import {validateGraph} from './conversation-graph.js';
export const TRIGGERS=new Set(['comment_keyword','comment_any','dm_keyword','story_reply']);
export function validateFlow(trigger,scope,c){
 if(!TRIGGERS.has(trigger)||!['all','selected'].includes(scope))return {ok:false,error:'unsupported_trigger_or_scope'};
 if(!c||typeof c!=='object'||JSON.stringify(c).length>16000)return {ok:false,error:'invalid_configuration'};
 if(trigger.endsWith('_keyword')&&(!Array.isArray(c.keywords)||!c.keywords.length||c.keywords.length>20||c.keywords.some(x=>typeof x!=='string'||!x.trim()||x.length>80)))return{ok:false,error:'keywords_required'};
 if(scope==='selected'&&(!Array.isArray(c.media_ids)||!c.media_ids.length||c.media_ids.length>100||c.media_ids.some(x=>typeof x!=='string'||!/^\d+$/.test(x))))return{ok:false,error:'selected_media_required'};
 if(c.once_per_contact!==undefined&&typeof c.once_per_contact!=='boolean')return{ok:false,error:'invalid_once_per_contact'};
 if(c.graph)return validateGraph(c.graph);
 if(!Array.isArray(c.actions)||!c.actions.length||c.actions.length>5)return{ok:false,error:'actions_required'};
 const allowed=trigger.startsWith('comment')?new Set(['private_reply','public_reply']):new Set(['message']);
 if(c.actions.some(x=>!x||!allowed.has(x.type)||typeof x.text!=='string'||!x.text.trim()||x.text.length>1000))return{ok:false,error:'invalid_actions'};
 if(c.actions.filter(x=>x.type==='private_reply').length>1||c.actions.filter(x=>x.type==='public_reply').length>1)return{ok:false,error:'one_reply_per_comment'};
 return{ok:true};
}
const normalize=x=>String(x||'').normalize('NFKC').toLocaleUpperCase();
export function matchFlow(flow,event){
 let c;try{c=typeof flow.configuration==='string'?JSON.parse(flow.configuration):flow.configuration}catch{return{matched:false,reason:'invalid_configuration'}}
 if(!validateFlow(flow.trigger_type,flow.scope,c).ok)return{matched:false,reason:'invalid_configuration'};
 if(flow.trigger_type.startsWith('comment')&&event.kind!=='comment'||flow.trigger_type==='dm_keyword'&&event.kind!=='dm'||flow.trigger_type==='story_reply'&&event.kind!=='story')return{matched:false,reason:'trigger'};
 if(flow.scope==='selected'&&!c.media_ids.includes(String(event.media_id)))return{matched:false,reason:'scope'};
 if(flow.trigger_type.endsWith('_keyword')&&!c.keywords.some(w=>normalize(event.text).includes(normalize(w))))return{matched:false,reason:'keyword'};
 return{matched:true,actions:c.graph?[]:c.actions,configuration:c,...(c.graph?{graph:c.graph}:{})};
}
export function normalizeWebhook(body,receivedAt=Date.now()){
 const result=[];if(body?.object!=='instagram'||!Array.isArray(body.entry))return result;
 const id=x=>typeof x==='string'||typeof x==='number'?/^\d+$/.test(String(x))?String(x):null:null;
 for(const entry of body.entry){const account=id(entry?.id);if(!account)continue;
  for(const change of Array.isArray(entry.changes)?entry.changes:[]){const v=change?.value;if(change.field!=='comments'||id(v?.from?.id)===account||v?.parent_id||!id(v?.id)||!id(v?.media?.id)||typeof v.text!=='string'||v.text.length>8000)continue;const at=Number(v.created_time||entry.time);result.push({key:'comment:'+v.id,kind:'comment',account,comment_id:id(v.id),media_id:id(v.media.id),sender_id:id(v.from?.id),text:v.text,at:Number.isFinite(at)&&at>0?(at>1e12?at:at*1000):receivedAt})}
  for(const message of Array.isArray(entry.messaging)?entry.messaging:[]){
   const sender=id(message?.sender?.id),at=Number(message?.timestamp);if(!sender||sender===account||message.is_self===true||!Number.isFinite(at)||at<=0)continue;
   const postback=message.postback;
   if(postback){
    if(typeof postback.payload!=='string'||!postback.payload.trim()||postback.payload.length>1000||postback.title!==undefined&&(typeof postback.title!=='string'||postback.title.length>1000))continue;
    const mid=postback.mid;if(mid!==undefined&&(typeof mid!=='string'||!mid||mid.length>500))continue;
    result.push({key:'postback:'+(mid||JSON.stringify([sender,at,postback.payload,postback.title||''])),kind:'dm',interaction:'postback',account,sender_id:sender,text:postback.title||'',payload:postback.payload,at:at>1e12?at:at*1000});continue;
   }
   const m=message.message;if(!m?.mid||typeof m.mid!=='string'||m.mid.length>500||m.is_echo||m.is_deleted)continue;
   const quick=m.quick_reply?.payload;if(m.quick_reply!==undefined&&(typeof quick!=='string'||!quick.trim()||quick.length>1000))continue;
   if(typeof m.text!=='string'&&quick===undefined||typeof m.text==='string'&&m.text.length>8000)continue;
   result.push({key:'message:'+m.mid,kind:m.reply_to?.story?'story':'dm',account,media_id:id(m.reply_to?.story?.id),sender_id:sender,text:m.text||'',...(quick!==undefined?{payload:quick,interaction:'quick_reply'}:{}),at:at>1e12?at:at*1000});
  }
 }
 return result;
}
