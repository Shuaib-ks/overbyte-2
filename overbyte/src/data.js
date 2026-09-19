/* ============================================================
   OVERBYTE — Demo dataset
   Five interconnected businesses around Indiranagar, Bengaluru.
   The prototype demo scenario (PRD §47) is wired end-to-end:
   GreenFork's surplus chicken ↔ Harvest Table's chicken shortage.
   ============================================================ */

/* ---------- Product catalog ---------- */
export const PRODUCTS = {
  "Chicken Breast": { cat: "Meat & Poultry", unit: "kg", market: 240, storage: "Refrigerated" },
  "Tomatoes":       { cat: "Produce",         unit: "kg", market: 96,  storage: "Ambient" },
  "Potatoes":       { cat: "Produce",         unit: "kg", market: 38,  storage: "Ambient" },
  "Butter Croissants": { cat: "Bakery",       unit: "pcs", market: 48, storage: "Ambient" },
  "Sourdough Loaves":  { cat: "Bakery",       unit: "pcs", market: 80, storage: "Ambient" },
  "Milk":           { cat: "Dairy",           unit: "L",  market: 58,  storage: "Refrigerated" },
  "Paneer":         { cat: "Dairy",           unit: "kg", market: 360, storage: "Refrigerated" },
  "Lettuce":        { cat: "Produce",         unit: "kg", market: 110, storage: "Refrigerated" },
  "Strawberries":   { cat: "Fruits",          unit: "kg", market: 320, storage: "Refrigerated" },
  "Basmati Rice":   { cat: "Grocery",         unit: "kg", market: 120, storage: "Dry storage" },
  "Bread Loaves":   { cat: "Bakery",          unit: "pcs", market: 40, storage: "Ambient" },
};

/* ---------- Businesses ---------- */
export const BUSINESSES = [
  { id: "b_gf", name: "GreenFork Kitchen", type: "Restaurant", loc: "Indiranagar, 100 Ft Rd", rating: 4.7, orders: 128, verified: true, hue: 0,
    pickup: "10:00 AM – 10:00 PM", owner: "Rohan Mehta", email: "rohan@greenfork.in" },
  { id: "b_uc", name: "Urban Crumb Bakery", type: "Bakery", loc: "Koramangala, 5th Block", rating: 4.9, orders: 214, verified: true, hue: 1,
    pickup: "7:00 AM – 8:00 PM", owner: "Ananya Rao", email: "ananya@urbancrumb.in" },
  { id: "b_fl", name: "FreshLine Grocers", type: "Grocery Store", loc: "HSR Layout, Sector 2", rating: 4.6, orders: 342, verified: true, hue: 2,
    pickup: "8:00 AM – 9:00 PM", owner: "Vikram Shah", email: "vikram@freshline.in" },
  { id: "b_ht", name: "Harvest Table", type: "Restaurant", loc: "Domlur,-level 1", rating: 4.8, orders: 96, verified: true, hue: 3,
    pickup: "11:00 AM – 11:00 PM", owner: "Sara D'Souza", email: "sara@harvesttable.in" },
  { id: "b_dg", name: "Daily Grind Café", type: "Café", loc: "Indiranagar, 12th Main", rating: 4.5, orders: 87, verified: true, hue: 4,
    pickup: "8:00 AM – 7:00 PM", owner: "Kabir Anand", email: "kabir@dailygrind.in" },
];

export const DIST = {
  "b_gf|b_uc": 2.1, "b_gf|b_fl": 3.5, "b_gf|b_ht": 2.8, "b_gf|b_dg": 1.2,
  "b_uc|b_fl": 4.4, "b_uc|b_ht": 1.9, "b_uc|b_dg": 2.6,
  "b_fl|b_ht": 4.8, "b_fl|b_dg": 3.9, "b_ht|b_dg": 2.3,
};
export const distance = (a, b) => (a === b ? 0 : DIST[[a, b].sort().join("|")] ?? 5);

/* ---------- Inventory ---------- */
export const INVENTORY = {
  b_gf: [
    { id: "it_gf1", product: "Chicken Breast", qty: 18, cost: 220, shelfHours: 18, demand: 7, storage: "Refrigerated", supplier: "Prime Farms", batch: "CK-2291", demandLabel: "6–8 kg" },
    { id: "it_gf2", product: "Tomatoes", qty: 25, cost: 96, shelfHours: 44, demand: 18, storage: "Ambient", supplier: "Kolar Farms", batch: "TM-8841" },
    { id: "it_gf3", product: "Butter Croissants", qty: 24, cost: 45, shelfHours: 31, demand: 8, storage: "Ambient", supplier: "In-house", batch: "CR-1120" },
    { id: "it_gf4", product: "Milk", qty: 40, cost: 58, shelfHours: 52, demand: 30, storage: "Refrigerated", supplier: "Nandini", batch: "MK-5502" },
    { id: "it_gf5", product: "Paneer", qty: 9, cost: 340, shelfHours: 60, demand: 7, storage: "Refrigerated", supplier: "Gowardhan", batch: "PN-3301" },
    { id: "it_gf6", product: "Lettuce", qty: 14, cost: 80, shelfHours: 36, demand: 11, storage: "Refrigerated", supplier: "Green Acres", batch: "LT-7714" },
    { id: "it_gf7", product: "Basmati Rice", qty: 120, cost: 110, shelfHours: 2160, demand: 60, storage: "Dry storage", supplier: "India Gate", batch: "RC-0021" },
    { id: "it_gf8", product: "Strawberries", qty: 10, cost: 280, shelfHours: 22, demand: 14, storage: "Refrigerated", supplier: "Mahabaleshwer Co.", batch: "SB-4410" },
    { id: "it_gf9", product: "Potatoes", qty: 60, cost: 32, shelfHours: 480, demand: 45, storage: "Ambient", supplier: "Agra Wholesale", batch: "PT-9034" },
    { id: "it_gf10", product: "Bread Loaves", qty: 30, cost: 40, shelfHours: 26, demand: 22, storage: "Ambient", supplier: "Urban Crumb", batch: "BR-1188" },
  ],
  b_ht: [
    { id: "it_ht1", product: "Chicken Breast", qty: 8, cost: 240, shelfHours: 30, demand: 20, storage: "Refrigerated", supplier: "Prime Farms", batch: "CK-2288" },
    { id: "it_ht2", product: "Tomatoes", qty: 6, cost: 94, shelfHours: 40, demand: 9, storage: "Ambient", supplier: "Kolar Farms", batch: "TM-8839" },
    { id: "it_ht3", product: "Paneer", qty: 5, cost: 345, shelfHours: 55, demand: 4, storage: "Refrigerated", supplier: "Gowardhan", batch: "PN-3297" },
    { id: "it_ht4", product: "Basmati Rice", qty: 80, cost: 112, shelfHours: 2160, demand: 40, storage: "Dry storage", supplier: "India Gate", batch: "RC-0018" },
    { id: "it_ht5", product: "Milk", qty: 22, cost: 58, shelfHours: 48, demand: 18, storage: "Refrigerated", supplier: "Nandini", batch: "MK-5490" },
    { id: "it_ht6", product: "Lettuce", qty: 8, cost: 82, shelfHours: 34, demand: 6, storage: "Refrigerated", supplier: "Green Acres", batch: "LT-7702" },
  ],
};
/* ---------- Surplus listings (live on the marketplace) ---------- */
export const LISTINGS = [
  { id: "l_uc1", biz: "b_uc", product: "Sourdough Loaves", qty: 40, price: 55, shelfHours: 26, cond: "Fresh", storage: "Ambient", pickup: "Today 6–9 PM", notes: "Baked this morning. Best within 24h.", packaging: "Paper bags, 5 pcs each", source: "Bakery surplus" },
  { id: "l_uc2", biz: "b_uc", product: "Butter Croissants", qty: 40, price: 30, shelfHours: 20, cond: "Fresh", storage: "Ambient", pickup: "Today 6–9 PM", notes: "End-of-day batch, unsold display stock.", packaging: "Trays of 10", source: "Bakery surplus" },
  { id: "l_fl1", biz: "b_fl", product: "Tomatoes", qty: 30, price: 68, shelfHours: 40, cond: "Fresh", storage: "Ambient", pickup: "Today 4–8 PM", notes: "Grade-A salad tomatoes, crates of 10 kg.", packaging: "10 kg crates", source: "Over-ordered stock" },
  { id: "l_fl2", biz: "b_fl", product: "Milk", qty: 25, price: 44, shelfHours: 28, cond: "Fresh", storage: "Refrigerated", pickup: "Today 4–8 PM", notes: "Chilled, unopened 1L cartons.", packaging: "1L cartons", source: "Near-expiry stock" },
  { id: "l_fl3", biz: "b_fl", product: "Strawberries", qty: 8, price: 195, shelfHours: 14, cond: "Fresh", storage: "Refrigerated", pickup: "Today 3–7 PM", notes: "Premium berries, punnets of 250 g.", packaging: "250 g punnets", source: "Over-ordered stock" },
  { id: "l_dg1", biz: "b_dg", product: "Paneer", qty: 6, price: 260, shelfHours: 48, cond: "Fresh", storage: "Refrigerated", pickup: "Tomorrow 9 AM–1 PM", notes: "Sealed 1 kg blocks, kept at 4°C.", packaging: "1 kg vacuum blocks", source: "Café stock" },
  { id: "l_dg2", biz: "b_dg", product: "Bread Loaves", qty: 20, price: 26, shelfHours: 22, cond: "Fresh", storage: "Ambient", pickup: "Today 5–8 PM", notes: "Sandwich loaves from breakfast service.", packaging: "Individual", source: "Café stock" },
  { id: "l_ht1", biz: "b_ht", product: "Chicken Breast", qty: 20, price: 195, shelfHours: 27, cond: "Fresh", storage: "Refrigerated", pickup: "Today 7–10 PM", notes: "Airline-grade breast portions, IQF.", packaging: "2 kg packs", source: "Event cancellation" },
];

/* ---------- Orders ---------- */
export const ORDERS = [
  { id: "OB-2041", buyer: "b_gf", seller: "b_dg", product: "Paneer", qty: 4, unit: "kg", price: 260, status: "Completed", pickup: "3 days ago, 12:30 PM", placedMins: 4320 },
  { id: "OB-2038", buyer: "b_gf", seller: "b_uc", product: "Butter Croissants", qty: 18, unit: "pcs", price: 30, status: "Completed", pickup: "Yesterday, 6:45 PM", placedMins: 1560 },
  { id: "OB-2035", buyer: "b_gf", seller: "b_fl", product: "Tomatoes", qty: 10, unit: "kg", price: 72, status: "Completed", pickup: "5 days ago, 5:10 PM", placedMins: 7200 },
  { id: "OB-2030", buyer: "b_dg", seller: "b_gf", product: "Milk", qty: 10, unit: "L", price: 52, status: "Completed", pickup: "2 days ago, 9:00 AM", placedMins: 2880 },
  { id: "OB-2027", buyer: "b_ht", seller: "b_gf", product: "Bread Loaves", qty: 15, unit: "pcs", price: 30, status: "Completed", pickup: "4 days ago, 4:00 PM", placedMins: 5760 },
  { id: "OB-2043", buyer: "b_ht", seller: "b_fl", product: "Tomatoes", qty: 5, unit: "kg", price: 70, status: "Ready for pickup", pickup: "Today, 6:30 PM", placedMins: 90 },
  { id: "OB-2044", buyer: "b_uc", seller: "b_fl", product: "Milk", qty: 12, unit: "L", price: 46, status: "Awaiting pickup", pickup: "Tomorrow, 8:00 AM", placedMins: 40 },
];

/* ---------- AI alerts (surplus + shortage) ---------- */
export const ALERTS = [
  { id: "al1", biz: "b_gf", kind: "surplus", item: "it_gf1", product: "Chicken Breast", qty: 18, unit: "kg", expectedDemand: [6, 8], surplus: [10, 12], wasteProb: 72, shelfHours: 18, createdMins: 34, status: "pending" },
  { id: "al2", biz: "b_gf", kind: "surplus", item: "it_gf3", product: "Butter Croissants", qty: 24, unit: "pcs", expectedDemand: [7, 9], surplus: [15, 17], wasteProb: 66, shelfHours: 31, createdMins: 58, status: "pending" },
  { id: "al3", biz: "b_gf", kind: "shortage", item: "it_gf8", product: "Strawberries", stock: 10, unit: "kg", expectedDemand: 14, shortage: 4, byLabel: "Tomorrow ~5:30 PM", createdMins: 26, status: "pending" },
  { id: "al4", biz: "b_ht", kind: "shortage", item: "it_ht1", product: "Chicken Breast", stock: 8, unit: "kg", expectedDemand: 20, shortage: 12, byLabel: "Tomorrow ~2:30 PM", createdMins: 41, status: "pending" },
  { id: "al5", biz: "b_ht", kind: "shortage", item: "it_ht2", product: "Tomatoes", stock: 6, unit: "kg", expectedDemand: 9, shortage: 3, byLabel: "Tomorrow ~4:00 PM", createdMins: 41, status: "pending" },
  { id: "al6", biz: "b_gf", kind: "surplus", item: "it_gf4", product: "Milk", qty: 40, unit: "L", expectedDemand: [28, 32], surplus: [8, 12], wasteProb: 24, shelfHours: 52, createdMins: 1200, status: "dismissed" },
];

/* ---------- Notifications ---------- */
export const NOTIFICATIONS = [
  { id: "n1", biz: "b_gf", kind: "AI ALERT", prio: "critical", title: "Chicken Breast may become surplus in ~18 hours", body: "18 kg on hand · 72% waste probability. OverByte recommends creating a listing.", mins: 34, read: false },
  { id: "n2", biz: "b_gf", kind: "SHORTAGE", prio: "high", title: "Strawberries may run out tomorrow", body: "10 kg in stock vs 14 kg expected demand. Find surplus on the marketplace.", mins: 26, read: false },
  { id: "n3", biz: "b_gf", kind: "MARKETPLACE", prio: "medium", title: "A nearby bakery listed 40 croissants", body: "Urban Crumb Bakery · 2.1 km away · ₹30/pcs · expires in ~20h.", mins: 47, read: false },
  { id: "n4", biz: "b_gf", kind: "ORDER", prio: "info", title: "Surplus order confirmed", body: "Daily Grind Café purchased 10 L Milk · pickup tomorrow 9:00 AM.", mins: 240, read: true },
  { id: "n5", biz: "b_gf", kind: "SENSOR", prio: "high", title: "Cold Storage #01 temperature stable", body: "3.8°C · within safe range for the last 24 hours.", mins: 380, read: true },
  { id: "n6", biz: "b_gf", kind: "AI ALERT", prio: "high", title: "Croissants trending towards surplus", body: "24 pcs on hand vs 8 expected. 66% waste probability.", mins: 58, read: false },
  { id: "n7", biz: "b_ht", kind: "SHORTAGE", prio: "critical", title: "Chicken Breast shortage projected", body: "8 kg stock vs 20 kg demand. Shortage expected tomorrow ~2:30 PM.", mins: 41, read: false },
  { id: "n8", biz: "b_ht", kind: "SHORTAGE", prio: "high", title: "Tomatoes below par level", body: "6 kg stock vs 9 kg demand. OverByte suggests finding surplus.", mins: 41, read: false },
  { id: "n9", biz: "b_ht", kind: "ORDER", prio: "info", title: "Order OB-2043 ready for pickup", body: "FreshLine Grocers · 5 kg Tomatoes · today 6:30 PM.", mins: 90, read: true },
  { id: "n10", biz: "b_uc", kind: "MARKETPLACE", prio: "medium", title: "Your croissant listing received a buyer", body: "Daily Grind Café is interested in 18 pcs.", mins: 65, read: false },
];
/* ---------- Insights (templates rendered by the insights engine) ---------- */
export const INSIGHTS = {
  b_gf: [
    { kind: "SUPPLY PATTERN", tone: "violet", title: "Your kitchen generated 23% more croissant surplus than usual this week",
      body: "Peak surplus lands Friday 5–7 PM, driven by weekend prep over-production. Reducing Friday's bake by ~12% would clear the gap without risking stockouts.",
      stats: [["Peak window", "Fri 5–7 PM"], ["Trend", "+23% vs avg"], ["Confidence", "87%"]],
      action: { label: "Adjust production plan", tone: "primary" },
      impact: "Potential monthly savings: ₹18,400" },
    { kind: "PURCHASING OPPORTUNITY", tone: "teal", title: "You're overpaying for tomatoes relative to nearby surplus",
      body: "You purchased tomatoes at an average ₹96/kg this month. Similar surplus inventory was available at an average ₹72/kg within 4 km.",
      stats: [["Your avg cost", "₹96/kg"], ["Surplus avg", "₹72/kg"], ["Distance", "≤ 4 km"]],
      action: { label: "Set purchase alert", tone: "ghost" },
      impact: "Potential savings: ₹8,240/month" },
    { kind: "DEMAND SIGNAL", tone: "green", title: "Chicken demand expected to rise 15% next week",
      body: "A citywide food festival (Oct 2–5) historically lifts your covers by ~15%. Current stock covers 4 of 6 projected days.",
      stats: [["Expected lift", "+15%"], ["Coverage", "4 of 6 days"], ["Confidence", "81%"]],
      action: { label: "Review purchase plan", tone: "ghost" },
      impact: "Avoid ~₹22,000 in last-minute premium buys" },
    { kind: "PERFORMANCE", tone: "green", title: "Waste risk is down 12% week over week",
      body: "Listing surplus earlier (18h before expiry vs 9h) doubled your match rate. Keep confirming AI listings within 2 hours of the alert.",
      stats: [["Waste risk", "18%"], ["Change", "↓ 12%"], ["Match rate", "2.1×"]],
      action: null, impact: "" },
  ],
  b_ht: [
    { kind: "SUPPLY PATTERN", tone: "violet", title: "Chicken shortage recurs every Wednesday–Thursday",
      body: "Demand spikes mid-week while your standing order stays flat. OverByte recommends +8 kg on Wednesday deliveries or an auto-match rule on the marketplace.",
      stats: [["Pattern", "6 of 8 weeks"], ["Avg gap", "11 kg"], ["Confidence", "84%"]],
      action: { label: "Create auto-match rule", tone: "primary" },
      impact: "Prevents ~₹14,000/month in lost covers" },
    { kind: "PURCHASING OPPORTUNITY", tone: "teal", title: "Nearby surplus chicken consistently under market",
      body: "Over the last 30 days, verified chicken surplus within 5 km averaged ₹188/kg vs your ₹240/kg purchase cost.",
      stats: [["Your cost", "₹240/kg"], ["Surplus avg", "₹188/kg"], ["Listings seen", "23"]],
      action: { label: "Set purchase alert", tone: "ghost" },
      impact: "Potential savings: ₹9,600/month" },
  ],
};
/* ---------- Analytics aggregates & series ---------- */
export const ANALYTICS = {
  b_gf: {
    foodSaved: 124820, recoveredKg: 682, wastePreventedKg: 391, surplusRevenue: 82400, purchaseSavings: 31200,
    wasteRisk: 18, wasteRiskDelta: -12,
    invValue: [71.2, 72.8, 74.1, 73.5, 75.9, 77.2, 76.4, 78.1, 79.6, 80.3, 81.9, 82.4, 83.1, 84.26],
    riskSeries: [31, 29, 30, 26, 27, 24, 25, 22, 23, 21, 20, 21, 19, 18],
    created: [0, 2, 1, 3, 2, 4, 1, 2, 3, 2, 4, 3, 2, 2],
    sold: [0, 1, 1, 2, 2, 3, 1, 2, 2, 2, 3, 3, 2, 1],
    revenue: [0, 3.2, 2.8, 5.1, 6.4, 8.2, 3.9, 5.4, 6.1, 5.8, 7.6, 8.4, 6.2, 4.1],
    savings: [0, 0.8, 1.1, 0.9, 1.4, 1.8, 1.2, 1.6, 2.1, 1.9, 2.4, 2.8, 2.2, 1.6],
    topSurplus: [["Chicken Breast", 86], ["Butter Croissants", 64], ["Milk", 52], ["Tomatoes", 44], ["Bread Loaves", 31]],
    topNeeded: [["Chicken Breast", 74], ["Strawberries", 58], ["Tomatoes", 46], ["Paneer", 38], ["Lettuce", 27]],
  },
  b_ht: {
    foodSaved: 68410, recoveredKg: 391, wastePreventedKg: 208, surplusRevenue: 21400, purchaseSavings: 43800,
    wasteRisk: 26, wasteRiskDelta: -8,
    invValue: [52.4, 53.1, 54.8, 54.2, 55.6, 56.9, 56.1, 57.8, 58.4, 59.2, 60.1, 60.8, 61.5, 62.3],
    riskSeries: [38, 36, 37, 34, 32, 33, 31, 30, 29, 28, 28, 27, 26, 26],
    created: [0, 1, 0, 1, 1, 2, 0, 1, 1, 1, 2, 1, 1, 0],
    sold: [0, 1, 0, 1, 0, 1, 0, 1, 1, 0, 1, 1, 1, 0],
    revenue: [0, 1.8, 1.2, 2.4, 2.1, 3.6, 1.9, 2.8, 3.1, 2.4, 3.8, 4.2, 3.4, 2.1],
    savings: [0, 1.2, 1.6, 1.4, 2.2, 2.6, 1.9, 2.4, 3.1, 2.8, 3.4, 3.9, 3.2, 2.4],
    topSurplus: [["Bread Loaves", 42], ["Milk", 34], ["Paneer", 28], ["Tomatoes", 22], ["Lettuce", 18]],
    topNeeded: [["Chicken Breast", 88], ["Tomatoes", 61], ["Strawberries", 33], ["Paneer", 29], ["Lettuce", 21]],
  },
};

export const ANALYTICS_LABELS = ["Sep 3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "13", "14", "15", "Today"];

/* ---------- IoT sensors ---------- */
export const SENSORS = {
  b_gf: [
    { id: "s1", name: "Cold Storage #01", type: "Temperature sensor", icon: "thermometer", status: "online", metric: "3.8°C", metricLabel: "Temperature", battery: 82, syncMins: 0.2, range: "0–4°C safe" },
    { id: "s2", name: "Walk-in Freezer #02", type: "Temperature sensor", icon: "snowflake", status: "online", metric: "-18.4°C", metricLabel: "Temperature", battery: 64, syncMins: 0.3, range: "-22–-15°C safe" },
    { id: "s3", name: "Smart Scale · Prep Station", type: "Inventory sensor", icon: "scaleIcon", status: "online", metric: "18.0 kg", metricLabel: "Last reading", battery: 91, syncMins: 4, range: "Auto-logs batches" },
    { id: "s4", name: "POS Terminal #1", type: "POS integration", icon: "monitor", status: "online", metric: "Live", metricLabel: "Sales feed", battery: null, syncMins: 0.1, range: "Sales velocity sync" },
    { id: "s5", name: "RFID Gateway · Dock 2", type: "RFID reader", icon: "radio", status: "offline", metric: "No signal", metricLabel: "Status", battery: 12, syncMins: 240, range: "Receiving alerts" },
    { id: "s6", name: "Barcode Scanner · Handheld", type: "Scanner", icon: "barcode", status: "online", metric: "Paired", metricLabel: "Connection", battery: 76, syncMins: 30, range: "Goods-in scanning" },
  ],
  b_ht: [
    { id: "hs1", name: "Cold Storage #01", type: "Temperature sensor", icon: "thermometer", status: "online", metric: "4.1°C", metricLabel: "Temperature", battery: 77, syncMins: 0.2, range: "0–4°C safe" },
    { id: "hs2", name: "POS Terminal #1", type: "POS integration", icon: "monitor", status: "online", metric: "Live", metricLabel: "Sales feed", battery: null, syncMins: 0.1, range: "Sales velocity sync" },
    { id: "hs3", name: "Smart Scale · Receiving", type: "Inventory sensor", icon: "scaleIcon", status: "online", metric: "8.0 kg", metricLabel: "Last reading", battery: 88, syncMins: 2, range: "Auto-logs batches" },
  ],
};

export const AI_STATUS = {
  b_gf: { monitoring: true, lastSyncSecs: 12, model: "demand-v2.3", itemsTracked: 10, accuracy: 94 },
  b_ht: { monitoring: true, lastSyncSecs: 8, model: "demand-v2.3", itemsTracked: 6, accuracy: 92 },
};

export const bizById = (id) => BUSINESSES.find((b) => b.id === id);