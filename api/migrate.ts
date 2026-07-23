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

-- ═══════════════════════════════════════════════════════════
-- SETUP SHEET SYSTEM — Persistent database-driven setup library
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS setup_sheets (
  id SERIAL PRIMARY KEY,
  job_id INTEGER NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  part_number VARCHAR(100) NOT NULL,
  revision VARCHAR(20) NOT NULL DEFAULT 'A',
  material_number VARCHAR(100) NOT NULL,
  operator_id INTEGER NOT NULL REFERENCES operators(id) ON DELETE CASCADE,
  operator_name VARCHAR(100) NOT NULL,
  program_notes TEXT,
  general_notes TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  is_latest BOOLEAN NOT NULL DEFAULT true,
  copied_from_job_id INTEGER,
  copied_from_version INTEGER,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS setup_sheet_images (
  id SERIAL PRIMARY KEY,
  setup_sheet_id INTEGER NOT NULL REFERENCES setup_sheets(id) ON DELETE CASCADE,
  image_data TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS setup_annotations (
  id SERIAL PRIMARY KEY,
  image_id INTEGER NOT NULL REFERENCES setup_sheet_images(id) ON DELETE CASCADE,
  type VARCHAR(30) NOT NULL,
  color VARCHAR(20) NOT NULL,
  points TEXT NOT NULL,
  text VARCHAR(500),
  number INTEGER,
  stroke_width INTEGER,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS setup_tools (
  id SERIAL PRIMARY KEY,
  setup_sheet_id INTEGER NOT NULL REFERENCES setup_sheets(id) ON DELETE CASCADE,
  tool_number VARCHAR(20) NOT NULL,
  description VARCHAR(200),
  tool_id VARCHAR(100),
  "offset" VARCHAR(50),
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS setup_workholding (
  id SERIAL PRIMARY KEY,
  setup_sheet_id INTEGER NOT NULL REFERENCES setup_sheets(id) ON DELETE CASCADE,
  label VARCHAR(100) NOT NULL,
  value VARCHAR(300),
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS setup_versions (
  id SERIAL PRIMARY KEY,
  setup_sheet_id INTEGER NOT NULL REFERENCES setup_sheets(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  operator_id INTEGER NOT NULL REFERENCES operators(id) ON DELETE CASCADE,
  operator_name VARCHAR(100) NOT NULL,
  change_summary TEXT,
  snapshot_data TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ─── Add missing columns to existing tables (idempotent) ───
DO $$ BEGIN
  ALTER TABLE setup_sheets ADD COLUMN IF NOT EXISTS copied_from_job_id INTEGER;
  ALTER TABLE setup_sheets ADD COLUMN IF NOT EXISTS copied_from_version INTEGER;
  -- Approval workflow: existing data defaults to 'approved' so nothing breaks
  ALTER TABLE setup_sheets ADD COLUMN IF NOT EXISTS approval_status VARCHAR(20) NOT NULL DEFAULT 'approved';
  ALTER TABLE setup_sheets ADD COLUMN IF NOT EXISTS approved_by VARCHAR(100);
  ALTER TABLE setup_sheets ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP;
EXCEPTION WHEN others THEN
  RAISE NOTICE 'setup_sheets columns may already exist';
END $$;

CREATE INDEX IF NOT EXISTS idx_setup_sheets_job_id ON setup_sheets(job_id);
CREATE INDEX IF NOT EXISTS idx_setup_sheets_part_number ON setup_sheets(part_number);
CREATE INDEX IF NOT EXISTS idx_setup_sheets_is_latest ON setup_sheets(is_latest);
CREATE INDEX IF NOT EXISTS idx_setup_tools_sheet_id ON setup_tools(setup_sheet_id);
CREATE INDEX IF NOT EXISTS idx_setup_workholding_sheet_id ON setup_workholding(setup_sheet_id);
CREATE INDEX IF NOT EXISTS idx_setup_sheet_images_sheet_id ON setup_sheet_images(setup_sheet_id);
CREATE INDEX IF NOT EXISTS idx_setup_annotations_image_id ON setup_annotations(image_id);
CREATE INDEX IF NOT EXISTS idx_setup_versions_sheet_id ON setup_versions(setup_sheet_id);
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
