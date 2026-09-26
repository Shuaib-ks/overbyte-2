// Fetch a coherent workspace read model in one remote query. All values remain
// bound parameters; only these static, server-owned SQL/column names are composed.
export function readStateData(service, businessId, time = Date.now()) {
  const stamp = new Date(time).toISOString();
  const startDay = new Date(time - 13 * 86400000).toISOString().slice(0, 10);
  const b = businessId;
  const listingColumns = 'id business_id inventory_id qty remaining price min_order expires_at pickup notes condition storage status created_at product category unit market batch';
  const listingSql = 'SELECT l.*,i.product,i.category,i.unit,i.market,i.batch FROM listings l JOIN inventory i ON i.id=l.inventory_id';
  const specs = {
    inventory: ['id business_id product category unit qty cost market expires_at daily_demand storage supplier batch created_at updated_at',
      'SELECT * FROM inventory WHERE business_id=? ORDER BY expires_at,created_at,id', [b]],
    consumption: ['product unit qty first',
      "SELECT lower(i.product) product,i.unit,COALESCE(SUM(-t.qty),0) qty,MIN(t.created_at) first FROM inventory_transactions t JOIN inventory i ON i.id=t.inventory_id WHERE t.business_id=? AND t.kind='consumption' AND t.created_at>=? GROUP BY lower(i.product),i.unit", [b, new Date(time - 7 * 86400000).toISOString()]],
    firstSales: ['product unit first',
      'SELECT lower(product) product,unit,MIN(created_at) first FROM inventory_sales WHERE business_id=? AND created_at<=? GROUP BY lower(product),unit', [b, stamp]],
    recentSales: ['product unit qty createdAt',
      'SELECT product,unit,qty,created_at AS createdAt FROM inventory_sales WHERE business_id=? AND created_at>=? AND created_at<=?', [b, new Date(Math.floor(time / 86400000) * 86400000 - 6 * 86400000).toISOString(), stamp]],
    incoming: ['product unit n',
      "SELECT lower(i.product) product,i.unit,COALESCE(SUM(o.qty),0) n FROM orders o JOIN listings l ON l.id=o.listing_id JOIN inventory i ON i.id=l.inventory_id WHERE o.buyer_id=? AND o.status='Ready for pickup' AND l.expires_at>? GROUP BY lower(i.product),i.unit", [b, stamp]],
    committed: ['inventory_id n',
      "SELECT inventory_id,SUM(qty) n FROM (SELECT inventory_id,remaining qty FROM listings WHERE business_id=? AND status='Active' AND expires_at>? UNION ALL SELECT l.inventory_id,o.qty FROM orders o JOIN listings l ON l.id=o.listing_id WHERE l.business_id=? AND o.status='Ready for pickup') GROUP BY inventory_id", [b, stamp, b]],
    dismissals: ['alert_id fingerprint', 'SELECT alert_id,fingerprint FROM alert_dismissals WHERE business_id=?', [b]],
    notificationKeys: ['event_key', 'SELECT event_key FROM notifications WHERE business_id=? AND event_key IS NOT NULL', [b]],
    notifications: ['id business_id kind priority title body link event_key is_read created_at',
      'SELECT * FROM notifications WHERE business_id=? ORDER BY created_at DESC LIMIT 300', [b]],
    orders: ['id listing_id buyer_id seller_id qty price total_paise reference_price status pickup payment_status idempotency_key created_at picked_at completed_at product unit',
      'SELECT o.*,i.product,i.unit FROM orders o JOIN listings l ON l.id=o.listing_id JOIN inventory i ON i.id=l.inventory_id WHERE o.buyer_id=? OR o.seller_id=? ORDER BY o.created_at DESC', [b, b]],
    businesses: ['id name type loc owner contact pickup lat lng onboarded settings created_at', 'SELECT * FROM businesses', []],
    orderCounts: ['seller_id n', "SELECT seller_id,COUNT(*) n FROM orders WHERE status IN ('Picked up','Completed') GROUP BY seller_id", []],
    listings: [listingColumns, listingSql + " WHERE l.business_id=? OR (l.status='Active' AND l.remaining>0 AND l.expires_at>?) ORDER BY l.created_at DESC", [b, stamp]],
    interested: ['listing_id n', "SELECT listing_id,COUNT(*) n FROM orders WHERE status<>'Cancelled' GROUP BY listing_id", []],
    sensors: ['id business_id name type unit created_at last_value last_reading_at',
      'SELECT s.*,r.value last_value,r.created_at last_reading_at FROM sensors s LEFT JOIN sensor_readings r ON r.id=(SELECT id FROM sensor_readings WHERE sensor_id=s.id ORDER BY created_at DESC LIMIT 1) WHERE s.business_id=?', [b]],
    history: ['id business_id product unit qty idempotency_key created_at',
      'SELECT * FROM inventory_sales WHERE business_id=? ORDER BY created_at DESC,id DESC LIMIT 100', [b]],
    allocations: ['sale_id inventoryItemId batch qty',
      'SELECT a.sale_id,a.inventory_id AS inventoryItemId,i.batch,a.qty FROM inventory_sale_allocations a JOIN inventory i ON i.id=a.inventory_id WHERE a.sale_id IN (SELECT id FROM inventory_sales WHERE business_id=? ORDER BY created_at DESC,id DESC LIMIT 100) ORDER BY i.expires_at,i.created_at,i.id', [b]],
    snapshots: ['business_id day inventory_value risk', 'SELECT * FROM daily_snapshots WHERE business_id=? ORDER BY day', [b]],
    recentListings: [listingColumns, listingSql + ' WHERE l.business_id=? AND l.created_at>=?', [b, startDay]],
    waste: ['n', "SELECT COALESCE(SUM(CASE WHEN i.unit='g' THEN -t.qty/1000.0 ELSE -t.qty END),0) n FROM inventory_transactions t JOIN inventory i ON i.id=t.inventory_id WHERE t.business_id=? AND t.kind='waste' AND i.unit IN ('kg','g') AND t.created_at>=?", [b, startDay]],
    watches: ['id product', 'SELECT id,product FROM watches WHERE business_id=?', [b]],
  };
  const args = [];
  const expressions = Object.entries(specs).map(([name, [columns, sql, values]]) => {
    args.push(...values);
    const pairs = columns.split(' ').map(column => `'${column}',"${column}"`).join(',');
    return `(SELECT json_group_array(json_object(${pairs})) FROM (${sql})) AS "${name}"`;
  });
  const row = service.one(`SELECT ${expressions.join(',')}`, ...args);
  return Object.fromEntries(Object.keys(specs).map(name => [name, JSON.parse(row[name])]));
}
