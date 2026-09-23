// Remembered sessions are verified by the server, never trusted from local storage.
export function returningUserRoute(state, hash = "") {
  const path = (hash || "#/").split("?")[0];
  return state.authed && ["#/", "#/login", "#/signup"].includes(path)
    ? state.onboarded ? "#/app/dashboard" : "#/onboarding"
    : null;
}

// No splash screen or cached private records: show the page frame during verification.
export function startupView() {
  return `<main class="content" aria-busy="true" aria-label="Loading account">
    <div aria-hidden="true" style="max-width:1280px;margin:auto">
      <div class="card" style="width:220px;height:28px;margin-bottom:24px"></div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:16px">
        ${Array.from({ length: 4 }, () => '<div class="card" style="height:112px"></div>').join("")}
      </div><div class="card" style="height:240px;margin-top:20px"></div>
    </div></main>`;
}
