/* A recorded sale is committed and allocated to batches by the server. */
import { actions, selectors, store } from "./store.js";
import { esc, fmtNum as formatNumber } from "./util.js";
import { openModal, modalHead, closeModal, toast } from "./ui.js";
import { icon } from "./icons.js";

const fmtNum = value => formatNumber(value, Number.isInteger(Number(value)) ? 0 : 2);
const productKey = value => String(value).trim().toLowerCase();
const sameProduct = (a, b) => productKey(a.product) === productKey(b.product) && a.unit === b.unit;
const dateLabel = value => new Date(value).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });

// One choice per product/unit, regardless of how many batches are in stock.
export function saleProducts(inventory, now = Date.now()) {
  const groups = new Map();
  for (const batch of [...inventory].sort((a, b) => new Date(a.expiresAt) - new Date(b.expiresAt))) {
    const available = Math.max(0, batch.qty - (batch.reservedQty || 0));
    if (!(new Date(batch.expiresAt).getTime() > now) || !(available > 0)) continue;
    const key = JSON.stringify([productKey(batch.product), batch.unit]);
    if (!groups.has(key)) groups.set(key, { ...batch, available: 0 });
    groups.get(key).available += available;
  }
  return [...groups.values()].map(item => ({ ...item, available: Math.round(item.available * 100) / 100 }))
    .sort((a, b) => a.product.localeCompare(b.product) || a.unit.localeCompare(b.unit));
}

export function openSalePicker() {
  const products = saleProducts(selectors.enrichedInventory());
  const modal = openModal(`${modalHead("Register Sale", "Choose a product, then enter how much you sold.")}
    <div class="modal-body col gap-16">
      ${products.length ? `<div class="field"><label for="sale-search">Find a product</label><input id="sale-search" class="input" type="search" placeholder="Search your inventory…" autocomplete="off"/></div>
        <div id="sale-products" class="col gap-8" style="max-height:320px;overflow-y:auto"></div><p id="sale-no-results" class="t-sm muted" role="status" hidden>No matching products. Try another name.</p>`
      : `<p class="t-sm secondary">No stock available to sell. Add inventory first. Expired or reserved stock cannot be sold.</p><a id="sale-open-inventory" class="btn btn-primary" href="#/app/inventory">Open Inventory</a>`}
      <p class="t-xs muted">Only available stock is shown. We handle batch selection and update your surplus forecast.</p>
      ${saleHistory(null, 5)}
    </div>`);
  modal.style.maxWidth = "480px";
  modal.querySelector("#sale-open-inventory")?.addEventListener("click", () => closeModal());
  const list = modal.querySelector("#sale-products");
  if (!list) return;
  const render = () => {
    const query = productKey(modal.querySelector("#sale-search").value);
    const matches = products.filter(item => productKey(item.product).includes(query));
    list.innerHTML = matches.map(item => `<button type="button" class="btn btn-secondary" data-sale-product="${esc(item.id)}" style="min-height:54px;justify-content:space-between;white-space:normal;text-align:left;flex-shrink:0">
      <span>${esc(item.product)} <span class="t-xs muted">${esc(item.unit)}</span></span><span class="row gap-8" style="flex-shrink:0"><span class="t-xs secondary">${fmtNum(item.available)} available</span>${icon("chevronRight", 14)}</span></button>`).join("");
    modal.querySelector("#sale-no-results").hidden = matches.length > 0;
  };
  modal.querySelector("#sale-search").addEventListener("input", render);
  modal.querySelector("#sale-search").addEventListener("keydown", event => {
    if (event.key === "Enter" && !event.isComposing) {
      event.preventDefault();
      list.querySelector("[data-sale-product]")?.click();
    }
  });
  list.addEventListener("click", event => {
    const button = event.target.closest("[data-sale-product]");
    const item = button && products.find(product => product.id === button.dataset.saleProduct);
    if (item) { closeModal(); openRegisterSale(item); }
  });
  render();
}

export function saleHistory(item = null, limit = 10) {
  const history = (store.get().salesHistory || []).filter(sale => !item || sameProduct(sale, item)).slice(0, limit);
  return `<details style="margin-top:16px"><summary class="t-sm" tabindex="0" style="cursor:pointer;font-weight:600">Recent sales${history.length ? ` · ${history.length} shown` : ""}</summary>
    ${history.length ? `<div style="margin-top:8px">${history.map(sale => `<div style="padding:10px 0;border-top:1px solid var(--border)">
      <div class="row-between gap-10"><span class="t-sm">${esc(sale.product)}</span><span class="t-sm" style="font-family:var(--font-mono)">${fmtNum(sale.qty)} ${esc(sale.unit)}</span></div>
      <div class="t-xs muted" style="margin-top:3px">${esc(dateLabel(sale.createdAt))}</div>
      <div class="t-xs muted" style="margin-top:3px;overflow-wrap:anywhere">${(sale.allocations || []).map(batch => `${esc(batch.batch || "Unlabelled batch")}: ${fmtNum(batch.qty)} ${esc(sale.unit)}`).join(" · ")}</div>
    </div>`).join("")}</div>` : `<p class="t-xs muted" style="margin-top:8px">No registered sales yet${item ? " for this product" : ""}. Register a sale to build a demand history.</p>`}
  </details>`;
}

export function openRegisterSale(item) {
  const now = Date.now();
  const batches = selectors.enrichedInventory().filter(batch => sameProduct(batch, item) && new Date(batch.expiresAt).getTime() > now)
    .sort((a, b) => new Date(a.expiresAt) - new Date(b.expiresAt) || String(a.id).localeCompare(String(b.id)));
  const available = Math.round(batches.reduce((total, batch) => total + Math.max(0, batch.qty - (batch.reservedQty || 0)), 0) * 100) / 100;
  const wholeUnits = ["pcs", "packs"].includes(item.unit);
  const idempotencyKey = crypto.randomUUID();
  const modal = openModal(`${modalHead("Register Sale", esc(item.product))}
    <div class="modal-body"><form class="col gap-16" id="sale-form">
      <div class="row-between"><span class="t-sm secondary">Available to sell</span><strong class="t-num-lg">${fmtNum(available)} ${esc(item.unit)}</strong></div>
      <div class="field"><label for="sale-qty">Quantity sold (${esc(item.unit)})</label><input class="input input-mono" id="sale-qty" name="qty" type="number" inputmode="${wholeUnits ? "numeric" : "decimal"}" min="${wholeUnits ? 1 : 0.01}" max="${available}" step="${wholeUnits ? 1 : 0.01}" required placeholder="0" aria-describedby="sale-stock-note" ${available > 0 ? "" : "disabled"}/></div>
      <p id="sale-stock-note" class="t-xs muted" style="line-height:1.6">${available > 0 ? "Stock is deducted from the earliest-expiring batch first, across all batches of this product and unit. Expired and reserved stock cannot be sold." : "There is no unreserved, unexpired stock available for this product. Update inventory or release a listing reservation before registering a sale."}</p>
      <p class="t-xs muted" style="line-height:1.6">This records a completed sale and updates the forecast. It does not create a marketplace listing or collect payment.</p>
      <p id="sale-error" class="t-sm" role="alert" style="color:var(--danger)" hidden></p>
      <button class="btn btn-primary" type="submit" ${available > 0 ? "" : "disabled"}>Register Sale</button>
    </form>
    <a class="btn btn-ghost btn-sm" id="sale-view-details" href="#/app/inventory/${encodeURIComponent(item.id)}" style="margin-top:12px">View batch details</a>
    ${saleHistory(item, 5)}</div>`);
  modal.style.maxWidth = "480px";
  const form = modal.querySelector("form");
  const quantityInput = modal.querySelector("#sale-qty");
  const submit = form.querySelector('[type="submit"]');
  const error = modal.querySelector("#sale-error");
  const details = modal.querySelector("#sale-view-details");
  let submittedQty = null;
  details.addEventListener("click", event => {
    if (modal.dataset.pending) event.preventDefault();
    else closeModal();
  });
  form.addEventListener("submit", async event => {
    event.preventDefault();
    if (modal.dataset.pending || !form.reportValidity()) return;
    // Keep both the key and payload stable after an uncertain network response.
    const qty = submittedQty ?? Number(quantityInput.value);
    if (!Number.isFinite(qty) || qty <= 0 || qty > available || (wholeUnits && !Number.isInteger(qty))) {
      error.textContent = `Enter a valid quantity up to ${fmtNum(available)} ${item.unit}.`;
      error.hidden = false;
      return;
    }
    submittedQty = qty;
    quantityInput.readOnly = true;
    error.hidden = true;
    modal.dataset.pending = "true";
    submit.disabled = true;
    submit.textContent = "Registering…";
    modal.querySelector("[data-close]").disabled = true;
    details.setAttribute("aria-disabled", "true");
    try {
      const sale = await actions.registerSale(item.id, qty, { idempotencyKey });
      if (modal.isConnected) closeModal();
      toast("Sale registered", `${fmtNum(sale.qty)} ${esc(sale.unit)} of ${esc(sale.product)} sold. Stock and surplus predictions updated.`, "success");
    } catch (cause) {
      error.textContent = `${cause?.message || "The sale could not be registered."} Retry to safely check or complete this same sale. Close and reopen to enter a different quantity.`;
      error.hidden = false;
    } finally {
      delete modal.dataset.pending;
      submit.disabled = false;
      submit.textContent = "Register Sale";
      modal.querySelector("[data-close]").disabled = false;
      details.removeAttribute("aria-disabled");
    }
  });
}
