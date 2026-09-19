/* Inventory forms persist every change through the authenticated API. */
import { icon } from "./icons.js";
import { PRODUCTS } from "./data.js";
import { actions } from "./store.js";
import { esc, fmtNum as formatNumber } from "./util.js";
import { openModal, modalHead, closeModal, toast } from "./ui.js";

const categories = ["Produce", "Fruits", "Meat & Poultry", "Seafood", "Dairy", "Bakery", "Grocery", "Frozen", "Beverages", "Other"];
const fmtNum = (value, decimals) => formatNumber(value, decimals ?? (Number.isInteger(Number(value)) ? 0 : 2));
const units = ["kg", "g", "L", "ml", "pcs", "packs"];
const storageOptions = ["Refrigerated", "Ambient", "Frozen", "Dry storage"];
const options = (values, value) => [...new Set([...values, ...(value ? [value] : [])])].map(v => `<option value="${esc(v)}" ${v === value ? "selected" : ""}>${esc(v)}</option>`).join("");
function localDateValue(value) {
  if (!value) return "";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}
export function openAddInventory() { openInventoryForm(); }
export function openInventoryEdit(item) { openInventoryForm(item); }

function openInventoryForm(item = null) {
  const editing = Boolean(item);
  // Keep this key across retries of the same form, including a timed-out
  // response after the server has already committed the inventory batch.
  const idempotencyKey = editing ? null : crypto.randomUUID();
  const m = openModal(`
    ${modalHead(editing ? "Edit inventory batch" : "Add inventory", "Track your stock, expiry and expected daily use")}
    <div class="modal-body"><form id="add-form" class="col gap-16">
      <div class="row gap-16 wrap">
        <div class="field flex-1" style="min-width:180px"><label for="f-product">Product</label><input class="input" id="f-product" list="inventory-products" required maxlength="120" placeholder="e.g. Chicken Breast" value="${esc(item?.product || "")}"/><datalist id="inventory-products">${Object.keys(PRODUCTS).map(p => `<option value="${esc(p)}"></option>`).join("")}</datalist></div>
        <div class="field flex-1" style="min-width:140px"><label for="f-category">Category</label><select class="select" id="f-category">${options(categories, item?.category || "Produce")}</select></div>
      </div>
      <div class="row gap-16 wrap">
        ${editing ? "" : `<div class="field flex-1" style="min-width:110px"><label for="f-qty">Quantity</label><input class="input input-mono" id="f-qty" type="number" min="0.01" step="0.01" required placeholder="0"/></div>`}
        <div class="field flex-1" style="min-width:110px"><label for="f-unit">Unit</label><select class="select" id="f-unit" ${editing ? "disabled" : ""}>${options(units, item?.unit || "kg")}</select></div>
        <div class="field flex-1" style="min-width:140px"><label for="f-cost">Purchase price (₹/unit)</label><input class="input input-mono" id="f-cost" type="number" min="0" step="any" required value="${item?.cost ?? ""}" placeholder="0.00"/></div>
      </div>
      <div class="row gap-16 wrap">
        <div class="field flex-1" style="min-width:180px"><label for="f-expiry">Expiry date and time</label><input class="input" id="f-expiry" type="datetime-local" required value="${localDateValue(item?.expiresAt)}"/><span class="t-xs muted">Your local time zone</span></div>
        <div class="field flex-1" style="min-width:150px"><label for="f-demand">Expected use per day</label><input class="input input-mono" id="f-demand" type="number" min="0" step="any" value="${item?.dailyDemand ?? ""}" placeholder="Optional"/><span class="t-xs muted">Units/day. Leave blank to learn from recorded consumption.</span></div>
      </div>
      <div class="row gap-16 wrap">
        <div class="field flex-1" style="min-width:140px"><label for="f-storage">Storage condition</label><select class="select" id="f-storage">${options(storageOptions, item?.storage || "Refrigerated")}</select></div>
        <div class="field flex-1" style="min-width:140px"><label for="f-supplier">Supplier</label><input class="input" id="f-supplier" maxlength="160" value="${esc(item?.supplier || "")}" placeholder="Optional"/></div>
      </div>
      <div class="row gap-16 wrap">
        <div class="field flex-1" style="min-width:150px"><label for="f-batch">Batch number / barcode</label><input class="input input-mono" id="f-batch" maxlength="120" value="${esc(item?.batch || "")}" placeholder="Enter or scan with a USB scanner"/></div>
        <div class="field flex-1" style="min-width:150px"><label for="f-market">Reference market price (₹/unit)</label><input class="input input-mono" id="f-market" type="number" min="0.01" step="any" value="${item?.market ?? ""}" placeholder="Optional"/><span class="t-xs muted">Optional seller reference for listing price comparisons.</span></div>
      </div>
      <p class="t-xs muted" style="line-height:1.6">Forecasts use expected daily use or recorded consumption and this batch’s expiry. Without a demand basis, OverByte will ask for more data.</p>
      <p id="inventory-error" class="t-sm" role="alert" style="color:var(--danger);display:none"></p>
      <button class="btn btn-primary btn-lg" type="submit">${icon(editing ? "check" : "plus", 15)}${editing ? "Save changes" : "Add to Inventory"}</button>
    </form></div>`);
  const form = m.querySelector("form");
  const field = id => m.querySelector(`#f-${id}`);
  if (!editing) field("product").addEventListener("change", () => {
    const catalog = PRODUCTS[field("product").value];
    if (catalog) { field("category").value = catalog.cat; field("unit").value = catalog.unit; field("storage").value = catalog.storage; }
  });
  form.addEventListener("submit", async e => {
    e.preventDefault();
    if (!form.reportValidity()) return;
    const submit = form.querySelector('[type="submit"]');
    const original = submit.innerHTML;
    const error = m.querySelector("#inventory-error");
    error.style.display = "none";
    submit.disabled = true;
    submit.textContent = "Saving…";
    try {
      const expiresAt = editing && field("expiry").value === localDateValue(item.expiresAt) ? item.expiresAt : new Date(field("expiry").value).toISOString();
      const payload = { product: field("product").value.trim(), category: field("category").value, cost: Number(field("cost").value), expiresAt, dailyDemand: field("demand").value === "" ? null : Number(field("demand").value), storage: field("storage").value, supplier: field("supplier").value.trim(), batch: field("batch").value.trim(), market: field("market").value === "" ? null : Number(field("market").value) };
      if (editing) await actions.updateInventory(item.id, payload);
      else await actions.addInventory({ ...payload, unit: field("unit").value, qty: Number(field("qty").value), idempotencyKey });
      closeModal();
      toast(editing ? "Inventory updated" : "Inventory added", `${esc(payload.product)} saved. Inventory forecasts have been refreshed.`, "success");
    } catch (err) {
      error.textContent = err.message || "Unable to save inventory. Please try again.";
      error.style.display = "block";
      submit.disabled = false;
      submit.innerHTML = original;
    }
  });
  field("product").focus();
}

export function openStockMovement(item, initialKind = "consumption") {
  const available = Math.max(0, item.qty - (item.reservedQty || 0));
  const m = openModal(`${modalHead("Update stock", `${esc(item.product)} · ${fmtNum(item.qty)} ${esc(item.unit)} on hand`)}
    <div class="modal-body"><form class="col gap-16" id="movement-form">
      <div class="field"><label for="movement-kind">Movement type</label><select class="select" id="movement-kind">
        <option value="consumption" ${initialKind === "consumption" ? "selected" : ""}>Used / sold — learn demand</option>
        <option value="received" ${initialKind === "received" ? "selected" : ""}>Received more stock</option>
        <option value="adjustment" ${initialKind === "adjustment" ? "selected" : ""}>Stock correction — reduce quantity</option>
        <option value="waste">Discarded / spoiled</option>
      </select></div>
      <div class="field"><label for="movement-qty">Quantity (${esc(item.unit)})</label><input id="movement-qty" class="input input-mono" type="number" min="0.01" step="0.01" required placeholder="0"/></div>
      <p class="t-xs muted" style="line-height:1.6">${fmtNum(available)} ${esc(item.unit)} are available after listing reservations. Recorded use updates the demand forecast. Receiving more stock applies to this batch and its existing expiry.</p>
      <p id="movement-error" role="alert" class="t-sm" style="color:var(--danger);display:none"></p><button class="btn btn-primary" type="submit">Save movement</button>
    </form></div>`);
  m.querySelector("form").addEventListener("submit", async e => {
    e.preventDefault();
    const button = m.querySelector('[type="submit"]');
    const error = m.querySelector("#movement-error");
    const quantity = Number(m.querySelector("#movement-qty").value);
    const kind = m.querySelector("#movement-kind").value;
    error.style.display = "none";
    button.disabled = true;
    button.textContent = "Saving…";
    try {
      if (kind === "consumption") await actions.recordConsumption(item.id, quantity);
      else await actions.adjustInventory(item.id, kind === "received" ? quantity : -quantity, kind);
      closeModal();
      toast("Stock updated", `${fmtNum(quantity)} ${esc(item.unit)} ${kind === "consumption" ? "recorded as used" : kind === "received" ? "received" : "removed"}.`, "success");
    } catch (err) {
      error.textContent = err.message || "Unable to update stock. Please try again.";
      error.style.display = "block";
      button.disabled = false;
      button.textContent = "Save movement";
    }
  });
  m.querySelector("#movement-qty").focus();
}
