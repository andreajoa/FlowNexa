import {encryptToken,decryptToken} from './instagram-oauth.js';
import {sha} from './identity.js';
import {matchFlow,normalizeWebhook} from './flow-runtime.js';
import {sendAction,messagingReady} from './meta-client.js';
export async function enqueueWebhook(body,env){
 const events=normalizeWebhook(body);let queued=0;
 if(events.length>100)throw Error('webhook_batch_too_large');
 for(const event of events){
  const account=await env.DB.prepare("SELECT id,workspace_id FROM instagram_accounts WHERE ig_user_id=? AND status='connected'").bind(event.account).first();if(!account)continue;
  const id=await sha(account.id+':'+event.key),now=Date.now();
  const result=await env.DB.prepare('INSERT OR IGNORE INTO automation_events(id,account_id,workspace_id,encrypted_event,received_at,event_at,due_at) VALUES (?,?,?,?,?,?,?)').bind(id,account.id,account.workspace_id,await encryptToken(JSON.stringify(event),env.TOKEN_ENCRYPTION_KEY),now,event.at,now).run();queued+=result.meta.changes;
 }
 return queued;
}
async function processEvent(env,row,deadline){
 const event=JSON.parse(await decryptToken(row.encrypted_event,env.TOKEN_ENCRYPTION_KEY));
 const account=await env.DB.prepare('SELECT * FROM instagram_accounts WHERE id=?').bind(row.account_id).first();
 if(!account||account.status!=='connected')return 'cancelled';
 let jobs=await env.DB.prepare('SELECT * FROM automation_jobs WHERE event_id=? ORDER BY action_index').bind(row.id).all();
 if(!jobs.results.length){
  const flows=await env.DB.prepare('SELECT * FROM flows WHERE account_id=? AND enabled=1 ORDER BY created_at,id').bind(account.id).all();
  let flow,match;for(const f of flows.results){const m=matchFlow(f,event);if(m.matched){flow=f;match=m;break;}}
  if(!flow)return 'unmatched';
  if(match.configuration.once_per_contact){
   if(!event.sender_id)return 'identity_unavailable';
   const recipient=await sha(event.sender_id);
   await env.DB.prepare('INSERT OR IGNORE INTO automation_contacts(account_id,flow_id,recipient_hash,event_id) VALUES (?,?,?,?)').bind(account.id,flow.id,recipient,row.id).run();
   const contact=await env.DB.prepare('SELECT event_id FROM automation_contacts WHERE account_id=? AND flow_id=? AND recipient_hash=?').bind(account.id,flow.id,recipient).first();if(contact.event_id!==row.id)return 'contact_already_processed';
  }
  const statements=[];
  for(let i=0;i<match.actions.length;i++){
   const action=match.actions[i];const effect=await sha(`${account.id}:${event.kind==='comment'?event.comment_id:event.key}:${action.type}:${event.kind==='comment'?'':i}`);
   statements.push(env.DB.prepare('INSERT OR IGNORE INTO automation_jobs(id,event_id,account_id,workspace_id,flow_id,flow_version,action_index,action_type,effect_key,encrypted_action) VALUES (?,?,?,?,?,?,?,?,?,?)').bind(crypto.randomUUID(),row.id,account.id,account.workspace_id,flow.id,flow.version,i,action.type,effect,await encryptToken(JSON.stringify(action),env.TOKEN_ENCRYPTION_KEY)));
  }
  await env.DB.batch(statements);jobs=await env.DB.prepare('SELECT * FROM automation_jobs WHERE event_id=? ORDER BY action_index').bind(row.id).all();
 }
 let unknown=false,failed=false;
 for(const job of jobs.results){
  if(job.status==='sending'){
   await env.DB.prepare("UPDATE automation_jobs SET status='unknown',error='interrupted_delivery',completed_at=? WHERE id=? AND status='sending'").bind(Date.now(),job.id).run();unknown=true;break;
  }
  if(job.status==='unknown'){unknown=true;break;}if(job.status==='accepted'||job.status==='cancelled')continue;if(job.status==='failed'){failed=true;break;}
  if(Date.now()>deadline){const error=Error('processing_deferred');error.deferred=true;throw error;}
  const flow=await env.DB.prepare('SELECT enabled,version FROM flows WHERE id=?').bind(job.flow_id).first();
  const current=await env.DB.prepare('SELECT * FROM instagram_accounts WHERE id=?').bind(account.id).first();
  if(!flow?.enabled||flow.version!==job.flow_version||current?.status!=='connected'){
   await env.DB.prepare("UPDATE automation_jobs SET status='cancelled',error='flow_or_account_changed',completed_at=? WHERE id=? AND status='pending'").bind(Date.now(),job.id).run();continue;
  }
  // Extend the lease, then reserve this effect before any provider request.
  const lease=await env.DB.prepare("UPDATE automation_events SET lease_until=? WHERE id=? AND lease_id=? AND status='processing' RETURNING id").bind(Date.now()+60000,row.id,row.lease_id).first();if(!lease)return 'lease_lost';
  const reserved=await env.DB.prepare("UPDATE automation_jobs SET status='sending',attempt_at=? WHERE id=? AND status='pending' RETURNING id").bind(Date.now(),job.id).first();if(!reserved)continue;
  try{
   const action=JSON.parse(await decryptToken(job.encrypted_action,env.TOKEN_ENCRYPTION_KEY));
   const id=await sendAction(env,current,event,action);
   try{await env.DB.prepare("UPDATE automation_jobs SET status='accepted',provider_id=?,completed_at=?,error=NULL WHERE id=?").bind(id,Date.now(),job.id).run();}catch{throw Error('delivery_unknown');}
  }catch(error){
   if(error.retryable&&row.attempts<6){await env.DB.prepare("UPDATE automation_jobs SET status='pending',error='meta_rate_limited' WHERE id=?").bind(job.id).run();throw error;}
   const uncertain=error.message==='delivery_unknown';
   const allowed=['delivery_unknown','messaging_disabled','account_reconnect_required','private_reply_window_expired','message_window_expired','event_time_invalid','invalid_comment','invalid_recipient','unsupported_action','meta_request_rejected','meta_invalid_response'];
   await env.DB.prepare('UPDATE automation_jobs SET status=?,error=?,completed_at=? WHERE id=?').bind(uncertain?'unknown':'failed',allowed.includes(error.message)?error.message:'processing_failed',Date.now(),job.id).run();
   if(error.message==='account_reconnect_required')await env.DB.prepare("UPDATE instagram_accounts SET status='reconnect_required' WHERE id=?").bind(account.id).run();
   if(uncertain)unknown=true;else failed=true;break;
  }
 }
 if(unknown||failed)await env.DB.prepare("UPDATE automation_jobs SET status='cancelled',error='previous_action_failed',completed_at=? WHERE event_id=? AND status='pending'").bind(Date.now(),row.id).run();
 return unknown?'unknown':failed?'failed':'completed';
}
export async function processPending(env,limit=10){
 if(!env.DB||!messagingReady(env))return{processed:0,disabled:true};
 let processed=0;const deadline=Date.now()+35000;
 for(let i=0;i<Math.min(limit,20)&&Date.now()<deadline;i++){
  const now=Date.now(),lease=crypto.randomUUID();
  const row=await env.DB.prepare("UPDATE automation_events SET status='processing',lease_id=?,lease_until=?,attempts=attempts+1 WHERE id=(SELECT id FROM automation_events WHERE (status='pending' AND due_at<=?) OR (status='processing' AND lease_until<?) ORDER BY due_at LIMIT 1) RETURNING *").bind(lease,now+60000,now,now).first();if(!row)break;
  try{const status=await processEvent(env,row,deadline);await env.DB.prepare('UPDATE automation_events SET status=?,lease_until=NULL,lease_id=NULL WHERE id=? AND lease_id=?').bind(status,row.id,lease).run();}
  catch(error){await env.DB.prepare('UPDATE automation_events SET status=?,due_at=?,error=?,lease_until=NULL,lease_id=NULL WHERE id=? AND lease_id=?').bind(!error.deferred&&row.attempts>=6?'failed':'pending',Date.now()+(error.deferred?2000:Math.min(3600000,30000*2**row.attempts)),error.deferred?'processing_deferred':error.retryable?'meta_rate_limited':'processing_failed',row.id,lease).run();}
  processed++;
 }
 return{processed};
}
