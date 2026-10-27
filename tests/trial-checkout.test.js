import test from 'node:test';
import assert from 'node:assert/strict';
import {trialParams,releaseZernio} from '../src/billing.js';
import {trialReminderEmail} from '../src/transactional-email.js';
import {commercialPlans} from '../src/commercial-plans.js';

test('council prices (26/10/2026): Pro R$79,90/US$14,90, Teams R$159,90/US$34,90, annual = 10x monthly', () => {
 const p = Object.fromEntries(commercialPlans().map(x => [x.id, x.unit_amount]));
 assert.deepEqual([p.pro_brl_month, p.pro_usd_month, p.teams_brl_month, p.teams_usd_month], [7990, 1490, 15990, 3490]);
 for (const tier of ['pro_brl', 'pro_usd', 'teams_brl', 'teams_usd']) assert.equal(p[tier + '_year'], p[tier + '_month'] * 10);
});

test('first checkout gets a 7-day trial with card required; a returning workspace does not', () => {
 const fresh = trialParams({}, {stripe_subscription_id: null});
 assert.equal(fresh['subscription_data[trial_period_days]'], '7');
 assert.equal(fresh.payment_method_collection, 'always');
 assert.equal(fresh['subscription_data[trial_settings][end_behavior][missing_payment_method]'], 'cancel');
 assert.deepEqual(trialParams({}, {stripe_subscription_id: 'sub_123'}), {});
 assert.deepEqual(trialParams({BILLING_CHECKOUT_TRIAL_DAYS: '0'}, {}), {});
});

test('ended subscription releases only Zernio accounts, local first even if the provider fails', async () => {
 const writes = [], calls = [];
 const accounts = [{id: 'a1', ig_user_id: 'zernio:abc', status: 'connected'}, {id: 'a2', ig_user_id: '1789', status: 'connected'}];
 const db = {
  prepare: sql => ({bind: (...args) => ({sql, args, all: async () => ({results: accounts}), run: async () => ({})})}),
  batch: async stmts => { writes.push(...stmts.map(s => s.args[0])); },
 };
 const env = {DB: db, ZERNIO_API_KEY: 'k', ZERNIO_FETCH: async (url, init) => { calls.push([url, init.method]); throw Error('down'); }};
 const released = await releaseZernio(env, 'ws1');
 assert.equal(released, 1);
 assert.deepEqual(writes, ['a1', 'a1']);
});

test('trial reminder is self-serve, dated, priced and bilingual', () => {
 const plan = commercialPlans().find(p => p.id === 'pro_usd_month');
 const en = trialReminderEmail({trialEnd: 1800000000, plan, locale: 'en'}, {});
 assert.match(en.subject, /3 days/);
 assert.match(en.text, /\$14\.90/);
 assert.match(en.text, /Cancel in one click/);
 assert.doesNotMatch(en.text, /reply|call us|contact/i);
 const pt = trialReminderEmail({trialEnd: 1800000000, plan: commercialPlans().find(p => p.id === 'pro_brl_month'), locale: 'pt-BR'}, {});
 assert.match(pt.text, /R\$\s?79,90/);
 assert.match(pt.text, /nada será cobrado/);
});
