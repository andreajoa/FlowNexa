import { readdir, readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { D1Rest } from "../src/d1-rest.js";
const db = new D1Rest({
  accountId: process.env.CLOUDFLARE_ACCOUNT_ID,
  databaseId: process.env.CLOUDFLARE_D1_DATABASE_ID,
  token: process.env.CLOUDFLARE_D1_TOKEN,
});
await db
  .prepare(
    "CREATE TABLE IF NOT EXISTS schema_migrations(name TEXT PRIMARY KEY,sha256 TEXT NOT NULL,applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)",
  )
  .run();
for (const name of (await readdir(new URL("../migrations/", import.meta.url)))
  .filter((x) => x.endsWith(".sql"))
  .sort()) {
  const sql = await readFile(
      new URL("../migrations/" + name, import.meta.url),
      "utf8",
    ),
    sha = createHash("sha256").update(sql).digest("hex"),
    prior = await db
      .prepare("SELECT sha256 FROM schema_migrations WHERE name=?")
      .bind(name)
      .first();
  if (prior) {
    if (prior.sha256 !== sha)
      throw Error("Previously applied migration changed: " + name);
    console.log("Already applied:", name);
    continue;
  }
  await db.batch([
    db.prepare(sql),
    db
      .prepare("INSERT INTO schema_migrations(name,sha256) VALUES (?,?)")
      .bind(name, sha),
  ]);
  console.log("Applied:", name);
}
