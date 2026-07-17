import { Pool } from "pg";

const TABLES_SQL = `
-- Create tables if they don't exist

CREATE TABLE IF NOT EXISTS operators (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  operator_id VARCHAR(50) NOT NULL UNIQUE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS jobs (
  id SERIAL PRIMARY KEY,
  job_number VARCHAR(50) NOT NULL,
  part_number VARCHAR(100) NOT NULL,
  material_number VARCHAR(100) NOT NULL,
  revision VARCHAR(20) NOT NULL DEFAULT 'A',
  operator_id INTEGER NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS inspections (
  id SERIAL PRIMARY KEY,
  job_id INTEGER NOT NULL,
  operator_id INTEGER NOT NULL,
  notes TEXT,
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  duration_seconds INTEGER,
  fail_count INTEGER DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS inspection_items (
  id SERIAL PRIMARY KEY,
  inspection_id INTEGER NOT NULL,
  dimension_name VARCHAR(100) NOT NULL,
  nominal_value DECIMAL(12,4) NOT NULL,
  tolerance_plus DECIMAL(12,4) NOT NULL,
  tolerance_minus DECIMAL(12,4) NOT NULL,
  measured_value DECIMAL(12,4),
  is_pass BOOLEAN,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS setup_images (
  id SERIAL PRIMARY KEY,
  job_id INTEGER NOT NULL,
  image_url VARCHAR(500) NOT NULL,
  uploaded_by INTEGER NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ncr (
  id SERIAL PRIMARY KEY,
  job_id INTEGER NOT NULL,
  operator_id INTEGER NOT NULL,
  inspection_id INTEGER,
  problem_description TEXT NOT NULL,
  root_cause TEXT NOT NULL,
  corrective_action TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cnc_programs (
  id SERIAL PRIMARY KEY,
  operator_id INTEGER NOT NULL,
  job_id INTEGER,
  program_type VARCHAR(50) NOT NULL,
  parameters TEXT NOT NULL,
  gcode_text TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS job_feedback (
  id SERIAL PRIMARY KEY,
  job_id INTEGER NOT NULL,
  operator_id INTEGER NOT NULL,
  program_id INTEGER,
  result VARCHAR(20) NOT NULL,
  offset_adjustment DECIMAL(12,4),
  tool_change BOOLEAN DEFAULT false,
  feed_adjustment DECIMAL(8,4),
  speed_adjustment INTEGER,
  notes TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ncr_whys (
  id SERIAL PRIMARY KEY,
  ncr_id INTEGER NOT NULL,
  why_level INTEGER NOT NULL,
  answer TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS foundry_ncrs (
  id SERIAL PRIMARY KEY,
  job_id INTEGER NOT NULL,
  operator_id INTEGER NOT NULL,
  casting_batch_id INTEGER,
  ncr_type VARCHAR(50) NOT NULL DEFAULT 'foundry',
  defect_type VARCHAR(50) NOT NULL,
  problem_description TEXT NOT NULL,
  root_cause TEXT,
  corrective_action TEXT,
  severity VARCHAR(20) NOT NULL DEFAULT 'major',
  status VARCHAR(20) NOT NULL DEFAULT 'open',
  scrap_quantified BOOLEAN DEFAULT false,
  scrap_cost DECIMAL(12,2),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS foundry_ncr_images (
  id SERIAL PRIMARY KEY,
  foundry_ncr_id INTEGER NOT NULL,
  image_url VARCHAR(500) NOT NULL,
  thumbnail_url VARCHAR(500),
  uploaded_by INTEGER NOT NULL,
  file_size INTEGER,
  mime_type VARCHAR(50),
  metadata TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS foundry_defects (
  id SERIAL PRIMARY KEY,
  foundry_ncr_id INTEGER NOT NULL,
  part_number VARCHAR(100) NOT NULL,
  defect_type VARCHAR(50) NOT NULL,
  description TEXT,
  location VARCHAR(100),
  confidence DECIMAL(5,2),
  ai_predicted BOOLEAN DEFAULT false,
  image_id INTEGER,
  is_repeat BOOLEAN DEFAULT false,
  previous_occurrence_id INTEGER,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ai_visual_predictions (
  id SERIAL PRIMARY KEY,
  image_id INTEGER NOT NULL,
  provider VARCHAR(50) NOT NULL DEFAULT 'mock',
  model VARCHAR(100),
  predicted_defect_type VARCHAR(50),
  confidence DECIMAL(5,2),
  all_predictions TEXT,
  raw_response TEXT,
  processing_time_ms INTEGER,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  error_message TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS casting_batches (
  id SERIAL PRIMARY KEY,
  batch_number VARCHAR(50) NOT NULL UNIQUE,
  part_number VARCHAR(100) NOT NULL,
  material VARCHAR(100),
  furnace_id VARCHAR(50),
  operator_id INTEGER,
  quantity INTEGER DEFAULT 0,
  quantity_scrap INTEGER DEFAULT 0,
  pour_date TIMESTAMP,
  status VARCHAR(20) NOT NULL DEFAULT 'poured',
  notes TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
`;

export async function runMigrations() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error("DATABASE_URL not set, skipping migration");
    return;
  }

  console.log("Running database migrations...");
  const pool = new Pool({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await pool.query(TABLES_SQL);
    console.log("All tables created/verified successfully!");

    // Seed default operator for login
    const { rows } = await pool.query(
      "SELECT id FROM operators WHERE operator_id = $1",
      ["20047"]
    );
    if (rows.length === 0) {
      await pool.query(
        "INSERT INTO operators (name, operator_id) VALUES ($1, $2)",
        ["Default Operator", "20047"]
      );
      console.log("Default operator (20047) seeded for login");
    }

    // Seed test jobs
    const { rows: jobRows } = await pool.query("SELECT id FROM jobs LIMIT 1");
    if (jobRows.length === 0) {
      await pool.query(
        `INSERT INTO jobs (job_number, part_number, material_number, operator_id, status) VALUES
         ('JOB-001', 'PART-1001', 'MAT-A', 1, 'active'),
         ('JOB-002', 'PART-1002', 'MAT-B', 1, 'active'),
         ('JOB-003', 'PART-1003', 'MAT-C', 1, 'completed')`
      );
      console.log("Test jobs seeded");
    }
  } catch (err) {
    console.error("Migration error:", err);
    throw err;
  } finally {
    await pool.end();
  }
}
