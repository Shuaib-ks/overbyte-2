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
  return openRegisterSale();
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

export function openRegisterSale(item = null) {
  const products = saleProducts(selectors.enrichedInventory());
  const selected = new Map();
  const initial = item && products.find(product => sameProduct(product, item));
  if (initial) selected.set(initial.id, { item: initial, qty: "" });
  const idempotencyKey = crypto.randomUUID();
  let submittedItems = null;
  const modal = openModal(`${modalHead("Register Sale", "One customer, one sale. Add one or more products below.")}
    <div class="modal-body"><form class="col gap-16" id="sale-form">
      <div id="sale-selected" class="col gap-10"></div>
      ${products.length ? `<div class="field"><label for="sale-search">Add a product</label><input id="sale-search" class="input" type="search" placeholder="Search your inventory…" autocomplete="off"/></div>
        <div id="sale-products" class="col gap-8" style="max-height:180px;overflow-y:auto"></div><p id="sale-no-results" class="t-xs muted" role="status" hidden></p>`
      : `<p class="t-sm secondary">No stock available to sell. Expired and reserved stock cannot be sold.</p><a id="sale-open-inventory" class="btn btn-secondary" href="#/app/inventory">Open Inventory</a>`}
      <p id="sale-stock-note" class="t-xs muted" style="line-height:1.6">All items save together. Earliest-expiring stock is used first and forecasts update automatically. This records a completed sale; it does not collect payment.</p>
      <p id="sale-error" class="t-sm" role="alert" style="color:var(--danger)" hidden></p>
      <button class="btn btn-primary" type="submit" disabled>Register Sale</button>
    </form>
    ${item ? `<a class="btn btn-ghost btn-sm" id="sale-view-details" href="#/app/inventory/${encodeURIComponent(item.id)}" style="margin-top:12px">View batch details</a>` : ""}
    ${saleHistory(null, 5)}</div>`);
  modal.style.maxWidth = "560px";
  const form = modal.querySelector("form");
  const submit = form.querySelector('[type="submit"]');
  const error = modal.querySelector("#sale-error");
  const chosen = modal.querySelector("#sale-selected");
  const search = modal.querySelector("#sale-search");
  const list = modal.querySelector("#sale-products");
  const label = () => `Register Sale${selected.size ? ` · ${selected.size} item${selected.size === 1 ? "" : "s"}` : ""}`;
  modal.querySelectorAll("a").forEach(link => link.addEventListener("click", event => {
    if (modal.dataset.pending) event.preventDefault();
    else closeModal();
  }));
  const renderProducts = () => {
    if (!list) return;
    const matches = products.filter(product => !selected.has(product.id) && productKey(product.product).includes(productKey(search.value)));
    list.innerHTML = matches.map(product => `<button type="button" class="btn btn-secondary" data-add-sale="${esc(product.id)}" style="min-height:44px;justify-content:space-between;white-space:normal;text-align:left;flex-shrink:0" ${selected.size >= 20 ? "disabled" : ""}>
      <span>${esc(product.product)} <span class="t-xs muted">${fmtNum(product.available)} ${esc(product.unit)} available</span></span>${icon("plus", 14)}</button>`).join("");
    const empty = modal.querySelector("#sale-no-results");
    empty.hidden = matches.length > 0 && selected.size < 20;
    empty.textContent = selected.size >= 20 ? "Up to 20 products per sale." : selected.size === products.length ? "All available products added." : "No matching products.";
  };
  const renderSelected = () => {
    chosen.innerHTML = [...selected.values()].map(({ item: product, qty }, index) => {
      const whole = ["pcs", "packs"].includes(product.unit);
      return `<div class="card" style="padding:12px"><div class="row-between gap-8"><strong class="t-sm">${esc(product.product)}</strong><button type="button" class="btn btn-ghost btn-sm" data-remove-sale="${esc(product.id)}" aria-label="Remove ${esc(product.product)}">${icon("x", 13)}</button></div>
        <div class="field"><label for="sale-qty-${index}">Quantity sold (${esc(product.unit)}) · ${fmtNum(product.available)} available</label><input id="sale-qty-${index}" data-sale-qty="${esc(product.id)}" class="input input-mono" type="number" inputmode="${whole ? "numeric" : "decimal"}" min="${whole ? 1 : 0.01}" max="${product.available}" step="${whole ? 1 : 0.01}" value="${esc(qty)}" placeholder="0" required aria-describedby="sale-stock-note"/></div></div>`;
    }).join("");
    submit.disabled = selected.size === 0;
    submit.textContent = label();
    renderProducts();
  };
  chosen.addEventListener("input", event => {
    const row = selected.get(event.target.dataset.saleQty);
    if (row && !submittedItems) row.qty = event.target.value;
  });
  chosen.addEventListener("click", event => {
    const button = event.target.closest("[data-remove-sale]");
    if (!button || submittedItems) return;
    selected.delete(button.dataset.removeSale);
    renderSelected();
    search?.focus();
  });
  search?.addEventListener("input", renderProducts);
  search?.addEventListener("keydown", event => {
    if (event.key === "Enter" && !event.isComposing) {
      event.preventDefault();
      list.querySelector("[data-add-sale]:not([disabled])")?.click();
    }
  });
  list?.addEventListener("click", event => {
    const button = event.target.closest("[data-add-sale]");
    if (!button || submittedItems || selected.size >= 20) return;
    const product = products.find(product => product.id === button.dataset.addSale);
    if (!product || selected.has(product.id)) return;
    selected.set(product.id, { item: product, qty: "" });
    search.value = "";
    renderSelected();
    chosen.querySelectorAll("input")[selected.size - 1]?.focus();
  });
  form.addEventListener("submit", async event => {
    event.preventDefault();
    if (modal.dataset.pending || !selected.size || !form.reportValidity()) return;
    // A lost response must retry exactly the same basket, never duplicate it.
    submittedItems ??= [...selected.values()].map(row => ({ inventoryItemId: row.item.id, qty: Number(row.qty) }));
    error.hidden = true;
    modal.dataset.pending = "true";
    form.querySelectorAll("input,button").forEach(control => { control.disabled = true; });
    submit.textContent = "Registering…";
    modal.querySelector("[data-close]").disabled = true;
    try {
      const result = await actions.registerSales(submittedItems, { idempotencyKey });
      if (modal.isConnected) closeModal();
      toast("Sale registered", `${result.sales.length} product${result.sales.length === 1 ? "" : "s"} recorded. Stock and surplus predictions updated.`, "success");
    } catch (cause) {
      error.textContent = `${cause?.message || "The sale could not be registered."} Retry to safely check or complete this same sale. Keep this sale open if the connection was interrupted; close and reopen to change items after a stock validation error.`;
      error.hidden = false;
    } finally {
      delete modal.dataset.pending;
      submit.disabled = false;
      submit.textContent = error.hidden ? label() : "Retry same sale";
      modal.querySelector("[data-close]").disabled = false;
    }
  });
  renderSelected();
  return modal;
}
