import {validateGraph,conditionMatches,switchTarget} from '../conversation-graph.js';
export function validateTikTokGraph(graph){
 const result=validateGraph(graph);if(!result.ok)return result;
 if(graph.nodes.some(n=>!['message','wait_reply','condition','switch','end'].includes(n.type)||n.quick_replies))return{ok:false,error:'tiktok_unsupported_node'};
 // One outbound response per inbound event makes every effect independently resumable and quota-counted.
 const nodes=new Map(graph.nodes.map(n=>[n.id,n]));
 if(graph.nodes.some(n=>n.type==='wait_reply'&&(n.deadline_seconds_from_start!==undefined||nodes.get(n.on_timeout)?.type!=='end'||n.on_timeout_without_window&&nodes.get(n.on_timeout_without_window)?.type!=='end')))return{ok:false,error:'tiktok_timeout_must_end'};
 const memo=new Map();
 function walk(id,count){const n=nodes.get(id);if(n.type==='message'){if(count)return false;return visit(n.next,1);}if(n.type==='wait_reply')return count===1;if(n.type==='end')return true;if(n.type==='condition')return visit(n.yes,count)&&visit(n.no,count);return [...n.cases.map(c=>c.next),n.default].every(next=>visit(next,count));}
 function visit(id,count){const key=id+':'+count;if(!memo.has(key))memo.set(key,walk(id,count));return memo.get(key);}
 if(!visit(graph.start,0)||graph.nodes.filter(n=>n.type==='wait_reply').some(n=>!visit(n.on_reply,0)))return{ok:false,error:'tiktok_one_message_per_reply'};
 return{ok:true};
}
export function walkTikTokGraph(graph,from,reply){
 const nodes=new Map(graph.nodes.map(n=>[n.id,n]));let id=from,text=null;
 for(let i=0;i<graph.nodes.length;i++){const n=nodes.get(id);if(!n)throw Error('invalid_graph');
  if(n.type==='message'){text=n.text;id=n.next;}
  else if(n.type==='condition')id=conditionMatches(n,reply)?n.yes:n.no;
  else if(n.type==='switch')id=switchTarget(n,reply);
  else if(n.type==='wait_reply')return{text,wait:{node_id:n.on_reply,seconds:Math.min(172800,n.timeout_seconds)}};
  else return{text,wait:null};
 }
 throw Error('invalid_graph');
}
