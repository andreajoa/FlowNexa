# FlowNexa

Instagram automation with a Vercel application, Cloudflare D1 storage and Resend account emails. The public landing is preserved; the private application is at `/app`.

See [RUNTIME.md](RUNTIME.md) for setup, execution semantics and release checks.

Current integration status: account access, flow editor and durable execution engine are implemented. Live Instagram validation still requires the dedicated Meta app and an authorized professional account. Keep messaging disabled until that end-to-end check passes.

```sh
npm ci --ignore-scripts
npm test
npm run check
```
