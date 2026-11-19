// App shell. Login (SR-16) and the home queue replace this once Firebase Auth is configured.
const app = document.querySelector<HTMLDivElement>("#app");

if (app) {
  app.innerHTML = `
    <a class="skip" href="#queue">Skip to client queue</a>
    <header>
      <h1>Tax Copilot</h1>
      <button type="button" disabled title="Sign in arrives with SR-16">Sign in</button>
    </header>
    <main id="queue" tabindex="-1">
      <section class="empty" aria-label="Client queue">
        <h2>No clients yet</h2>
        <p>Clients you add show up here, flagged ones first.</p>
      </section>
    </main>
  `;
}
