import {commercialPlans,PLAN_TIERS} from './commercial-plans.js';
import {getSessionUser,requireMembership,sameOrigin,payload,respond,nowSeconds,sha} from './identity.js';
const API_VERSION='2026-08-26.dahlia';
const terminal=new Set(['canceled','incomplete_expired']);
const states=new Set(['active','trialing','past_due','unpaid','canceled','incomplete','incomplete_expired','paused']);
const idOf=value=>typeof value==='string'?value:value?.id;
const error=(message,status=502)=>Object.assign(Error(message),{status});
function config(env){
 let prices;try{prices=JSON.parse(env.STRIPE_PRICE_MAP||'{}');}catch{return null;}
 if(!prices||typeof prices!=='object'||Array.isArray(prices))return null;
 const entries=Object.entries(prices);
 if(!entries.length||entries.length>8||new Set(entries.map(([,value])=>value)).size!==entries.length||entries.some(([key,value])=>!/^[-\w]{1,40}$/.test(key)||typeof value!=='string'||!/^price_[A-Za-z0-9]+$/.test(value)))return null;
 if(!/^(?:sk|rk)_(test|live)_/.test(env.STRIPE_SECRET_KEY||'')||!/^pk_(test|live)_/.test(env.STRIPE_PUBLISHABLE_KEY||'')||!env.STRIPE_WEBHOOK_SECRET?.startsWith('whsec_'))return null;
 if(env.STRIPE_SECRET_KEY.includes('_live_')!==env.STRIPE_PUBLISHABLE_KEY.includes('_live_'))return null;
 return{prices,live:env.STRIPE_SECRET_KEY.includes('_live_')};
}
async function stripe(env,path,{method='GET',params={},idempotencyKey}={}){
 const headers={authorization:`Bearer ${env.STRIPE_SECRET_KEY}`,'Stripe-Version':API_VERSION};
 if(idempotencyKey)headers['Idempotency-Key']=idempotencyKey;
 const options={method,headers,redirect:'error',signal:AbortSignal.timeout(12000)};
 if(method==='POST'){headers['content-type']='application/x-www-form-urlencoded';options.body=new URLSearchParams(params).toString();}
 let response,data;try{response=await(env.STRIPE_FETCH||fetch)('https://api.stripe.com/v1/'+path,options);data=await response.json();}catch{throw error('billing_provider_unavailable');}
 if(!response.ok)throw error('billing_provider_unavailable');
 return data;
}
function base(env){const url=new URL(env.PUBLIC_BASE_URL||'https://flownex.online');if(url.protocol!=='https:')throw error('billing_not_configured',503);return url.origin;}
async function rowFor(env,workspace){await env.DB.prepare('INSERT INTO workspace_billing(workspace_id,updated_at) VALUES(?,?) ON CONFLICT(workspace_id) DO NOTHING').bind(workspace,nowSeconds()).run();return env.DB.prepare('SELECT * FROM workspace_billing WHERE workspace_id=?').bind(workspace).first();}
async function lock(env,workspace){const id=crypto.randomUUID(),now=nowSeconds();const result=await env.DB.prepare('UPDATE workspace_billing SET lease_id=?,lease_until=? WHERE workspace_id=? AND (lease_until IS NULL OR lease_until<?)').bind(id,now+90,workspace,now).run();if(!result.meta.changes)throw error('billing_busy',409);return id;}
async function unlock(env,workspace,lease){await env.DB.prepare('UPDATE workspace_billing SET lease_id=NULL,lease_until=NULL WHERE workspace_id=? AND lease_id=?').bind(workspace,lease).run();}
async function price(env,id){const p=await stripe(env,'prices/'+encodeURIComponent(id)+'?expand[]=product');if(p.id!==id||p.active!==true||p.type!=='recurring'||!p.recurring||!['day','week','month','year'].includes(p.recurring.interval)||!Number.isSafeInteger(p.recurring.interval_count)||p.recurring.interval_count<=0||!Number.isSafeInteger(p.unit_amount)||p.unit_amount<=0||!/^[a-z]{3}$/.test(p.currency||''))throw error('invalid_recurring_price',503);const known=commercialPlans().find(plan=>env.STRIPE_PRICE_MAP&&JSON.parse(env.STRIPE_PRICE_MAP)[plan.id]===id);if(known&&(p.currency!==known.currency||p.unit_amount!==known.unit_amount||p.recurring.interval!==known.interval||p.recurring.interval_count!==1))throw error('price_catalog_mismatch',503);return p;}
function subscription(row,cfg){if(!row?.stripe_subscription_id)return null;const plan=Object.entries(cfg?.prices||{}).find(([,id])=>id===row.stripe_price_id)?.[0]||null;return{status:row.subscription_status,plan,price_id:row.stripe_price_id,current_period_end:row.current_period_end,cancel_at_period_end:Boolean(row.cancel_at_period_end),entitled:Boolean(plan&&['active','trialing'].includes(row.subscription_status)&&row.current_period_end>nowSeconds())};}
export async function billingApi(request,env){
 if(!env.DB)return respond({error:'database_unavailable'},503);
 if(request.method!=='GET'&&!sameOrigin(request))return respond({error:'invalid_origin'},403);
 const user=await getSessionUser(request,env);if(!user)return respond({error:'unauthorized'},401);
 const url=new URL(request.url);let lease,workspace;
 try{
  const body=request.method==='POST'?await payload(request):{};
  workspace=request.method==='GET'?url.searchParams.get('workspace'):body.workspace_id;
  if(typeof workspace!=='string'||!workspace||workspace.length>100)return respond({error:'workspace_required'},400);
  const member=await requireMembership(env.DB,user.id,workspace);if(!member)return respond({error:'forbidden'},403);
  const canManage=['owner','admin'].includes(member.role),cfg=config(env);
  const row=await env.DB.prepare('SELECT * FROM workspace_billing WHERE workspace_id=?').bind(workspace).first();
  if(url.pathname==='/api/billing/status'&&request.method==='GET'){
   const plans=cfg?await Promise.all(Object.entries(cfg.prices).map(async([id,priceId])=>{const p=await price(env,priceId);const definition=commercialPlans().find(plan=>plan.id===id);return{...(definition?{tier:definition.tier,accounts:definition.accounts,messages:definition.messages}:{}),id,name:definition?.name||p.nickname||(typeof p.product==='object'?p.product.name:null)||id,unit_amount:p.unit_amount,currency:p.currency,interval:p.recurring.interval,interval_count:p.recurring.interval_count};})):[];
   const currentPlan=await workspacePlan(env,workspace);const usage=currentPlan?{...await messageUsage(env,workspace),limit:currentPlan.messages}:null;
   const owner=await ownerExempt(env,workspace),legacy=env.BILLING_ENFORCED==='true'?await legacyBillingAccess(env,workspace):null,trial=env.BILLING_ENFORCED==='true'&&!legacy&&!owner?await trialStatus(env,workspace):null;
   return respond({configured:Boolean(cfg),can_manage:canManage,plans,subscription:subscription(row,cfg),...(usage?{usage}:{}),...(legacy!==null?{legacy_access:legacy}:{}),...(trial?{trial}:{}),...(owner?{owner_access:true}:{})});
  }
  if(request.method!=='POST'||!['/api/billing/checkout','/api/billing/portal'].includes(url.pathname))return respond({error:'not_found'},404);
  if(!canManage)return respond({error:'forbidden'},403);
  if(!cfg)return respond({error:'billing_not_configured'},503);
  await rowFor(env,workspace);lease=await lock(env,workspace);let current=await env.DB.prepare('SELECT * FROM workspace_billing WHERE workspace_id=?').bind(workspace).first();
  if(url.pathname==='/api/billing/portal'){
   if(!current.stripe_customer_id)return respond({error:'billing_customer_missing'},409);
   const portal=await stripe(env,'billing_portal/sessions',{method:'POST',params:{customer:current.stripe_customer_id,return_url:base(env)+'/app?billing=portal',locale:['en','pt-BR'].includes(body.locale)?body.locale:'auto',...(/^bpc_[A-Za-z0-9]+$/.test(env.STRIPE_PORTAL_CONFIGURATION||'')?{configuration:env.STRIPE_PORTAL_CONFIGURATION}:{})}});
   const location=new URL(portal.url);if(location.protocol!=='https:'||location.hostname!=='billing.stripe.com')throw error('billing_provider_unavailable');
   return respond({url:location.href});
  }
  const priceId=Object.hasOwn(cfg.prices,body.plan)?cfg.prices[body.plan]:null;if(!priceId)return respond({error:'invalid_plan'},400);
  const selectedPrice=await price(env,priceId);
  const locale=['pt-BR','en'].includes(body.locale)?body.locale:selectedPrice.currency==='brl'?'pt-BR':'en';
  if(current.stripe_subscription_id&&!terminal.has(current.subscription_status))return respond({error:'subscription_exists'},409);
  if(!current.stripe_customer_id){
   const owner=await env.DB.prepare('SELECT u.email FROM users u JOIN workspaces w ON w.owner_id=u.id WHERE w.id=?').bind(workspace).first();
   if(!owner)throw error('billing_owner_missing',409);
   const customer=await stripe(env,'customers',{method:'POST',params:{email:owner.email,'metadata[workspace_id]':workspace},idempotencyKey:'flownexa-customer-'+workspace});
   if(!/^cus_[A-Za-z0-9]+$/.test(customer.id||''))throw error('billing_provider_unavailable');
   await env.DB.prepare('UPDATE workspace_billing SET stripe_customer_id=?,updated_at=? WHERE workspace_id=? AND lease_id=?').bind(customer.id,nowSeconds(),workspace,lease).run();current.stripe_customer_id=customer.id;
  }
  if(current.checkout_session_id){
   let previous=await stripe(env,'checkout/sessions/'+encodeURIComponent(current.checkout_session_id));
   if(previous.status==='open'&&current.checkout_price_id!==priceId&&body.replace_open_checkout===true){previous=await stripe(env,'checkout/sessions/'+encodeURIComponent(current.checkout_session_id)+'/expire',{method:'POST',idempotencyKey:'flownexa-expire-'+current.checkout_session_id});if(previous.status!=='expired')throw error('subscription_sync_pending',409);}
   if(previous.status==='open'){
    if(current.checkout_price_id!==priceId)return respond({error:'checkout_in_progress'},409);
    if(typeof previous.client_secret!=='string'||!previous.client_secret)throw error('billing_provider_unavailable');
    return respond({client_secret:previous.client_secret,publishable_key:env.STRIPE_PUBLISHABLE_KEY,session_id:previous.id});
   }
   if(previous.status==='complete'&&!(current.stripe_subscription_id===idOf(previous.subscription)&&terminal.has(current.subscription_status)))return respond({error:'subscription_sync_pending'},409);
   if(!['complete','expired'].includes(previous.status))throw error('billing_provider_unavailable');
   current.checkout_request_id=null;
  }
  const requestId=current.checkout_request_id||crypto.randomUUID();
  if(!current.checkout_request_id)await env.DB.prepare('UPDATE workspace_billing SET checkout_request_id=?,checkout_session_id=NULL,checkout_price_id=? WHERE workspace_id=? AND lease_id=?').bind(requestId,priceId,workspace,lease).run();
  else if(current.checkout_price_id!==priceId)return respond({error:'checkout_in_progress'},409);
  const suffix=requestId.replaceAll('-','').slice(0,8).split('').map(c=>String.fromCharCode(97+parseInt(c,16))).join('');
  const session=await stripe(env,'checkout/sessions',{method:'POST',idempotencyKey:'flownexa-checkout-'+requestId,params:{mode:'subscription',ui_mode:'embedded_page',locale,customer:current.stripe_customer_id,'line_items[0][price]':priceId,'line_items[0][quantity]':'1',client_reference_id:workspace,'metadata[workspace_id]':workspace,'subscription_data[metadata][workspace_id]':workspace,return_url:base(env)+'/app?billing=return&session_id={CHECKOUT_SESSION_ID}',redirect_on_completion:'if_required',integration_identifier:'flownexa-embedded-'+suffix}});
  if(!/^cs_[A-Za-z0-9_]+$/.test(session.id||'')||typeof session.client_secret!=='string'||!session.client_secret)throw error('billing_provider_unavailable');
  await env.DB.prepare('UPDATE workspace_billing SET checkout_session_id=?,updated_at=? WHERE workspace_id=? AND lease_id=?').bind(session.id,nowSeconds(),workspace,lease).run();
  return respond({client_secret:session.client_secret,publishable_key:env.STRIPE_PUBLISHABLE_KEY,session_id:session.id});
 }catch(e){return respond({error:e.status?e.message:'billing_request_failed'},e.status||502);}
 finally{if(lease)await unlock(env,workspace,lease);}
}

async function rawBody(request){const max=262144;if(Number(request.headers.get('content-length')||0)>max)throw error('payload_too_large',413);if(!request.body)throw error('invalid_payload',400);const reader=request.body.getReader(),chunks=[];let size=0;try{while(true){const{value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>max){await reader.cancel();throw error('payload_too_large',413);}chunks.push(value);}}finally{reader.releaseLock();}const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}return bytes;}
async function verifiedEvent(request,env){
 const bytes=await rawBody(request),header=request.headers.get('stripe-signature')||'';if(header.length>2048)throw error('invalid_signature',400);
 const parts=header.split(',').map(x=>x.trim().split('=')),timestamps=parts.filter(x=>x[0]==='t'),signatures=parts.filter(x=>x[0]==='v1'&&/^[a-f0-9]{64}$/i.test(x[1]||''));
 if(timestamps.length!==1||!/^\d+$/.test(timestamps[0][1])||Math.abs(nowSeconds()-Number(timestamps[0][1]))>300||!signatures.length||signatures.length>10)throw error('invalid_signature',400);
 const prefix=new TextEncoder().encode(timestamps[0][1]+'.'),message=new Uint8Array(prefix.length+bytes.length);message.set(prefix);message.set(bytes,prefix.length);
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(env.STRIPE_WEBHOOK_SECRET),{name:'HMAC',hash:'SHA-256'},false,['verify']);let valid=false;for(const[,sig]of signatures)valid=await crypto.subtle.verify('HMAC',key,Uint8Array.from(sig.match(/../g),x=>parseInt(x,16)),message)||valid;
 if(!valid)throw error('invalid_signature',400);
 let event;try{event=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));}catch{throw error('invalid_payload',400);}
 if(!/^evt_[A-Za-z0-9]+$/.test(event.id||'')||typeof event.type!=='string'||!Number.isSafeInteger(event.created)||typeof event.livemode!=='boolean')throw error('invalid_event',400);
 return{event,hash:await sha(new TextDecoder().decode(bytes))};
}
const events=new Set(['customer.subscription.created','customer.subscription.updated','customer.subscription.deleted','checkout.session.completed','checkout.session.async_payment_succeeded','invoice.paid','invoice.payment_failed']);
export async function stripeWebhook(request,env){
 if(request.method!=='POST')return respond({error:'method_not_allowed'},405);
 const cfg=config(env);if(!env.DB||!cfg)return respond({error:'billing_not_configured'},503);
 let claimed,eventId,workspace,lease;
 try{
  const{event,hash}=await verifiedEvent(request,env);if(event.livemode!==cfg.live)return respond({error:'invalid_mode'},400);
  eventId=event.id;const now=nowSeconds();
  await env.DB.prepare('INSERT INTO stripe_webhook_events(id,payload_hash,type,created_at) VALUES(?,?,?,?) ON CONFLICT(id) DO NOTHING').bind(event.id,hash,event.type,event.created).run();
  const existing=await env.DB.prepare('SELECT * FROM stripe_webhook_events WHERE id=?').bind(event.id).first();if(existing.payload_hash!==hash)return respond({error:'event_conflict'},409);if(existing.status==='processed')return respond({received:true,duplicate:true});
  claimed=crypto.randomUUID();const claim=await env.DB.prepare("UPDATE stripe_webhook_events SET lease_id=?,lease_until=? WHERE id=? AND status='pending' AND (lease_until IS NULL OR lease_until<?)").bind(claimed,now+90,event.id,now).run();if(!claim.meta.changes){claimed=null;return respond({error:'event_busy'},409);}
  if(events.has(event.type)){
   let object=event.data?.object,subId;
   if(event.type.startsWith('customer.subscription.'))subId=object?.id;
   else if(event.type.startsWith('checkout.session.')){if(!/^cs_[A-Za-z0-9_]+$/.test(object?.id||''))throw error('invalid_event',400);object=await stripe(env,'checkout/sessions/'+encodeURIComponent(object.id));subId=idOf(object.subscription);}
   else {subId=idOf(object?.parent?.subscription_details?.subscription||object?.subscription);}
   const customerId=idOf(object?.customer);
   if(!/^cus_[A-Za-z0-9]+$/.test(customerId||''))throw error('invalid_event',400);
   const binding=await env.DB.prepare('SELECT * FROM workspace_billing WHERE stripe_customer_id=?').bind(customerId).first();
   if(binding&&/^sub_[A-Za-z0-9]+$/.test(subId||'')){
    workspace=binding.workspace_id;lease=await lock(env,workspace);
    const current=await env.DB.prepare('SELECT * FROM workspace_billing WHERE workspace_id=?').bind(workspace).first();
    // Always retrieve Stripe's current object under the workspace lease. Arrival order is never authority.
    const sub=await stripe(env,'subscriptions/'+encodeURIComponent(subId));
    if(idOf(sub.customer)!==customerId||sub.id!==subId||!states.has(sub.status))throw error('invalid_subscription',502);
    let apply=true;if(current.stripe_subscription_id&&current.stripe_subscription_id!==subId){const previous=await stripe(env,'subscriptions/'+encodeURIComponent(current.stripe_subscription_id));if(!terminal.has(previous.status))apply=false;}
    if(apply){const items=sub.items?.data;if(!Array.isArray(items)||items.length!==1)throw error('unsupported_subscription',502);const item=items[0],priceId=idOf(item.price),period=item.current_period_end??sub.current_period_end;if(!/^price_[A-Za-z0-9]+$/.test(priceId||'')||!Number.isSafeInteger(period)||period<0)throw error('invalid_subscription',502);
     await env.DB.prepare('UPDATE workspace_billing SET stripe_subscription_id=?,subscription_status=?,stripe_price_id=?,current_period_end=?,cancel_at_period_end=?,last_event_created=MAX(last_event_created,?),updated_at=? WHERE workspace_id=? AND lease_id=?').bind(sub.id,sub.status,priceId,period,sub.cancel_at_period_end?1:0,event.created,nowSeconds(),workspace,lease).run();
    }
   }
  }
  await env.DB.prepare("UPDATE stripe_webhook_events SET status='processed',processed_at=?,lease_id=NULL,lease_until=NULL WHERE id=? AND lease_id=?").bind(nowSeconds(),event.id,claimed).run();claimed=null;
  return respond({received:true});
 }catch(e){return respond({error:e.status?e.message:'billing_webhook_failed'},e.status||503);}
 finally{if(lease)await unlock(env,workspace,lease);if(claimed)await env.DB.prepare('UPDATE stripe_webhook_events SET lease_id=NULL,lease_until=NULL WHERE id=? AND lease_id=?').bind(eventId,claimed).run();}
}

// Cutover preserves pre-launch workspaces; newly created workspaces require a subscription when enforced.
export async function legacyBillingAccess(env,workspace){
 const value=env.BILLING_LEGACY_BEFORE;if(!env.DB||!workspace||typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(value))return false;
 const cutoff=Date.parse(value);if(!Number.isFinite(cutoff)||cutoff>Date.now())return false;
 const row=await env.DB.prepare('SELECT created_at FROM workspaces WHERE id=?').bind(workspace).first();
 const timestamp=typeof row?.created_at==='string'?Date.parse(row.created_at.includes('T')?row.created_at:row.created_at.replace(' ','T')+'Z'):NaN;
 return Number.isFinite(timestamp)&&timestamp<cutoff;
}
// The owner's own profiles: full access with no charge and no plan limits. Matched on an
// Instagram username in the workspace, which only the account holder can establish via OAuth.
const listEnv=value=>(value||'').split(',').map(v=>v.trim().replace(/^@/,'').toLowerCase()).filter(Boolean);
export async function ownerExempt(env,workspace){
 if(!workspace)return false;if(listEnv(env.BILLING_EXEMPT_WORKSPACES).includes(workspace.toLowerCase()))return true;
 const names=listEnv(env.BILLING_EXEMPT_INSTAGRAM);if(!names.length||!env.DB)return false;
 try{return Boolean(await env.DB.prepare(`SELECT 1 FROM instagram_accounts WHERE workspace_id=? AND lower(username) IN (${names.map(()=>'?').join(',')}) LIMIT 1`).bind(workspace,...names).first());}catch{return false;}
}
// Free trial: full access (Teams account limit, capped messages) without a card, counted
// from the owner's signup so creating another workspace cannot restart it.
export async function trialStatus(env,workspace){
 const days=Number(env.BILLING_TRIAL_DAYS??7);if(!env.DB||!workspace||!Number.isInteger(days)||days<=0)return null;
 const row=await env.DB.prepare('SELECT users.created_at FROM workspaces JOIN users ON users.id=workspaces.owner_id WHERE workspaces.id=?').bind(workspace).first();
 const start=typeof row?.created_at==='string'?Date.parse(row.created_at.includes('T')?row.created_at:row.created_at.replace(' ','T')+'Z'):NaN;if(!Number.isFinite(start))return null;
 const ends=start+days*86400000,left=ends-Date.now();
 return{days,active:left>0,ends_at:new Date(ends).toISOString(),days_left:Math.max(0,Math.ceil(left/86400000))};
}
function trialPlan(env){const teams=PLAN_TIERS.find(tier=>tier.id==='teams');const messages=Number(env.BILLING_TRIAL_MESSAGES??1000);return{id:'trial',tier:'trial',name:'Teste grátis',accounts:teams.accounts,messages:Number.isSafeInteger(messages)&&messages>0?messages:1000};}
async function paidPlan(env,workspace){
 const cfg=config(env);if(!cfg||!env.DB||!workspace)return null;
 const row=await env.DB.prepare('SELECT stripe_price_id,subscription_status,current_period_end FROM workspace_billing WHERE workspace_id=?').bind(workspace).first();
 if(!row||!['active','trialing'].includes(row.subscription_status)||row.current_period_end<=nowSeconds())return null;
 return commercialPlans().find(plan=>cfg.prices[plan.id]===row.stripe_price_id)||null;
}
async function activeTrial(env,workspace){
 if(env.BILLING_ENFORCED!=='true'||await legacyBillingAccess(env,workspace)||await ownerExempt(env,workspace))return false;
 return Boolean((await trialStatus(env,workspace))?.active);
}
export async function billingAccess(env,workspace){
 if(env.BILLING_ENFORCED!=='true')return true;
 if(await legacyBillingAccess(env,workspace)||await ownerExempt(env,workspace))return true;
 const cfg=config(env);if(!env.DB||!workspace)return false;
 try{const row=cfg&&await env.DB.prepare('SELECT subscription_status,stripe_price_id,current_period_end FROM workspace_billing WHERE workspace_id=?').bind(workspace).first();if(row&&['active','trialing'].includes(row.subscription_status)&&Object.values(cfg.prices).includes(row.stripe_price_id)&&row.current_period_end>nowSeconds())return true;return await activeTrial(env,workspace);}catch{return false;}
}

export async function workspacePlan(env,workspace){
 if(await ownerExempt(env,workspace))return null;
 const paid=await paidPlan(env,workspace);if(paid)return paid;
 return env.DB&&workspace&&await activeTrial(env,workspace)?trialPlan(env):null;
}
export async function withBillingAccountCapacity(env,workspace,existingId,operation){
 const plan=await workspacePlan(env,workspace);if(!plan)return operation();
 const lease=await lock(env,workspace);
 try{const count=await env.DB.prepare("SELECT count(*) AS total FROM instagram_accounts WHERE workspace_id=? AND status='connected' AND id<>?").bind(workspace,existingId||'').first();if(count.total>=plan.accounts)throw error('billing_account_limit',409);return await operation();}
 finally{await unlock(env,workspace,lease);}
}
export async function messageUsage(env,workspace){
 const now=new Date(),start=Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),1),reset=Date.UTC(now.getUTCFullYear(),now.getUTCMonth()+1,1);
 const usage=await env.DB.prepare("SELECT count(*) AS total FROM automation_jobs WHERE workspace_id=? AND status IN ('sending','accepted','unknown') AND COALESCE(attempt_at,completed_at)>=?").bind(workspace,start).first();
 return{used:usage.total,resets_at:new Date(reset).toISOString()};
}
export async function assertMessageCapacity(env,workspace){
 const plan=await workspacePlan(env,workspace);if(!plan)return;
 // The caller reserves its durable send first; include that reservation and unknown
 // outcomes so retries and concurrent workers cannot bypass the cap.
 const usage=await messageUsage(env,workspace);
 if(usage.used>plan.messages)throw error('billing_message_limit',409);
}
