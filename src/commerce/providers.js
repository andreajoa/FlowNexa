import {commerceHttp,storeOrigin,fail} from './http.js';
export const PROVIDERS=['shopify','woocommerce','nuvemshop','wordpress'];
const short=(s,n=160)=>String(s??'').replace(/<[^>]*>/g,'').slice(0,n);
const cleanLink=s=>{try{const u=new URL(s);return u.protocol==='https:'&&!u.username&&!u.password?u.href:null;}catch{return null;}};
export function validateCredentials(provider,input){
 if(!PROVIDERS.includes(provider)||!input||typeof input!=='object')throw fail('commerce_invalid_provider');
 const c={};
 if(provider==='nuvemshop'){if(!/^\d{1,20}$/.test(String(input.store_id)))throw fail('commerce_invalid_store_id');c.store_id=String(input.store_id);c.origin='https://api.tiendanube.com';}
 else{c.origin=storeOrigin(input.url);if(provider==='shopify'&&!/^https:\/\/[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(c.origin))throw fail('commerce_shopify_domain');}
 for(const k of ['access_token','client_id','client_secret','consumer_key','consumer_secret','username','application_password','webhook_secret','bridge_secret'])if(input[k]){if(typeof input[k]!=='string'||input[k].length>4096||/[\r\n]/.test(input[k]))throw fail('commerce_invalid_credentials');c[k]=input[k];}
 if(provider==='shopify'&&!c.access_token&&!(c.client_id&&c.client_secret)||provider==='nuvemshop'&&!c.access_token||provider==='woocommerce'&&!(c.consumer_key&&c.consumer_secret)||provider==='wordpress'&&!(c.username&&c.application_password))throw fail('commerce_missing_credentials');
 return c;
}
async function shopify(env,c,query,variables={}){
 if(c.client_id&&c.client_secret&&(!c.access_token||!c.expires_at||Date.now()>c.expires_at-120000)){
  const t=await commerceHttp(env,c.origin+'/admin/oauth/access_token',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'client_credentials',client_id:c.client_id,client_secret:c.client_secret}).toString()});
  if(!t.access_token||!Number.isFinite(t.expires_in))throw fail('commerce_shopify_token',502);c.access_token=t.access_token;c.expires_at=Date.now()+t.expires_in*1000;
 }
 const r=await commerceHttp(env,c.origin+'/admin/api/2026-10/graphql.json',{method:'POST',headers:{'X-Shopify-Access-Token':c.access_token,'content-type':'application/json'},body:JSON.stringify({query,variables})});
 if(r.errors?.length||!r.data)throw fail('commerce_credentials_or_scope',502);return r.data;
}
function wc(env,c,path,method='GET',data){return commerceHttp(env,c.origin+'/wp-json/'+path,{method,headers:{authorization:'Basic '+Buffer.from(c.consumer_key+':'+c.consumer_secret).toString('base64'),'content-type':'application/json'},body:data?JSON.stringify(data):undefined});}
function wp(env,c,path){return commerceHttp(env,c.origin+'/wp-json/'+path,{headers:{authorization:'Basic '+Buffer.from(c.username+':'+c.application_password).toString('base64')}});}
function nube(env,c,path,method='GET',data){return commerceHttp(env,'https://api.tiendanube.com/2025-03/'+c.store_id+'/'+path,{method,headers:{Authorization:'Bearer '+c.access_token,'User-Agent':'FlowNexa (flownex@proton.me)','content-type':'application/json'},body:data?JSON.stringify(data):undefined});}
export async function probeStore(env,provider,c){
 if(provider==='shopify'){const r=await shopify(env,c,'{shop{id name myshopifyDomain} currentAppInstallation{accessScopes{handle}}}');const scopes=r.currentAppInstallation.accessScopes.map(s=>s.handle);return{remote_id:r.shop.id,name:r.shop.name,capabilities:{products:scopes.includes('read_products'),orders:scopes.includes('read_orders'),tracking:scopes.includes('read_orders'),abandoned_carts:scopes.includes('read_orders'),webhooks:Boolean(c.webhook_secret||c.client_secret)},scopes};}
 if(provider==='woocommerce'){const r=await wc(env,c,'wc/v3/products?per_page=1');if(!Array.isArray(r))throw fail('commerce_invalid_response',502);const orders=await wc(env,c,'wc/v3/orders?per_page=1');const index=await commerceHttp(env,c.origin+'/wp-json/');
  const routes=Object.keys(index.routes||{});c.tracking_namespace=routes.some(r=>r.startsWith('/wc-shipment-tracking/v3/'))?'wc-shipment-tracking/v3':routes.some(r=>r.includes('/shipment-tracking'))?'wc/v3':null;
  let bridge=false;if(c.bridge_secret){const b=await commerceHttp(env,c.origin+'/wp-json/flownexa/v1/capabilities',{headers:{'X-FlowNexa-Key':c.bridge_secret}});bridge=b.abandoned_carts===true;}
  const tracking=Boolean(c.tracking_namespace)||orders.some(o=>(o.meta_data||[]).some(m=>m.key==='_wc_shipment_tracking_items'));
  return{remote_id:c.origin,name:new URL(c.origin).hostname,capabilities:{products:true,orders:true,tracking,abandoned_carts:bridge,webhooks:true}};}
 if(provider==='wordpress'){const user=await wp(env,c,'wp/v2/users/me');if(!user.id)throw fail('commerce_credentials_or_scope',502);return{remote_id:c.origin,name:new URL(c.origin).hostname,capabilities:{products:false,orders:false,tracking:false,abandoned_carts:false,content:true,webhooks:Boolean(c.bridge_secret)}};}
 const r=await nube(env,c,'store');if(String(r.id)!==c.store_id)throw fail('commerce_invalid_response',502);return{remote_id:String(r.id),name:short(r.name?.pt||r.name?.en||r.name||r.url),capabilities:{products:true,orders:true,tracking:true,abandoned_carts:true,webhooks:Boolean(c.webhook_secret||env.NUVEMSHOP_CLIENT_SECRET)}};
}
export async function queryStore(env,provider,c,operation,input={}){
 if(!['products','order','tracking','abandoned_carts','content'].includes(operation))throw fail('commerce_invalid_operation');
 const reference=short(input.reference,80).replace(/^#/,'');const email=String(input.email||'').trim().toLowerCase();
 if(['order','tracking','abandoned_carts'].includes(operation)&&(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254))throw fail('commerce_customer_identity_required');
 if(['order','tracking'].includes(operation)&&!/^[\p{L}\p{N}_-]{1,60}$/u.test(reference))throw fail('commerce_order_reference_required');
 if(provider==='shopify'){
  if(operation==='products'){const r=await shopify(env,c,'query($q:String!){products(first:5,query:$q,sortKey:CREATED_AT,reverse:true){nodes{id title onlineStoreUrl status variants(first:1){nodes{price}}}}}',{q:'status:active'+(input.search?' AND title:'+JSON.stringify(short(input.search,80)):'')});return{products:r.products.nodes.filter(p=>p.onlineStoreUrl).map(p=>({id:p.id,name:short(p.title),url:cleanLink(p.onlineStoreUrl),price:p.variants.nodes[0]?.price}))};}
  if(operation==='abandoned_carts'){let after=null,carts=[],hasMore=false;for(let page=0;page<5;page++){const r=await shopify(env,c,'query($after:String){abandonedCheckouts(first:50,after:$after,query:"recovery_state:not_recovered"){nodes{id customer{email} abandonedCheckoutUrl completedAt} pageInfo{hasNextPage endCursor}}}',{after});carts.push(...r.abandonedCheckouts.nodes.filter(o=>o.customer?.email?.toLowerCase()===email&&!o.completedAt).map(o=>({id:o.id,recovery_url:cleanLink(o.abandonedCheckoutUrl)})));hasMore=r.abandonedCheckouts.pageInfo.hasNextPage;if(!hasMore)break;after=r.abandonedCheckouts.pageInfo.endCursor;}return{carts,partial:hasMore};}
  const r=await shopify(env,c,'query($q:String!){orders(first:5,query:$q){nodes{id name email displayFinancialStatus displayFulfillmentStatus fulfillments{trackingInfo{number url company}}}}}',{q:'name:'+JSON.stringify('#'+reference)+' AND email:'+JSON.stringify(email)});
  const o=r.orders.nodes.find(o=>o.email?.toLowerCase()===email&&o.name.replace(/^#/,'')===reference);return{order:o?{reference:o.name,status:o.displayFinancialStatus,fulfillment:o.displayFulfillmentStatus,tracking:o.fulfillments.flatMap(f=>f.trackingInfo).map(t=>({number:short(t.number),company:short(t.company),url:cleanLink(t.url)}))}:null};
 }
 if(provider==='woocommerce'){
  if(operation==='products'){const rows=await wc(env,c,'wc/v3/products?status=publish&per_page=5&orderby=date&order=desc&search='+encodeURIComponent(short(input.search||'',80)));return{products:rows.filter(p=>p.catalog_visibility!=='hidden').map(p=>({id:String(p.id),name:short(p.name),url:cleanLink(p.permalink),price:short(p.price)}))};}
  if(operation==='abandoned_carts'){if(!c.bridge_secret)throw fail('commerce_bridge_required',409);const r=await commerceHttp(env,c.origin+'/wp-json/flownexa/v1/carts?email='+encodeURIComponent(email),{headers:{'X-FlowNexa-Key':c.bridge_secret}});return{carts:(r.carts||[]).filter(o=>o.email?.toLowerCase()===email).map(o=>({id:String(o.id),recovery_url:cleanLink(o.recovery_url)}))};}
  if(!/^\d+$/.test(reference))throw fail('commerce_order_reference_required');
  let o;try{o=await wc(env,c,'wc/v3/orders/'+reference);}catch(e){if(e.status===404)return{order:null};throw e;}
  if(o.billing?.email?.toLowerCase()!==email)return{order:null};
  let tracking=(o.meta_data||[]).find(m=>m.key==='_wc_shipment_tracking_items')?.value||[];
  if(c.tracking_namespace){const path=c.tracking_namespace+'/orders/'+reference+(c.tracking_namespace==='wc/v3'?'/shipment-tracking':'/shipment-trackings');const remote=await wc(env,c,path);tracking=Array.isArray(remote)?remote:remote.shipment_trackings||[];}
  if(!Array.isArray(tracking))tracking=[];
  return{order:{reference:String(o.number||o.id),status:short(o.status),tracking:tracking.map(t=>({number:short(t.tracking_number),company:short(t.tracking_provider||t.custom_tracking_provider),url:cleanLink(t.custom_tracking_link)}))}};
 }
 if(provider==='wordpress'){
  if(operation!=='content')throw fail('commerce_wordpress_requires_woocommerce',409);
  const rows=await wp(env,c,'wp/v2/posts?status=publish&per_page=5&search='+encodeURIComponent(short(input.search||'',80)));return{products:rows.map(p=>({id:String(p.id),name:short(p.title?.rendered),url:cleanLink(p.link)}))};
 }
 if(operation==='products'){const rows=await nube(env,c,'products?published=true&per_page=5&sort_by=created-at-descending&q='+encodeURIComponent(short(input.search||'',80)));return{products:rows.filter(p=>p.published!==false).map(p=>({id:String(p.id),name:short(p.name?.pt||p.name?.es||p.name?.en),url:cleanLink(p.canonical_url),price:short(p.variants?.[0]?.price)}))};}
 if(operation==='abandoned_carts'){const rows=await nube(env,c,'checkouts?per_page=200&contact_email='+encodeURIComponent(email));return{carts:rows.filter(o=>(o.contact_email||o.customer?.email)?.toLowerCase()===email&&!o.completed_at).map(o=>({id:String(o.id),recovery_url:cleanLink(o.abandoned_checkout_url)}))};}
 const rows=await nube(env,c,'orders?per_page=200&aggregates=fulfillment_orders&q='+encodeURIComponent(reference));const o=rows.find(o=>String(o.number)===reference&&(o.contact_email||o.customer?.email)?.toLowerCase()===email);return{order:o?{reference:String(o.number),status:short(o.payment_status),fulfillment:short(o.shipping_status),tracking:(o.fulfillments||[]).filter(f=>f.tracking_info?.code).map(f=>({number:short(f.tracking_info.code),url:cleanLink(f.tracking_info.url)}))}:null};
}
export async function registerWebhooks(env,provider,c,address,onProgress=async()=>{}){
 const topics=provider==='shopify'?['ORDERS_CREATE','ORDERS_UPDATED','FULFILLMENTS_CREATE','PRODUCTS_CREATE','APP_UNINSTALLED']:provider==='woocommerce'?['order.created','order.updated','product.created']:['order/created','order/updated','product/created','app/uninstalled'];
 // Reconcile provider state first: a response may have been lost after the remote creation.
 let existing=[];
 if(provider==='shopify'){const r=await shopify(env,c,'{webhookSubscriptions(first:100){nodes{id topic uri}}}');existing=r.webhookSubscriptions.nodes.map(h=>({id:h.id,topic:h.topic,url:h.uri}));}
 else if(provider==='woocommerce')existing=(await wc(env,c,'wc/v3/webhooks?per_page=100')).map(h=>({id:String(h.id),topic:h.topic,url:h.delivery_url}));
 else existing=(await nube(env,c,'webhooks')).map(h=>({id:String(h.id),topic:h.event,url:h.url}));
 c.hooks=c.hooks||{};
 for(const topic of topics){
  const found=existing.find(h=>h.topic===topic&&h.url===address);
  if(found){c.hooks[topic]=found.id;await onProgress();continue;}
  if(c.hooks[topic])continue;
  let id;
  if(provider==='shopify'){const r=await shopify(env,c,'mutation($topic:WebhookSubscriptionTopic!,$s:WebhookSubscriptionInput!){webhookSubscriptionCreate(topic:$topic,webhookSubscription:$s){webhookSubscription{id} userErrors{message}}}',{topic,s:{uri:address,format:'JSON'}});if(r.webhookSubscriptionCreate.userErrors?.length)throw fail('commerce_webhook_registration_failed',502);id=r.webhookSubscriptionCreate.webhookSubscription?.id;}
  else if(provider==='woocommerce'){const r=await wc(env,c,'wc/v3/webhooks','POST',{name:'FlowNexa '+topic,topic,delivery_url:address,secret:c.webhook_secret,status:'active'});id=r.id;}
  else{const r=await nube(env,c,'webhooks','POST',{event:topic,url:address});id=r.id;}
  if(!id)throw fail('commerce_webhook_registration_failed',502);c.hooks[topic]=String(id);await onProgress();
 }
 return Object.values(c.hooks);
}
export async function removeWebhooks(env,provider,c){
 const ids=[...new Set([...Object.values(c.hooks||{}),...(c.hook_ids||[])])];let failed=0;
 for(const id of ids)try{
  if(provider==='shopify'){const r=await shopify(env,c,'mutation($id:ID!){webhookSubscriptionDelete(id:$id){userErrors{message}}}',{id});if(r.webhookSubscriptionDelete.userErrors?.length)failed++;}
  else if(provider==='woocommerce')await wc(env,c,'wc/v3/webhooks/'+encodeURIComponent(id)+'?force=true','DELETE');
  else if(provider==='nuvemshop')await nube(env,c,'webhooks/'+encodeURIComponent(id),'DELETE');
 }catch(e){if(e.status!==404)failed++;}
 return failed;
}
// Resolve Nuvemshop's ID-only notifications before using any fields.
export async function eventResource(env,provider,c,topic,data){
 if(provider==='nuvemshop'&&data.id){if(topic.startsWith('product/'))return nube(env,c,'products/'+encodeURIComponent(String(data.id)));if(topic.startsWith('order/'))return nube(env,c,'orders/'+encodeURIComponent(String(data.id))+'?aggregates=fulfillment_orders');}
 return data.data||data;
}
