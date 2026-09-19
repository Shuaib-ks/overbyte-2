/* OverByte — persisted business settings and sensor readings. */
import { icon } from "../icons.js";
import { selectors, actions, store } from "../store.js";
import { pageHead, toast } from "../ui.js";
import { esc } from "../util.js";

const view = { tab: "business" };
const TABS = [["business", "Business profile", "building"], ["ai", "AI intelligence", "sparkles"], ["notifications", "Notifications", "bell"], ["sensors", "IoT & sensors", "cpu"]];
const TYPES = ["Restaurant", "Grocery Store", "Bakery", "Hotel", "Café", "Distributor", "Other"];
const formError = () => `<p data-form-error class="t-sm" role="alert" tabindex="-1" style="color:var(--danger)" hidden></p>`;

function toggle(id, on, label, hint = "") {
  return `<div class="row-between gap-20" style="padding:14px 0;border-bottom:1px solid var(--border)">
    <div><div class="t-sm" style="font-weight:570">${label}</div>${hint ? `<div class="t-xs muted" style="margin-top:3px">${hint}</div>` : ""}</div>
    <button type="button" class="toggle ${on ? "on" : ""}" data-toggle="${id}" aria-pressed="${!!on}" aria-label="Toggle ${label}"></button>
  </div>`;
}

function businessPanel() {
  const biz = selectors.biz() || {};
  return `<div class="col gap-20">
    <div class="card card-pad"><div class="card-title">Business profile</div><p class="t-xs muted" style="margin-top:4px">Your business name and approximate pickup location appear on your marketplace listings.</p>
      <form id="profile-form" class="col gap-16" style="margin-top:20px">
        <div class="row gap-16 wrap"><div class="field flex-1"><label for="profile-name">Business name</label><input class="input" id="profile-name" name="business" value="${esc(biz.name)}" required maxlength="120"></div><div class="field flex-1"><label for="profile-type">Business type</label><select class="select" id="profile-type" name="type">${TYPES.map((type) => `<option ${biz.type === type ? "selected" : ""}>${type}</option>`).join("")}</select></div></div>
        <div class="row gap-16 wrap"><div class="field flex-1"><label for="profile-location">Location</label><input class="input" id="profile-location" name="location" value="${esc(biz.loc)}" required maxlength="240"></div><div class="field flex-1"><label for="profile-owner">Primary contact</label><input class="input" id="profile-owner" name="owner" value="${esc(biz.owner)}" maxlength="120"></div></div>
        <div class="row gap-16 wrap"><div class="field flex-1"><label for="profile-email">Contact email</label><input class="input" type="email" id="profile-email" name="email" value="${esc(biz.email)}" maxlength="254"><span class="hint">Your sign-in email is ${esc(store.get().user?.email)}.</span></div><div class="field flex-1"><label for="profile-pickup">Pickup hours</label><input class="input" id="profile-pickup" name="pickup" placeholder="e.g. Monday–Saturday, 4–8 PM" value="${esc(biz.pickup)}" maxlength="200"></div></div>
        <div class="row gap-16 wrap"><div class="field flex-1"><label for="profile-lat">Approximate latitude (optional)</label><input class="input" id="profile-lat" name="latitude" type="number" min="-90" max="90" step="any" placeholder="e.g. 12.97" value="${esc(biz.lat ?? "")}"></div><div class="field flex-1"><label for="profile-lng">Approximate longitude (optional)</label><input class="input" id="profile-lng" name="longitude" type="number" min="-180" max="180" step="any" placeholder="e.g. 77.59" value="${esc(biz.lng ?? "")}"></div></div>
        <p class="hint">Set both coordinates to enable distance-based marketplace matching. Use the center of your area rather than a private address.</p>
        ${formError()}
        <div class="row" style="justify-content:flex-end"><button class="btn btn-primary" type="submit">${icon("check", 14)}Save profile</button></div>
      </form>
    </div>
    <div class="card card-pad"><div class="row-between"><div><div class="card-title">Business verification</div><p class="t-xs muted" style="margin-top:4px">Verification status is separate from creating an account.</p></div><span class="badge ${biz.verified ? "badge-safe" : "badge-neutral"}">${biz.verified ? "Verified" : "Not verified"}</span></div><div class="row gap-10" style="margin-top:16px;color:var(--text-secondary)">${icon("shieldCheck", 16)}<span class="t-sm">${biz.verified ? "This business has completed verification." : "Your business has not been independently verified. Confirm seller and food-handling details before arranging a pickup."}</span></div></div>
  </div>`;
}

function aiPanel() {
  const settings = store.get().settings || {};
  return `<div class="col gap-20">
    <div class="card ai-panel card-pad"><div class="row-between"><div><span class="ai-chip">${icon("sparkles", 11)}OVERBYTE AI</span><div class="card-title" style="margin-top:12px">Inventory intelligence</div></div><span class="badge badge-violet">RULES-BASED FORECASTS</span></div>
      ${toggle("autoAlerts", settings.autoAlerts, "Proactive surplus & shortage alerts", "Generate alerts from your inventory, expected demand and remaining shelf life.")}
      ${toggle("listingSuggestions", settings.listingSuggestions, "Generate listing suggestions", "Suggest quantity and price for at-risk stock. Publishing always requires your approval.")}
      ${toggle("priceOverrideConfirm", settings.priceOverrideConfirm, "Confirm suggested price overrides", "Review prices outside the suggested range before publishing.")}
      <div style="padding-top:16px"><div class="row-between"><div><label for="waste-target" class="t-sm" style="font-weight:570">Waste-risk alert threshold</label><div class="t-xs muted" style="margin-top:3px">Alert when estimated waste risk reaches <span id="threshold-value">${Number(settings.wasteTarget ?? 50)}%</span>.</div></div><span class="t-num" id="threshold-number" style="font-size:13px;color:var(--primary-strong)">${Number(settings.wasteTarget ?? 50)}%</span></div><input id="waste-target" class="range" type="range" min="5" max="80" step="1" value="${Number(settings.wasteTarget ?? 50)}" style="margin-top:16px"></div>
    </div>
    <div class="card card-pad"><div class="card-title">How your forecasts work</div><p class="t-sm secondary" style="margin-top:10px;line-height:1.65">Forecasts use your recorded inventory, expiry dates, expected demand and consumption history. They are explainable rules-based estimates, not predictions from a trained machine-learning model. Keep stock and consumption records up to date to make the signals useful.</p><div class="row gap-10 wrap" style="margin-top:16px"><span class="badge badge-violet">Your recorded data</span><span class="badge badge-info">Explainable estimates</span><span class="badge badge-safe">Seller approval required</span></div></div>
  </div>`;
}

function notificationPanel() {
  const settings = store.get().settings || {};
  return `<div class="card card-pad"><div class="card-title">Notification preferences</div><p class="t-xs muted" style="margin-top:4px">Choose which new events appear in your notification center. Existing notifications stay available.</p><div style="margin-top:14px">
    ${toggle("notifyAI", settings.notifyAI, "AI inventory alerts", "Surplus risk, expiry risk and shortage forecasts.")}
    ${toggle("notifyMarket", settings.notifyMarket, "Marketplace activity", "Matching listings and listing activity.")}
    ${toggle("notifyOrders", settings.notifyOrders, "Order and pickup updates", "Order confirmation and handover status.")}
    ${toggle("notifySensors", settings.notifySensors, "Sensor updates", "New readings received from your registered devices.")}
  </div></div>`;
}

function sensorsPanel() {
  const sensors = store.get().sensors || [];
  return `<div class="col gap-16"><div class="card ai-panel card-pad"><span class="ai-chip">${icon("cpu", 11)}INVENTORY SIGNALS</span><div class="card-title" style="margin-top:12px">Devices & readings</div><p class="t-xs muted" style="margin-top:6px;line-height:1.7">Register a device and record readings from your equipment. A saved reading does not establish a live hardware connection.</p></div>
    ${sensors.length ? sensors.map((sensor) => {
      const recordedAt = sensor.lastReadingAt ? new Date(sensor.lastReadingAt) : null;
      const hasReading = sensor.lastValue !== null && sensor.lastValue !== undefined && recordedAt && Number.isFinite(recordedAt.getTime());
      return `<article class="card card-pad"><div class="row gap-16 wrap"><span class="sensor-icon" style="background:var(--primary-dim);color:var(--primary-strong)">${icon(sensor.type === "Temperature" ? "thermometer" : "cpu", 19)}</span><div class="flex-1"><div class="row gap-8 wrap"><div class="t-sm" style="font-weight:590">${esc(sensor.name)}</div><span class="badge ${hasReading ? "badge-info" : "badge-neutral"}">${hasReading ? "Reading received" : "No readings"}</span></div><div class="t-xs muted" style="margin-top:4px">${esc(sensor.type)} · ${hasReading ? `Last reading ${esc(recordedAt.toLocaleString())}` : "Awaiting your first reading"}</div></div><div class="sensor-metric"><div class="sm-v">${hasReading ? `${esc(sensor.lastValue)} ${esc(sensor.unit)}` : "—"}</div><div class="sm-k">Last recorded value</div></div></div>
        <form data-reading-form="${esc(sensor.id)}" class="row gap-10 wrap" style="margin-top:18px"><div class="field flex-1"><label for="reading-${esc(sensor.id)}">New reading ${sensor.unit ? `(${esc(sensor.unit)})` : ""}</label><input class="input" id="reading-${esc(sensor.id)}" name="reading" type="number" step="any" required placeholder="Enter measured value"></div><button type="submit" class="btn btn-secondary" style="align-self:flex-end">Record reading</button><div style="width:100%">${formError()}</div></form>
      </article>`;
    }).join("") : `<div class="card card-pad"><div class="t-sm">No devices registered</div><div class="t-xs muted" style="margin-top:6px">Add a device below to start keeping a real reading history.</div></div>`}
    <div class="card card-pad"><div class="card-title">Register a device</div><form id="sensor-form" class="col gap-16" style="margin-top:18px"><div class="field"><label for="sensor-name">Device name</label><input class="input" id="sensor-name" name="deviceName" required maxlength="120" placeholder="e.g. Cold storage thermometer"></div><div class="row gap-16 wrap"><div class="field flex-1"><label for="sensor-type">Device type</label><select class="select" id="sensor-type" name="deviceType"><option>Temperature</option><option>Smart scale</option><option>Storage</option><option>Other</option></select></div><div class="field flex-1"><label for="sensor-unit">Unit</label><input class="input" id="sensor-unit" name="unit" required maxlength="20" value="°C" placeholder="e.g. °C or kg"></div></div>${formError()}<div class="row" style="justify-content:flex-end"><button type="submit" class="btn btn-primary">${icon("plus", 14)}Register device</button></div></form></div>
  </div>`;
}

function activePanel() {
  return view.tab === "ai" ? aiPanel() : view.tab === "notifications" ? notificationPanel() : view.tab === "sensors" ? sensorsPanel() : businessPanel();
}

export function render() {
  return `${pageHead("Settings", "Manage your business profile, intelligence preferences and recorded signals")}
    <div class="settings-layout"><aside class="settings-nav card" style="padding:8px">${TABS.map(([id, label, symbol]) => `<button type="button" class="${view.tab === id ? "active" : ""}" data-tab="${id}" aria-pressed="${view.tab === id}">${icon(symbol, 15)}<span style="margin-left:9px">${label}</span></button>`).join("")}</aside><section>${activePanel()}</section></div>`;
}

function redraw(root) {
  const content = root.closest(".content") || root;
  content.innerHTML = `<div class="page">${render()}</div>`;
  init(content);
}

async function saveForm(form, operation) {
  if (form.dataset.pending) return;
  form.dataset.pending = "true";
  const button = form.querySelector('[type="submit"]');
  const error = form.querySelector("[data-form-error]");
  const label = button.innerHTML;
  button.disabled = true;
  button.textContent = "Saving…";
  error.hidden = true;
  try { await operation(); }
  catch (cause) {
    error.textContent = cause?.message || "Unable to save. Please try again.";
    error.hidden = false;
    error.focus();
  } finally {
    delete form.dataset.pending;
    button.disabled = false;
    button.innerHTML = label;
  }
}

export function init(root) {
  root.querySelectorAll("[data-tab]").forEach((button) => button.addEventListener("click", () => { view.tab = button.dataset.tab; redraw(root); }));
  root.querySelector("#profile-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    saveForm(form, async () => {
      const fields = form.elements;
      const lat = fields.latitude.value === "" ? null : Number(fields.latitude.value);
      const lng = fields.longitude.value === "" ? null : Number(fields.longitude.value);
      if ((lat === null) !== (lng === null)) throw new Error("Enter both latitude and longitude, or leave both blank.");
      await actions.updateProfile({ name: fields.business.value.trim(), type: fields.type.value, loc: fields.location.value.trim(), owner: fields.owner.value.trim(), email: fields.email.value.trim(), pickup: fields.pickup.value.trim(), lat, lng });
      toast("Business profile saved", "Your marketplace profile is up to date.", "success");
    });
  });
  root.querySelectorAll("[data-toggle]").forEach((button) => button.addEventListener("click", async () => {
    button.disabled = true;
    const key = button.dataset.toggle;
    const next = !store.get().settings[key];
    try {
      await actions.updateSettings({ [key]: next });
      button.classList.toggle("on", next);
      button.setAttribute("aria-pressed", String(next));
      toast("Preference saved", esc(button.getAttribute("aria-label")?.replace("Toggle ", "") || "Setting"), "success");
    } catch (cause) { toast("Could not save preference", esc(cause?.message || "Please try again."), "error"); }
    finally { button.disabled = false; }
  }));
  root.querySelector("#waste-target")?.addEventListener("input", (event) => {
    root.querySelector("#threshold-value").textContent = `${event.currentTarget.value}%`;
    root.querySelector("#threshold-number").textContent = `${event.currentTarget.value}%`;
  });
  root.querySelector("#waste-target")?.addEventListener("change", async (event) => {
    const input = event.currentTarget;
    input.disabled = true;
    try { await actions.updateSettings({ wasteTarget: Number(input.value) }); toast("Risk threshold saved", "Your alert preference is up to date.", "success"); }
    catch (cause) { toast("Could not save threshold", esc(cause?.message || "Please try again."), "error"); redraw(root); }
    finally { input.disabled = false; }
  });
  root.querySelector("#sensor-type")?.addEventListener("change", (event) => {
    root.querySelector("#sensor-unit").value = event.currentTarget.value === "Temperature" ? "°C" : event.currentTarget.value === "Smart scale" ? "kg" : "";
  });
  root.querySelector("#sensor-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    saveForm(form, async () => {
      await actions.addSensor({ name: form.elements.deviceName.value.trim(), type: form.elements.deviceType.value, unit: form.elements.unit.value.trim() });
      toast("Device registered", "You can now record measured readings.", "success");
      if (form.isConnected) redraw(root);
    });
  });
  root.querySelectorAll("[data-reading-form]").forEach((form) => form.addEventListener("submit", (event) => {
    event.preventDefault();
    saveForm(form, async () => {
      const value = Number(form.elements.reading.value);
      if (!Number.isFinite(value)) throw new Error("Enter a valid measured value.");
      await actions.recordSensorReading(form.dataset.readingForm, { value });
      toast("Reading recorded", "The measured value and timestamp have been saved.", "success");
      if (form.isConnected) redraw(root);
    });
  }));
}
