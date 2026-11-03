import test from 'node:test';
import assert from 'node:assert/strict';
import {pbkdf2Sync} from 'node:crypto';
import {passwordHash,verifyPassword,needsRehash} from '../src/identity.js';
import {pbkdf2Sha256} from '../src/pbkdf2.js';

test('passwords made on Vercel (600000 iterations) still sign in on Workers, whose WebCrypto stops at 100000',async()=>{
 const salt='0b0e6f3c-legacy',legacy=`pbkdf2-sha256$600000$${salt}$${pbkdf2Sync('senha-antiga-123',salt,600000,32,'sha256').toString('hex')}`;
 assert.equal(await verifyPassword('senha-antiga-123',legacy),true);
 assert.equal(await verifyPassword('senha-errada-123',legacy),false);
 assert.equal(needsRehash(legacy),true);
});
test('new and reset passwords use the Workers-native work factor and verify',async()=>{
 const h=await passwordHash('senha-nova-456');
 assert.match(h,/^pbkdf2-sha256\$100000\$/);assert.equal(needsRehash(h),false);
 assert.equal(await verifyPassword('senha-nova-456',h),true);
});
test('JavaScript PBKDF2 matches Node for unicode and long passwords',()=>{
 for(const [p,s,n] of [['ção€ senha','sal',2000],['x'.repeat(100),'sal-2',1500]])assert.equal(pbkdf2Sha256(p,s,n),pbkdf2Sync(p,s,n,32,'sha256').toString('hex'));
});
