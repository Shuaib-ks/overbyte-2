/* OverByte — account authentication and business onboarding. */
import { icon, logoMark, wordmark } from "../icons.js";
import { actions, selectors, store } from "../store.js";
import { toast } from "../ui.js";
import { esc } from "../util.js";

function shellAuth(formHtml) {
  return `<div class="auth-wrap">
    <div class="auth-left">
      <a href="#/" class="auth-brand-row">${logoMark(30)}${wordmark()}</a>
      ${formHtml}
    </div>
    <div class="auth-right"><div style="position:relative">
      <div class="auth-stat-card">
        <div class="asc-row">${icon("sparkles", 15)}<span style="font-size:12px;letter-spacing:.08em;color:var(--primary-strong);font-weight:650">INVENTORY INTELLIGENCE</span></div>
        <div style="margin-top:12px;font-size:18px;font-weight:600">See surplus before it becomes waste.</div>
        <p class="t-sm muted" style="margin-top:10px;line-height:1.7">Track your stock, expiry dates and consumption. Get explainable recommendations based on your business’s actual inventory.</p>
      </div>
      <div class="auth-stat-card">
        <div class="asc-row">${icon("bag", 15)}<span style="font-size:12px;letter-spacing:.08em;color:var(--info);font-weight:650">A CONNECTED MARKETPLACE</span></div>
        <div style="margin-top:12px;font-size:14px;font-weight:600">Your surplus. Another business’s next order.</div>
        <p class="t-sm muted" style="margin-top:8px;line-height:1.7">Review and publish a listing, discover available supply, and coordinate pickup with other businesses.</p>
      </div>
      <div class="auth-stat-card">
        <div class="asc-row">${icon("shieldCheck", 15)}<span style="font-size:12px;letter-spacing:.08em;color:var(--success);font-weight:650">YOUR BUSINESS WORKSPACE</span></div>
        <div style="margin-top:12px;font-size:14px;font-weight:600">Real records. A fresh start.</div>
        <p class="t-sm muted" style="margin-top:8px;line-height:1.7">Your account starts with an empty inventory. Your business data and orders stay saved between visits.</p>
      </div>
    </div></div>
  </div>`;
}

const errorBox = () => `<p data-form-error role="alert" tabindex="-1" class="t-sm" style="color:var(--danger);margin:0" hidden></p>`;

async function submitForm(form, operation) {
  if (form.dataset.pending) return;
  const button = form.querySelector('[type="submit"]');
  const error = form.querySelector("[data-form-error]");
  const label = button.innerHTML;
  form.dataset.pending = "true";
  button.disabled = true;
  button.textContent = "Please wait…";
  error.hidden = true;
  try { await operation(); }
  catch (cause) {
    error.textContent = cause?.message || "Something went wrong. Please try again.";
    error.hidden = false;
    error.focus();
  } finally {
    delete form.dataset.pending;
    button.disabled = false;
    button.innerHTML = label;
  }
}

export function login() {
  return shellAuth(`<div class="auth-panel">
    <h1>Welcome back to OverByte</h1>
    <p class="sub">Sign in to your business workspace.</p>
    <form class="auth-form" id="login-form">
      <div class="field"><label for="email">Email</label><input class="input" id="email" name="email" type="email" placeholder="you@business.in" autocomplete="username" required maxlength="254"/></div>
      <div class="field"><label for="password">Password</label><input class="input" id="password" name="password" type="password" autocomplete="current-password" required maxlength="128"/></div>
      ${errorBox()}
      <button class="btn btn-primary btn-lg btn-block" type="submit">Sign In ${icon("arrowRight", 15)}</button>
    </form>
    <div class="auth-foot">New to OverByte? <a href="#/signup">Create account</a></div>
  </div>`);
}

export function loginInit(root) {
  root.querySelector("#login-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    submitForm(form, async () => {
      await actions.login({ email: form.elements.email.value.trim(), password: form.elements.password.value });
      location.hash = store.get().onboarded ? "#/app/dashboard" : "#/onboarding";
      toast("Welcome back", `Signed in to ${esc(selectors.biz()?.name || "your workspace")}.`, "success");
    });
  });
}

const TYPES = [["Restaurant", "chefHat"], ["Grocery Store", "basket"], ["Bakery", "layers"], ["Hotel", "building"], ["Café", "coffee"], ["Distributor", "truck"], ["Other", "tag"]];

export function signup() {
  return shellAuth(`<div class="auth-panel">
    <h1>Create your business account</h1>
    <p class="sub">For restaurants, grocers, bakeries, hotels and food distributors.</p>
    <form class="auth-form" id="signup-form">
      <div class="field"><label for="biz">Business name</label><input class="input" id="biz" name="business" autocomplete="organization" placeholder="e.g. Coastal Table" required maxlength="120"/></div>
      <div class="field"><label for="type">Business type</label><select class="select" id="type" name="type">${TYPES.map(([type]) => `<option>${type}</option>`).join("")}</select></div>
      <div class="field"><label for="loc">Location</label><input class="input" id="loc" name="location" placeholder="Area, city" required maxlength="240"/></div>
      <div class="field"><label for="email">Work email</label><input class="input" id="email" name="email" type="email" autocomplete="username" placeholder="you@business.in" required maxlength="254"/></div>
      <div class="field"><label for="password">Password</label><input class="input" id="password" name="password" type="password" autocomplete="new-password" placeholder="At least 8 characters" minlength="8" maxlength="128" required/></div>
      ${errorBox()}
      <button class="btn btn-primary btn-lg btn-block" type="submit">Create Account ${icon("arrowRight", 15)}</button>
    </form>
    <div class="auth-foot">Already have an account? <a href="#/login">Sign in</a></div>
  </div>`);
}

export function signupInit(root) {
  root.querySelector("#signup-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    submitForm(form, async () => {
      await actions.signup({ name: form.elements.business.value.trim(), type: form.elements.type.value, loc: form.elements.location.value.trim(), email: form.elements.email.value.trim(), password: form.elements.password.value });
      location.hash = "#/onboarding";
    });
  });
}

export function onboarding() {
  const chosen = selectors.biz()?.type || "Restaurant";
  return shellAuth(`<div class="auth-panel" style="max-width:520px">
    <div class="ai-chip" style="margin-bottom:18px">${icon("sparkles", 11)}STEP 1 OF 1 · PROFILE</div>
    <h1>What does your business do?</h1>
    <p class="sub">Set up ${esc(selectors.biz()?.name || "your business")} and start tracking your own inventory.</p>
    <div class="type-grid" id="type-grid">${TYPES.map(([type, symbol]) => `<button type="button" class="type-card ${type === chosen ? "selected" : ""}" data-type="${type}" aria-pressed="${type === chosen}">${icon(symbol, 20)}<span>${type}</span></button>`).join("")}</div>
    <form class="auth-form" id="onb-form">
      ${errorBox()}
      <button class="btn btn-primary btn-lg btn-block" type="submit">Open my workspace ${icon("arrowRight", 15)}</button>
      <p class="hint center">You can change this later in Settings.</p>
    </form>
  </div>`);
}

export function onboardingInit(root) {
  let chosen = selectors.biz()?.type || "Restaurant";
  root.querySelectorAll(".type-card").forEach((button) => button.addEventListener("click", () => {
    root.querySelectorAll(".type-card").forEach((item) => { item.classList.remove("selected"); item.setAttribute("aria-pressed", "false"); });
    button.classList.add("selected");
    button.setAttribute("aria-pressed", "true");
    chosen = button.dataset.type;
  }));
  root.querySelector("#onb-form").addEventListener("submit", (event) => {
    event.preventDefault();
    submitForm(event.currentTarget, async () => {
      await actions.completeOnboarding({ type: chosen });
      location.hash = "#/app/dashboard";
      toast("Workspace ready", "Add your first inventory item to start tracking stock and expiry.", "success");
    });
  });
}
