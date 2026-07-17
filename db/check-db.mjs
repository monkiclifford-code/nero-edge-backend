import { createConnection } from "mysql2/promise";

const dbUrl = "mysql://2b4Hfvnm3Dxqdo1.root:V9PkGWOMKXbOzdYCpfZDPKA8ENav90ij@ep-t4ni387b5e83b7519dc8.epsrv-t4n281l4mrmemi4zls9a.ap-southeast-1.privatelink.aliyuncs.com:4000/19cedfbd-6472-8155-8000-09a9e1ba4ee1";

try {
  const conn = await createConnection(dbUrl);
  const [tables] = await conn.query("SHOW TABLES");
  const existing = tables.map((t) => Object.values(t)[0]);
  console.log("=== Existing Tables ===");
  existing.forEach((t) => console.log("  - " + t));
  console.log("Total: " + existing.length);
  await conn.end();
} catch(e) {
  console.error("ERROR: " + e.message);
  process.exit(1);
}
