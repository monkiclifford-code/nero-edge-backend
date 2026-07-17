const mysql = require("mysql2/promise");

async function main() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL);
  const [tables] = await conn.query("SHOW TABLES");
  const existing = tables.map((t) => Object.values(t)[0]);
  console.log("=== Existing Tables ===");
  existing.forEach((t) => console.log("  - " + t));
  console.log("Total: " + existing.length);
  await conn.end();
}
main().catch((e) => { console.error("ERROR: " + e.message); process.exit(1); });
