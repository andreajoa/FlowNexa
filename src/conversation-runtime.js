import {campaignSuppressed} from './campaign-opt-out.js';
import {isOptOut} from './flow-runtime.js';
import {encryptToken,decryptToken} from './instagram-oauth.js';
import {sha} from './identity.js';
import {billingAccess} from './billing.js';
import {sendAction,messagingReady} from './meta-client.js';
import {validateGraph,conditionMatches,switchTarget} from './conversation-graph.js';
const active="('running','waiting_reply','delayed')";
async function lock(env,id){const lease=crypto.randomUUID(),now=Date.now();const row=await env.DB.prepare(`UPDATE conversation_sessions SET lease_id=?,lease_until=? WHERE id=? AND status IN ${active} AND (lease_until IS NULL OR lease_until<?) RETURNING *`).bind(lease,now+60000,id,now).first();if(!row){const error=Error('conversation_busy');error.retryable=true;throw error;}return row;}
async function save(env,row,state,changes={}){
 const next={node_id:row.node_id,step_index:row.step_index,status:row.status,due_at:row.due_at,retry_count:row.retry_count,error:row.error,...changes};
 const changed=await env.DB.prepare('UPDATE conversation_sessions SET encrypted_state=?,node_id=?,step_index=?,status=?,due_at=?,retry_count=?,error=?,updated_at=? WHERE id=? AND lease_id=?').bind(await encryptToken(JSON.stringify(state),env.TOKEN_ENCRYPTION_KEY),next.node_id,next.step_index,next.status,next.due_at,next.retry_count,next.error??null,Date.now(),row.id,row.lease_id).run();
 if(!changed.meta.changes)throw Error('conversation_lease_lost');Object.assign(row,next);
 if(!['running','waiting_reply','delayed'].includes(next.status))await env.DB.prepare("UPDATE automation_jobs SET status='cancelled',error=?,completed_at=? WHERE event_id=? AND action_index>=1000 AND status='pending'").bind(next.error||'conversation_completed',Date.now(),row.origin_event_id).run();
}
async function release(env,row){await env.DB.prepare('UPDATE conversation_sessions SET lease_id=NULL,lease_until=NULL WHERE id=? AND lease_id=?').bind(row.id,row.lease_id).run();}
async function eligibility(env,row){const flow=await env.DB.prepare('SELECT enabled,version FROM flows WHERE id=?').bind(row.flow_id).first(),account=await env.DB.prepare('SELECT * FROM instagram_accounts WHERE id=?').bind(row.account_id).first();if(await campaignSuppressed(env,row.account_id,row.flow_id,row.recipient_hash))return null;if(!flow?.enabled||flow.version!==row.flow_version||account?.status!=='connected'||account.token_expires_at<=Date.now()/1000||!await billingAccess(env,row.workspace_id))return null;return account;}
async function drive(env,row,state,deadline){
 const nodes=new Map(state.graph.nodes.map(node=>[node.id,node]));
 for(let count=0;count<35&&Date.now()<deadline;count++){
  const account=await eligibility(env,row);if(!account){await save(env,row,state,{status:'cancelled',error:'flow_account_or_billing_changed'});return;}
  const node=nodes.get(row.node_id);if(!node){await save(env,row,state,{status:'failed',error:'invalid_graph_node'});return;}
  if(row.status==='waiting_reply'){
   if(row.due_at>Date.now())return;
   if(node.deadline_seconds_from_start!==undefined&&Date.now()>=row.created_at+node.deadline_seconds_from_start*1000){await save(env,row,state,{status:'completed',error:'conversation_deadline_expired'});return;}
   // Timers may advance control state after 24 hours; they never reopen delivery permission.
   const hasWindow=state.inbound&&Date.now()-state.inbound.at<86400000&&state.inbound.at<=Date.now()+300000;
   const withoutWindow=!hasWindow&&node.on_timeout_without_window;
   if(!state.inbound&&!withoutWindow){await save(env,row,state,{status:'completed',error:'no_reply_no_message_window'});return;}
   state.afterMessage=false;
   await save(env,row,state,{node_id:withoutWindow||node.on_timeout,status:'running',step_index:row.step_index+1});continue;
  }
  if(row.status==='delayed'){
   if(row.due_at>Date.now())return;
   await save(env,row,state,{node_id:node.next,status:'running',step_index:row.step_index+1});continue;
  }
  if(node.type==='end'){await save(env,row,state,{status:'completed',error:null});return;}
  if(node.type==='condition'){await save(env,row,state,{node_id:conditionMatches(node,state.replyText,state.replyPayload)?node.yes:node.no,step_index:row.step_index+1});continue;}
  if(node.type==='switch'){await save(env,row,state,{node_id:switchTarget(node,state.replyText,state.replyPayload),step_index:row.step_index+1});continue;}
  if(node.type==='wait_reply'){
   state.waitingSince=state.afterMessage?state.lastOutboundAt:Date.now();state.waitingInboundAt=state.afterMessage?state.lastMessageInboundAt:(state.inbound?.at||0);state.afterMessage=false;
   // A reply may already be durable while recovering an accepted message's cursor write.
   // Select its original encrypted event, not a later message that merely refreshed the window.
   const pending=await env.DB.prepare('SELECT e.encrypted_event FROM conversation_inbound i JOIN automation_events e ON e.id=i.event_id WHERE i.conversation_id=? AND e.event_at>=? AND e.event_at>? AND e.event_at<=? ORDER BY i.received_at,i.rowid LIMIT 1').bind(row.id,state.waitingSince,state.waitingInboundAt,node.deadline_seconds_from_start===undefined?Number.MAX_SAFE_INTEGER:row.created_at+node.deadline_seconds_from_start*1000).first();
   if(pending){const reply=JSON.parse(await decryptToken(pending.encrypted_event,env.TOKEN_ENCRYPTION_KEY));state.replyText=reply.text;state.replyPayload=reply.payload||null;await save(env,row,state,{node_id:node.on_reply,step_index:row.step_index+1});continue;}
   const dueAt=Math.min(state.waitingSince+node.timeout_seconds*1000,node.deadline_seconds_from_start===undefined?Infinity:row.created_at+node.deadline_seconds_from_start*1000);
   await save(env,row,state,{status:'waiting_reply',due_at:dueAt});return;
  }
  if(node.type==='delay'){state.afterMessage=false;await save(env,row,state,{status:'delayed',due_at:Date.now()+node.seconds*1000});return;}
  if(!['message','image','video','buttons'].includes(node.type)){await save(env,row,state,{status:'failed',error:'invalid_graph_node'});return;}
  let event,action;
  let textMsg=node.text;
  if(node.id==='welcome'){
   if(state.isReturning&&node.text_returning)textMsg=node.text_returning;
   else if(state.isReturning)textMsg='Oi de novo! Que bom falar com você por aqui 🙂\n\nVi que já conversamos antes por aqui. Como posso te ajudar hoje? Quer ver os planos, continuar de onde paramos ou precisa de suporte com a sua conta?';
   else if(state.origin.kind==='dm'&&node.text_dm)textMsg=node.text_dm;
   else if(state.origin.kind==='dm')textMsg='Oi! Aqui é a equipe da Atenza 👋\n\nQue bom ter você por aqui! A gente ajuda empresas a organizar o WhatsApp com múltiplos atendentes no mesmo número, agentes de IA e CRM com funil.\n\nVocê já conhece a Atenza ou é seu primeiro contato?';
  }
  if(state.origin.kind==='comment'&&!state.sentFirst){event=state.origin;action={type:'private_reply',text:textMsg};}
  else{event=state.inbound;if(!event||Date.now()-event.at>86400000){await save(env,row,state,{status:'completed',error:'message_window_expired'});return;}action=node.type==='message'?{type:'message',text:textMsg,...(node.quick_replies?{quick_replies:node.quick_replies}:{})}:['image','video'].includes(node.type)?{type:node.type,url:node.url}:{type:'buttons',text:node.text,buttons:node.buttons};}
  action.source_at=event.at;
  const effect=await sha('conversation:'+row.id+':'+row.step_index),jobId=await sha('conversation-job:'+effect);
  await env.DB.prepare('INSERT OR IGNORE INTO automation_jobs(id,event_id,account_id,workspace_id,flow_id,flow_version,action_index,action_type,effect_key,encrypted_action) VALUES(?,?,?,?,?,?,?,?,?,?)').bind(jobId,row.origin_event_id,row.account_id,row.workspace_id,row.flow_id,row.flow_version,1000+row.step_index,action.type,effect,await encryptToken(JSON.stringify(action),env.TOKEN_ENCRYPTION_KEY)).run();
  const job=await env.DB.prepare('SELECT * FROM automation_jobs WHERE id=?').bind(jobId).first();
  if(job.status==='accepted'){const stored=JSON.parse(await decryptToken(job.encrypted_action,env.TOKEN_ENCRYPTION_KEY));state.sentFirst=true;state.lastOutboundAt=job.completed_at;state.lastMessageInboundAt=stored.source_at??event.at;state.afterMessage=true;await save(env,row,state,{node_id:node.next,step_index:row.step_index+1,retry_count:0});continue;}
  if(job.status==='sending'||job.status==='unknown'){
   await env.DB.prepare("UPDATE automation_jobs SET status='unknown',error='interrupted_delivery',completed_at=? WHERE id=? AND status='sending'").bind(Date.now(),jobId).run();await save(env,row,state,{status:'unknown',error:'delivery_unknown'});return;
  }
  if(job.status!=='pending'){await save(env,row,state,{status:'failed',error:'previous_action_failed'});return;}
  const current=await eligibility(env,row);if(!current){await save(env,row,state,{status:'cancelled',error:'flow_account_or_billing_changed'});return;}
  const extended=await env.DB.prepare('UPDATE conversation_sessions SET lease_until=? WHERE id=? AND lease_id=? RETURNING id').bind(Date.now()+60000,row.id,row.lease_id).first();if(!extended)throw Error('conversation_lease_lost');
  const reserved=await env.DB.prepare("UPDATE automation_jobs SET status='sending',attempt_at=? WHERE id=? AND status='pending' RETURNING id").bind(Date.now(),jobId).first();if(!reserved)throw Error('conversation_busy');
  let acceptedAt;
  try{
   const provider=await sendAction(env,current,event,action);
   acceptedAt=Date.now();
   try{await env.DB.prepare("UPDATE automation_jobs SET status='accepted',provider_id=?,completed_at=?,error=NULL WHERE id=? AND status='sending'").bind(provider,acceptedAt,jobId).run();}catch{throw Error('delivery_unknown');}
  }catch(error){
   if(error.deferred){await env.DB.prepare("UPDATE automation_jobs SET status='pending',error='processing_deferred' WHERE id=?").bind(jobId).run();await save(env,row,state,{due_at:Date.now()+2000});return;}
   if(error.retryable&&row.retry_count<5){await env.DB.prepare("UPDATE automation_jobs SET status='pending',error='meta_rate_limited' WHERE id=?").bind(jobId).run();await save(env,row,state,{retry_count:row.retry_count+1,due_at:Date.now()+Math.min(3600000,30000*2**row.retry_count)});return;}
   const uncertain=error.message==='delivery_unknown';
   await env.DB.prepare('UPDATE automation_jobs SET status=?,error=?,completed_at=? WHERE id=?').bind(uncertain?'unknown':'failed',uncertain?'delivery_unknown':'message_rejected',Date.now(),jobId).run();
   if(error.message==='account_reconnect_required')await env.DB.prepare("UPDATE instagram_accounts SET status='reconnect_required' WHERE id=?").bind(row.account_id).run();
   await save(env,row,state,{status:uncertain?'unknown':'failed',error:uncertain?'delivery_unknown':'message_rejected'});return;
  }
  state.sentFirst=true;state.lastOutboundAt=acceptedAt;state.lastMessageInboundAt=event.at;state.afterMessage=true;await save(env,row,state,{node_id:node.next,step_index:row.step_index+1,retry_count:0,error:null});
 }
}
export async function startConversation(env,account,flow,event,eventId){
 const c=typeof flow.configuration==='string'?JSON.parse(flow.configuration):flow.configuration;
 if(!validateGraph(c.graph).ok)return'invalid_graph';if(!event.sender_id)return'identity_unavailable';
 if(isOptOut(c,event)||await campaignSuppressed(env,account.id,flow.id,await sha(event.sender_id)))return'opted_out';
 const suppressed=await env.DB.prepare("SELECT id FROM conversation_sessions WHERE account_id=? AND flow_id=? AND recipient_hash=? AND error='opted_out' LIMIT 1").bind(account.id,flow.id,await sha(event.sender_id)).first();if(suppressed)return'opted_out';
 const prior=await env.DB.prepare('SELECT id FROM conversation_sessions WHERE origin_event_id=?').bind(eventId).first();if(prior)return'conversation_started';
 const recipient=await sha(event.sender_id);
 const priorSession=await env.DB.prepare("SELECT id,node_id,status,encrypted_state,updated_at FROM conversation_sessions WHERE account_id=? AND recipient_hash=? ORDER BY updated_at DESC LIMIT 1").bind(account.id,recipient).first();
 const isReturning=Boolean(priorSession);
 const now=Date.now(),id=crypto.randomUUID(),state={graph:c.graph,origin:event,inbound:['dm','story'].includes(event.kind)?event:null,replyText:event.text||'',replyPayload:event.payload||null,opt_out_keywords:c.opt_out_keywords||[],sentFirst:false,isReturning,priorNodeId:priorSession?.node_id||null};
 const inserted=await env.DB.prepare('INSERT OR IGNORE INTO conversation_sessions(id,account_id,workspace_id,flow_id,flow_version,recipient_hash,origin_event_id,encrypted_state,node_id,due_at,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)').bind(id,account.id,account.workspace_id,flow.id,flow.version,recipient,eventId,await encryptToken(JSON.stringify(state),env.TOKEN_ENCRYPTION_KEY),c.graph.start,now,now,now).run();
 return inserted.meta.changes?'conversation_started':'conversation_already_active';
}
export async function resumeConversation(env,account,event,eventId){
 if(!['comment','dm','story'].includes(event.kind)||!event.sender_id)return false;
 const existing=await env.DB.prepare('SELECT conversation_id FROM conversation_inbound WHERE event_id=?').bind(eventId).first();if(existing)return true;
 const found=await env.DB.prepare(`SELECT id FROM conversation_sessions WHERE account_id=? AND recipient_hash=? AND status IN ${active} ORDER BY created_at LIMIT 1`).bind(account.id,await sha(event.sender_id)).first();if(!found)return false;
 const row=await lock(env,found.id);
 try{
  if(await env.DB.prepare('SELECT event_id FROM conversation_inbound WHERE event_id=?').bind(eventId).first())return true;
  const state=JSON.parse(await decryptToken(row.encrypted_state,env.TOKEN_ENCRYPTION_KEY));
  if(isOptOut({opt_out_keywords:state.opt_out_keywords||[]},event)){await save(env,row,state,{status:'cancelled',error:'opted_out'});await env.DB.prepare('INSERT OR IGNORE INTO conversation_inbound(event_id,conversation_id,received_at) VALUES(?,?,?)').bind(eventId,row.id,Date.now()).run();return true;}
  if(event.kind==='comment')return false;
  if(!await eligibility(env,row)){await save(env,row,state,{status:'cancelled',error:'flow_account_or_billing_changed'});return false;}
  if(event.at>Date.now()+300000||Date.now()-event.at>86400000)return true;
  const newer=!state.inbound||event.at>state.inbound.at;
  if(newer)state.inbound=event;
  const node=state.graph.nodes.find(n=>n.id===row.node_id);
  if(row.status==='waiting_reply'&&node.deadline_seconds_from_start!==undefined&&event.at>row.created_at+node.deadline_seconds_from_start*1000){
   await save(env,row,state,{status:'completed',error:'conversation_deadline_expired'});
   await env.DB.prepare('INSERT OR IGNORE INTO conversation_inbound(event_id,conversation_id,received_at) VALUES(?,?,?)').bind(eventId,row.id,Date.now()).run();
   return true;
  }
  const advance=row.status==='waiting_reply'&&newer&&event.at>=(state.waitingSince||row.created_at)&&event.at>(state.waitingInboundAt||0);
  // Freeze the answer consumed by this branch. Later DMs can extend the user window,
  // but cannot replace the already selected answer while the graph cursor is running.
  if(advance){state.replyText=event.text;state.replyPayload=event.payload||null;}
  // Cursor and inbound event receipt commit together: an interrupted callback cannot branch twice.
  const nextNode=advance?node.on_reply:row.node_id,nextStatus=advance?'running':row.status,nextStep=row.step_index+(advance?1:0);
  const encrypted=await encryptToken(JSON.stringify(state),env.TOKEN_ENCRYPTION_KEY);
  await env.DB.batch([
   env.DB.prepare('INSERT OR IGNORE INTO conversation_inbound(event_id,conversation_id,received_at) VALUES(?,?,?)').bind(eventId,row.id,Date.now()),
   env.DB.prepare('UPDATE conversation_sessions SET encrypted_state=?,node_id=?,status=?,step_index=?,due_at=?,updated_at=? WHERE id=? AND lease_id=?').bind(encrypted,nextNode,nextStatus,nextStep,advance?Date.now():row.due_at,Date.now(),row.id,row.lease_id)
  ]);
  return true;
 }finally{await release(env,row);}
}
export async function processConversations(env,limit=5,executionDeadline){
 if(!env.DB||!messagingReady(env))return{processed:0,disabled:true};let processed=0;const deadline=executionDeadline||env.RUNTIME_DEADLINE_MS||Date.now()+18000;
 env={...env,RUNTIME_DEADLINE_MS:deadline};
 for(let i=0;i<Math.min(limit,10)&&Date.now()<deadline;i++){
  const now=Date.now(),row=await env.DB.prepare(`SELECT id FROM conversation_sessions WHERE status IN ${active} AND due_at<=? AND (lease_until IS NULL OR lease_until<?) ORDER BY due_at,id LIMIT 1`).bind(now,now).first();if(!row)break;
  let locked;try{locked=await lock(env,row.id);const state=JSON.parse(await decryptToken(locked.encrypted_state,env.TOKEN_ENCRYPTION_KEY));await drive(env,locked,state,deadline);processed++;}
  catch{if(locked)await env.DB.prepare("UPDATE conversation_sessions SET due_at=?,error='processing_deferred' WHERE id=? AND lease_id=?").bind(Date.now()+60000,locked.id,locked.lease_id).run();}
  finally{if(locked)await release(env,locked);}
 }
 return{processed};
}
