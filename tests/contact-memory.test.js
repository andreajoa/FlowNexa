import test from 'node:test';
import assert from 'node:assert/strict';
import {transcript} from '../src/contact-memory.js';
import {validateGraph} from '../src/conversation-graph.js';
test('contact memory transcript keeps the latest turns, oldest first, within the prompt budget',()=>{
 const h=[];for(let i=0;i<30;i++)h.push({role:i%2?'assistant':'user',text:'mensagem '+i,at:Date.UTC(2026,10,1+i%20)});
 const t=transcript(h,200);assert.ok(t.length<=200);assert.match(t,/mensagem 29$/);assert.ok(!t.includes('mensagem 0\n'));assert.match(t,/Pessoa: |Atendente: /);
});
test('a flow can branch on returning contacts (returning_contact needs no value)',()=>{
 const g={version:1,start:'r',nodes:[{id:'r',type:'condition',operator:'returning_contact',yes:'a',no:'b'},{id:'a',type:'message',text:'Oi de novo!',next:'f'},{id:'b',type:'message',text:'Oi!',next:'f'},{id:'f',type:'end'}]};
 assert.deepEqual(validateGraph(g),{ok:true});
 assert.equal(validateGraph({...g,nodes:[{...g.nodes[0],operator:'starts_with'},...g.nodes.slice(1)]}).ok,false);
});
