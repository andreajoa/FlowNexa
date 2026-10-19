// Facebook identifiers are opaque. They must never pass through Instagram's numeric-ID validator.
const opaque=value=>typeof value==='string'&&value.length>0&&value.length<=1000&&!/[\u0000-\u001f\u007f]/.test(value);
export function normalizeFacebook(body,account){
 if(body?.test===true||body?.account?.platform!=='facebook')return null;
 if(body.event==='message.received'){
  const m=body.message,conversation=body.conversation?.id||m?.conversationId;
  if(!m||m.platform!=='facebook'||m.direction!=='incoming'||body.metadata?.standby===true||m.sender?.isOwnAccount===true||!opaque(m.sender?.id)||m.sender.id===account.native_id||!opaque(m.platformMessageId)||!opaque(conversation)||m.conversationId&&body.conversation?.id&&m.conversationId!==body.conversation.id)return null;
  const attachment=Array.isArray(m.attachments)&&m.attachments.some(a=>a&&typeof a.type==='string');
  if(typeof m.text!=='string'&&!attachment||typeof m.text==='string'&&m.text.length>8000)return null;
  const at=Date.parse(m.sentAt);if(!Number.isFinite(at)||at<=0||at>Date.now()+300000)return null;
  const metadata=m.metadata||body.metadata||{},payload=metadata.postback?.payload??metadata.quick_reply?.payload??metadata.quickReply?.payload??metadata.postbackPayload??metadata.quickReplyPayload;
  return{key:'message:'+m.platformMessageId,kind:'dm',sender_id:m.sender.id,conversation_id:conversation,text:m.text||'',...(opaque(payload)?{payload}:{}),at};
 }
 if(body.event==='comment.received'){
  const c=body.comment;if(!c||c.platform!=='facebook'||c.isReply!==false||c.parentCommentId||c.isLive===true||c.author?.isOwnAccount===true||c.author?.id===account.native_id||!opaque(c.id)||!opaque(c.platformPostId)||!opaque(c.author?.id)||typeof c.text!=='string'||c.text.length>8000)return null;
  const at=Date.parse(c.createdAt);if(!Number.isFinite(at)||at<=0||at>Date.now()+300000)return null;
  return{key:'comment:'+c.id,kind:'comment',comment_id:c.id,post_id:c.platformPostId,sender_id:c.author.id,text:c.text,at};
 }
 return null;
}
