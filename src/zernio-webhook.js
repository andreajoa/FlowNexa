import {acceptFacebookWebhook} from './facebook-runtime.js';
import {respond as J} from './identity.js';
import {enqueueEvents} from './automation-engine.js';
import {zernioRequest,accountUsable} from './zernio-client.js';
const validId=id=>typeof id==='string'&&id.length>0&&id.length<=1000;
const numeric=id=>typeof id==='string'&&/^\d{1,100}$/.test(id);
export function normalizeZernio(body,account){
 if(body.test===true||body.account?.platform!=='instagram')return [];
 const base={account:account.ig_user_id,provider:'zernio'};
 if(body.event==='comment.received'){
  const c=body.comment;if(!c||c.platform!=='instagram'||c.isReply!==false||c.parentCommentId||c.isLive===true||c.author?.isOwnAccount===true||c.author?.id===account.platform_user_id||typeof c.author?.username==='string'&&c.author.username.toLowerCase()===account.username.toLowerCase()||!numeric(c.id)||!numeric(c.platformPostId)||!numeric(c.author?.id)||typeof c.text!=='string'||c.text.length>8000)return [];
  const at=Date.parse(c.createdAt);if(!Number.isFinite(at)||at<=0)return [];
  return [{...base,key:'zernio:comment:'+c.id,kind:'comment',comment_id:c.id,media_id:c.platformPostId,sender_id:c.author.id,text:c.text,at}];
 }
 if(body.event==='message.received'){
  const m=body.message,metadata=body.metadata||{},conversation=body.conversation?.id||m?.conversationId;
  if(!m||m.platform!=='instagram'||m.direction!=='incoming'||metadata.standby===true||!numeric(m.sender?.id)||m.sender.id===account.platform_user_id||!validId(m.platformMessageId)||!validId(conversation))return [];
  if(m.conversationId&&body.conversation?.id&&m.conversationId!==body.conversation.id)return [];
  const at=Date.parse(m.sentAt);if(!Number.isFinite(at)||at<=0)return [];
  const payload=metadata.postback?.payload??metadata.quick_reply?.payload??metadata.quickReply?.payload??metadata.postbackPayload??metadata.quickReplyPayload;
  if(payload!==undefined&&(typeof payload!=='string'||!payload.trim()||payload.length>1000))return [];
  const hasAttachment=Array.isArray(m.attachments)&&m.attachments.some(a=>a&&typeof a.type==='string'&&['image','video','audio','file','share','story','reel'].includes(a.type));
  if(typeof m.text!=='string'&&payload===undefined&&!hasAttachment||typeof m.text==='string'&&m.text.length>8000)return [];
  // The signed event's platform time opens the window, never the delivery timestamp.
  const story=metadata.reply_to?.story||metadata.replyTo?.story;
  return [{...base,key:'zernio:message:'+m.platformMessageId,kind:story?'story':'dm',sender_id:m.sender.id,text:m.text||'',conversation_id:conversation,at,...(payload!==undefined?{payload,interaction:'postback'}:hasAttachment&&!m.text?{interaction:'attachment'}:{})}];
 }
 return [];
}
async function rawBody(request){
 const reader=request.body?.getReader();if(!reader)throw Error('invalid_payload');
 let size=0;const chunks=[];
 while(true){const{done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>1048576){await reader.cancel();throw Error('payload_too_large');}chunks.push(value);}
 const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}return bytes;
}
export async function zernioWebhook(request,env){
 if(request.method!=='POST')return J({error:'method_not_allowed'},405);
 const signature=request.headers.get('x-zernio-signature');
 if(!env.ZERNIO_WEBHOOK_SECRET||!signature||!/^[a-f0-9]{64}$/.test(signature))return J({error:'invalid_signature'},403);
 let bytes,body;
 try{
  bytes=await rawBody(request);
  const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(env.ZERNIO_WEBHOOK_SECRET),{name:'HMAC',hash:'SHA-256'},false,['verify']);
  if(!await crypto.subtle.verify('HMAC',key,Uint8Array.from(signature.match(/../g),h=>parseInt(h,16)),bytes))return J({error:'invalid_signature'},403);
  body=JSON.parse(new TextDecoder().decode(bytes));if(!body||typeof body!=='object')throw Error('invalid_payload');
 }catch(error){return J({error:error.message==='payload_too_large'?'payload_too_large':'invalid_payload'},error.message==='payload_too_large'?413:400);}
 // Vendor samples must never send messages or mutate a real account.
 if(body.test===true||body.event==='webhook.test')return J({received:true,queued:0});
 if(body.account?.platform==='facebook')return acceptFacebookWebhook(body,env);
 if(!['comment.received','message.received','account.disconnected'].includes(body.event)||body.account?.platform!=='instagram')return J({received:true,queued:0});
 if(!env.DB||!env.TOKEN_ENCRYPTION_KEY)return J({error:'database_unavailable'},503);
 const remoteId=body.account?.accountId||body.account?.id;
 if(typeof remoteId!=='string'||!/^[a-f0-9]{24}$/i.test(remoteId))return J({error:'invalid_account'},400);
 try{
  const account=await env.DB.prepare('SELECT a.*,z.platform_user_id,z.profile_id FROM instagram_accounts a JOIN zernio_accounts z ON z.account_id=a.id WHERE z.remote_id=?').bind(remoteId).first();
  if(!account)return J({received:true,queued:0});
  if(body.account.profileId&&body.account.profileId!==account.profile_id)return J({error:'profile_mismatch'},400);
  if(body.event==='account.disconnected'){
   // Re-check current provider state so an old signed disconnect cannot undo reconnection.
   const result=await zernioRequest(env,'accounts?'+new URLSearchParams({profileId:account.profile_id,platform:'instagram'}));
   if(!Array.isArray(result.accounts))throw Error('zernio_invalid_response');
   const remote=result.accounts.find(a=>a._id===remoteId);
   if(!remote||remote.isActive===false||remote.needsReconnection===true)await env.DB.batch([
    env.DB.prepare('UPDATE flows SET enabled=0,version=version+1 WHERE account_id=? AND enabled=1').bind(account.id),
    env.DB.prepare("UPDATE instagram_accounts SET status='reconnect_required' WHERE id=? AND status='connected'").bind(account.id)
   ]);
   return J({received:true,queued:0});
  }
  if(!accountUsable(account))return J({received:true,queued:0});
  const queued=await enqueueEvents(normalizeZernio(body,account),env);
  return J({received:true,queued});
 }catch{return J({error:'queue_unavailable'},503);}
}
