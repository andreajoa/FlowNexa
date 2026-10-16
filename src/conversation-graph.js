const id=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{1,40}$/.test(value);
export function validateGraph(graph){
 const invalid=error=>({ok:false,error});
 if(!graph||graph.version!==1||!id(graph.start)||!Array.isArray(graph.nodes)||graph.nodes.length<2||graph.nodes.length>30)return invalid('invalid_graph');
 const nodes=new Map();
 for(const n of graph.nodes){
  if(!n||!id(n.id)||nodes.has(n.id))return invalid('invalid_graph_node');
  let edges;
  if(n.type==='message'){if(typeof n.text!=='string'||!n.text.trim()||n.text.length>1000)return invalid('invalid_graph_message');edges=[n.next];}
  else if(n.type==='wait_reply'){if(!Number.isSafeInteger(n.timeout_seconds)||n.timeout_seconds<60||n.timeout_seconds>82800)return invalid('invalid_graph_timeout');edges=[n.on_reply,n.on_timeout];}
  else if(n.type==='condition'){if(!['contains','equals'].includes(n.operator)||typeof n.value!=='string'||!n.value.trim()||n.value.length>200)return invalid('invalid_graph_condition');edges=[n.yes,n.no];}
  else if(n.type==='delay'){if(!Number.isSafeInteger(n.seconds)||n.seconds<60||n.seconds>82800)return invalid('invalid_graph_delay');edges=[n.next];}
  else if(n.type==='end')edges=[];
  else return invalid('unsupported_graph_node');
  if(edges.some(edge=>!id(edge)))return invalid('invalid_graph_target');nodes.set(n.id,{node:n,edges});
 }
 if(!nodes.has(graph.start)||graph.nodes.some(n=>nodes.get(n.id).edges.some(edge=>!nodes.has(edge))))return invalid('invalid_graph_target');
 const visited=new Set(),active=new Set();let cycle=false;
 function visit(key){if(active.has(key)){cycle=true;return;}if(visited.has(key))return;active.add(key);for(const edge of nodes.get(key).edges)visit(edge);active.delete(key);visited.add(key);}
 visit(graph.start);if(cycle)return invalid('graph_cycle');if(visited.size!==nodes.size)return invalid('unreachable_graph_node');
 if(nodes.get(graph.start).node.type!=='message')return invalid('graph_must_start_with_message');
 return{ok:true};
}
export function conditionMatches(node,text){const normalize=value=>String(value||'').normalize('NFKC').toLocaleUpperCase();const haystack=normalize(text),needle=normalize(node.value);return node.operator==='equals'?haystack.trim()===needle.trim():haystack.includes(needle);}
