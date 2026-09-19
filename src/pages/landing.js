/* ============================================================
   OVERBYTE — Public landing page
   ============================================================ */

import { icon, logoMark, wordmark } from "../icons.js";
import { flowNetwork, lineChart, sparkline, ringGauge } from "../charts.js";
import { aiHeader } from "../ui.js";

function nav() {
  return `<nav class="land-nav">
    <a href="#/" class="row gap-10">${logoMark(30)}${wordmark()}</a>
    <div class="links">
      <a href="#platform">Platform</a><a href="#intelligence">Intelligence</a><a href="#marketplace">Marketplace</a><a href="#impact">Impact</a>
    </div>
    <div class="row gap-10">
      <a class="btn btn-ghost" href="#/login">Sign in</a>
      <a class="btn btn-primary" href="#/signup">Get Started</a>
    </div>
  </nav>`;
}

function heroMock() {
  return `<div class="hero-mock" aria-label="Illustrative OverByte dashboard with example data">
    <div class="dots"><i></i><i></i><i></i><span style="margin-left:auto;font-size:10px;color:var(--text-muted);letter-spacing:.08em">ILLUSTRATIVE PREVIEW · EXAMPLE DATA</span></div>
    <div class="mock-body">
      <div class="mock-side">
        <div class="mi on">${icon("dashboard", 13)}Dashboard</div>
        <div class="mi">${icon("package", 13)}Inventory</div>
        <div class="mi">${icon("bag", 13)}Surplus</div>
        <div class="mi">${icon("receipt", 13)}Orders</div>
        <div class="mi">${icon("sparkles", 13)}AI Intelligence</div>
        <div class="mi">${icon("chart", 13)}Analytics</div>
      </div>
      <div class="mock-main">
        <div class="mock-card"><div class="mock-label">Total Inventory</div><div class="mock-kpi">₹84,260</div>
          <div style="margin-top:8px">${sparkline([62, 64, 66, 65, 70, 74, 78, 84], "#8577ff", 110, 26)}</div></div>
        <div class="mock-card"><div class="mock-label">Food Waste Risk</div><div class="mock-kpi" style="color:#34d399">18%</div>
          <div style="margin-top:6px;font-size:10px;color:#34d399;font-family:var(--font-mono)">↓ 12% this week</div></div>
        <div class="mock-card"><div class="mock-label">Predicted Surplus</div><div class="mock-kpi" style="color:#cfc9ff">₹8,000</div>
          <div style="margin-top:8px">${sparkline([4, 5, 4.4, 6, 5.6, 7, 7.4, 8], "#22d3ee", 110, 26)}</div></div>
        <div class="mock-card wide" style="display:flex;gap:14px;align-items:center">
          <span>${icon("sparkles", 15)}</span>
          <div style="flex:1">
            <div style="font-size:10px;letter-spacing:.1em;color:#9a8fff;font-weight:650">OVERBYTE AI · HIGH RISK</div>
            <div style="font-size:12px;color:#eef1f7;margin-top:3px">18 kg Chicken Breast — expected surplus in ~18 hours</div>
            <div style="font-size:10.5px;color:#667083;margin-top:2px">72% waste probability · listing recommended at ₹180–₹210/kg</div>
          </div>
          <span style="font-size:10px;border:1px solid rgba(133,119,255,.4);color:#cfc9ff;border-radius:6px;padding:5px 9px;font-weight:600">Review Listing</span>
        </div>
        <div class="mock-card" style="display:flex;justify-content:center">${ringGauge({ value: 94, size: 92, stroke: 8, sub: "AI MATCH", fs: 17 })}</div>
      </div>
    </div>
  </div>`;
}

const FEATURES = [
  ["trending", "Demand estimates", "Use expected demand and recorded consumption to estimate how much stock you will need before expiry."],
  ["flame", "Surplus detection", "Identify potential surplus from your actual stock, expiry dates and demand. Review the inputs behind each recommendation."],
  ["sparkles", "Explainable matching", "Find available supply ranked by recorded demand, quantity, shelf life, price and location when provided."],
  ["bag", "B2B marketplace", "Publish available surplus and discover listings from other kitchens, grocers and cafés. You control quantity and price."],
  ["chart", "Business analytics", "Track inventory value, surplus orders and recovered revenue from your own business activity."],
  ["cpu", "Sensor records", "Register your devices and save measured readings alongside your inventory. Hardware connections require a separate integration."],
];

const HOW = [
  ["Add your inventory", "Record products, quantities, purchase costs and expiry dates in your business workspace."],
  ["Estimate demand", "Set expected demand and record consumption so forecasts reflect your operations."],
  ["Review surplus alerts", "Rules-based risk estimates highlight inventory that may remain unsold."],
  ["Approve your listing", "Review the suggested quantity and price, then publish when you are ready."],
  ["Find a supply match", "Buyers search available listings and see why each option matches their needs."],
  ["Complete the pickup", "Reserve stock, arrange payment with the seller and record the handover in Orders."],
];

export function render() {
  return `<div class="land">
    ${nav()}
    <header class="land-hero">
      <div class="hero-glow"></div>
      <div class="hero-eyebrow">${aiHeader("AI FOOD SURPLUS INTELLIGENCE")}</div>
      <h1>Turn surplus<br/><span class="grad-text">into supply.</span></h1>
      <p class="hero-sub">Track inventory, anticipate surplus, and connect businesses with the food they need. Explainable intelligence, from your stockroom to the marketplace.</p>
      <div class="hero-cta">
        <a class="btn btn-primary btn-lg" href="#/signup">Get Started ${icon("arrowRight", 15)}</a>
        <a class="btn btn-secondary btn-lg" href="#/login">Explore Surplus</a>
      </div>
      <div class="hero-meta">
        <span>${icon("checkCircle", 13)}Your own business workspace</span>
        <span>${icon("checkCircle", 13)}Seller-approved listings</span>
        <span>${icon("checkCircle", 13)}Explainable recommendations</span>
      </div>
      ${heroMock()}
    </header>

    <section class="land-quote" id="platform">
      <blockquote>"Food doesn't become waste when it expires.<br/><em>It becomes waste when nobody knows it will.</em>"</blockquote>
    </section>

    <section class="land-section" id="intelligence">
      <div class="kicker">${aiHeader("INVENTORY INTELLIGENCE")}</div>
      <h2>Your inventory, with foresight</h2>
      <p class="sec-sub">OverByte evaluates recorded stock against expected demand and shelf life. Forecasts use explainable rules and your records; they are estimates, not trained machine-learning predictions.</p>
      <div class="feature-grid stagger">
        ${FEATURES.map(([ic, t, d]) => `<div class="card feature"><div class="f-icon">${icon(ic, 17)}</div><h3>${t}</h3><p>${d}</p></div>`).join("")}
      </div>
    </section>

    <section class="land-section" id="marketplace">
      <div class="kicker">${aiHeader("AI MATCHING")}</div>
      <h2>One business's surplus is another's supply</h2>
      <p class="sec-sub">When your recorded demand exceeds stock, find surplus listings and compare compatibility. Demand, available quantity, remaining shelf life and location help explain each score.</p>
      <div class="flow-viz"><p class="t-cap muted" style="padding:16px 20px 0">Illustrative matching scenario · example businesses</p>${flowNetwork()}</div>
    </section>

    <section class="land-section" id="impact">
      <div class="kicker">${aiHeader("MEASURABLE IMPACT")}</div>
      <h2>Waste prevented is revenue recovered</h2>
      <p class="sec-sub">See how surplus orders contribute to your business. The example below shows 12 kg sold at ₹180/kg, compared with a reference price of ₹240/kg.</p>
      <div class="page-grid stagger" style="grid-template-columns:repeat(3,1fr);margin-top:52px">
        <div class="card metric"><div class="m-label">${icon("wallet", 13)}Surplus revenue</div><div class="m-value">₹2,160</div><div class="m-foot"><span>Illustrative order · 12 kg × ₹180</span></div></div>
        <div class="card metric"><div class="m-label">${icon("package", 13)}Stock transferred</div><div class="m-value">12 kg</div><div class="m-foot"><span>Illustrative order · completed pickup</span></div></div>
        <div class="card metric"><div class="m-label">${icon("leaf", 13)}Buyer price difference</div><div class="m-value">₹720</div><div class="m-foot"><span>Illustrative order · reference price comparison</span></div></div>
      </div>
      <div class="card" style="margin-top:20px;padding:20px">
        <div class="row-between" style="margin-bottom:14px"><span class="card-title">Track your progress over time</span>
          <span class="ai-chip">${icon("sparkles", 10)}ILLUSTRATIVE CHART</span></div>
        ${lineChart({ height: 210, series: [
          { name: "Inventory value recovered", color: "#8577ff", area: true, points: [12, 18, 22, 30, 36, 41, 48, 52, 61, 66, 74, 81, 88, 96].map((v, i) => ({ x: `W${i + 1}`, y: v })) },
          { name: "Purchasing price difference", color: "#22d3ee", points: [4, 7, 9, 12, 16, 19, 22, 26, 31, 34, 39, 44, 48, 54].map((v, i) => ({ x: `W${i + 1}`, y: v })) },
        ], yFmt: (v) => `₹${v}K` })}
      </div>
    </section>

    <section class="land-section">
      <h2>How OverByte works</h2>
      <p class="sec-sub">From recorded inventory to a completed pickup — one connected flow.</p>
      <div class="how-grid stagger">
        ${HOW.map(([t, d]) => `<div class="card how-step"><h3>${t}</h3><p>${d}</p></div>`).join("")}
      </div>
    </section>

    <section class="land-cta">
      <div class="kicker" style="display:flex;justify-content:center;margin-bottom:16px">${aiHeader("GET STARTED")}</div>
      <h2>Start reducing waste.<br/>Start recovering value.</h2>
      <a class="btn btn-primary btn-lg" href="#/signup">Create your business account ${icon("arrowRight", 15)}</a>
      <div class="hero-meta" style="margin-top:18px"><span>${icon("checkCircle", 13)}Start with your own inventory</span><span>${icon("checkCircle", 13)}No hardware required</span></div>
    </section>

    <footer class="land-foot">
      <a href="#/" class="row gap-10">${logoMark(24)}<span style="font-weight:660">OverByte</span></a>
      <div class="links"><a href="#platform">Platform</a><a href="#marketplace">Marketplace</a><a href="#impact">Impact</a><a href="#/login">Sign in</a></div>
      <span>© ${new Date().getFullYear()} OverByte</span>
    </footer>
  </div>`;
}

export function init(root) {
  /* smooth-scroll for in-page anchors */
  root.querySelectorAll('.land-nav .links a, .land-foot .links a').forEach((a) => {
    a.addEventListener("click", (e) => {
      const id = a.getAttribute("href");
      const target = id && /^#[A-Za-z][\w-]*$/.test(id) ? document.getElementById(id.slice(1)) : null;
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
      }
    });
  });
}
