// Pure-JS PBKDF2-HMAC-SHA256 for iteration counts Workers' WebCrypto refuses (> 100000).
const K=new Int32Array([0x428a2f98,0x71374491,-0x4a3f0431,-0x164a245b,0x3956c25b,0x59f111f1,-0x6dc07d5c,-0x54e3a12b,-0x27f85568,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,-0x7f214e02,-0x6423f959,-0x3e640e8c,-0x1b64963f,-0x1041b87a,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,-0x67c1aeae,-0x57ce3993,-0x4ffcd838,-0x40a68039,-0x391ff40d,-0x2a586eb9,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,-0x7e3d36d2,-0x6d8dd37b,-0x5d40175f,-0x57e599b5,-0x3db47490,-0x3893ae5d,-0x2e6d17e7,-0x2966f9dc,-0xbf1ca7b,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,-0x7b3787ec,-0x7338fdf8,-0x6f410006,-0x5baf9315,-0x41065c09,-0x398e870e]);
const W=new Int32Array(64);
function compress(st,blk){let a=st[0],b=st[1],c=st[2],d=st[3],e=st[4],f=st[5],g=st[6],h=st[7];
 for(let i=0;i<16;i++)W[i]=blk[i];
 for(let i=16;i<64;i++){const x=W[i-15],y=W[i-2];W[i]=(((x>>>7|x<<25)^(x>>>18|x<<14)^(x>>>3))+W[i-7]+((y>>>17|y<<15)^(y>>>19|y<<13)^(y>>>10))+W[i-16])|0;}
 for(let i=0;i<64;i++){const t1=(h+((e>>>6|e<<26)^(e>>>11|e<<21)^(e>>>25|e<<7))+((e&f)^(~e&g))+K[i]+W[i])|0,t2=(((a>>>2|a<<30)^(a>>>13|a<<19)^(a>>>22|a<<10))+((a&b)^(a&c)^(b&c)))|0;h=g;g=f;f=e;e=(d+t1)|0;d=c;c=b;b=a;a=(t1+t2)|0;}
 st[0]=st[0]+a|0;st[1]=st[1]+b|0;st[2]=st[2]+c|0;st[3]=st[3]+d|0;st[4]=st[4]+e|0;st[5]=st[5]+f|0;st[6]=st[6]+g|0;st[7]=st[7]+h|0;}
const IV=[0x6a09e667,-0x4498517b,0x3c6ef372,-0x5ab00ac6,0x510e527f,-0x64fa9774,0x1f83d9ab,0x5be0cd19];
function words(bytes){const w=new Int32Array(bytes.length>>2);for(let i=0;i<w.length;i++)w[i]=bytes[i*4]<<24|bytes[i*4+1]<<16|bytes[i*4+2]<<8|bytes[i*4+3];return w;}
function sha256(bytes){const l=bytes.length,n=((l+9+63)>>6)<<6,p=new Uint8Array(n);p.set(bytes);p[l]=0x80;const bits=l*8;p[n-4]=bits>>>24;p[n-3]=bits>>>16;p[n-2]=bits>>>8;p[n-1]=bits;const st=Int32Array.from(IV),w=words(p);for(let i=0;i<w.length;i+=16)compress(st,w.subarray(i,i+16));return st;}
const toBytes=st=>{const o=new Uint8Array(32);for(let i=0;i<8;i++){o[i*4]=st[i]>>>24;o[i*4+1]=st[i]>>>16;o[i*4+2]=st[i]>>>8;o[i*4+3]=st[i];}return o;};
export function pbkdf2Sha256(password,salt,iterations){
 let key=new TextEncoder().encode(password);if(key.length>64)key=toBytes(sha256(key));
 const ipad=new Uint8Array(64).fill(0x36),opad=new Uint8Array(64).fill(0x5c);for(let i=0;i<key.length;i++){ipad[i]^=key[i];opad[i]^=key[i];}
 const ist=Int32Array.from(IV),ost=Int32Array.from(IV);compress(ist,words(ipad));compress(ost,words(opad));
 const s=new TextEncoder().encode(salt),first=new Uint8Array(64+s.length+4);first.set(ipad);first.set(s,64);first[first.length-1]=1;
 // U1 = HMAC(P, S || INT(1))
 const inner=sha256(first),ob=new Uint8Array(96);ob.set(opad);ob.set(toBytes(inner),64);let u=sha256(ob);
 const t=Int32Array.from(u),blk=new Int32Array(16),st=new Int32Array(8);
 for(let it=1;it<iterations;it++){
  // inner: ipad state + U (32 bytes) + padding (total 96 bytes = 768 bits)
  for(let i=0;i<8;i++)blk[i]=u[i];blk[8]=-0x80000000;for(let i=9;i<15;i++)blk[i]=0;blk[15]=768;
  st.set(ist);compress(st,blk);
  for(let i=0;i<8;i++)blk[i]=st[i];st.set(ost);compress(st,blk);
  u=Int32Array.from(st);for(let i=0;i<8;i++)t[i]^=u[i];}
 return [...toBytes(t)].map(b=>b.toString(16).padStart(2,'0')).join('');}
