import {sha} from '../identity.js';
import {encryptToken,decryptToken} from '../instagram-oauth.js';
import {billingAccess} from '../billing.js';
import {sendAction,messagingReady} from '../meta-client.js';
import {credentialsFor,readStore} from './service.js';
import {eventResource} from './providers.js';
import {ensureCommerceSchema} from './schema.js';
const normalizeTopic=t=>/^products?[/\.]creat/.test(t)?'product.created':/^cart[/\.]abandoned$/.test(t)?'cart.abandoned':/^orders?[/\.](?:updated|paid|fulfilled)$/.test(t)||t==='fulfillments/create'?'order.updated':null;
const trim=s=>String(s||'').replace(/<[^>]*>/g,'').slice(0,120);
async function prepareEvent(env,event){
 const store=await env.DB.prepare("SELECT * FROM commerce_stores WHERE id=? AND status='connected'").bind(event.store_id).first();
 const type=normalizeTopic(event.topic);if(!store||!type)return true;
 const raw=JSON.parse(await decryptToken(event.encrypted_payload,env.TOKEN_ENCRYPTION_KEY));
 const data=await eventResource(env,store.provider,await credentialsFor(env,store),event.topic,raw);
 const email=(data.contact_email||data.billing?.email||data.email||data.customer?.email||'').toLowerCase();
 if(type!=='product.created'&&!email)return true;
 if(type==='product.created'&&(data.status&& !['active','publish'].includes(data.status)||data.published===false))return true;
 const name=trim(typeof data.name==='object'?data.name.pt||data.name.es:data.title||data.name);
 const rules=await env.DB.prepare('SELECT * FROM commerce_rules WHERE store_id=? AND event_type=? AND enabled=1').bind(store.id,type).all();
 let complete=true;
 for(const rule of rules.results){
  const progress=await env.DB.prepare('SELECT cursor,done FROM commerce_event_cursors WHERE event_id=? AND rule_id=?').bind(event.id,rule.id).first();
  if(progress?.done)continue;
  const contacts=await env.DB.prepare('SELECT * FROM commerce_identities WHERE store_id=? AND account_id=? AND opted_out=0 AND last_incoming_at>? AND (?=1 OR email_hash=?) AND (?=1 OR marketing_opt_in=1) AND recipient_hash>? ORDER BY recipient_hash LIMIT 50').bind(store.id,rule.account_id,Date.now()-86400000,type==='product.created'?1:0,await sha(email),type==='order.updated'?1:0,progress?.cursor||'').all();
  const statements=[];
  for(const contact of contacts.results){
   const status=trim(data.shipping_status||data.status||data.fulfillment_status||data.payment_status);
   const text=rule.message.replaceAll('{product}',name).replaceAll('{order}',trim(data.number||data.order_number||data.name||data.id)).replaceAll('{status}',status);
   // Only non-sensitive templates go into outbound events. Order details and recovery links are read via a verified conversation.
   const id=await sha([store.id,rule.id,contact.recipient_hash,type,data.id||data.token,status,type==='cart.abandoned'?'':name].join(':'));
   const identity=JSON.parse(await decryptToken(contact.encrypted_identity,env.TOKEN_ENCRYPTION_KEY));
   statements.push(env.DB.prepare('INSERT OR IGNORE INTO commerce_deliveries(id,event_id,rule_id,store_id,account_id,recipient_hash,encrypted_action,due_at) VALUES(?,?,?,?,?,?,?,?)').bind(id,event.id,rule.id,store.id,rule.account_id,contact.recipient_hash,await encryptToken(JSON.stringify({recipient:identity.recipient,text:text.slice(0,1000),resource_id:String(data.id||data.token||'')}),env.TOKEN_ENCRYPTION_KEY),Date.now()));
  }
  const done=contacts.results.length<50;if(!done)complete=false;
  statements.push(env.DB.prepare('INSERT INTO commerce_event_cursors(event_id,rule_id,cursor,done) VALUES(?,?,?,?) ON CONFLICT(event_id,rule_id) DO UPDATE SET cursor=excluded.cursor,done=excluded.done').bind(event.id,rule.id,contacts.results.at(-1)?.recipient_hash||progress?.cursor||'',done?1:0));
  await env.DB.batch(statements);
 }
 return complete;
}
export async function processCommerce(env,limit=3,deadline=Date.now()+15000){
 if(!env.DB||!env.TOKEN_ENCRYPTION_KEY)return{processed:0};
 // No schema work on every scheduler tick until a merchant has activated commerce.
 try{await env.DB.prepare('SELECT id FROM commerce_stores LIMIT 1').first();}catch(e){if(/no such table/i.test(e.message))return{processed:0};throw e;}
 env={...env,COMMERCE_DEADLINE:deadline,RUNTIME_DEADLINE_MS:deadline};
 let processed=0;
 await pollAbandoned(env,deadline);
 for(let i=0;i<limit&&Date.now()<deadline-2000;i++){
  const lease=crypto.randomUUID(),now=Date.now();
  const event=await env.DB.prepare("UPDATE commerce_events SET lease_id=?,lease_until=? WHERE id=(SELECT id FROM commerce_events WHERE status='pending' AND due_at<=? AND (lease_until IS NULL OR lease_until<?) ORDER BY due_at LIMIT 1) RETURNING *").bind(lease,now+120000,now,now).first();if(!event)break;
  try{const complete=await prepareEvent(env,event);if(!complete){await env.DB.prepare('UPDATE commerce_events SET due_at=?,lease_id=NULL,lease_until=NULL WHERE id=? AND lease_id=?').bind(Date.now()+1000,event.id,lease).run();continue;}await env.DB.prepare("UPDATE commerce_events SET status='processed',lease_id=NULL,lease_until=NULL,error=NULL WHERE id=? AND lease_id=?").bind(event.id,lease).run();processed++;}
  catch{await env.DB.prepare("UPDATE commerce_events SET attempts=attempts+1,status=?,due_at=?,error='processing_failed',lease_id=NULL,lease_until=NULL WHERE id=? AND lease_id=?").bind(event.attempts>=4?'failed':'pending',now+60000*2**event.attempts,event.id,lease).run();}
 }
 if(messagingReady(env))for(let i=0;i<limit&&Date.now()<deadline-2000;i++){
  const lease=crypto.randomUUID(),now=Date.now();
  const job=await env.DB.prepare("UPDATE commerce_deliveries SET status='sending',attempt_at=?,lease_id=?,lease_until=? WHERE id=(SELECT id FROM commerce_deliveries WHERE status='pending' AND due_at<=? ORDER BY due_at LIMIT 1) RETURNING *").bind(now,lease,now+120000,now).first();if(!job)break;
  try{
   const store=await env.DB.prepare("SELECT * FROM commerce_stores WHERE id=? AND status='connected'").bind(job.store_id).first();
   const rule=await env.DB.prepare('SELECT * FROM commerce_rules WHERE id=? AND enabled=1').bind(job.rule_id).first();
   const contact=await env.DB.prepare('SELECT * FROM commerce_identities WHERE store_id=? AND account_id=? AND recipient_hash=? AND opted_out=0').bind(job.store_id,job.account_id,job.recipient_hash).first();
   const account=await env.DB.prepare('SELECT * FROM instagram_accounts WHERE id=?').bind(job.account_id).first();
   if(!store||!rule||!contact||!account||account.workspace_id!==store.workspace_id||Date.now()-contact.last_incoming_at>=86400000||contact.last_incoming_at>Date.now()+300000||rule.event_type!=='order.updated'&&!contact.marketing_opt_in||!await billingAccess(env,store.workspace_id)){
    await env.DB.prepare("UPDATE commerce_deliveries SET status='skipped',error='permission_or_window_unavailable',completed_at=? WHERE id=?").bind(Date.now(),job.id).run();continue;
   }
   const action=JSON.parse(await decryptToken(job.encrypted_action,env.TOKEN_ENCRYPTION_KEY));
   if(rule.event_type==='cart.abandoned'){
    const identity=JSON.parse(await decryptToken(contact.encrypted_identity,env.TOKEN_ENCRYPTION_KEY)),current=await readStore(env,store.workspace_id,store.id,'abandoned_carts',{email:identity.email});
    if(!(current.carts||[]).some(c=>String(c.id)===action.resource_id)){await env.DB.prepare("UPDATE commerce_deliveries SET status='skipped',error='cart_no_longer_abandoned',completed_at=? WHERE id=?").bind(Date.now(),job.id).run();continue;}
   }
   const provider=await sendAction(env,account,{kind:'dm',sender_id:action.recipient,at:contact.last_incoming_at},{type:'message',text:action.text});
   try{await env.DB.prepare("UPDATE commerce_deliveries SET status='accepted',provider_id=?,completed_at=? WHERE id=? AND lease_id=?").bind(provider,Date.now(),job.id,lease).run();}catch{throw Error('delivery_unknown');}processed++;
  }catch(e){
   const retry=(e.deferred||e.retryable===true)&&job.attempts<4,unknown=e.message==='delivery_unknown';
   await env.DB.prepare('UPDATE commerce_deliveries SET status=?,attempts=attempts+1,due_at=?,error=?,completed_at=? WHERE id=? AND lease_id=?').bind(retry?'pending':unknown?'unknown':'failed',Date.now()+60000*2**job.attempts,retry?'provider_rate_limit':unknown?'delivery_unknown':'send_rejected',retry?null:Date.now(),job.id,lease).run();
  }
 }
 // A worker interruption after sending must never turn into an automatic duplicate.
 await env.DB.prepare("UPDATE commerce_deliveries SET status='unknown',error='interrupted_delivery' WHERE status='sending' AND lease_until<?").bind(Date.now()).run();
 await env.DB.prepare('DELETE FROM commerce_events WHERE received_at<? AND status!=\'pending\'').bind(Date.now()-7*86400000).run();
 await env.DB.prepare('DELETE FROM commerce_challenges WHERE expires_at<?').bind(Date.now()-86400000).run();
 return{processed};
}

async function pollAbandoned(env,deadline){
 if(Date.now()>deadline-4000)return;
 const now=Date.now(),poll=await env.DB.prepare("UPDATE commerce_polling SET lease_until=? WHERE store_id=(SELECT p.store_id FROM commerce_polling p JOIN commerce_stores s ON s.id=p.store_id WHERE p.next_at<=? AND p.lease_until<? AND s.status='connected' ORDER BY p.next_at LIMIT 1) RETURNING *").bind(now+120000,now,now).first();
 if(!poll)return;
 let cursor=poll.cursor,next=now+3600000;
 try{
  const store=await env.DB.prepare('SELECT * FROM commerce_stores WHERE id=?').bind(poll.store_id).first();
  if(!JSON.parse(store.capabilities).abandoned_carts)return;
  const contacts=await env.DB.prepare('SELECT * FROM commerce_identities WHERE store_id=? AND opted_out=0 AND marketing_opt_in=1 AND last_incoming_at>? AND recipient_hash>? ORDER BY recipient_hash LIMIT 3').bind(store.id,now-86400000,cursor).all();
  for(const contact of contacts.results){
   if(Date.now()>deadline-4000){next=now+60000;break;}
   const identity=JSON.parse(await decryptToken(contact.encrypted_identity,env.TOKEN_ENCRYPTION_KEY));
   const result=await readStore(env,store.workspace_id,store.id,'abandoned_carts',{email:identity.email});
   for(const cart of result.carts||[]){const id=await sha(store.id+':abandoned:'+cart.id+':'+contact.email_hash);await env.DB.prepare('INSERT OR IGNORE INTO commerce_events(id,store_id,topic,encrypted_payload,due_at,received_at) VALUES(?,?,?,?,?,?)').bind(id,store.id,'cart.abandoned',await encryptToken(JSON.stringify({id:cart.id,email:identity.email}),env.TOKEN_ENCRYPTION_KEY),now,now).run();}
   cursor=contact.recipient_hash;
  }
  if(contacts.results.length===3)next=now+60000;else if(next===now+3600000)cursor='';
 }catch{next=now+900000;}
 finally{await env.DB.prepare('UPDATE commerce_polling SET cursor=?,next_at=?,lease_until=0 WHERE store_id=? AND lease_until=?').bind(cursor,next,poll.store_id,poll.lease_until).run();}
}
