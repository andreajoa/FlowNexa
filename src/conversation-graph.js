const id=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{1,40}$/.test(value);
const text=(value,max)=>typeof value==='string'&&Boolean(value.trim())&&value.length<=max;
export function safeHttpsUrl(value){
 if(typeof value!=='string'||value.length>2048||/[\u0000-\u0020\\]/.test(value))return false;
 try{const url=new URL(value),host=url.hostname.toLowerCase().replace(/\.$/,'');return url.protocol==='https:'&&!url.username&&!url.password&&(!url.port||url.port==='443')&&host.includes('.')&&!host.includes(':')&&!/^\d+(?:\.\d+)*$/.test(host)&&!/(?:^|\.)(?:localhost|local|internal|test|invalid)$/.test(host);}catch{return false;}
}
export function validQuickReplies(replies){return replies===undefined||Array.isArray(replies)&&replies.length>=1&&replies.length<=13&&replies.every(reply=>reply&&text(reply.title,20)&&text(reply.payload,1000))&&new Set(replies.map(reply=>reply.payload)).size===replies.length;}
export function validButtons(buttons){return Array.isArray(buttons)&&buttons.length>=1&&buttons.length<=3&&buttons.every(button=>button&&text(button.title,20)&&(button.type==='web_url'?safeHttpsUrl(button.url):button.type==='postback'&&text(button.payload,1000)))&&new Set(buttons.filter(button=>button.type==='postback').map(button=>button.payload)).size===buttons.filter(button=>button.type==='postback').length;}
export function validOutboundAction(action){
 if(!action||typeof action!=='object')return false;
 if(['message','private_reply','public_reply'].includes(action.type))return text(action.text,1000)&&validQuickReplies(action.quick_replies)&&action.buttons===undefined;
 if(['image','video'].includes(action.type))return safeHttpsUrl(action.url)&&action.quick_replies===undefined&&action.buttons===undefined;
 if(action.type==='buttons')return text(action.text,80)&&validButtons(action.buttons)&&action.quick_replies===undefined;
 return false;
}
export function validateGraph(graph){
 const invalid=error=>({ok:false,error});
 if(!graph||graph.version!==1||!id(graph.start)||!Array.isArray(graph.nodes)||graph.nodes.length<2||graph.nodes.length>30)return invalid('invalid_graph');
 const nodes=new Map();
 for(const n of graph.nodes){
  if(!n||!id(n.id)||nodes.has(n.id))return invalid('invalid_graph_node');
  let edges;
  if(n.type==='message'){if(!validOutboundAction(n))return invalid('invalid_graph_message');edges=[n.next];}
  else if(['image','video'].includes(n.type)){if(!validOutboundAction(n))return invalid('invalid_graph_media');edges=[n.next];}
  else if(n.type==='buttons'){if(!validOutboundAction(n))return invalid('invalid_graph_buttons');edges=[n.next];}
  else if(n.type==='wait_reply'){if(!Number.isSafeInteger(n.timeout_seconds)||n.timeout_seconds<60||n.timeout_seconds>259200)return invalid('invalid_graph_timeout');if(n.deadline_seconds_from_start!==undefined&&(!Number.isSafeInteger(n.deadline_seconds_from_start)||n.deadline_seconds_from_start<60||n.deadline_seconds_from_start>259200))return invalid('invalid_graph_deadline');edges=[n.on_reply,n.on_timeout,...(n.on_timeout_without_window!==undefined?[n.on_timeout_without_window]:[])];}
  else if(n.type==='condition'){if(!['contains','equals'].includes(n.operator)||!text(n.value,200))return invalid('invalid_graph_condition');edges=[n.yes,n.no];}
  else if(n.type==='switch'){
   if(!['equals','contains','contains_any','date_between'].includes(n.operator)||!Array.isArray(n.cases)||n.cases.length<2||n.cases.length>10||n.cases.some(c=>!c||!id(c.id)||!text(c.label,40)||!text(c.value,1000))||new Set(n.cases.map(c=>c.id)).size!==n.cases.length||new Set(n.cases.map(c=>c.value.normalize('NFKC').toUpperCase())).size!==n.cases.length)return invalid('invalid_graph_switch');if(n.operator==='date_between'&&n.cases.some(c=>!validDateRange(c.value)))return invalid('invalid_graph_switch');edges=[...n.cases.map(c=>c.next),n.default];
  }
  else if(n.type==='delay'){if(!Number.isSafeInteger(n.seconds)||n.seconds<60||n.seconds>82800)return invalid('invalid_graph_delay');edges=[n.next];}
  else if(n.type==='commerce'){if(!id(n.store_id)||!['identify','verify','products','order','tracking','abandoned_carts','content','marketing_opt_in'].includes(n.operation)||n.search!==undefined&&(!text(n.search,80)))return invalid('invalid_commerce_node');edges=[n.next,n.on_error];}
  else if(n.type==='end')edges=[];
  else return invalid('unsupported_graph_node');
  if(edges.some(edge=>!id(edge)))return invalid('invalid_graph_target');nodes.set(n.id,{node:n,edges});
 }
 if(!nodes.has(graph.start)||graph.nodes.some(n=>nodes.get(n.id).edges.some(edge=>!nodes.has(edge))))return invalid('invalid_graph_target');
 const visited=new Set(),active=new Set();let cycle=false;
 function visit(key){if(active.has(key)){cycle=true;return;}if(visited.has(key))return;active.add(key);for(const edge of nodes.get(key).edges)visit(edge);active.delete(key);visited.add(key);}
 visit(graph.start);if(cycle)return invalid('graph_cycle');if(visited.size!==nodes.size)return invalid('unreachable_graph_node');
 if(!['message','condition','switch'].includes(nodes.get(graph.start).node.type))return invalid('graph_must_start_with_message');
 return{ok:true};
}
// Alternative phrases are newline-separated. Unicode word boundaries prevent e.g. 'help' matching 'shelf'.
export function phraseMatches(value,alternatives){
 const normalize=x=>String(x||'').normalize('NFKC').toLocaleUpperCase().replace(/[’‘]/g,"'").replace(/\s+/g,' ').trim();
 const haystack=normalize(value);
 return String(alternatives||'').split('\n').filter(x=>x.trim()).some(phrase=>{
  const needle=normalize(phrase);let at=haystack.indexOf(needle);
  while(at!==-1){const before=Array.from(haystack.slice(0,at)).at(-1)||'',after=Array.from(haystack.slice(at+needle.length))[0]||'';
   if(!/[\p{L}\p{N}_]/u.test(before)&&!/[\p{L}\p{N}_]/u.test(after))return true;
   at=haystack.indexOf(needle,at+1);
  }return false;
 });
}
export function conditionMatches(node,value,replyPayload){if(typeof replyPayload==='string'&&replyPayload)return node.value===replyPayload;const normalize=x=>String(x||'').normalize('NFKC').toLocaleUpperCase();const haystack=normalize(value),needle=normalize(node.value);if(node.operator==='contains_any')return phraseMatches(value,node.value);return node.operator==='equals'?haystack.trim()===needle.trim():haystack.includes(needle);}
export function validDateRange(value){
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}\/\d{4}-\d{2}-\d{2}$/.test(value))return false;
 const [start,end]=value.split('/');return start<=end&&[start,end].every(day=>{const parsed=Date.parse(day+'T00:00:00Z');return Number.isFinite(parsed)&&new Date(parsed).toISOString().slice(0,10)===day;});
}
export function switchTarget(node,replyText,replyPayload,now=Date.now()){
 if(node.operator==='date_between'){const today=new Date(now).toISOString().slice(0,10);return node.cases.find(c=>{const [start,end]=c.value.split('/');return today>=start&&today<=end;})?.next||node.default;}
const match=node.cases.find(c=>typeof replyPayload==='string'&&replyPayload?(node.operator==='contains_any'?c.value.split('\n').some(v=>v.trim()===replyPayload):c.value===replyPayload):conditionMatches({...c,operator:node.operator},replyText));return match?match.next:node.default;}
