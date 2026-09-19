/* ============================================================
   OVERBYTE — Icon system & food artwork
   Stroke icons (24×24, feather/lucide-derived) + duotone food art.
   ============================================================ */

const P = {
  dashboard: '<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
  package: '<line x1="16.5" y1="9.4" x2="7.5" y2="4.21"/><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/>',
  bag: '<path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/>',
  receipt: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>',
  sparkles: '<path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/><path d="M20 3v4"/><path d="M22 5h-4"/>',
  trending: '<polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>',
  chart: '<line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>',
  bell: '<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>',
  bellRing: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/><path d="M4 2C2.8 3.7 2 5.7 2 8"/><path d="M22 8c0-2.3-.8-4.3-2-6"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
  search: '<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>',
  plus: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
  minus: '<line x1="5" y1="12" x2="19" y2="12"/>',
  x: '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
  check: '<polyline points="20 6 9 17 4 12"/>',
  chevronDown: '<polyline points="6 9 12 15 18 9"/>',
  chevronRight: '<polyline points="9 18 15 12 9 6"/>',
  chevronLeft: '<polyline points="15 18 9 12 15 6"/>',
  chevronUp: '<polyline points="18 15 12 9 6 15"/>',
  arrowRight: '<line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>',
  arrowUpRight: '<line x1="7" y1="17" x2="17" y2="7"/><polyline points="7 7 17 7 17 17"/>',
  clock: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
  history: '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/>',
  mapPin: '<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>',
  truck: '<rect x="1" y="3" width="15" height="13" rx="1"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>',
  shieldCheck: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/>',
  star: '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>',
  alertTriangle: '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
  alertCircle: '<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>',
  checkCircle: '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>',
  thermometer: '<path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z"/>',
  wifi: '<path d="M5 12.55a11 11 0 0 1 14.08 0"/><path d="M1.42 9a16 16 0 0 1 21.16 0"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/>',
  barcode: '<line x1="3" y1="5" x2="3" y2="19"/><line x1="7" y1="5" x2="7" y2="19"/><line x1="11" y1="5" x2="11" y2="19"/><line x1="14" y1="5" x2="14" y2="19"/><line x1="18" y1="5" x2="18" y2="19"/><line x1="21" y1="5" x2="21" y2="19"/>',
  scan: '<path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/><line x1="7" y1="12" x2="17" y2="12"/>',
  user: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  building: '<path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/><path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/><path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"/><path d="M10 6h4"/><path d="M10 10h4"/><path d="M10 14h4"/><path d="M10 18h4"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>',
  sliders: '<line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/>',
  calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>',
  info: '<circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>',
  zap: '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>',
  eye: '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>',
  refresh: '<polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>',
  edit: '<path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/>',
  send: '<line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>',
  trash: '<polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/>',
  chefHat: '<path d="M17 21a1 1 0 0 0 1-1v-5.35c0-.457.316-.844.727-1.041a4 4 0 0 0-2.134-7.589 5 5 0 0 0-9.186 0 4 4 0 0 0-2.134 7.588c.411.198.727.585.727 1.041V20a1 1 0 0 0 1 1Z"/><path d="M6 17h12"/>',
  cart: '<circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>',
  percent: '<line x1="19" y1="5" x2="5" y2="19"/><circle cx="6.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/>',
  timer: '<line x1="10" y1="2" x2="14" y2="2"/><line x1="12" y1="14" x2="15" y2="11"/><circle cx="12" cy="14" r="8"/>',
  fridge: '<rect x="6" y="2" width="12" height="20" rx="2"/><path d="M6 10h12"/><path d="M9 6v1"/><path d="M9 14v2"/>',
  cpu: '<rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><line x1="9" y1="1" x2="9" y2="4"/><line x1="15" y1="1" x2="15" y2="4"/><line x1="9" y1="20" x2="9" y2="23"/><line x1="15" y1="20" x2="15" y2="23"/><line x1="20" y1="9" x2="23" y2="9"/><line x1="20" y1="14" x2="23" y2="14"/><line x1="1" y1="9" x2="4" y2="9"/><line x1="1" y1="14" x2="4" y2="14"/>',
  radio: '<circle cx="12" cy="12" r="2"/><path d="M16.24 7.76a6 6 0 0 1 0 8.49m-8.48-.01a6 6 0 0 1 0-8.49m11.31-2.82a10 10 0 0 1 0 14.14m-14.14 0a10 10 0 0 1 0-14.14"/>',
  monitor: '<rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>',
  clipboard: '<path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/><line x1="9" y1="12" x2="15" y2="12"/><line x1="9" y1="16" x2="13" y2="16"/>',
  flame: '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>',
  external: '<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>',
  inbox: '<polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>',
  tag: '<path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/>',
  target: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
  scaleIcon: '<path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="M7 21h10"/><path d="M12 3v18"/><path d="M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2"/>',
  coffee: '<path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/>',
  wallet: '<path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a2 2 0 0 0 0 4h4v-4Z"/>',
  box: '<rect x="4" y="7" width="16" height="14" rx="2"/><path d="m4 11 8 3 8-3"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
  droplet: '<path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/>',
  activity: '<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>',
  layers: '<polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/>',
  sun: '<circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>',
  moon: '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>',
  leaf: '<path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/>',
  utensils: '<path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/>',
  basket: '<path d="m15 11-1 9"/><path d="m19 11-4-7"/><path d="M2 11h20"/><path d="m3.5 11 1.6 7.4a2 2 0 0 0 2 1.6h9.8a2 2 0 0 0 2-1.6l1.7-7.4"/><path d="m5 11 4-7"/><path d="m9 11 1 9"/>',
  mail: '<path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>',
  lock: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  keyboard: '<rect x="2" y="6" width="20" height="12" rx="2"/><line x1="6" y1="10" x2="6" y2="10.01"/><line x1="10" y1="10" x2="10" y2="10.01"/><line x1="14" y1="10" x2="14" y2="10.01"/><line x1="18" y1="10" x2="18" y2="10.01"/><line x1="7" y1="14" x2="17" y2="14"/>',
};

/* ---------------- Brand primitives ----------------
   Kept with the icon system so app chrome, landing and auth can use the
   identical mark without creating a dependency on higher-level UI helpers. */
export function logoMark(size = 30) {
  return `<svg class="mark" width="${size}" height="${size}" viewBox="0 0 40 40" fill="none" aria-hidden="true">
    <defs><linearGradient id="overbyte-mark-gradient" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#9a8fff"/><stop offset="100%" stop-color="#5b48e8"/></linearGradient></defs>
    <rect x="1.5" y="1.5" width="37" height="37" rx="10" fill="url(#overbyte-mark-gradient)" opacity="0.16"/>
    <rect x="1.5" y="1.5" width="37" height="37" rx="10" stroke="url(#overbyte-mark-gradient)" stroke-width="1.6"/>
    <path d="M12 14l6 6-6 6" stroke="url(#overbyte-mark-gradient)" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M21.5 26h7" stroke="#22d3ee" stroke-width="2.6" stroke-linecap="round"/>
    <circle cx="28.5" cy="14.5" r="2.5" fill="url(#overbyte-mark-gradient)"/>
  </svg>`;
}

export const wordmark = () => `<span class="wordmark">Over<i>Byte</i></span>`;

export function icon(name, size = 16, cls = "") {
  const d = P[name] || P.info;
  return `<svg class="${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
}

/* ---------------- Food artwork (duotone tiles, 64×64) ---------------- */

const ART = {
  chicken: `<path d="M39 15c6 0 11 5 11 12 0 6-4 10-8 11l-3 6-5-4-5 2 1-7c-2-3-3-6-3-8 0-7 6-12 12-12Z" fill="#e9b98c"/><path d="M39 15c6 0 11 5 11 12 0 6-4 10-8 11l-3 6-2-1V15Z" fill="#d9a06f"/><rect x="31" y="42" width="4" height="12" rx="2" transform="rotate(-14 33 48)" fill="#f2f4f8"/><circle cx="31" cy="55" r="3.4" fill="#f2f4f8"/><circle cx="36" cy="53" r="3.2" fill="#cfd5df"/><path d="M35 22c2 1 4 1 6 0" stroke="#a5714a" stroke-width="2" stroke-linecap="round" fill="none"/>`,
  tomato: `<circle cx="32" cy="36" r="17" fill="#e85d4f"/><path d="M32 19a17 17 0 0 1 14 8 17 17 0 0 0-25 4 17 17 0 0 1 11-12Z" fill="#c94437"/><circle cx="26" cy="30" r="4.5" fill="#f2938a" opacity="0.85"/><path d="M32 20c-1-4-4-6-8-6 3 3 3 5 3 6-3-2-6-2-9 0 4 2 7 3 9 6M32 20c1-4 4-6 8-6-3 3-3 5-3 6 3-2 6-2 9 0-4 2-7 3-9 6" fill="#3dd68c"/><path d="M32 21v-6" stroke="#2a9d6a" stroke-width="2.4" stroke-linecap="round"/>`,
  potato: `<ellipse cx="27" cy="36" rx="14" ry="11" transform="rotate(-18 27 36)" fill="#d4a96f"/><ellipse cx="40" cy="40" rx="12" ry="9.5" transform="rotate(14 40 40)" fill="#b98b52"/><ellipse cx="27" cy="36" rx="14" ry="11" transform="rotate(-18 27 36)" fill="none" stroke="#8a6238" stroke-width="1.4" opacity="0.5"/><circle cx="23" cy="34" r="1.3" fill="#8a6238"/><circle cx="30" cy="39" r="1.3" fill="#8a6238"/><circle cx="26" cy="42" r="1.1" fill="#8a6238"/><circle cx="40" cy="38" r="1.1" fill="#7c5a34"/><circle cx="44" cy="43" r="1.1" fill="#7c5a34"/>`,
  croissant: `<path d="M32 22c-11 0-20 8-22 16 0 3 3 5 6 4 4-1 6-4 8-5 2 2 5 3 8 3s6-1 8-3c2 1 4 4 8 5 3 1 6-1 6-4-2-8-11-16-22-16Z" fill="#e2a355"/><path d="M20 33c3-4 7-7 12-7s9 3 12 7c-2 2-4 3-5 5-2-2-4-3-7-3s-5 1-7 3c-1-2-3-3-5-5Z" fill="#c9883c"/><path d="M12 36c-1 1-2 2-2 3 0 3 3 5 6 4 3-1 5-3 7-4M52 36c1 1 2 2 2 3 0 3-3 5-6 4-3-1-5-3-7-4" fill="#f0bc72"/>`,
  bread: `<path d="M14 30c0-7 8-12 18-12s18 5 18 12v10c0 3-2 5-5 5H19c-3 0-5-2-5-5Z" fill="#d99c55"/><path d="M14 30c0-7 8-12 18-12s18 5 18 12c0 2-1 3-3 3H17c-2 0-3-1-3-3Z" fill="#edb877"/><path d="M25 24c1 2 1 4 0 6M32 23c1 2 1 5 0 7M39 24c1 2 1 4 0 6" stroke="#a5702f" stroke-width="2.2" stroke-linecap="round" fill="none"/>`,
  milk: `<path d="M25 14h14v34a3 3 0 0 1-3 3H28a3 3 0 0 1-3-3Z" fill="#eef1f7"/><path d="M25 14h7v37h-4a3 3 0 0 1-3-3Z" fill="#cdd4e0"/><path d="M28 8h8v6h-8z" fill="#aeb8c8"/><rect x="27" y="28" width="10" height="12" rx="2" fill="#8577ff" opacity="0.85"/><path d="M30 32h4M30 35h4" stroke="#e9e5ff" stroke-width="1.6" stroke-linecap="round"/>`,
  paneer: `<path d="M18 26 32 18l14 8v14l-14 8-14-8Z" fill="#f4f1e6"/><path d="M18 26v14l14 8V34Z" fill="#dcd8c8"/><path d="M32 34l14-8v14l-14 8Z" fill="#efece0"/><circle cx="27" cy="33" r="1.6" fill="#b9b4a0"/><circle cx="25" cy="39" r="1.4" fill="#b9b4a0"/><circle cx="30" cy="43" r="1.5" fill="#b9b4a0"/><circle cx="38" cy="36" r="1.4" fill="#c6c1ad"/>`,
  lettuce: `<path d="M32 52c-9 0-15-6-15-13 0-3 1-5 3-7-1-8 5-14 12-14s13 6 12 14c2 2 3 4 3 7 0 7-6 13-15 13Z" fill="#3dd68c"/><path d="M32 52c-5 0-9-3-9-7 0-4 4-7 9-7s9 3 9 7c0 4-4 7-9 7Z" fill="#8ee7b4"/><path d="M32 18c-2 4-2 8 0 12 2-4 2-8 0-12Z" fill="#2a9d6a"/><path d="M20 32c3 1 5 3 6 6M44 32c-3 1-5 3-6 6" stroke="#2a9d6a" stroke-width="2" stroke-linecap="round" fill="none"/>`,
  strawberry: `<path d="M32 22c8 0 14 5 14 11 0 8-8 15-14 15s-14-7-14-15c0-6 6-11 14-11Z" fill="#e8546e"/><path d="M32 22c8 0 14 5 14 11 0 2-.5 4-1.5 6-2-8-7-12-12.5-12S20 31 18 39c-1-2-1.5-4-1.5-6 0-6 6-11 14-11Z" fill="#c93a52" opacity="0.6"/><path d="M32 22c-6 0-10-2-12-6 4 1 6 0 8-2 1 2 2 3 4 3s3-1 4-3c2 2 4 3 8 2-2 4-6 6-12 6Z" fill="#3dd68c"/><path d="M32 18v4" stroke="#2a9d6a" stroke-width="2.2" stroke-linecap="round"/><circle cx="26" cy="36" r="1.4" fill="#ffd9e0"/><circle cx="34" cy="34" r="1.4" fill="#ffd9e0"/><circle cx="30" cy="42" r="1.4" fill="#ffd9e0"/><circle cx="37" cy="40" r="1.3" fill="#ffd9e0"/><circle cx="24" cy="42" r="1.2" fill="#ffd9e0"/>`,
  cheese: `<path d="M12 42 44 20l8 6v16a4 4 0 0 1-4 4H16a4 4 0 0 1-4-4Z" fill="#f5c451"/><path d="M12 42 44 20l8 6H20Z" fill="#fbd97e"/><circle cx="30" cy="36" r="3.4" fill="#e0a92e"/><circle cx="40" cy="34" r="2.4" fill="#e0a92e"/><circle cx="36" cy="42" r="2" fill="#e0a92e"/><circle cx="24" cy="41" r="1.6" fill="#e0a92e"/>`,
  rice: `<path d="M14 34h36c0 8-6 14-12 14H26c-6 0-12-6-12-14Z" fill="#aeb8c8"/><path d="M14 34h36c0 8-6 14-12 14h-6V34Z" fill="#98a3b5"/><path d="M18 34c-2-2-2-6 1-8 0-3 3-5 6-4 1-3 5-4 7-2 2-2 6-1 7 2 3-1 6 1 6 4 3 2 3 6 1 8Z" fill="#f2f4f8"/><path d="M25 28c.6 1.4.6 3 0 4M32 26c.6 1.4.6 3 0 4M39 28c.6 1.4.6 3 0 4" stroke="#c9d0dc" stroke-width="1.6" stroke-linecap="round" fill="none"/>`,
  egg: `<path d="M32 12c8 0 14 10 14 20 0 8-6 14-14 14s-14-6-14-14c0-10 6-20 14-20Z" fill="#f0e7d4"/><path d="M32 12c8 0 14 10 14 20 0 2-.3 4-.9 5.6C43 28 38 20 32 20s-11 8-13.1 17.6c-.6-1.6-.9-3.6-.9-5.6 0-10 6-20 14-20Z" fill="#dccfb2" opacity="0.7"/>`,
  fish: `<path d="M12 32c6-8 14-12 22-12 6 0 12 3 18 8v8c-6 5-12 8-18 8-8 0-16-4-22-12Z" fill="#7fb2d9"/><path d="M12 32c6-8 14-12 22-12 3 0 6 .6 9 2-10 2-18 6-24 12Z" fill="#5d92bd"/><path d="M52 28l8-6v20l-8-6Z" fill="#5d92bd"/><circle cx="21" cy="30" r="2.2" fill="#12314a"/><path d="M34 26c2 4 2 8 0 12" stroke="#12314a" stroke-width="1.6" stroke-linecap="round" fill="none" opacity="0.4"/>`,
  generic: `<path d="m32 10 18 10v24L32 54 14 44V20Z" fill="#8577ff" opacity="0.28"/><path d="m32 10 18 10-18 10-18-10Z" fill="#a99dff" opacity="0.5"/><path d="M32 30v24" stroke="#8577ff" stroke-width="2.4" stroke-linecap="round" opacity="0.6"/><path d="m14 20 18 10 18-10" fill="none" stroke="#a99dff" stroke-width="2" stroke-linejoin="round" opacity="0.5"/>`,
};

const TILES = {
  chicken: "tile-amber", potato: "tile-amber", bread: "tile-amber", croissant: "tile-amber", cheese: "tile-amber",
  tomato: "tile-red", strawberry: "tile-red", fish: "tile-blue",
  lettuce: "tile-green", rice: "tile-neutral", egg: "tile-neutral",
  milk: "tile-blue", paneer: "tile-neutral",
};

export function foodArt(product, cls = "") {
  const key = String(product || "").toLowerCase();
  const art = ART[key] || ART.generic;
  const tile = TILES[key] || "tile-violet";
  return `<div class="food-art ${tile} ${cls}" role="img" aria-label="${product} illustration">
    <svg viewBox="0 0 64 64" fill="none" aria-hidden="true">
      <ellipse cx="32" cy="52" rx="18" ry="4" fill="#000" opacity="0.25"/>
      ${art}
    </svg>
  </div>`;
}

export function artKey(product) {
  const k = String(product || "").toLowerCase();
  return ART[k] ? k : "generic";
}
