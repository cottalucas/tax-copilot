// Login and home queue (SR-16). Screens and states from DESIGN.md.
import { GoogleAuthProvider, onAuthStateChanged, reauthenticateWithPopup, signInWithCredential, signInWithPopup, signOut, type User } from "firebase/auth";
import { addDoc, collection, getDocs, query, serverTimestamp, where } from "firebase/firestore";
import { createFolder, DRIVE_SCOPE, uploadFile } from "./drive.js";
import { auth, db } from "./firebase.js";
import { checkFiles, folderName, hasPdfHeader, validateName } from "./intake.js";
import { groupQueue, toQueueClient, type QueueClient } from "./queue.js";

const app = document.querySelector<HTMLDivElement>("#app")!;

// Emulator test builds only (VITE_USE_EMULATORS, replaced at build time, so production bundles drop
// this): sign in through the Auth emulator without Google's popup, and use a test Drive token.
const testMode = import.meta.env.VITE_USE_EMULATORS === "true";
if (testMode) {
  (window as unknown as { __tcSignIn: (email: string) => Promise<unknown> }).__tcSignIn = (email) =>
    signInWithCredential(auth, GoogleAuthProvider.credential(JSON.stringify({ sub: email, email, email_verified: true })));
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, string> = {}, text?: string) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  if (text !== undefined) node.textContent = text;
  return node;
}

function header(user?: User) {
  const h = el("header");
  h.append(el("h1", {}, "Tax Copilot"));
  if (user) {
    const out = el("button", { type: "button", class: "secondary" }, "Sign out");
    out.addEventListener("click", () => void signOut(auth));
    h.append(out);
  }
  return h;
}

function renderLogin(error?: string) {
  app.replaceChildren(header());
  const main = el("main", { id: "main" });
  const panel = el("section", { class: "panel", "aria-labelledby": "login-title" });
  panel.append(el("h2", { id: "login-title" }, "Sign in"));
  panel.append(el("p", {}, "Use your Google account to open your client queue."));
  const button = el("button", { type: "button" }, "Sign in with Google");
  button.addEventListener("click", async () => {
    button.setAttribute("disabled", "");
    button.textContent = "Signing in";
    try {
      await signInWithPopup(auth, new GoogleAuthProvider());
    } catch (err) {
      renderLogin(`Sign in failed. Try again. (${(err as { code?: string }).code ?? "unknown error"})`);
    }
  });
  panel.append(button);
  if (error) panel.append(el("p", { role: "alert", class: "error" }, error));
  main.append(panel);
  app.append(main);
}

function renderQueueShell(user: User) {
  app.replaceChildren(header(user));
  const main = el("main", { id: "main" });
  app.append(main);
  return main;
}

function renderLoading(main: HTMLElement) {
  const s = el("section", { "aria-busy": "true", "aria-label": "Client queue" });
  s.append(el("p", { class: "muted" }, "Loading clients"));
  for (let i = 0; i < 3; i++) s.append(el("div", { class: "skeleton" }));
  main.replaceChildren(s);
}

function renderError(main: HTMLElement, user: User) {
  const s = el("section", { role: "alert", class: "panel" });
  s.append(el("h2", {}, "Could not load clients."));
  const retry = el("button", { type: "button" }, "Retry");
  retry.addEventListener("click", () => void loadQueue(user));
  s.append(retry);
  main.replaceChildren(s);
}

function newClientButton(user: User) {
  const b = el("button", { type: "button" }, "New client");
  b.addEventListener("click", () => renderIntake(user));
  return b;
}

function renderEmpty(main: HTMLElement, user: User) {
  const s = el("section", { class: "empty", "aria-label": "Client queue" });
  s.append(el("h2", {}, "No clients yet"));
  s.append(el("p", {}, "Clients you add show up here, flagged ones first."));
  s.append(newClientButton(user));
  main.replaceChildren(s);
}

/** A Google OAuth token for Drive (drive.file: only files this app creates), from her own account. */
async function driveToken(user: User): Promise<string> {
  if (testMode) return "emulator-drive-token";
  const provider = new GoogleAuthProvider();
  provider.addScope(DRIVE_SCOPE);
  if (user.email) provider.setCustomParameters({ login_hint: user.email });
  // Re-authenticate the signed in user: Firebase rejects a different Google account
  // (auth/user-mismatch), so files can only go to her own Drive.
  const result = await reauthenticateWithPopup(user, provider);
  const token = GoogleAuthProvider.credentialFromResult(result)?.accessToken;
  if (!token) throw new Error("Drive access needed.");
  return token;
}

/** New client and intake (SR-17): files go straight to a new folder in her Drive, nothing else stores them. */
function renderIntake(user: User) {
  const main = renderQueueShell(user);
  const form = el("form", { class: "panel intake", "aria-labelledby": "intake-title", novalidate: "" });
  form.append(el("h2", { id: "intake-title" }, "New client"));
  const nameLabel = el("label", { for: "client-name" }, "Client name");
  const name = el("input", { id: "client-name", name: "client-name", type: "text", maxlength: "80", autocomplete: "off" }) as HTMLInputElement;
  const drop = el("div", { class: "drop", id: "drop" });
  drop.append(el("p", {}, "Drop the client's PDFs here, or choose them."));
  const fileLabel = el("label", { for: "client-files" }, "Choose PDFs");
  const input = el("input", { id: "client-files", type: "file", multiple: "", accept: "application/pdf,.pdf" }) as HTMLInputElement;
  drop.append(fileLabel, input);
  const list = el("ul", { class: "files", "aria-live": "polite" });
  const status = el("p", { class: "muted", role: "status" });
  const errors = el("div", { role: "alert", class: "error" });
  const submit = el("button", { type: "submit" }, "Create client");
  const cancel = el("button", { type: "button", class: "secondary" }, "Cancel");
  cancel.addEventListener("click", () => void loadQueue(user));
  const actions = el("div", { class: "actions" });
  actions.append(submit, cancel);
  form.append(nameLabel, name, drop, list, status, errors, actions);
  main.replaceChildren(form);

  let files: File[] = [];
  let folderId: string | undefined;
  // Each selected file is tracked by its position, so two files with the same name both upload.
  const uploaded = new Set<number>();
  // While an upload runs, the selection is locked: no new choice or drop can replace it.
  let busy = false;
  const showFiles = (picked: File[]) => {
    if (busy) return;
    const { accepted, rejected } = checkFiles(picked);
    files = accepted;
    uploaded.clear();
    folderId = undefined;
    list.replaceChildren(...accepted.map((f) => el("li", {}, f.name)));
    errors.replaceChildren(...rejected.map((r) => el("p", {}, r)));
  };
  input.addEventListener("change", () => showFiles([...(input.files ?? [])]));
  drop.addEventListener("dragover", (e) => {
    e.preventDefault();
    drop.classList.add("over");
  });
  drop.addEventListener("dragleave", () => drop.classList.remove("over"));
  drop.addEventListener("drop", (e) => {
    e.preventDefault();
    drop.classList.remove("over");
    showFiles([...(e.dataTransfer?.files ?? [])]);
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const checked = validateName(name.value);
    if (checked.error || !checked.name) return void errors.replaceChildren(el("p", {}, checked.error ?? "Enter a client name."));
    if (files.length === 0) return void errors.replaceChildren(el("p", {}, "Add at least one PDF."));
    // Lock first, then check and upload one fixed snapshot of the selection.
    busy = true;
    input.setAttribute("disabled", "");
    submit.setAttribute("disabled", "");
    const selection = [...files];
    const notPdf: string[] = [];
    for (const f of selection) if (!(await hasPdfHeader(f))) notPdf.push(`${f.name}: not a PDF file.`);
    if (notPdf.length) {
      busy = false;
      input.removeAttribute("disabled");
      submit.removeAttribute("disabled");
      return void errors.replaceChildren(...notPdf.map((m) => el("p", {}, m)));
    }
    errors.replaceChildren();
    try {
      status.textContent = "Connecting to your Google Drive";
      const token = await driveToken(user);
      folderId ??= await createFolder(token, folderName(checked.name, new Date().getFullYear()));
      for (const [i, f] of selection.entries()) {
        if (uploaded.has(i)) continue;
        status.textContent = `Uploading ${i + 1} of ${selection.length} to your Drive`;
        await uploadFile(token, folderId, f);
        uploaded.add(i);
      }
      status.textContent = "Saving the client";
      await addDoc(collection(db, "clients"), {
        ownerUid: user.uid,
        displayName: checked.name,
        status: "documents_in",
        flagCount: 0,
        driveFolderId: folderId,
        fileCount: selection.length,
        createdAt: serverTimestamp(),
      });
      await loadQueue(user);
    } catch (err) {
      const code = (err as { code?: string }).code;
      const msg = code === "auth/user-mismatch" ? "Use the same Google account you signed in with." : (err as Error).message || "Something went wrong.";
      status.textContent = uploaded.size ? `${uploaded.size} of ${selection.length} files are in your Drive.` : "";
      errors.replaceChildren(el("p", {}, `${msg} Try again: files already in your Drive are not uploaded twice.`));
      submit.removeAttribute("disabled");
      submit.textContent = "Try again";
    } finally {
      busy = false;
      input.removeAttribute("disabled");
    }
  });
  name.focus();
}

function renderQueue(main: HTMLElement, clients: QueueClient[], user: User) {
  const wrap = el("section", { "aria-label": "Client queue" });
  const bar = el("div", { class: "actions" });
  bar.append(newClientButton(user));
  wrap.append(bar);
  for (const group of groupQueue(clients)) {
    const g = el("section", { class: "group", "aria-labelledby": `g-${group.status}` });
    g.append(el("h2", { id: `g-${group.status}` }, `${group.label} (${group.clients.length})`));
    const table = el("table");
    const head = el("tr");
    for (const h of ["Client", "Status", "Flags"]) head.append(el("th", { scope: "col" }, h));
    table.append(el("thead"), el("tbody"));
    table.tHead!.append(head);
    for (const c of group.clients) {
      const row = el("tr", { "data-client": c.id });
      row.append(el("td", {}, c.displayName));
      const status = el("td");
      status.append(el("span", { class: "badge" }, group.label));
      row.append(status);
      const flags = el("td");
      flags.append(c.flagCount > 0 ? el("span", { class: "badge flag", "aria-label": `${c.flagCount} flags` }, String(c.flagCount)) : el("span", { class: "muted" }, "0"));
      row.append(flags);
      table.tBodies[0]!.append(row);
    }
    g.append(table);
    wrap.append(g);
  }
  main.replaceChildren(wrap);
}

async function loadQueue(user: User) {
  const main = renderQueueShell(user);
  renderLoading(main);
  try {
    const snap = await getDocs(query(collection(db, "clients"), where("ownerUid", "==", user.uid)));
    const clients = snap.docs.map((d) => toQueueClient(d.id, d.data())).filter((c): c is QueueClient => !!c);
    if (clients.length === 0) renderEmpty(main, user);
    else renderQueue(main, clients, user);
  } catch {
    renderError(main, user);
  }
}

onAuthStateChanged(auth, (user) => {
  if (user) void loadQueue(user);
  else renderLogin();
});
