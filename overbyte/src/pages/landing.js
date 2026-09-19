/* ============================================================
   OVERBYTE — Public landing page
   ============================================================ */

import { icon, logoMark, wordmark } from "../icons.js";
import { flowNetwork, lineChart, sparkline, ringGauge } from "../charts.js";
import { fmtINR } from "../util.js";
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
  return `<div class="hero-mock" aria-hidden="true">
    <div class="dots"><i></i><i></i><i></i></div>
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
  ["trending", "Predictive demand", "OverByte learns your sales velocity, weekday seasonality and events to forecast what you will actually sell."],
  ["flame", "Surplus detection", "Every batch is scored for spoilage risk. The moment waste becomes likely, you know — hours before it happens."],
  ["sparkles", "AI matching", "Surplus is matched to nearby businesses by demand, quantity, distance, shelf life and price — not luck."],
  ["bag", "B2B marketplace", "A verified, business-only marketplace where surplus moves at a fair price between kitchens, grocers and cafés."],
  ["chart", "Impact analytics", "Revenue recovered, waste prevented and purchasing savings — measurable down to the kilogram."],
  ["cpu", "IoT-ready inventory", "Smart scales, temperature sensors and POS feeds keep your inventory live without manual counts."],
];

const HOW = [
  ["Connect inventory", "POS, smart scales or a 2-minute manual setup — your stock becomes live."],
  ["OverByte predicts demand", "Forecasts per product, per day, using your history and local signals."],
  ["AI detects surplus", "Risk-scored alerts surface exactly what won't sell in time."],
  ["Business approves listing", "You review the AI-suggested listing, price and publish. Always your call."],
  ["AI finds buyers", "Nearby businesses with real demand get matched instantly."],
  ["Surplus gets transferred", "Pickup, payment and analytics — handled end to end."],
];

export function render() {
  return `<div class="land">
    ${nav()}
    <header class="land-hero">
      <div class="hero-glow"></div>
      <div class="hero-eyebrow">${aiHeader("AI FOOD SURPLUS INTELLIGENCE")}</div>
      <h1>Turn surplus<br/><span class="grad-text">into supply.</span></h1>
      <p class="hero-sub">OverByte uses AI to predict food surplus before it happens, prevent waste, and connect businesses with the inventory they need — in real time.</p>
      <div class="hero-cta">
        <a class="btn btn-primary btn-lg" href="#/signup">Get Started ${icon("arrowRight", 15)}</a>
        <a class="btn btn-secondary btn-lg" href="#/login">Explore Surplus</a>
      </div>
      <div class="hero-meta">
        <span>${icon("checkCircle", 13)}₹1.2Cr+ value recovered in pilot</span>
        <span>${icon("checkCircle", 13)}40+ businesses onboard</span>
        <span>${icon("checkCircle", 13)}94% match accuracy</span>
      </div>
      ${heroMock()}
    </header>

    <section class="land-quote" id="platform">
      <blockquote>"Food doesn't become waste when it expires.<br/><em>It becomes waste when nobody knows it will.</em>"</blockquote>
    </section>

    <section class="land-section" id="intelligence">
      <div class="kicker">${aiHeader("INVENTORY INTELLIGENCE")}</div>
      <h2>Your inventory, with foresight</h2>
      <p class="sec-sub">OverByte continuously scores every item against expected demand, shelf life and sales velocity — so surplus is a decision, not a surprise.</p>
      <div class="feature-grid stagger">
        ${FEATURES.map(([ic, t, d]) => `<div class="card feature"><div class="f-icon">${icon(ic, 17)}</div><h3>${t}</h3><p>${d}</p></div>`).join("")}
      </div>
    </section>

    <section class="land-section" id="marketplace">
      <div class="kicker">${aiHeader("AI MATCHING")}</div>
      <h2>One business's surplus is another's supply</h2>
      <p class="sec-sub">When OverByte detects a shortage across the network, it searches live surplus and ranks every option by real compatibility — demand, quantity, distance, shelf life, price and pickup windows.</p>
      <div class="flow-viz">${flowNetwork()}</div>
    </section>

    <section class="land-section" id="impact">
      <div class="kicker">${aiHeader("MEASURABLE IMPACT")}</div>
      <h2>Waste prevented is revenue recovered</h2>
      <p class="sec-sub">Every kilogram redirected is tracked — value recovered, waste prevented, and purchasing savings against market price.</p>
      <div class="page-grid stagger" style="grid-template-columns:repeat(3,1fr);margin-top:52px">
        <div class="card metric"><div class="m-label">${icon("wallet", 13)}Food saved</div><div class="m-value">₹12.4L</div><div class="m-foot"><span class="delta up">↓ 34% waste cost</span><span>this quarter</span></div></div>
        <div class="card metric"><div class="m-label">${icon("package", 13)}Inventory recovered</div><div class="m-value">6,820 kg</div><div class="m-foot"><span class="delta up">+18%</span><span>vs last quarter</span></div></div>
        <div class="card metric"><div class="m-label">${icon("leaf", 13)}CO₂e avoided</div><div class="m-value">41.2 t</div><div class="m-foot"><span class="delta up">+22%</span><span>equivalent</span></div></div>
      </div>
      <div class="card" style="margin-top:20px;padding:20px">
        <div class="row-between" style="margin-bottom:14px"><span class="card-title">Inventory value recovered — network pilot (14 weeks)</span>
          <span class="ai-chip">${icon("sparkles", 10)}LIVE DATA</span></div>
        ${lineChart({ height: 210, series: [
          { name: "Inventory value recovered", color: "#8577ff", area: true, points: [12, 18, 22, 30, 36, 41, 48, 52, 61, 66, 74, 81, 88, 96].map((v, i) => ({ x: `W${i + 1}`, y: v })) },
          { name: "Waste cost avoided", color: "#22d3ee", points: [4, 7, 9, 12, 16, 19, 22, 26, 31, 34, 39, 44, 48, 54].map((v, i) => ({ x: `W${i + 1}`, y: v })) },
        ], yFmt: (v) => `₹${v}K` })}
      </div>
    </section>

    <section class="land-section">
      <h2>How OverByte works</h2>
      <p class="sec-sub">From live inventory to a completed pickup — one connected flow.</p>
      <div class="how-grid stagger">
        ${HOW.map(([t, d]) => `<div class="card how-step"><h3>${t}</h3><p>${d}</p></div>`).join("")}
      </div>
    </section>

    <section class="land-cta">
      <div class="kicker" style="display:flex;justify-content:center;margin-bottom:16px">${aiHeader("GET STARTED")}</div>
      <h2>Start reducing waste.<br/>Start recovering value.</h2>
      <a class="btn btn-primary btn-lg" href="#/signup">Create your business account ${icon("arrowRight", 15)}</a>
      <div class="hero-meta" style="margin-top:18px"><span>${icon("checkCircle", 13)}Free pilot for the first 30 days</span><span>${icon("checkCircle", 13)}No hardware required</span></div>
    </section>

    <footer class="land-foot">
      <a href="#/" class="row gap-10">${logoMark(24)}<span style="font-weight:660">OverByte</span></a>
      <div class="links"><a href="#platform">Platform</a><a href="#marketplace">Marketplace</a><a href="#impact">Impact</a><a href="#/login">Sign in</a></div>
      <span>© 2026 OverByte Technologies · Bengaluru</span>
    </footer>
  </div>`;
}

export function init(root) {
  /* smooth-scroll for in-page anchors */
  root.querySelectorAll('a[href^="#p"], a[href^="#i"], a[href^="#m"]').forEach(() => {});
  root.querySelectorAll('.land-nav .links a, .land-foot .links a').forEach((a) => {
    a.addEventListener("click", (e) => {
      const id = a.getAttribute("href");
      if (id?.startsWith("#") && id.length > 1 && document.querySelector(id)) {
        e.preventDefault();
        document.querySelector(id).scrollIntoView({ behavior: "smooth" });
      }
    });
  });
}
