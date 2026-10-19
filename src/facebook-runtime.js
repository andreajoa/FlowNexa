import {respond as J,sha} from './identity.js';
import {encryptToken,decryptToken} from './instagram-oauth.js';
import {zernioRequest} from './zernio-client.js';
import {facebookEnabled,facebookAccess,facebookSendsEnabled,facebookMonthlyLimit,ensureFacebookSchema} from './facebook-schema.js';
import {normalizeFacebook} from './facebook-webhook.js';
const rows=async statement=>(await statement.all()).results||[];
const changes=result=>Number(result?.meta?.changes||0);
const clean=text=>String(text).normalize('NFKC').trim().toLowerCase();
const windowError=event=>Date.now()-event.at>(event.kind==='dm'?86400000:7*86400000)?'message_window_expired':null;
function matches(flow,event){
 if(!['dm_any','dm_keyword','comment_any','comment_keyword'].includes(flow.trigger_type)||!flow.trigger_type.startsWith(event.kind==='dm'?'dm_':'comment_'))return false;
 if(event.kind==='dm'&&flow.response_kind!=='message'||event.kind==='comment'&&!['public_reply','private_reply'].includes(flow.response_kind)||typeof flow.response_text!=='string'||!flow.response_text.trim()||flow.response_text.length>2000)return false;
 if(flow.trigger_type.endsWith('_any'))return true;
 try{const keywords=JSON.parse(flow.keywords);return Array.isArray(keywords)&&keywords.some(k=>typeof k==='string'&&clean(k)&&clean(event.text).includes(clean(k)));}catch{return false;}
}
async function contactHash(account,event){return sha(account.id+':'+event.sender_id);}
async function threadHash(account,conversation){return sha(account.id+':'+conversation);}
async function threadPaused(env,account,conversation,eventAt=null){
 if(!conversation)return false;
 const state=await env.DB.prepare('SELECT standby,last_control_at FROM facebook_threads WHERE account_id=? AND conversation_hash=?').bind(account.id,await threadHash(account,conversation)).first();
 return Boolean(state&&(state.standby||eventAt!==null&&eventAt<=state.last_control_at));
}
async function pauseConversation(env,account,conversation,at=Date.now()){
 if(typeof conversation!=='string'||!conversation||conversation.length>1000)return;
 const hash=await threadHash(account,conversation);
 await env.DB.batch([
  env.DB.prepare('INSERT INTO facebook_threads(account_id,conversation_hash,standby,last_control_at) VALUES(?,?,1,?) ON CONFLICT(account_id,conversation_hash) DO UPDATE SET standby=1,last_control_at=MAX(last_control_at,excluded.last_control_at)').bind(account.id,hash,at),
  env.DB.prepare("UPDATE facebook_jobs SET status='paused',error='thread_standby' WHERE account_id=? AND conversation_hash=? AND status='pending'").bind(account.id,hash)
 ]);
}
async function controlChanged(env,account,body){
 const conversation=body.conversation?.id,owner=body.control?.owner,at=Date.parse(body.timestamp);
 if(typeof conversation!=='string'||!conversation||conversation.length>1000||!['app','other','ai_agent'].includes(owner)||!Number.isFinite(at)||at<=0||at>Date.now()+300000)return;
 if(owner!=='app'){await pauseConversation(env,account,conversation,Math.max(Date.now(),at));return;}
 // Only a newer, signed provider handback can release the barrier. Ordinary
 // messages and replays cannot revive paused actions or steal human ownership.
 await env.DB.prepare('INSERT INTO facebook_threads(account_id,conversation_hash,standby,last_control_at) VALUES(?,?,0,?) ON CONFLICT(account_id,conversation_hash) DO UPDATE SET standby=0,last_control_at=excluded.last_control_at WHERE excluded.last_control_at>last_control_at').bind(account.id,await threadHash(account,conversation),at).run();
}
export async function acceptFacebookWebhook(body,env){
 if(env.FACEBOOK_CHANNEL_ENABLED!=='true'||!env.DB||!env.TOKEN_ENCRYPTION_KEY||body?.test===true||body?.account?.platform!=='facebook')return J({received:true,queued:0});
 const remote=body.account.accountId||body.account.id,profile=body.account.profileId;
 if(typeof remote!=='string'||!/^[a-f0-9]{24}$/i.test(remote)||typeof profile!=='string'||!profile)return J({error:'invalid_account'},400);
 if(!['message.received','comment.received','account.disconnected','conversation.control_changed'].includes(body.event))return J({received:true,queued:0});
 try{
  await ensureFacebookSchema(env);
  const account=await env.DB.prepare('SELECT * FROM facebook_accounts WHERE remote_id=?').bind(remote).first();
  if(!account||!facebookEnabled(env,account.workspace_id))return J({received:true,queued:0});
  if(profile!==account.profile_id)return J({error:'profile_mismatch'},400);
  if(body.event==='account.disconnected'){
   const result=await zernioRequest(env,'accounts?'+new URLSearchParams({profileId:profile,platform:'facebook'}));
   if(!Array.isArray(result.accounts))throw Error('invalid_provider_response');
   const current=result.accounts.find(a=>a._id===remote);
   if(!current||current.platform!=='facebook'||current.isActive===false||current.needsReconnection===true)await env.DB.batch([
    env.DB.prepare("UPDATE facebook_accounts SET status='reconnect_required' WHERE id=?").bind(account.id),
    env.DB.prepare('UPDATE facebook_flows SET enabled=0,version=version+1 WHERE account_id=? AND enabled=1').bind(account.id),
    env.DB.prepare("UPDATE facebook_jobs SET status='cancelled',error='account_reconnect_required' WHERE account_id=? AND status='pending'").bind(account.id)
   ]);
   return J({received:true,queued:0});
  }
  if(account.status!=='connected')return J({received:true,queued:0});
  if(body.event==='conversation.control_changed'){await controlChanged(env,account,body);return J({received:true,queued:0});}
  if(body.metadata?.standby===true){await pauseConversation(env,account,body.conversation?.id||body.message?.conversationId);return J({received:true,queued:0});}
  const event=normalizeFacebook(body,account);if(!event)return J({received:true,queued:0});
  const recipient=await contactHash(account,event),command=clean(event.text);
  // Only explicit inbound DM commands alter consent. Comments cannot restart consent.
  if(event.kind==='dm'&&['stop','parar','cancelar','unsubscribe','start'].includes(command)){
   const updated=await env.DB.prepare('INSERT INTO facebook_contacts(account_id,recipient_hash,opted_out,last_incoming_at) VALUES(?,?,?,?) ON CONFLICT(account_id,recipient_hash) DO UPDATE SET opted_out=excluded.opted_out,last_incoming_at=MAX(last_incoming_at,excluded.last_incoming_at) WHERE excluded.last_incoming_at>=last_incoming_at').bind(account.id,recipient,command==='start'?0:1,event.at).run();
   if(command!=='start'&&changes(updated))await env.DB.prepare("UPDATE facebook_jobs SET status='paused',error='contact_opted_out' WHERE account_id=? AND recipient_hash=? AND status='pending'").bind(account.id,recipient).run();
   return J({received:true,queued:0});
  }
  const consent=await env.DB.prepare('SELECT opted_out FROM facebook_contacts WHERE account_id=? AND recipient_hash=?').bind(account.id,recipient).first();
  if(!facebookSendsEnabled(env,account.workspace_id)||consent?.opted_out||windowError(event)||!await facebookAccess(env,account.workspace_id))return J({received:true,queued:0});
  if(event.kind==='dm'&&await threadPaused(env,account,event.conversation_id,event.at))return J({received:true,queued:0});
  const flows=await rows(env.DB.prepare('SELECT * FROM facebook_flows WHERE account_id=? AND workspace_id=? AND enabled=1 ORDER BY trigger_type DESC,id LIMIT 100').bind(account.id,account.workspace_id));
  const flow=flows.filter(f=>matches(f,event)&&(!f.published_at||event.at>=f.published_at)).sort((a,b)=>Number(b.trigger_type.endsWith('_keyword'))-Number(a.trigger_type.endsWith('_keyword'))||a.id.localeCompare(b.id))[0];
  if(!flow)return J({received:true,queued:0});
  const id=await sha('facebook:'+account.id+':'+event.key),now=Date.now(),job=await sha('facebook-job:'+id);
  const payload=await encryptToken(JSON.stringify(event),env.TOKEN_ENCRYPTION_KEY),action=await encryptToken(JSON.stringify({event,kind:flow.response_kind,text:flow.response_text}),env.TOKEN_ENCRYPTION_KEY);
  const result=await env.DB.batch([
   env.DB.prepare('INSERT OR IGNORE INTO facebook_events(id,workspace_id,account_id,encrypted_event,event_at,received_at) VALUES(?,?,?,?,?,?)').bind(id,account.workspace_id,account.id,payload,event.at,now),
   env.DB.prepare('INSERT OR IGNORE INTO facebook_jobs(id,event_id,workspace_id,account_id,flow_id,flow_version,encrypted_action,due_at,recipient_hash,conversation_hash) VALUES(?,?,?,?,?,?,?,?,?,?)').bind(job,id,account.workspace_id,account.id,flow.id,flow.version,action,now,recipient,event.conversation_id?await sha(account.id+':'+event.conversation_id):null)
  ]);
  return J({received:true,queued:changes(result[1])});
 }catch{return J({error:'facebook_queue_unavailable'},503);}
}
async function finish(env,id,status,error=null,provider=null,lease=null){
 const condition=lease?"status='sending' AND lease_id=?":"status='pending'";
 const args=[status,error,provider,Date.now(),id,...(lease?[lease]:[])];
 return env.DB.prepare('UPDATE facebook_jobs SET status=?,error=?,provider_id=?,completed_at=?,lease_until=NULL WHERE id=? AND '+condition).bind(...args).run();
}
export async function processFacebookJobs(env,limit=5,deadline=Date.now()+8000){
 const summary={processed:0,accepted:0,unknown:0,failed:0};
 if(!env.DB)return summary;
 if(env.FACEBOOK_CHANNEL_ENABLED!=='true'||env.FACEBOOK_SENDS_ENABLED!=='true'){
  // Rollback must not depend on migrations having run, or on Instagram tables.
  try{await env.DB.prepare("UPDATE facebook_jobs SET status='cancelled',error='facebook_disabled',completed_at=? WHERE status='pending'").bind(Date.now()).run();}catch{}
  return summary;
 }
 if(!env.TOKEN_ENCRYPTION_KEY||deadline-Date.now()<2500)return summary;
 await ensureFacebookSchema(env);
 // A process crash after reservation has uncertain delivery; never resend that action.
 await env.DB.prepare("UPDATE facebook_jobs SET status='unknown',error='delivery_unknown',completed_at=? WHERE status='sending' AND lease_until<?").bind(Date.now(),Date.now()).run();
 const jobs=await rows(env.DB.prepare("SELECT * FROM facebook_jobs WHERE status='pending' AND due_at<=? ORDER BY due_at,id LIMIT ?").bind(Date.now(),Math.max(1,Math.min(20,Number(limit)||5))));
 for(const job of jobs){
  if(deadline-Date.now()<2500)break;
  if(!facebookSendsEnabled(env,job.workspace_id)){await finish(env,job.id,'cancelled','facebook_disabled');continue;}
  let reserved=false,attempted=false,ownedLease=null,eventAt=null;
  try{
   const account=await env.DB.prepare('SELECT * FROM facebook_accounts WHERE id=? AND workspace_id=?').bind(job.account_id,job.workspace_id).first(),flow=await env.DB.prepare('SELECT * FROM facebook_flows WHERE id=? AND account_id=? AND workspace_id=?').bind(job.flow_id,job.account_id,job.workspace_id).first();
   if(!account||account.status!=='connected'||!flow?.enabled||flow.version!==job.flow_version||!await facebookAccess(env,job.workspace_id)){await finish(env,job.id,'cancelled','automation_disabled');continue;}
   const action=JSON.parse(await decryptToken(job.encrypted_action,env.TOKEN_ENCRYPTION_KEY)),event=action.event;
   eventAt=event?.at;
   if(!event||!matches(flow,event)||action.kind!==flow.response_kind||action.text!==flow.response_text||flow.published_at&&event.at<flow.published_at||!Number.isFinite(event.at)||event.at>Date.now()+300000)throw Error('invalid_action');
   const consent=await env.DB.prepare('SELECT opted_out FROM facebook_contacts WHERE account_id=? AND recipient_hash=?').bind(account.id,await contactHash(account,event)).first();
   if(consent?.opted_out)throw Error('contact_opted_out');
   if(event.kind==='dm'&&await threadPaused(env,account,event.conversation_id,event.at))throw Error('thread_standby');
   if(windowError(event))throw Error(windowError(event));
   if(deadline-Date.now()<2500)break;
   const now=Date.now(),d=new Date(now),month=Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),1),lease=crypto.randomUUID();
   // Reservation and quota test share one atomic statement, preventing concurrent ticks
   // from both consuming the last allowance. Unknown deliveries remain counted.
   const claim=await env.DB.prepare("UPDATE facebook_jobs SET status='sending',lease_id=?,lease_until=?,attempt_at=?,attempts=attempts+1 WHERE id=? AND status='pending' AND NOT EXISTS(SELECT 1 FROM facebook_threads t WHERE t.account_id=facebook_jobs.account_id AND t.conversation_hash=facebook_jobs.conversation_hash AND (t.standby=1 OR t.last_control_at>=?)) AND (SELECT COUNT(*) FROM facebook_jobs q WHERE q.workspace_id=? AND q.status IN ('sending','accepted','unknown') AND q.attempt_at>=?)<?").bind(lease,now+60000,now,job.id,event.at,job.workspace_id,month,facebookMonthlyLimit(env)).run();
   if(!changes(claim)){const current=await env.DB.prepare('SELECT status FROM facebook_jobs WHERE id=?').bind(job.id).first();if(current?.status==='pending'){const paused=await threadPaused(env,account,event.conversation_id,event.at);await finish(env,job.id,paused?'paused':'failed',paused?'thread_standby':'facebook_message_limit');}continue;}
   reserved=true;ownedLease=lease;summary.processed++;
   if(action.kind==='private_reply'){
    const effect=await sha('facebook-private:'+account.id+':'+event.comment_id);
    const held=await env.DB.prepare('INSERT OR IGNORE INTO facebook_effects(effect_key,job_id) VALUES(?,?)').bind(effect,job.id).run();
    const existing=await env.DB.prepare('SELECT job_id FROM facebook_effects WHERE effect_key=?').bind(effect).first();
    if(!changes(held)&&existing?.job_id!==job.id)throw Error('private_reply_already_sent');
   }
   let path,body={accountId:account.remote_id,message:action.text};
   if(event.kind==='dm')path='inbox/conversations/'+encodeURIComponent(event.conversation_id)+'/messages';
   else{path='inbox/comments/'+encodeURIComponent(event.post_id);if(action.kind==='private_reply')path+='/'+encodeURIComponent(event.comment_id)+'/private-reply';else body.commentId=event.comment_id;}
   attempted=true;
   const result=await zernioRequest({...env,RUNTIME_DEADLINE_MS:deadline},path,{method:'POST',body});
   const provider=result.data?.messageId||result.data?.commentId||result.messageId||result.message?.platformMessageId||result.message?.id||result.comment?.id||result.id;
   if(typeof provider!=='string'||!provider.trim())throw Error('delivery_unknown');
   await finish(env,job.id,'accepted',null,provider,ownedLease);summary.accepted++;
  }catch(error){
   if(['processing_deferred','meta_rate_limited'].includes(error.message)&&reserved){
    const state=job.conversation_hash?await env.DB.prepare('SELECT standby,last_control_at FROM facebook_threads WHERE account_id=? AND conversation_hash=?').bind(job.account_id,job.conversation_hash).first():null;
    const consent=await env.DB.prepare('SELECT opted_out FROM facebook_contacts WHERE account_id=? AND recipient_hash=?').bind(job.account_id,job.recipient_hash).first();
    const blocked=state&&(state.standby||eventAt<=state.last_control_at);
    if(blocked||consent?.opted_out){await finish(env,job.id,'paused',blocked?'thread_standby':'contact_opted_out',null,ownedLease);continue;}
   }
   if(error.message==='processing_deferred'&&reserved){await env.DB.prepare("UPDATE facebook_jobs SET status='pending',due_at=?,lease_until=NULL,error='processing_deferred' WHERE id=? AND status='sending' AND lease_id=?").bind(Date.now()+1000,job.id,ownedLease).run();continue;}
   if(error.message==='meta_rate_limited'&&reserved&&job.attempts<2){await env.DB.prepare("UPDATE facebook_jobs SET status='pending',due_at=?,lease_until=NULL,error='rate_limited' WHERE id=? AND status='sending' AND lease_id=?").bind(Date.now()+60000*(job.attempts+1),job.id,ownedLease).run();continue;}
   const uncertain=reserved&&(error.message==='delivery_unknown'||attempted&&!['account_reconnect_required','zernio_request_rejected','meta_rate_limited','processing_deferred'].includes(error.message));
   const safe=['thread_standby','contact_opted_out','message_window_expired','private_reply_already_sent','invalid_action','account_reconnect_required','zernio_request_rejected','meta_rate_limited','processing_deferred'].includes(error.message)?error.message:'facebook_send_failed';
   await finish(env,job.id,uncertain?'unknown':error.message==='thread_standby'?'paused':'failed',uncertain?'delivery_unknown':safe,null,ownedLease);summary[uncertain?'unknown':'failed']++;
  }
 }
 return summary;
}
