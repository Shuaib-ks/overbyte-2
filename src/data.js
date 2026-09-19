/* Product-entry suggestions. Business data comes only from the authenticated API. */
export const PRODUCTS=Object.fromEntries([
  ['Chicken Breast','Meat & Poultry','kg','Refrigerated'],['Tomatoes','Produce','kg','Ambient'],['Potatoes','Produce','kg','Ambient'],
  ['Croissants','Bakery','pcs','Ambient'],['Bread','Bakery','pcs','Ambient'],['Milk','Dairy','L','Refrigerated'],['Paneer','Dairy','kg','Refrigerated'],
  ['Lettuce','Produce','kg','Refrigerated'],['Strawberries','Fruits','kg','Refrigerated'],['Cheese','Dairy','kg','Refrigerated'],['Rice','Grocery','kg','Ambient']
].map(([name,cat,unit,storage])=>[name,{cat,unit,storage}]));
export const BUSINESSES=[];
export function setBusinesses(list){BUSINESSES.splice(0,BUSINESSES.length,...list);}
export const bizById=id=>BUSINESSES.find(b=>b.id===id)||{id,name:'Business',type:'Business',loc:'Location not provided',verified:false,rating:null};
export const ANALYTICS_LABELS=[];
