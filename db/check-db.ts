import { createConnection } from "mysql2/promise";
import { drizzle } from "drizzle-orm/mysql2";

async function main() {
  const conn = await createConnection(process.env.DATABASE_URL!);
  const [tables] = await conn.query("SHOW TABLES");
  const existing = (tables as any[]).map((t) => Object.values(t)[0] as string);
  console.log("=== Existing Tables ===");
  existing.forEach((t) => console.log("  -", t));
  console.log("Total:", existing.length);
  await conn.end();
}
main().catch((e) => { console.error(e.message); process.exit(1); });
