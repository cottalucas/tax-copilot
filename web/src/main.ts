// Login, home queue and intake (SR-16, SR-28). Screens and states from DESIGN.md.
import { GoogleAuthProvider, onAuthStateChanged, signInWithCredential, signInWithPopup, signOut, type User } from "firebase/auth";
import { addDoc, collection, doc, getDoc, getDocs, query, serverTimestamp, where } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { getBlob, ref, uploadBytes } from "firebase/storage";
import type { Flag } from "../../rules/types.js";
import type { ExtractedReturn, Source } from "../../src/schema/extraction.js";
import { pendingExtraction, runBatch } from "./batch.js";
import { auth, db, functions, storage } from "./firebase.js";
import { checkFiles, hasValidHeader, storageNames, taxYearChoices, validateName, type DocumentType } from "./intake.js";
import { groupQueue, toQueueClient, type QueueClient } from "./queue.js";
import { buildReview } from "./review.js";

const app = document.querySelector<HTMLDivElement>("#app")!;

// Emulator test builds only (VITE_USE_EMULATORS, replaced at build time, so production bundles drop
// this): sign in through the Auth emulator without Google's popup.
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

/** The callable functions' errors carry a message for her; anything else gets a generic one. */
function callableMessage(err: unknown): string {
  const e = err as { code?: string; message?: string };
  // The client library appends the HTTP status ("[500]"); she does not need it.
  return e.code?.startsWith("functions/") && e.message ? e.message.replace(/\s*\[\d{3}\]$/, "") : "Reading the documents failed. Try again.";
}

const extractCall = httpsCallable<{ clientId: string }, { ok: true; files: number }>(functions, "extract", { timeout: 70_000 });

/** Asks the extract function to read one client's documents (server side, Vertex EU). */
async function extractClient(clientId: string): Promise<void> {
  try {
    await extractCall({ clientId });
  } catch (err) {
    throw new Error(callableMessage(err), { cause: err });
  }
}

/**
 * New client and intake (SR-28): she names the client, picks the tax year and adds PDFs, JPGs or
 * PNGs. The client record comes first, then the files go to her folder in the Zurich bucket, then
 * the extract function reads them. A retry never creates the client or uploads a file twice.
 */
function renderIntake(user: User) {
  const main = renderQueueShell(user);
  const form = el("form", { class: "panel intake", "aria-labelledby": "intake-title", novalidate: "" });
  form.append(el("h2", { id: "intake-title" }, "New client"));
  const nameLabel = el("label", { for: "client-name" }, "Client name");
  const name = el("input", { id: "client-name", name: "client-name", type: "text", maxlength: "80", autocomplete: "off" }) as HTMLInputElement;
  const yearLabel = el("label", { for: "tax-year" }, "Tax year");
  const year = el("select", { id: "tax-year" }) as HTMLSelectElement;
  // She states the tax year. The app never guesses it.
  year.append(el("option", { value: "" }, "Choose"), ...taxYearChoices(new Date()).map((y) => el("option", { value: String(y) }, String(y))));
  const drop = el("div", { class: "drop", id: "drop" });
  drop.append(el("p", {}, "Drop the client's documents here, or choose them. PDF, JPG or PNG, scans and photos too."));
  const fileLabel = el("label", { for: "client-files" }, "Choose documents");
  const input = el("input", { id: "client-files", type: "file", multiple: "", accept: "application/pdf,image/jpeg,image/png,.pdf,.jpg,.jpeg,.png" }) as HTMLInputElement;
  drop.append(fileLabel, input);
  const list = el("ul", { class: "files", "aria-live": "polite" });
  const status = el("p", { class: "muted", role: "status" });
  const errors = el("div", { role: "alert", class: "error" });
  const submit = el("button", { type: "submit" }, "Create client");
  const cancel = el("button", { type: "button", class: "secondary" }, "Cancel");
  cancel.addEventListener("click", () => void loadQueue(user));
  const actions = el("div", { class: "actions" });
  actions.append(submit, cancel);
  form.append(nameLabel, name, yearLabel, year, drop, list, status, errors, actions);
  main.replaceChildren(form);

  let files: { file: File; type: DocumentType }[] = [];
  let clientId: string | undefined;
  // Each selected file is tracked by its position, so two files with the same name both upload.
  const uploaded = new Set<number>();
  // While an upload runs, the selection is locked: no new choice or drop can replace it.
  let busy = false;
  const showFiles = (picked: File[]) => {
    if (busy || clientId) return;
    const { accepted, rejected } = checkFiles(picked);
    files = accepted;
    uploaded.clear();
    list.replaceChildren(...accepted.map((f) => el("li", {}, f.file.name)));
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
    const taxYear = Number(year.value);
    if (!taxYear) return void errors.replaceChildren(el("p", {}, "Choose the tax year."));
    if (files.length === 0) return void errors.replaceChildren(el("p", {}, "Add at least one document."));
    // Lock first, then check and upload one fixed snapshot of the selection.
    busy = true;
    for (const c of [input, submit, name, year]) c.setAttribute("disabled", "");
    const selection = [...files];
    const invalid: string[] = [];
    for (const f of selection) if (!(await hasValidHeader(f.file, f.type))) invalid.push(`${f.file.name}: not a valid ${f.type === "application/pdf" ? "PDF" : "image"} file.`);
    if (invalid.length) {
      busy = false;
      for (const c of [input, submit, name, year]) c.removeAttribute("disabled");
      return void errors.replaceChildren(...invalid.map((m) => el("p", {}, m)));
    }
    errors.replaceChildren();
    const names = storageNames(selection.map((f) => f.file.name));
    try {
      status.textContent = "Saving the client";
      clientId ??= (
        await addDoc(collection(db, "clients"), {
          ownerUid: user.uid,
          displayName: checked.name,
          status: "documents_in",
          flagCount: 0,
          fileCount: selection.length,
          taxYear,
          createdAt: serverTimestamp(),
        })
      ).id;
      for (const [i, f] of selection.entries()) {
        if (uploaded.has(i)) continue;
        status.textContent = `Uploading ${i + 1} of ${selection.length}`;
        await uploadBytes(ref(storage, `users/${user.uid}/clients/${clientId}/${names[i]}`), f.file, { contentType: f.type });
        uploaded.add(i);
      }
      status.textContent = "Reading the documents";
      try {
        await extractClient(clientId);
        await loadQueue(user, `${checked.name}: documents read.`);
      } catch (err) {
        // The client and files are saved; Extract all on the queue retries the reading.
        await loadQueue(user, `${checked.name}: documents uploaded. ${(err as Error).message} Use Extract all to retry.`);
      }
    } catch (err) {
      status.textContent = uploaded.size ? `${uploaded.size} of ${selection.length} files uploaded.` : "";
      errors.replaceChildren(el("p", {}, `${(err as Error).message || "Something went wrong."} Try again: files already uploaded are not uploaded twice.`));
      submit.removeAttribute("disabled");
      submit.textContent = "Try again";
    } finally {
      busy = false;
      input.removeAttribute("disabled");
    }
  });
  name.focus();
}

/** Extract all (SR-18): the server reads the documents of every waiting client. */
function extractAllButton(pending: QueueClient[], user: User, status: HTMLElement, errors: HTMLElement) {
  const b = el("button", { type: "button", class: "secondary" }, `Extract all (${pending.length})`);
  b.addEventListener("click", async () => {
    b.setAttribute("disabled", "");
    errors.replaceChildren();
    const outcome = await runBatch(pending, extractClient, (m) => (status.textContent = m));
    if (outcome.failed.length === 0) return void (await loadQueue(user, `Documents read for ${outcome.done.length} of ${pending.length} clients.`));
    status.textContent = `Documents read for ${outcome.done.length} of ${pending.length} clients.`;
    errors.replaceChildren(...outcome.failed.map((f) => el("p", {}, `${f.name}: ${f.reason}`)));
    const again = el("button", { type: "button", class: "secondary" }, "Refresh the queue");
    again.addEventListener("click", () => void loadQueue(user));
    errors.append(again);
  });
  return b;
}

const approveCall = httpsCallable<{ clientId: string }, { ok: true }>(functions, "approveReturn");

/** Opens a document at its source page. The file comes through Storage with her own sign-in: no shareable link. */
async function openSource(user: User, clientId: string, source: Source, status: HTMLElement) {
  // Open the tab first, while the click still counts as hers, then load the file into it.
  const tab = window.open("", "_blank");
  try {
    const blob = await getBlob(ref(storage, `users/${user.uid}/clients/${clientId}/${source.file}`));
    const url = URL.createObjectURL(blob);
    const target = blob.type === "application/pdf" ? `${url}#page=${source.page}` : url;
    if (tab) tab.location.href = target;
    else window.location.assign(target);
  } catch {
    tab?.close();
    status.textContent = `Could not open ${source.file}. It may have been deleted after 28 days.`;
  }
}

function sourceButton(user: User, clientId: string, source: Source, status: HTMLElement) {
  const b = el("button", { type: "button", class: "link" }, `${source.file}, page ${source.page}`);
  b.addEventListener("click", () => void openSource(user, clientId, source, status));
  return b;
}

/** Review (SR-20): flags first, then key totals, then changes from last year. Approve sets Ready to fill. */
async function renderReview(user: User, clientId: string) {
  const main = renderQueueShell(user);
  const loading = el("section", { "aria-busy": "true", "aria-label": "Return" });
  loading.append(el("p", { class: "muted" }, "Loading the return"));
  for (let i = 0; i < 3; i++) loading.append(el("div", { class: "skeleton" }));
  main.replaceChildren(loading);
  const back = () => {
    const b = el("button", { type: "button", class: "secondary" }, "Back to clients");
    b.addEventListener("click", () => void loadQueue(user));
    return b;
  };
  let client: Record<string, unknown> | undefined;
  let values: { data: ExtractedReturn; flags?: Flag[] } | undefined;
  try {
    client = (await getDoc(doc(db, "clients", clientId))).data();
    const snap = await getDoc(doc(db, "clients", clientId, "extraction", "current"));
    values = snap.exists() ? (snap.data() as { data: ExtractedReturn; flags?: Flag[] }) : undefined;
  } catch {
    const s = el("section", { role: "alert", class: "panel" });
    s.append(el("h2", {}, "Could not load this return."));
    const retry = el("button", { type: "button" }, "Retry");
    retry.addEventListener("click", () => void renderReview(user, clientId));
    s.append(retry, back());
    return void main.replaceChildren(s);
  }
  const name = String(client?.displayName ?? "Client");
  const wrap = el("div", { class: "review" });
  const head = el("section", { "aria-labelledby": "review-title" });
  head.append(el("h2", { id: "review-title", tabindex: "-1" }, `${name}, tax year ${String(client?.taxYear ?? "")}`));
  const status = el("p", { class: "muted", role: "status" });
  const errors = el("div", { role: "alert", class: "error" });
  wrap.append(head);
  if (!values) {
    head.append(el("p", {}, "The documents have not been read yet. Use Extract all on the queue."), back());
    return void main.replaceChildren(wrap);
  }
  const review = buildReview(values.data, values.flags ?? []);

  const flags = el("section", { "aria-labelledby": "flags-title" });
  flags.append(el("h2", { id: "flags-title" }, `Flags (${review.flags.length})`));
  if (review.flags.length === 0) flags.append(el("p", {}, "No flags. Check totals and approve."));
  for (const f of review.flags) {
    const card = el("article", { class: `flag-card ${f.severity}` });
    card.append(el("span", { class: `badge ${f.severity === "critical" ? "critical" : "warning"}` }, f.severity === "critical" ? "Critical" : "Warning"));
    card.append(el("p", {}, f.reason));
    if (f.source) card.append(sourceButton(user, clientId, f.source, status));
    flags.append(card);
  }

  const totals = el("section", { "aria-labelledby": "totals-title" });
  totals.append(el("h2", { id: "totals-title" }, "Key totals"));
  const table = el("table");
  const headRow = el("tr");
  for (const h of ["Item", "Amount", "Source"]) headRow.append(el("th", { scope: "col" }, h));
  table.append(el("thead"), el("tbody"));
  table.tHead!.append(headRow);
  for (const r of review.totals) {
    const row = el("tr");
    row.append(el("td", {}, r.label), el("td", {}, r.value));
    const src = el("td");
    if (r.source) src.append(sourceButton(user, clientId, r.source, status));
    row.append(src);
    table.tBodies[0]!.append(row);
  }
  totals.append(table);
  if (review.notFound.length) totals.append(el("p", { class: "muted" }, `Not found in the documents: ${review.notFound.join(", ")}.`));

  const changes = el("section", { "aria-labelledby": "changes-title" });
  changes.append(el("h2", { id: "changes-title" }, "Changes from last year"));
  changes.append(el("p", { class: "muted" }, "No previous year return on file yet."));

  const actions = el("div", { class: "actions" });
  if (client?.status === "needs_review" || client?.status === "ready_to_fill") {
    const approve = el("button", { type: "button" }, client.status === "ready_to_fill" ? "Approve again" : "Approve");
    approve.addEventListener("click", async () => {
      approve.setAttribute("disabled", "");
      errors.replaceChildren();
      try {
        await approveCall({ clientId });
        await loadQueue(user, `${name}: approved, ready to fill.`);
      } catch (err) {
        errors.replaceChildren(el("p", {}, callableMessage(err)));
        approve.removeAttribute("disabled");
      }
    });
    actions.append(approve);
  }
  actions.append(back());
  wrap.append(flags, totals, changes, status, errors, actions);
  main.replaceChildren(wrap);
  document.getElementById("review-title")?.focus();
}

function renderQueue(main: HTMLElement, clients: QueueClient[], user: User, notice?: string) {
  const wrap = el("section", { "aria-label": "Client queue" });
  const bar = el("div", { class: "actions" });
  bar.append(newClientButton(user));
  const status = el("p", { class: "muted", role: "status" }, notice ?? "");
  const errors = el("div", { role: "alert", class: "error" });
  const pending = pendingExtraction(clients);
  if (pending.length > 0) bar.append(extractAllButton(pending, user, status, errors));
  wrap.append(bar, status, errors);
  for (const group of groupQueue(clients)) {
    const g = el("section", { class: "group", "aria-labelledby": `g-${group.status}` });
    g.append(el("h2", { id: `g-${group.status}` }, `${group.label} (${group.clients.length})`));
    const table = el("table");
    const head = el("tr");
    for (const h of ["Client", "Status", "Flags", "Data"]) head.append(el("th", { scope: "col" }, h));
    table.append(el("thead"), el("tbody"));
    table.tHead!.append(head);
    for (const c of group.clients) {
      const row = el("tr", { "data-client": c.id });
      const nameCell = el("td");
      if (c.extracted) {
        // Opens the review screen (SR-20).
        const open = el("button", { type: "button", class: "link" }, c.displayName);
        open.addEventListener("click", () => void renderReview(user, c.id));
        nameCell.append(open);
      } else nameCell.textContent = c.displayName;
      row.append(nameCell);
      const status = el("td");
      status.append(el("span", { class: "badge" }, group.label));
      row.append(status);
      const flags = el("td");
      flags.append(c.flagCount > 0 ? el("span", { class: "badge flag", "aria-label": `${c.flagCount} flags` }, String(c.flagCount)) : el("span", { class: "muted" }, "0"));
      row.append(flags);
      row.append(el("td", { class: c.extracted ? "" : "muted" }, c.extracted ? "Extracted" : "Not yet"));
      table.tBodies[0]!.append(row);
    }
    g.append(table);
    wrap.append(g);
  }
  main.replaceChildren(wrap);
}

async function loadQueue(user: User, notice?: string) {
  const main = renderQueueShell(user);
  renderLoading(main);
  try {
    const snap = await getDocs(query(collection(db, "clients"), where("ownerUid", "==", user.uid)));
    const clients = snap.docs.map((d) => toQueueClient(d.id, d.data())).filter((c): c is QueueClient => !!c);
    if (clients.length === 0) renderEmpty(main, user);
    else renderQueue(main, clients, user, notice);
  } catch {
    renderError(main, user);
  }
}

onAuthStateChanged(auth, (user) => {
  if (user) void loadQueue(user);
  else renderLogin();
});
