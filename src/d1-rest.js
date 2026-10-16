// Cloudflare D1 HTTP adapter for Vercel's Node.js runtime.
// This keeps D1 credentials exclusively on the server and preserves parameter binding.
export class D1Rest {
  constructor({ accountId, databaseId, token, fetcher = fetch }) {
    if (
      !/^[a-f0-9]{32}$/i.test(accountId || "") ||
      !/^[a-f0-9-]{36}$/i.test(databaseId || "") ||
      !token
    )
      throw Error("database_configuration_required");
    this.url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${databaseId}/query`;
    this.token = token;
    this.fetcher = fetcher;
  }
  prepare(sql) {
    return new D1Statement(this, sql);
  }
  async query(statements) {
    const body =
      statements.length === 1 ? statements[0] : { batch: statements };
    const response = await this.fetcher(this.url, {
      method: "POST",
      headers: {
        authorization: "Bearer " + this.token,
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) throw Error("database_request_failed");
    const data = await response.json();
    if (
      !data.success ||
      !Array.isArray(data.result) ||
      data.result.some((x) => !x.success)
    )
      throw Error("database_query_failed");
    return data.result;
  }
  async batch(statements) {
    return this.query(
      statements.map((s) => ({ sql: s.sql, params: s.params })),
    );
  }
}
class D1Statement {
  constructor(db, sql, params = []) {
    this.db = db;
    this.sql = sql;
    this.params = params;
  }
  bind(...params) {
    return new D1Statement(this.db, this.sql, params);
  }
  async run() {
    return (await this.db.query([{ sql: this.sql, params: this.params }]))[0];
  }
  async all() {
    return this.run();
  }
  async first(column) {
    const row = (await this.run()).results?.[0] || null;
    return column && row ? row[column] : row;
  }
}
