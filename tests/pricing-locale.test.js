import test from 'node:test';
import assert from 'node:assert/strict';
import {browserBillingPreference, commercialPlans, planDisplay} from '../src/commercial-plans.js';
import {appPage} from '../src/app-ui.js';

test('displayed language overrides browser locale for currency',()=>{
 assert.deepEqual(browserBillingPreference(['en-US'],'pt-BR'),{currency:'brl',locale:'pt-BR'});
 assert.deepEqual(browserBillingPreference(['pt-BR'],'en'),{currency:'usd',locale:'en'});
 assert.deepEqual(browserBillingPreference(['pt-BR'],'en-US'),{currency:'usd',locale:'en'});
 assert.deepEqual(browserBillingPreference(['en-US']),{currency:'usd',locale:'en'});
});
test('localized catalog retains approved amounts and annual billing totals',()=>{
 const plans=commercialPlans();
 assert.equal(plans.length,8);
 assert.equal(planDisplay(plans.find(p=>p.id==='pro_usd_month'),'en').price,'$14.90');
 assert.match(planDisplay(plans.find(p=>p.id==='pro_brl_month'),'pt-BR').price,/79,90/);
 assert.equal(planDisplay(plans.find(p=>p.id==='pro_usd_year'),'en').price,'$149.00');
});
test('dashboard carries supported language without interpolating arbitrary input',()=>{
 assert.match(appPage('en'),/<html lang="en">/);
 assert.match(appPage('pt-BR'),/<html lang="pt-BR">/);
 assert.match(appPage('\"><script>'),/<html lang="pt-BR">/);
});
