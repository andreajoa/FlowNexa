import {respond as J,sha} from '../identity.js';
import {encryptToken,decryptToken} from '../instagram-oauth.js';
import {zernioRequest} from '../zernio-client.js';
import {billingAccess,assertMessageCapacity} from '../billing.js';
import {phraseMatches} from '../conversation-graph.js';
import {ensureSchema,enabled,sendsEnabled} from './schema.js';
import {normalizeTikTok} from './normalize.js';
import {validateTikTokGraph,walkTikTokGraph} from './graph.js';
const windowMs=48*3600000;
const encrypt=(env,data)=>encryptToken(JSON.stringify(data),env.TOKEN_ENCRYPTION_KEY);
const decrypt=async(env,data)=>JSON.parse(await decryptToken(data,env.TOKEN_ENCRYPTION_KEY));
const all=async q=>(await q.all()).results;
export async function acceptTikTokWebhook(body,env){
 if(!enabled(env)||body.test===true)return J({received:true,queued:0});
 try{
  await ensureSchema(env);
  const remote=body.account?.accountId||body.account?.id;
  const a=await env.DB.prepare('SELECT * FROM tiktok_accounts WHERE remote_id=?').bind(typeof remote==='string'?remote:'').first();
  if(!a)return J({received:true,queued:0});
  if(body.account?.profileId!==a.profile_id)return J({error:'profile_mismatch'},400);
  if(body.event==='account.disconnected'){
   const result=await zernioRequest(env,'accounts?'+new URLSearchParams({profileId:a.profile_id,platform:'tiktok'}));
   if(!Array.isArray(result.accounts))throw Error('invalid_provider_response');
   const current=result.accounts.find(x=>x._id===remote);
   if(!current||current.isActive===false||current.needsReconnection===true)await env.DB.batch([
    env.DB.prepare("UPDATE tiktok_accounts SET status='reconnect_required' WHERE id=?").bind(a.id),
    env.DB.prepare('UPDATE tiktok_flows SET enabled=0,version=version+1 WHERE account_id=?').bind(a.id),
    env.DB.prepare("UPDATE tiktok_jobs SET status='cancelled',encrypted_action='',error='account_reconnect_required' WHERE account_id=? AND status='pending'").bind(a.id)
   ]);
   return J({received:true,queued:0});
  }
  const e=normalizeTikTok(body,a);
  if(a.status!=='connected'||!e||e.at<a.created_at||Date.now()-e.at>windowMs)return J({received:true,queued:0});
  const id=await sha(a.id+':'+e.key),recipient=await sha(a.id+':'+e.sender_id);
  // Opt-out takes effect at receipt, even when a previous response is still queued.
  const stop=e.kind==='dm'&&/^(stop|parar|sair|cancelar)$/i.test(e.text.trim());
  const statements=[env.DB.prepare('INSERT OR IGNORE INTO tiktok_events(id,account_id,encrypted_event,event_at,received_at) VALUES(?,?,?,?,?)').bind(id,a.id,await encrypt(env,e),e.at,Date.now())];
  if(e.kind==='dm')statements.push(env.DB.prepare('INSERT INTO tiktok_contacts(account_id,recipient_hash,opted_out,last_incoming_at) VALUES(?,?,?,?) ON CONFLICT(account_id,recipient_hash) DO UPDATE SET last_incoming_at=MAX(last_incoming_at,excluded.last_incoming_at),opted_out=MAX(opted_out,excluded.opted_out)').bind(a.id,recipient,stop?1:0,e.at));
  if(stop)statements.push(env.DB.prepare("UPDATE tiktok_jobs SET status='cancelled',encrypted_action='',error='contact_opted_out' WHERE account_id=? AND recipient_hash=? AND status='pending'").bind(a.id,recipient),env.DB.prepare('DELETE FROM tiktok_sessions WHERE account_id=? AND recipient_hash=?').bind(a.id,recipient));
  const result=await env.DB.batch(statements);return J({received:true,queued:result[0].meta.changes});
 }catch{return J({error:'queue_unavailable'},503);}
}
async function planEvent(env,row){
 const e=await decrypt(env,row.encrypted_event),a=await env.DB.prepare('SELECT * FROM tiktok_accounts WHERE id=?').bind(row.account_id).first();
 const finish=()=>env.DB.prepare("UPDATE tiktok_events SET status='processed',encrypted_event='' WHERE id=?").bind(row.id).run();
 if(!a||a.status!=='connected'||Date.now()-e.at>windowMs)return finish();
 const recipient=await sha(a.id+':'+e.sender_id),thread=await sha(a.id+':'+(e.conversation_id||e.key));
 const contact=await env.DB.prepare('SELECT * FROM tiktok_contacts WHERE account_id=? AND recipient_hash=?').bind(a.id,recipient).first();
 if(contact?.opted_out||contact?.last_event_at>e.at)return finish();
 // An ambiguous response requires human review; never restart the same conversation automatically.
 if(await env.DB.prepare("SELECT id FROM tiktok_jobs WHERE account_id=? AND conversation_hash=? AND status='unknown' AND attempt_at>? LIMIT 1").bind(a.id,thread,Date.now()-windowMs).first())return finish();
 const session=e.kind==='dm'?await env.DB.prepare('SELECT * FROM tiktok_sessions WHERE account_id=? AND recipient_hash=? AND expires_at>?').bind(a.id,recipient,Date.now()).first():null;
 const flows=await all(env.DB.prepare('SELECT * FROM tiktok_flows WHERE account_id=? AND enabled=1 AND published_at<=? ORDER BY created_at,id').bind(a.id,e.at));
 let flow=session&&flows.find(f=>f.id===session.flow_id&&f.version===session.flow_version);
 const resume=Boolean(flow);
 if(!flow)flow=flows.find(f=>f.trigger_type.startsWith(e.kind+'_')&&(f.trigger_type.endsWith('_any')||phraseMatches(e.text,JSON.parse(f.keywords).join('\n'))));
 if(!flow)return finish();
 const graph=JSON.parse(flow.graph);if(!validateTikTokGraph(graph).ok)return finish();
 const action=walkTikTokGraph(graph,resume?session.node_id:graph.start,e.text);
 // Empty branches end without an outbound effect.
 if(!action.text){await env.DB.batch([env.DB.prepare('DELETE FROM tiktok_sessions WHERE account_id=? AND recipient_hash=?').bind(a.id,recipient),env.DB.prepare("UPDATE tiktok_events SET status='processed',encrypted_event='' WHERE id=?").bind(row.id)]);return;}
 await env.DB.batch([
  env.DB.prepare('INSERT OR IGNORE INTO tiktok_jobs(id,event_id,workspace_id,account_id,flow_id,flow_version,recipient_hash,conversation_hash,encrypted_action,due_at) VALUES(?,?,?,?,?,?,?,?,?,?)').bind(row.id,row.id,a.workspace_id,a.id,flow.id,flow.version,recipient,thread,await encrypt(env,{event:e,...action}),Date.now()),
  env.DB.prepare("UPDATE tiktok_events SET status='processed',encrypted_event='' WHERE id=?").bind(row.id)
 ]);
}
async function sendJob(env,job){
 const a=await env.DB.prepare('SELECT * FROM tiktok_accounts WHERE id=?').bind(job.account_id).first(),f=await env.DB.prepare('SELECT * FROM tiktok_flows WHERE id=?').bind(job.flow_id).first();
 const data=await decrypt(env,job.encrypted_action),e=data.event;
 const contact=await env.DB.prepare('SELECT * FROM tiktok_contacts WHERE account_id=? AND recipient_hash=?').bind(job.account_id,job.recipient_hash).first();
 let reason=a?.status!=='connected'?'account_disconnected':!f?.enabled||f.version!==job.flow_version?'flow_changed':contact?.opted_out?'contact_opted_out':Date.now()-e.at>windowMs?'message_window_expired':!await billingAccess(env,job.workspace_id)?'billing_subscription_required':null;
 if(!reason&&e.kind==='dm'){
  const count=await env.DB.prepare("SELECT count(*) n FROM tiktok_jobs WHERE account_id=? AND conversation_hash=? AND status IN ('sending','accepted','unknown') AND attempt_at>?").bind(a.id,job.conversation_hash,Date.now()-windowMs).first();
  if(count.n>=10)reason='tiktok_reply_limit';
 }
 if(reason){await env.DB.prepare("UPDATE tiktok_jobs SET status='cancelled',error=?,encrypted_action='' WHERE id=? AND status='pending'").bind(reason,job.id).run();return;}
 const reserved=await env.DB.prepare("UPDATE tiktok_jobs SET status='sending',attempt_at=?,attempts=attempts+1 WHERE id=? AND status='pending' RETURNING id").bind(Date.now(),job.id).first();if(!reserved)return;
 let dispatched=false;
 try{
  await assertMessageCapacity(env,job.workspace_id);
  const path=e.kind==='dm'?'inbox/conversations/'+encodeURIComponent(e.conversation_id)+'/messages':'inbox/comments/'+encodeURIComponent(e.post_id);
  dispatched=true;
  const result=await zernioRequest(env,path,{method:'POST',idempotencyKey:'flownexa-tiktok-'+job.id,body:{accountId:a.remote_id,message:data.text,...(e.kind==='comment'?{commentId:e.comment_id}:{})}});
  const id=result.data?.messageId||result.data?.commentId||result.messageId||result.comment?.id;
  if(result.success===false||typeof id!=='string'||!id)throw Error('delivery_unknown');
  const statements=[env.DB.prepare("UPDATE tiktok_jobs SET status='accepted',provider_id=?,completed_at=?,encrypted_action='' WHERE id=? AND status='sending'").bind(id,Date.now(),job.id)];
  if(e.kind==='dm'){
   statements.push(env.DB.prepare('UPDATE tiktok_contacts SET last_event_at=MAX(last_event_at,?) WHERE account_id=? AND recipient_hash=?').bind(e.at,a.id,job.recipient_hash));
   if(data.wait)statements.push(env.DB.prepare('INSERT INTO tiktok_sessions(account_id,recipient_hash,flow_id,flow_version,node_id,expires_at) VALUES(?,?,?,?,?,?) ON CONFLICT(account_id,recipient_hash) DO UPDATE SET flow_id=excluded.flow_id,flow_version=excluded.flow_version,node_id=excluded.node_id,expires_at=excluded.expires_at').bind(a.id,job.recipient_hash,f.id,f.version,data.wait.node_id,Math.min(e.at+windowMs,Date.now()+data.wait.seconds*1000)));
   else statements.push(env.DB.prepare('DELETE FROM tiktok_sessions WHERE account_id=? AND recipient_hash=?').bind(a.id,job.recipient_hash));
  }
  await env.DB.batch(statements);
 }catch(error){
  const retry=error.message==='meta_rate_limited'||error.deferred;
  const unknown=dispatched&&!retry&&(!error.status||error.status>=500);
  const status=retry&&job.attempts<4?'pending':unknown?'unknown':'failed';
  const code=unknown?'delivery_unknown':retry?'rate_limited':error.message==='account_reconnect_required'?'account_reconnect_required':dispatched?'provider_rejected':'billing_message_limit';
  await env.DB.prepare("UPDATE tiktok_jobs SET status=?,error=?,due_at=?,completed_at=?,encrypted_action=CASE WHEN ?='pending' THEN encrypted_action ELSE '' END WHERE id=? AND status='sending'").bind(status,code,Date.now()+60000*Math.pow(2,job.attempts),Date.now(),status,job.id).run();
  if(code==='account_reconnect_required')await env.DB.prepare("UPDATE tiktok_accounts SET status='reconnect_required' WHERE id=?").bind(a.id).run();
 }
}
export async function processTikTokJobs(env,limit=10,deadline=Date.now()+8000){
 if(!sendsEnabled(env))return{processed:0};await ensureSchema(env);
 const lease=crypto.randomUUID(),now=Date.now();
 const lock=await env.DB.prepare('INSERT INTO tiktok_worker(id,lease,expires_at) VALUES(1,?,?) ON CONFLICT(id) DO UPDATE SET lease=excluded.lease,expires_at=excluded.expires_at WHERE expires_at<? RETURNING lease').bind(lease,now+120000,now).first();
 if(lock?.lease!==lease)return{processed:0};let processed=0;
 env={...env,RUNTIME_DEADLINE_MS:deadline};
 try{
  await env.DB.prepare("UPDATE tiktok_jobs SET status='unknown',error='delivery_unknown',encrypted_action='' WHERE status='sending' AND attempt_at<?").bind(now-120000).run();
  for(let i=0;i<limit&&Date.now()<deadline-2000;i++){
   const job=await env.DB.prepare("SELECT * FROM tiktok_jobs WHERE status='pending' AND due_at<=? ORDER BY due_at,id LIMIT 1").bind(Date.now()).first();
   if(job){await sendJob(env,job);processed++;continue;}
   const row=await env.DB.prepare("SELECT * FROM tiktok_events e WHERE status='pending' AND NOT EXISTS(SELECT 1 FROM tiktok_jobs j WHERE j.account_id=e.account_id AND j.status IN ('pending','sending')) ORDER BY event_at,received_at,id LIMIT 1").first();
   if(!row)break;await planEvent(env,row);processed++;
  }
  return{processed};
 }finally{await env.DB.prepare('DELETE FROM tiktok_worker WHERE id=1 AND lease=?').bind(lease).run();}
}
