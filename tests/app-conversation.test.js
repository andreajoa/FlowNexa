import test from 'node:test';
import assert from 'node:assert/strict';
import {conversationTemplate,previewConversation,publicationConflicts} from '../src/app-client.js';
import {validateGraph} from '../src/conversation-graph.js';
import {validateFlow} from '../src/flow-runtime.js';
test('ready conversation uses supported persistent graph, independent replies and finite branching',()=>{
 const flow=conversationTemplate();assert.equal(validateGraph(flow.configuration.graph).ok,true);assert.equal(validateFlow(flow.trigger_type,flow.scope,flow.configuration).ok,true);assert.equal(flow.trigger_type,'dm_keyword');assert.equal(flow.configuration.once_per_contact,false);
 const yes=previewConversation(flow.configuration.graph,{reply:'sim'}),no=previewConversation(flow.configuration.graph,{reply:'Não'}),timeout=previewConversation(flow.configuration.graph,{timeout:true});
 assert.ok(yes.some(s=>s.id==='positive'));assert.ok(!yes.some(s=>s.id==='negative'||s.id==='followup'));assert.ok(no.some(s=>s.id==='negative'));assert.ok(timeout.some(s=>s.id==='followup'));assert.ok(!timeout.some(s=>s.id==='positive'));assert.equal(timeout.at(-1).type,'end');
});
test('path preview stops at waiting when no reply or elapsed-time selection is supplied',()=>{const path=previewConversation(conversationTemplate().configuration.graph);assert.equal(path.at(-1).type,'wait_reply');assert.equal(path.filter(n=>n.type==='message').length,1);});
test('exact-response condition preview matches engine whitespace/case semantics and reports invalid links',()=>{const graph=conversationTemplate().configuration.graph,condition=graph.nodes.find(n=>n.type==='condition');condition.operator='equals';condition.value=' SIM ';assert.ok(previewConversation(graph,{reply:' sim '}).some(n=>n.id==='positive'));graph.nodes.find(n=>n.id==='positive').next='missing';assert.equal(previewConversation(graph,{reply:'SIM'}).at(-1).type,'error');});

test('graph publication guard blocks broad/overlapping existing flows without blocking distinct scopes or keywords',()=>{
 const candidate={id:'new',account_id:'account',trigger_type:'comment_keyword',scope:'selected',configuration:{keywords:['QUERO'],media_ids:['123']}};
 const broad={id:'old',name:'Existing',account_id:'account',enabled:1,trigger_type:'comment_any',scope:'all',configuration:{}};
 assert.deepEqual(publicationConflicts(candidate,[broad]),[broad]);
 assert.deepEqual(publicationConflicts(candidate,[{...broad,scope:'selected',configuration:{media_ids:['456']}}]),[]);
 assert.deepEqual(publicationConflicts(candidate,[{...broad,trigger_type:'comment_keyword',configuration:{keywords:['AGENDA']}}]),[]);
 assert.equal(publicationConflicts(candidate,[{...broad,trigger_type:'comment_keyword',configuration:JSON.stringify({keywords:['quero preço']})}]).length,1);
 assert.deepEqual(publicationConflicts(candidate,[{...broad,enabled:0},{...broad,id:'new'},{...broad,account_id:'other'},{...broad,trigger_type:'dm_keyword',configuration:{keywords:['QUERO']}}]),[]);
 assert.deepEqual(publicationConflicts({...candidate,trigger_type:'dm_keyword'},[{...broad,trigger_type:'story_reply'}]),[]);
});
