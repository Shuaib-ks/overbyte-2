/* The API is authoritative. No credentials or business records are stored in web storage. */
import { PRODUCTS,setBusinesses } from './data.js';
const empty=()=>({authed:false,authoritative:true,onboarded:false,bizId:null,user:null,businesses:[],inventory:{},salesHistory:[],listings:[],orders:[],alerts:[],notifications:[],analytics:{},insights:[],settings:{},sensors:[],watches:[],syncAt:null,syncedAt:null,error:null});
let state=empty(),generation=0,refreshing=null;
const subs=new Set();
const emit=meta=>subs.forEach(fn=>fn(state,meta));
const apply=(next,meta={})=>{state={...empty(),...next};setBusinesses(state.businesses);emit(meta);};
export const store={get:()=>state,subscribe(fn){subs.add(fn);return()=>subs.delete(fn);}};
async function api(path,body,method='POST'){
  // Wait beyond the configured 60-second function limit so the browser cannot
  // abort a write that Vercel is still processing and eventually returns 200.
  const signal=AbortSignal.timeout(70000);
  let response;
  try{response=await fetch('/api'+path,{method,credentials:'same-origin',headers:body===undefined?{}:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),signal});}
  catch(error){
    if(signal.aborted)throw new Error(method==='GET'?'The server took too long to load your data. Please retry.':'The server took too long to confirm this change. It may have been saved; retry the same request or refresh before creating another.');
    throw new Error(`Could not connect to OverByte (${error?.message||'network error'}). Check your connection and retry.`);
  }
  let data;
  try{data=await response.json();}
  catch(error){
    if(signal.aborted)throw new Error('The server took too long to finish its response. Your change may have been saved; refresh before trying again.');
    throw new Error(`OverByte returned HTTP ${response.status} without a valid JSON response. Please retry or contact support if this continues.`);
  }
  if(!response.ok){if(response.status===401&&state.authed){apply(empty());}throw new Error(data.error||`OverByte returned HTTP ${response.status}. Please retry.`);}return data;
}
async function mutate(path,p={},method='POST'){
  generation++;const data=await api(path,p,method);generation++;apply(data.state);return data.result;
}
async function refresh(options={}){
  if(refreshing)return refreshing;
  const version=generation;
  refreshing=(async()=>{try{const next=await api('/state',undefined,'GET');if(version===generation)apply(next,{background:options.background??true});return next;}catch(error){state={...state,error:error.message};emit({background:true});throw error;}finally{refreshing=null;}})();return refreshing;
}
export const selectors={
  biz:(s=state)=>s.businesses.find(b=>b.id===s.bizId),
  business:(id,s=state)=>s.businesses.find(b=>b.id===id),
  inventory:(s=state)=>s.inventory[s.bizId]||[],
  enrichedInventory:(s=state)=>s.inventory[s.bizId]||[],
  product:name=>PRODUCTS[name]||{cat:'Other',unit:'kg',storage:'Refrigerated'},
  totalInventoryValue:(s=state)=>(s.inventory[s.bizId]||[]).reduce((n,i)=>n+i.value,0),
  atRiskValue:(s=state)=>(s.inventory[s.bizId]||[]).reduce((n,i)=>n+(i.risk.probability||0)/100*i.value,0),
  pendingAlerts:(s=state)=>s.alerts.filter(a=>a.status==='pending'),
  marketplace:(s=state)=>s.listings.filter(l=>l.biz!==s.bizId&&l.status==='Active'&&l.qtyRemaining>0&&l.shelfHours>0),
  allListings:(s=state)=>s.listings,
  myActiveListings:(s=state)=>s.listings.filter(l=>l.biz===s.bizId),
  ordersFor:(s=state)=>s.orders,
  notificationsFor:(s=state)=>s.notifications,
  unreadCount:(s=state)=>s.notifications.filter(n=>!n.read).length,
};
export const actions={
  bootstrap:()=>refresh({background:false}),refresh,
  signup:p=>mutate('/auth/signup',p),login:p=>mutate('/auth/login',p),logout:()=>mutate('/auth/logout'),
  completeOnboarding:p=>mutate('/onboarding',p),updateProfile:p=>mutate('/profile',p,'PATCH'),updateSettings:p=>mutate('/settings',p,'PATCH'),
  addInventory:p=>mutate('/inventory',{...p,idempotencyKey:p.idempotencyKey||crypto.randomUUID()}),updateInventory:(id,p)=>mutate(`/inventory/${encodeURIComponent(id)}`,p,'PATCH'),
  adjustInventory:(id,delta,kind='adjustment')=>mutate(`/inventory/${encodeURIComponent(id)}/adjust`,{delta,kind}),
  recordConsumption:(id,qty)=>mutate(`/inventory/${encodeURIComponent(id)}/consume`,{qty}),
  registerSale:(id,qty,options={})=>mutate(`/inventory/${encodeURIComponent(id)}/sales`,{qty,idempotencyKey:options.idempotencyKey||crypto.randomUUID()}),
  async createListing(p){const result=await mutate('/listings',p);return state.listings.find(l=>l.id===result.id)||result;},
  async publishFromAlert(alertId,p){const alert=state.alerts.find(a=>a.id===alertId);if(!alert)throw new Error('This alert has changed. Refresh and review it again.');return actions.createListing({...p,inventoryItemId:p.inventoryItemId||alert.inventoryItemId});},
  cancelListing:id=>mutate(`/listings/${encodeURIComponent(id)}/cancel`),
  async createOrder(listingId,qty,options={}){const result=await mutate('/orders',{listingId,qty,idempotencyKey:options.idempotencyKey||crypto.randomUUID()});return state.orders.find(o=>o.id===result.id)||result;},
  advanceOrder:id=>mutate(`/orders/${encodeURIComponent(id)}/advance`),cancelOrder:id=>mutate(`/orders/${encodeURIComponent(id)}/cancel`),
  dismissAlert:id=>mutate(`/alerts/${encodeURIComponent(id)}/dismiss`),
  markRead:id=>mutate(`/notifications/${encodeURIComponent(id)}/read`),markAllRead:()=>mutate('/notifications/read-all'),
  addSensor:p=>mutate('/sensors',p),recordSensorReading:(id,p)=>mutate(`/sensors/${encodeURIComponent(id)}/readings`,p),
  addWatch:p=>mutate('/watches',p),
};
