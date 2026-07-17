import "dotenv/config";
import { createConnection } from "mysql2/promise";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

async function setup() {
  const conn = await createConnection(url!);

  console.log("Dropping old tables if they exist...");
  await conn.execute(`DROP TABLE IF EXISTS job_feedback`);
  await conn.execute(`DROP TABLE IF EXISTS cnc_programs`);
  await conn.execute(`DROP TABLE IF EXISTS ncr_whys`);
  await conn.execute(`DROP TABLE IF EXISTS ncr`);
  await conn.execute(`DROP TABLE IF EXISTS inspection_items`);
  await conn.execute(`DROP TABLE IF EXISTS setup_images`);
  await conn.execute(`DROP TABLE IF EXISTS inspections`);
  await conn.execute(`DROP TABLE IF EXISTS jobs`);
  await conn.execute(`DROP TABLE IF EXISTS operators`);

  console.log("Creating tables...");

  await conn.execute(`
    CREATE TABLE IF NOT EXISTS operators (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      operator_id VARCHAR(50) NOT NULL UNIQUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await conn.execute(`
    CREATE TABLE IF NOT EXISTS jobs (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      job_number VARCHAR(50) NOT NULL,
      part_number VARCHAR(100) NOT NULL,
      material_number VARCHAR(100) NOT NULL,
      revision VARCHAR(20) NOT NULL DEFAULT 'A',
      operator_id INT UNSIGNED NOT NULL,
      status ENUM('active', 'completed', 'on_hold') NOT NULL DEFAULT 'active',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (operator_id) REFERENCES operators(id) ON DELETE CASCADE
    )
  `);

  await conn.execute(`
    CREATE TABLE IF NOT EXISTS inspections (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      job_id INT UNSIGNED NOT NULL,
      operator_id INT UNSIGNED NOT NULL,
      notes TEXT,
      started_at TIMESTAMP NULL,
      completed_at TIMESTAMP NULL,
      duration_seconds INT,
      fail_count INT DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE,
      FOREIGN KEY (operator_id) REFERENCES operators(id) ON DELETE CASCADE
    )
  `);

  await conn.execute(`
    CREATE TABLE IF NOT EXISTS inspection_items (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      inspection_id INT UNSIGNED NOT NULL,
      dimension_name VARCHAR(100) NOT NULL,
      nominal_value DECIMAL(12,4) NOT NULL,
      tolerance_plus DECIMAL(12,4) NOT NULL,
      tolerance_minus DECIMAL(12,4) NOT NULL,
      measured_value DECIMAL(12,4),
      is_pass BOOLEAN,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (inspection_id) REFERENCES inspections(id) ON DELETE CASCADE
    )
  `);

  await conn.execute(`
    CREATE TABLE IF NOT EXISTS setup_images (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      job_id INT UNSIGNED NOT NULL,
      image_url VARCHAR(500) NOT NULL,
      uploaded_by INT UNSIGNED NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE,
      FOREIGN KEY (uploaded_by) REFERENCES operators(id) ON DELETE CASCADE
    )
  `);

  await conn.execute(`
    CREATE TABLE IF NOT EXISTS ncr (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      job_id INT UNSIGNED NOT NULL,
      operator_id INT UNSIGNED NOT NULL,
      inspection_id INT UNSIGNED NULL,
      problem_description TEXT NOT NULL,
      root_cause TEXT NOT NULL,
      corrective_action TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE,
      FOREIGN KEY (operator_id) REFERENCES operators(id) ON DELETE CASCADE,
      FOREIGN KEY (inspection_id) REFERENCES inspections(id) ON DELETE SET NULL
    )
  `);

  await conn.execute(`
    CREATE TABLE IF NOT EXISTS ncr_whys (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      ncr_id INT UNSIGNED NOT NULL,
      why_level INT NOT NULL,
      answer TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (ncr_id) REFERENCES ncr(id) ON DELETE CASCADE
    )
  `);

  await conn.execute(`
    CREATE TABLE IF NOT EXISTS cnc_programs (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      operator_id INT UNSIGNED NOT NULL,
      job_id INT UNSIGNED NULL,
      program_type ENUM('facing', 'od_turning', 'id_turning', 'drilling') NOT NULL,
      parameters TEXT NOT NULL,
      gcode_text TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (operator_id) REFERENCES operators(id) ON DELETE CASCADE,
      FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE SET NULL
    )
  `);

  await conn.execute(`
    CREATE TABLE IF NOT EXISTS job_feedback (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      job_id INT UNSIGNED NOT NULL,
      operator_id INT UNSIGNED NOT NULL,
      program_id INT UNSIGNED NULL,
      result ENUM('pass', 'fail') NOT NULL,
      offset_adjustment DECIMAL(12,4),
      tool_change BOOLEAN DEFAULT FALSE,
      feed_adjustment DECIMAL(8,4),
      speed_adjustment INT,
      notes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE,
      FOREIGN KEY (operator_id) REFERENCES operators(id) ON DELETE CASCADE,
      FOREIGN KEY (program_id) REFERENCES cnc_programs(id) ON DELETE SET NULL
    )
  `);

  console.log("Tables created successfully!");
  await conn.end();
}

setup().catch((err) => {
  console.error("Setup failed:", err);
  process.exit(1);
});
