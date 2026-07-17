import { getDb } from "../api/queries/connection";

async function seed() {
  const db = getDb();
  console.log("Seeding database...");
  console.log("Done.");
  process.exit(0);
}

seed();
