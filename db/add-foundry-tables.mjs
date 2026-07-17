import { createConnection } from "mysql2/promise";

const dbUrl = "mysql://2b4Hfvnm3Dxqdo1.root:V9PkGWOMKXbOzdYCpfZDPKA8ENav90ij@ep-t4ni387b5e83b7519dc8.epsrv-t4n281l4mrmemi4zls9a.ap-southeast-1.privatelink.aliyuncs.com:4000/19cedfbd-6472-8155-8000-09a9e1ba4ee1";

const TABLES = [
  // Foundry NCRs
  `CREATE TABLE IF NOT EXISTS foundry_ncrs (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    job_id BIGINT UNSIGNED NOT NULL,
    operator_id BIGINT UNSIGNED NOT NULL,
    casting_batch_id BIGINT UNSIGNED DEFAULT NULL,
    ncr_type ENUM('foundry','machining','tooling','supplier') DEFAULT 'foundry' NOT NULL,
    defect_type ENUM('blow_hole','porosity','corrosion','crack','sand_inclusion','shrinkage','surface_defect','hard_spot','misrun','dimensional_shift','other') NOT NULL,
    problem_description TEXT NOT NULL,
    root_cause TEXT,
    corrective_action TEXT,
    severity ENUM('critical','major','minor','observation') DEFAULT 'major' NOT NULL,
    status ENUM('open','in_progress','resolved','closed') DEFAULT 'open' NOT NULL,
    scrap_quantified TINYINT(1) DEFAULT 0,
    scrap_cost DECIMAL(12,2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  )`,

  // Foundry NCR Images
  `CREATE TABLE IF NOT EXISTS foundry_ncr_images (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    foundry_ncr_id BIGINT UNSIGNED NOT NULL,
    image_url VARCHAR(500) NOT NULL,
    thumbnail_url VARCHAR(500),
    uploaded_by BIGINT UNSIGNED NOT NULL,
    file_size INT,
    mime_type VARCHAR(50),
    metadata TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,

  // Foundry Defects
  `CREATE TABLE IF NOT EXISTS foundry_defects (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    foundry_ncr_id BIGINT UNSIGNED NOT NULL,
    part_number VARCHAR(100) NOT NULL,
    defect_type ENUM('blow_hole','porosity','corrosion','crack','sand_inclusion','shrinkage','surface_defect','hard_spot','misrun','dimensional_shift','other') NOT NULL,
    description TEXT,
    location VARCHAR(100),
    confidence DECIMAL(5,2),
    ai_predicted TINYINT(1) DEFAULT 0,
    image_id BIGINT UNSIGNED,
    is_repeat TINYINT(1) DEFAULT 0,
    previous_occurrence_id BIGINT UNSIGNED,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,

  // AI Visual Predictions
  `CREATE TABLE IF NOT EXISTS ai_visual_predictions (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    image_id BIGINT UNSIGNED NOT NULL,
    provider ENUM('mock','openai','ollama','deepseek','yolo_local') DEFAULT 'mock' NOT NULL,
    model VARCHAR(100),
    predicted_defect_type ENUM('blow_hole','porosity','corrosion','crack','sand_inclusion','shrinkage','surface_defect','hard_spot','misrun','dimensional_shift','other'),
    confidence DECIMAL(5,2),
    all_predictions TEXT,
    raw_response TEXT,
    processing_time_ms INT,
    status ENUM('pending','processing','completed','failed') DEFAULT 'pending' NOT NULL,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,

  // Casting Batches
  `CREATE TABLE IF NOT EXISTS casting_batches (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    batch_number VARCHAR(50) NOT NULL UNIQUE,
    part_number VARCHAR(100) NOT NULL,
    material VARCHAR(100),
    furnace_id VARCHAR(50),
    operator_id BIGINT UNSIGNED,
    quantity INT DEFAULT 0,
    quantity_scrap INT DEFAULT 0,
    pour_date TIMESTAMP,
    status ENUM('poured','cooling','fettled','inspected','shipped') DEFAULT 'poured' NOT NULL,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  )`,
];

try {
  const conn = await createConnection(dbUrl);

  for (const sql of TABLES) {
    const tableName = sql.match(/CREATE TABLE IF NOT EXISTS (\w+)/)?.[1];
    try {
      await conn.query(sql);
      console.log("[OK] Created/verified:", tableName);
    } catch (e) {
      console.error("[FAIL]", tableName + ":", e.message);
    }
  }

  console.log("\n[ForgeTraceIQ] Foundry tables ready!");
  await conn.end();
} catch(e) {
  console.error("ERROR: " + e.message);
  process.exit(1);
}
