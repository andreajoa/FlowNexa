import test from 'node:test';import assert from 'node:assert/strict';import {existsSync} from 'node:fs';
import {buildAtenzaAcquisition,ATENZA_OPENING} from '../src/presets/atenza-acquisition.js';
import {validateFlow,matchFlow} from '../src/flow-runtime.js';

test('atenza funnel is a valid comment_any graph that keeps the current trigger and sells Atenza only',()=>{
 const f=buildAtenzaAcquisition(),c=f.configuration,json=JSON.stringify(c);
 assert.equal(validateFlow(f.trigger_type,f.scope,c).ok,true);
 assert.equal(f.trigger_type,'comment_any');assert.equal(f.scope,'all');assert.equal(c.entry_points,undefined);
 assert.equal(c.graph.nodes[0].text,ATENZA_OPENING);assert.ok(c.graph.nodes.length<=30);
 assert.ok(json.length<16000);assert.doesNotMatch(json,/FlowNexa/i);
 assert.equal(c.once_per_contact,true);assert.ok(c.opt_out_keywords.includes('PARAR'));
});

test('atenza funnel uses only public Atenza links and bundled PNG assets',()=>{
 for(const n of buildAtenzaAcquisition().configuration.graph.nodes){
  for(const url of [n.url,...(n.buttons||[]).map(b=>b.url)].filter(Boolean)){
   const u=new URL(url);assert.ok(['www.atenza.online','flownex.online'].includes(u.hostname),url);
   if(u.hostname==='flownex.online'){assert.match(u.pathname,/^\/assets\/funnel\/atenza\/.+\.png$/);assert.ok(existsSync(new URL('../public'+u.pathname,import.meta.url)),u.pathname);}
  }
 }
});

test('atenza funnel states the published prices and trial terms without invented promises',()=>{
 const text=buildAtenzaAcquisition().configuration.graph.nodes.map(n=>n.text||'').join('\n');
 for(const fact of ['R$ 97','R$ 197','R$ 397','7 dias sem cobrança','cartão necessário','chave do provedor'])assert.ok(text.includes(fact),fact);
 assert.doesNotMatch(text,/garant|grátis para sempre|sem custo de IA|dobr|triplic/i);
});

test('atenza funnel follow-ups stay inside the 24h window and end silently otherwise',()=>{
 const nodes=buildAtenzaAcquisition().configuration.graph.nodes,by=id=>nodes.find(n=>n.id===id);
 assert.equal(by('first_wait').on_timeout_without_window,'silent_wait');
 for(const id of ['offer_wait','plans_wait']){const w=by(id);assert.ok(w.timeout_seconds<86400);assert.equal(w.on_timeout,'last_call');assert.equal(w.on_timeout_without_window,'finish');}
});

test('atenza funnel starts on any comment and respects opt-out',()=>{
 const f={...buildAtenzaAcquisition(),account_id:'a'};
 assert.equal(matchFlow(f,{kind:'comment',text:'quero saber',media_id:'1'}).matched,true);
 assert.equal(matchFlow(f,{kind:'comment',text:' parar ',media_id:'1'}).matched,false);
});
