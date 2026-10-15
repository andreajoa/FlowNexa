import test from "node:test";
import assert from "node:assert/strict";
import handler from "../api/index.js";
function fakeRequest(url="/", headers={host:"flownexa.vercel.app"}){return {url,method:"GET",headers}}
function fakeResponse(){return {statusCode:200,headers:{},setHeader(key,value){this.headers[key]=value},end(value){this.body=String(value||"");return this}}}
test("Vercel gateway serves hero and animation without backend configuration",async()=>{
 const previous=process.env.FLOWNEXA_WORKER_ORIGIN;delete process.env.FLOWNEXA_WORKER_ORIGIN;
 try{const res=fakeResponse();await handler(fakeRequest(),res);assert.equal(res.statusCode,200);assert.match(res.body,/Automação/);const js=fakeResponse();await handler(fakeRequest("/landing.js"),js);assert.equal(js.statusCode,200);assert.match(js.body,/conversation/);const api=fakeResponse();await handler(fakeRequest("/api/health"),api);assert.equal(api.statusCode,503)}
 finally{if(previous===undefined)delete process.env.FLOWNEXA_WORKER_ORIGIN;else process.env.FLOWNEXA_WORKER_ORIGIN=previous}
});
test("Vercel gateway rejects cross-origin browser requests",async()=>{
 const previous=process.env.FLOWNEXA_WORKER_ORIGIN;process.env.FLOWNEXA_WORKER_ORIGIN="https://worker.example.com/";
 try{const res=fakeResponse();await handler(fakeRequest("/api/health",{host:"flownexa.vercel.app",origin:"https://attacker.example"}),res);assert.equal(res.statusCode,403)}
 finally{if(previous===undefined)delete process.env.FLOWNEXA_WORKER_ORIGIN;else process.env.FLOWNEXA_WORKER_ORIGIN=previous}
});
