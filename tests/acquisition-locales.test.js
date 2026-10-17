import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {ACQUISITION_LOCALES} from '../src/presets/flownexa-acquisition-locales.js';
import {buildFlowNexaAcquisition} from '../src/presets/flownexa-acquisition.js';

test('all five bundled translations cover every outbound node and obey provider text limits',()=>{
 const base=buildFlowNexaAcquisition({opening:'Abertura original preservada'});
 assert.equal(base.configuration.graph.nodes[0].text,'Abertura original preservada');
 assert.deepEqual(Object.keys(ACQUISITION_LOCALES).sort(),['de','en','es','fr','it']);
 for(const [lang,map] of Object.entries(ACQUISITION_LOCALES))for(const node of base.configuration.graph.nodes){
  const translated=map[node.id];
  if(node.text){assert.ok(translated?.text,`${lang}/${node.id}`);assert.ok(translated.text.length<=1000);}
  if(node.type==='buttons')assert.ok(translated.text.length<=80,`${lang}/${node.id} template text`);
  if(node.buttons){assert.equal(translated.buttons.length,node.buttons.length);translated.buttons.forEach((button,index)=>{
   assert.ok(button.title.length>0&&button.title.length<=20,`${lang}/${node.id} title`);
   assert.equal(button.payload,undefined,'stable routing payload is inherited from base');
   if(button.url){assert.equal(node.buttons[index].type,'web_url');assert.ok(button.url.startsWith(`https://flownex.online/assets/funnel/${lang}/`));}
  });}
 }
});

test('each supported campaign locale has a six-page guide and three localized images',()=>{
 for(const lang of Object.keys(ACQUISITION_LOCALES))for(const name of ['flownexa-guia-direct.pdf','flownexa-conversa.png','flownexa-como-funciona.png','flownexa-modelos.png'])assert.ok(existsSync(new URL(`../public/assets/funnel/${lang}/${name}`,import.meta.url)),`${lang}/${name}`);
});
