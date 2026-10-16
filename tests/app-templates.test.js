import test from 'node:test';
import assert from 'node:assert/strict';
import {APP_TEMPLATES,prepareTemplate} from '../src/app-client.js';
import {validateFlow,matchFlow} from '../src/flow-runtime.js';
const values={link:'https://example.test/product',coupon:'WELCOME10',price:'€ 49',answer:'Segunda a sexta, das 9h às 18h.'};
test('every ready template produces supported matching flow and optional public reply only for comments',()=>{
 assert.equal(APP_TEMPLATES.length,10);assert.equal(new Set(APP_TEMPLATES.map(t=>t.id)).size,10);
 for(const template of APP_TEMPLATES)for(const publicReply of [false,true]){
  const flow=prepareTemplate(template,values,publicReply);
  assert.equal(validateFlow(flow.trigger_type,flow.scope,flow.configuration).ok,true,template.id);
  assert.equal(matchFlow(flow,{kind:flow.trigger_type.startsWith('comment')?'comment':flow.trigger_type==='story_reply'?'story':'dm',text:template.keywords[0]||'Hello'}).matched,true,template.id);
  assert.equal(flow.configuration.once_per_contact,template.trigger_type.startsWith('comment'));assert.equal(flow.configuration.actions.length,publicReply&&template.category==='Comentários'?2:1);
  assert.ok(flow.configuration.actions.every(a=>!/{(?:link|coupon|price|answer)}/.test(a.text)));
 }
 for(const id of ['comment','help','story'])assert.ok(APP_TEMPLATES.some(t=>t.id===id));
});
test('templates require configured details and refuse unsafe or missing destination URLs',()=>{
 const t=APP_TEMPLATES.find(t=>t.id==='comment');for(const link of ['', 'javascript:alert(1)','http://example.test','https://user:password@example.test'])assert.throws(()=>prepareTemplate(t,{link}));
 assert.throws(()=>prepareTemplate(APP_TEMPLATES.find(t=>t.id==='coupon'),{link:values.link}));
 assert.throws(()=>prepareTemplate(APP_TEMPLATES.find(t=>t.id==='faq'),{answer:'x'.repeat(501)}));
});
test('preparing multiple drafts does not mutate the reusable model',()=>{
 const t=APP_TEMPLATES[0],before=JSON.stringify(t),first=prepareTemplate(t,values);first.configuration.keywords[0]='CHANGED';first.configuration.actions[0].text='Changed';assert.equal(JSON.stringify(t),before);assert.equal(prepareTemplate(t,values).configuration.keywords[0],'QUERO');
});
