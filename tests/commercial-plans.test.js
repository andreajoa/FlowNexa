import test from 'node:test';import assert from 'node:assert/strict';
import {commercialPlans,browserBillingPreference,planDisplay,pricingClient} from '../src/commercial-plans.js';
import {landingPage} from '../src/landing.js';import {landingClient} from '../src/landing-script.js';
test('one commercial catalog provides eight fixed monthly/yearly prices in minor units',()=>{
 const plans=commercialPlans();assert.equal(plans.length,8);assert.equal(new Set(plans.map(p=>p.id)).size,8);
 for(const p of plans){assert.ok(Number.isInteger(p.unit_amount));assert.equal(p.interval_count,1);const monthly=plans.find(m=>m.tier===p.tier&&m.currency===p.currency&&m.interval==='month');if(p.interval==='year')assert.equal(p.unit_amount,monthly.unit_amount*10);}
 assert.equal(plans.find(p=>p.id==='pro_brl_month').unit_amount,5990);assert.equal(plans.find(p=>p.id==='pro_usd_year').unit_amount,12900);assert.equal(plans.find(p=>p.id==='teams_brl_year').accounts,2);
});
test('English browser initially selects dollars and Portuguese selects reais; annual display never replaces actual charge',()=>{
 assert.deepEqual(browserBillingPreference(['en-GB','pt-BR']),{currency:'usd',locale:'en'});assert.deepEqual(browserBillingPreference(['pt-BR','en-US']),{currency:'brl',locale:'pt-BR'});assert.equal(browserBillingPreference(['pt-PT']).currency,'brl');
 const annual=commercialPlans().find(p=>p.id==='pro_usd_year');assert.equal(planDisplay(annual,'en-US').price,'$129.00');assert.equal(planDisplay(annual,'en-US').monthly_equivalent,'$10.75');assert.equal(annual.unit_amount,12900);
});
test('landing renders real plan choices and serializes pricing without stale nonfunctional toggle handler',()=>{
 const html=landingPage();const section=html.slice(html.indexOf('id="precos"'),html.indexOf('</section>',html.indexOf('id="precos"')));assert.match(section,/R\$ 59,90/);assert.match(section,/teams_brl_month/);assert.doesNotMatch(section,/Em definição|ainda não foram definidos/);assert.doesNotThrow(()=>new Function(pricingClient()));assert.doesNotThrow(()=>new Function(landingClient()));assert.doesNotMatch(landingClient(),/Visualização anual selecionada/);
});
