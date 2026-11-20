// Login and home queue (SR-16). Screens and states from DESIGN.md.
import { GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut, type User } from "firebase/auth";
import { collection, getDocs, query, where } from "firebase/firestore";
import { auth, db } from "./firebase.js";
import { groupQueue, toQueueClient, type QueueClient } from "./queue.js";

const app = document.querySelector<HTMLDivElement>("#app")!;

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

function renderEmpty(main: HTMLElement) {
  const s = el("section", { class: "empty", "aria-label": "Client queue" });
  s.append(el("h2", {}, "No clients yet"));
  s.append(el("p", {}, "Clients you add show up here, flagged ones first."));
  main.replaceChildren(s);
}

function renderQueue(main: HTMLElement, clients: QueueClient[]) {
  const wrap = el("section", { "aria-label": "Client queue" });
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
    if (clients.length === 0) renderEmpty(main);
    else renderQueue(main, clients);
  } catch {
    renderError(main, user);
  }
}

onAuthStateChanged(auth, (user) => {
  if (user) void loadQueue(user);
  else renderLogin();
});
