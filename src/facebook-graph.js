// Conversation graphs for the Facebook pilot. Reuses the Instagram graph contract
// (validateGraph, conditions, switches) but keeps its own session storage so no
// Instagram table, identifier or flow is touched.
import {validateGraph,conditionMatches,switchTarget} from './conversation-graph.js';

const OUTBOUND=['message','buttons','image','video'];

// Delays need a scheduler with a guaranteed Messenger window; the pilot keeps
// graphs to immediate messages, waits for a reply, conditions and switches.
export function validateFacebookGraph(graph){
 const result=validateGraph(graph);if(!result.ok)return result;
 if(graph.nodes.some(n=>['audio','transcribe_audio','ai_reply'].includes(n.type)))return{ok:false,error:'facebook_graph_audio_unsupported'};
 if(graph.nodes.some(n=>n.type==='delay'))return{ok:false,error:'facebook_graph_delay_unsupported'};
 return{ok:true};
}

const outbound=node=>node.type==='message'?{type:'message',text:node.text,...(node.quick_replies?{quick_replies:node.quick_replies}:{})}
 :node.type==='buttons'?{type:'buttons',text:node.text,buttons:node.buttons}
 :{type:node.type,url:node.url};

// Walks from `from` until the conversation needs the contact again. `reply` routes
// conditions and switches; it is consumed by the first routing node only.
export function walkFacebookGraph(graph,from,reply={},now=Date.now()){
 const nodes=new Map(graph.nodes.map(n=>[n.id,n])),actions=[];
 let id=from,text=reply.text||'',payload=reply.payload||null;
 for(let step=0;step<graph.nodes.length+1;step++){
  const node=nodes.get(id);if(!node)return{actions,wait:null};
  if(OUTBOUND.includes(node.type)){actions.push(outbound(node));id=node.next;continue;}
  if(node.type==='condition'){id=conditionMatches(node,text,payload)?node.yes:node.no;text='';payload=null;continue;}
  if(node.type==='switch'){id=switchTarget(node,text,payload,now);text='';payload=null;continue;}
  if(node.type==='wait_reply')return{actions,wait:{node_id:node.id,on_reply:node.on_reply,on_timeout:node.on_timeout,timeout_seconds:node.timeout_seconds}};
  return{actions,wait:null};
 }
 return{actions,wait:null};
}

// A comment only allows one private reply, and Messenger opens only after the
// contact answers it. The first text becomes that reply; later actions wait.
export function commentOpening(actions){
 const first=actions.find(a=>a.type==='message'||a.type==='buttons');if(!first)return null;
 if(first.type==='message')return{type:'private_reply',text:first.text,...(first.quick_replies?{quick_replies:first.quick_replies}:{})};
 return{type:'private_reply',text:first.text,quick_replies:first.buttons.filter(b=>b.type==='postback').map(b=>({title:b.title,payload:b.payload})).slice(0,13)};
}

export function facebookActionBody(account,event,action){
 const body={accountId:account.remote_id};
 if(action.type==='private_reply'||action.type==='public_reply'){
  if(event.kind!=='comment')throw Error('invalid_action');
  let path='inbox/comments/'+encodeURIComponent(event.post_id);
  if(action.type==='private_reply'){path+='/'+encodeURIComponent(event.comment_id)+'/private-reply';body.message=action.text;if(action.quick_replies?.length)body.quickReplies=action.quick_replies;}
  else{body.commentId=event.comment_id;body.message=action.text;}
  return{path,body};
 }
 if(event.kind!=='dm')throw Error('invalid_action');
 const path='inbox/conversations/'+encodeURIComponent(event.conversation_id)+'/messages';
 if(action.type==='message'){body.message=action.text;if(action.quick_replies?.length)body.quickReplies=action.quick_replies;}
 else if(action.type==='buttons')body.template={type:'generic',elements:[{title:action.text,buttons:action.buttons.map(button=>({...button,type:button.type==='web_url'?'url':'postback'}))}]};
 else if(['image','video'].includes(action.type)){body.attachmentUrl=action.url;body.attachmentType=action.type;}
 else throw Error('invalid_action');
 return{path,body};
}
