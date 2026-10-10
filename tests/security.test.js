import test from "node:test";
import assert from "node:assert/strict";
import {encryptToken,decryptToken,instagramOauth} from "../src/instagram-oauth.js";
const secret="0123456789abcdef".repeat(4);
test("Instagram tokens encrypt and round-trip",async()=>{
 const encrypted=await encryptToken("IGQVJ_token_example",secret);
 assert.notEqual(encrypted,"IGQVJ_token_example");
 assert.equal(await decryptToken(encrypted,secret),"IGQVJ_token_example");
 await assert.rejects(()=>decryptToken(encrypted,"b".repeat(64)));
});
test("different IV per encryption",async()=>{
 const a=await encryptToken("token",secret),b=await encryptToken("token",secret);
 assert.notEqual(a,b);
});
test("OAuth fails closed without configuration",async()=>{
 const r=await instagramOauth(new Request("https://example.com/api/instagram/connect?workspace=x"),{});
 assert.equal(r.status,503);
});
test("webhook fails closed for invalid signatures",async()=>{
 const {default:app}=await import("../src/index.js");
 const response=await app.fetch(new Request("https://example.com/webhooks/instagram",{method:"POST",body:'{"events":[]}',headers:{"x-hub-signature-256":"sha256="+"0".repeat(64)}}),{META_APP_SECRET:"top-secret"});
 assert.equal(response.status,403);
});
