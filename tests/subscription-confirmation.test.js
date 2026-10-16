import test from 'node:test';import assert from 'node:assert/strict';import {subscriptionConfirmed} from '../src/instagram-oauth.js';
test('subscription may identify either the configured Instagram app or its explicitly configured parent app',()=>{
 const fields=['comments','messages'];assert.equal(subscriptionConfirmed({data:[{id:'1796599974717414',subscribed_fields:fields}]},['1796599974717414','2210386389506759']),true);assert.equal(subscriptionConfirmed({data:[{id:'2210386389506759',subscribed_fields:fields}]},['1796599974717414','2210386389506759']),true);
});
test('foreign apps and incomplete or malformed subscription fields never count as confirmed',()=>{
 const ids=['1796599974717414','2210386389506759'];for(const app of [{id:'999',subscribed_fields:['comments','messages']},{id:ids[0],subscribed_fields:['messages']},{id:ids[0],subscribed_fields:'comments,messages'},{id:ids[0]}])assert.equal(subscriptionConfirmed({data:[app]},ids),false);assert.equal(subscriptionConfirmed({data:[{id:'1',subscribed_fields:['comments','messages']}]},[]),false);
});
