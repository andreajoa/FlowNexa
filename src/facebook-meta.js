// Facebook Pages connected directly through the FlowNexa Meta app (no per-account provider fee).
// Pages already connected through Zernio keep that provider; new connections use this path.
import {encryptToken,decryptToken} from './instagram-oauth.js';

const GRAPH='https://graph.facebook.com/v23.0';
export const META_PAGE_SCOPES=['pages_show_list','pages_messaging','pages_manage_metadata','pages_read_engagement','pages_manage_engagement','business_management'];
const opaque=value=>typeof value==='string'&&value.length>0&&value.length<=1000&&!/[\u0000-\u001f\u007f]/.test(value);

export function metaConfigured(env){return Boolean(env.FACEBOOK_APP_ID&&env.FACEBOOK_APP_SECRET&&env.TOKEN_ENCRYPTION_KEY);}
export function metaRedirectUri(origin){return new URL('/api/facebook/meta/callback',origin).href;}

export function metaAuthorizationUrl(env,origin,state){
 const url=new URL('https://www.facebook.com/v23.0/dialog/oauth');
 url.search=new URLSearchParams({client_id:env.FACEBOOK_APP_ID,redirect_uri:metaRedirectUri(origin),state,response_type:'code',scope:META_PAGE_SCOPES.join(',')}).toString();
 return url.href;
}

function graphError(status,data,method){
 const code=data?.error?.code;
 if(code===190||code===102)return 'account_reconnect_required';
 if(status===429||[4,17,32,613].includes(code))return 'meta_rate_limited';
 if(method!=='GET'&&status>=500)return 'delivery_unknown';
 return 'meta_request_rejected';
}
export async function metaGraph(env,path,{method='GET',params={},body,token}={}){
 const url=new URL(GRAPH+'/'+path.replace(/^\//,''));
 for(const[k,v]of Object.entries(params))url.searchParams.set(k,v);
 if(token)url.searchParams.set('access_token',token);
 let response;
 try{response=await (env.FACEBOOK_GRAPH_FETCH||fetch)(url.href,{method,headers:body?{'content-type':'application/json'}:{},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(15000)});}
 catch{throw Error(method==='GET'?'meta_request_rejected':'delivery_unknown');}
 const data=await response.json().catch(()=>({}));
 if(!response.ok||data?.error)throw Error(graphError(response.status,data,method));
 return data;
}

// Exchanges the login code for a long-lived user token and returns the Pages it can manage,
// each with its own Page token (non-expiring when derived from a long-lived user token).
export async function metaPagesFromCode(env,origin,code){
 const short=await metaGraph(env,'oauth/access_token',{params:{client_id:env.FACEBOOK_APP_ID,client_secret:env.FACEBOOK_APP_SECRET,redirect_uri:metaRedirectUri(origin),code}});
 const long=await metaGraph(env,'oauth/access_token',{params:{grant_type:'fb_exchange_token',client_id:env.FACEBOOK_APP_ID,client_secret:env.FACEBOOK_APP_SECRET,fb_exchange_token:short.access_token}});
 const pages=[];let next='me/accounts';let params={fields:'id,name,access_token,tasks',limit:'100'};
 for(let i=0;i<5&&next;i++){
  const data=await metaGraph(env,next,{params,token:long.access_token});
  for(const p of data.data||[])if(/^\d{1,40}$/.test(p.id||'')&&typeof p.access_token==='string'&&typeof p.name==='string')pages.push({id:p.id,name:p.name.slice(0,200),token:p.access_token});
  const after=data.paging?.cursors?.after;next=data.paging?.next&&after?'me/accounts':null;params={...params,after};
 }
 return pages;
}

export async function subscribeMetaPage(env,page){
 const result=await metaGraph(env,page.id+'/subscribed_apps',{method:'POST',params:{subscribed_fields:'messages,messaging_postbacks,feed'},token:page.token});
 if(result.success!==true)throw Error('meta_subscription_failed');
}

export async function sealPages(env,pages){return encryptToken(JSON.stringify(pages),env.TOKEN_ENCRYPTION_KEY);}
export async function openPages(env,sealed){return JSON.parse(await decryptToken(sealed,env.TOKEN_ENCRYPTION_KEY));}
export async function pageToken(env,account){return decryptToken(account.encrypted_token,env.TOKEN_ENCRYPTION_KEY);}

export async function verifyMetaSignature(raw,header,secret){
 if(!secret||typeof header!=='string'||!header.startsWith('sha256='))return false;
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 const digest=[...new Uint8Array(await crypto.subtle.sign('HMAC',key,raw))].map(b=>b.toString(16).padStart(2,'0')).join('');
 const given=header.slice(7);if(given.length!==digest.length)return false;
 let diff=0;for(let i=0;i<digest.length;i++)diff|=digest.charCodeAt(i)^given.charCodeAt(i);return diff===0;
}

// Normalizes one Page webhook entry into the provider-neutral events the queue understands.
export function normalizeMetaEntry(entry,account){
 const events=[];
 for(const m of entry.messaging||[]){
  if(!m?.sender?.id||m.sender.id===account.native_id||m.message?.is_echo)continue;
  const at=Number(m.timestamp);if(!Number.isFinite(at)||at<=0||at>Date.now()+300000)continue;
  if(m.message&&opaque(m.message.mid)){
   const text=typeof m.message.text==='string'?m.message.text:'',attachment=Array.isArray(m.message.attachments)&&m.message.attachments.length>0;
   if(!text&&!attachment||text.length>8000)continue;
   const payload=m.message.quick_reply?.payload;
   events.push({key:'message:'+m.message.mid,kind:'dm',sender_id:m.sender.id,conversation_id:m.sender.id,text,...(opaque(payload)?{payload}:{}),at});
  }else if(m.postback&&opaque(m.postback.mid||String(at))){
   const payload=m.postback.payload;
   events.push({key:'postback:'+(m.postback.mid||m.sender.id+':'+at),kind:'dm',sender_id:m.sender.id,conversation_id:m.sender.id,text:typeof m.postback.title==='string'?m.postback.title:'',...(opaque(payload)?{payload}:{}),at});
  }
 }
 for(const change of entry.changes||[]){
  const v=change?.value;
  if(change?.field!=='feed'||v?.item!=='comment'||v.verb!=='add'||!opaque(v.comment_id)||!opaque(v.post_id)||!opaque(v.from?.id)||v.from.id===account.native_id)continue;
  if(v.parent_id&&v.parent_id!==v.post_id)continue;
  const at=Number(v.created_time)*1000;if(!Number.isFinite(at)||at<=0||at>Date.now()+300000)continue;
  if(typeof v.message!=='string'||v.message.length>8000)continue;
  events.push({key:'comment:'+v.comment_id,kind:'comment',comment_id:v.comment_id,post_id:v.post_id,sender_id:v.from.id,text:v.message,at});
 }
 return events;
}

// Builds the Graph API request for one outbound step of a flow or graph.
export function metaActionRequest(event,step){
 const quick=step.quick_replies?.length?{quick_replies:step.quick_replies.slice(0,13).map(q=>({content_type:'text',title:q.title,payload:q.payload}))}:{};
 if(step.type==='public_reply'){if(event.kind!=='comment')throw Error('invalid_action');return{path:event.comment_id+'/comments',body:{message:step.text}};}
 if(step.type==='private_reply'){if(event.kind!=='comment')throw Error('invalid_action');return{path:'me/messages',body:{recipient:{comment_id:event.comment_id},message:{text:step.text,...quick}}};}
 if(event.kind!=='dm')throw Error('invalid_action');
 const recipient={id:event.sender_id};
 if(step.type==='message')return{path:'me/messages',body:{recipient,messaging_type:'RESPONSE',message:{text:step.text,...quick}}};
 if(step.type==='buttons')return{path:'me/messages',body:{recipient,messaging_type:'RESPONSE',message:{attachment:{type:'template',payload:{template_type:'button',text:step.text,buttons:step.buttons.map(b=>b.type==='web_url'?{type:'web_url',url:b.url,title:b.title}:{type:'postback',title:b.title,payload:b.payload})}}}}};
 if(['image','video'].includes(step.type))return{path:'me/messages',body:{recipient,messaging_type:'RESPONSE',message:{attachment:{type:step.type,payload:{url:step.url,is_reusable:true}}}}};
 throw Error('invalid_action');
}

export async function metaSend(env,account,event,step,deadline){
 const request=metaActionRequest(event,step);
 const result=await metaGraph({...env,RUNTIME_DEADLINE_MS:deadline},request.path,{method:'POST',body:request.body,token:await pageToken(env,account)});
 return result.message_id||result.id;
}

// Bring-your-own Meta app (same model as Atenza's WhatsApp): the customer's own app signs the
// webhooks, so FlowNexa needs no App Review to serve them. Validates the Page token before saving.
export async function validateOwnApp(env,{page_id,page_token}){
 if(!/^\d{1,40}$/.test(page_id||'')||typeof page_token!=='string'||page_token.length<20||page_token.length>1000)throw Error('facebook_invalid_credentials');
 let page;try{page=await metaGraph(env,page_id,{params:{fields:'id,name'},token:page_token});}catch{throw Error('facebook_invalid_credentials');}
 if(page.id!==page_id||typeof page.name!=='string')throw Error('facebook_invalid_credentials');
 return{id:page.id,name:page.name.slice(0,200),token:page_token};
}
export function webhookPageIds(body){return body?.object==='page'&&Array.isArray(body.entry)?[...new Set(body.entry.map(e=>e?.id).filter(id=>typeof id==='string'))]:[];}
