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

-- ─── Add version control columns to existing foundry_ncrs (individual blocks) ───
DO $$ BEGIN ALTER TABLE foundry_ncrs ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1; EXCEPTION WHEN others THEN RAISE NOTICE 'version column issue'; END $$;
DO $$ BEGIN ALTER TABLE foundry_ncrs ADD COLUMN IF NOT EXISTS is_latest BOOLEAN NOT NULL DEFAULT true; EXCEPTION WHEN others THEN RAISE NOTICE 'is_latest column issue'; END $$;
DO $$ BEGIN ALTER TABLE foundry_ncrs ADD COLUMN IF NOT EXISTS approval_status VARCHAR(20) NOT NULL DEFAULT 'approved'; EXCEPTION WHEN others THEN RAISE NOTICE 'approval_status column issue'; END $$;
DO $$ BEGIN ALTER TABLE foundry_ncrs ADD COLUMN IF NOT EXISTS approved_by VARCHAR(100); EXCEPTION WHEN others THEN RAISE NOTICE 'approved_by column issue'; END $$;
DO $$ BEGIN ALTER TABLE foundry_ncrs ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP; EXCEPTION WHEN others THEN RAISE NOTICE 'approved_at column issue'; END $$;
DO $$ BEGIN ALTER TABLE foundry_ncrs ADD COLUMN IF NOT EXISTS change_summary TEXT; EXCEPTION WHEN others THEN RAISE NOTICE 'change_summary column issue'; END $$;
DO $$ BEGIN ALTER TABLE foundry_ncrs ADD COLUMN IF NOT EXISTS updated_by VARCHAR(100); EXCEPTION WHEN others THEN RAISE NOTICE 'updated_by column issue'; END $$;

-- ─── Ensure foundry_ncr_images can store base64 data ───
DO $$ BEGIN ALTER TABLE foundry_ncr_images ALTER COLUMN image_url TYPE TEXT; EXCEPTION WHEN others THEN RAISE NOTICE 'image_url type issue'; END $$;
DO $$ BEGIN ALTER TABLE foundry_ncr_images ALTER COLUMN thumbnail_url TYPE TEXT; EXCEPTION WHEN others THEN RAISE NOTICE 'thumbnail_url type issue'; END $$;

-- ─── Foundry Knowledge Base (AI defect analysis) ───
CREATE TABLE IF NOT EXISTS foundry_knowledge (
  id SERIAL PRIMARY KEY,
  defect_type VARCHAR(50) NOT NULL,
  possible_causes TEXT NOT NULL,
  inspection_methods TEXT,
  corrective_actions TEXT NOT NULL,
  preventive_actions TEXT,
  lessons_learned TEXT,
  severity_indicators TEXT,
  related_defects TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(defect_type)
);

-- Seed knowledge base data
INSERT INTO foundry_knowledge (defect_type, possible_causes, inspection_methods, corrective_actions, preventive_actions, lessons_learned, severity_indicators, related_defects)
VALUES
('porosity',
 '1. Gas trapped during solidification (hydrogen, nitrogen, or steam)
2. Inadequate venting in mould or core
3. Excessive moisture in moulding sand or cores
4. Pouring temperature too high — increases gas absorption
5. Poor metal degassing before pour
6. Turbulent pouring causing air entrainment
7. Inadequate riser design — premature freezing traps gas',
 '1. Visual inspection — look for pinholes, surface voids, clustered pores
2. Ultrasonic testing (UT) for internal porosity
3. Dye penetrant inspection (DPI) for surface-connected porosity
4. X-ray or CT scanning for internal assessment
5. Sectioning and macro-etch examination',
 '1. Improve mould and core venting — add more vents, verify vent paths are clear
2. Reduce pouring temperature to recommended range
3. Degas molten metal before pouring (nitrogen or argon purging)
4. Reduce moisture in moulding sand to 2.5-3.5%
5. Redesign gating to reduce turbulence — use sprue well, enlarge gates
6. Use chills to accelerate directional solidification
7. Increase riser size or add exothermic sleeves to extend feeding',
 '1. Regular sand moisture testing and control
2. Routine vent inspection and cleaning
3. Standardize pouring temperature by alloy type
4. Implement metal degassing as standard procedure
5. Train operators on proper gating design principles
6. Use ceramic filters in gating system to trap inclusions and reduce turbulence',
 'Porosity is the most common foundry defect. Most cases are caused by inadequate venting or sand moisture. Implementing routine sand testing and vent inspection can reduce porosity by 60-70%.',
 'Critical: Shrinkage porosity in thick sections or junctions. Major: Scattered gas porosity across surface. Minor: Isolated pinholes not affecting structural integrity.',
 'shrinkage, blow_hole, surface_defect'),

('shrinkage',
 '1. Inadequate riser feeding — riser solidifies before casting
2. Incorrect gating system design — no directional solidification
3. Thick sections cooling slower than thin sections
4. No chills or insufficient chill placement
5. Excessive pouring temperature — prolongs solidification time
6. Alloy composition promoting wide freezing range
7. Riser neck too small — freezes off before feeding complete',
 '1. Visual inspection — look for sunken surfaces, internal cavities
2. Ultrasonic testing for internal shrinkage cavities
3. Radiographic testing (X-ray)
4. Cut sections and macro-etch to reveal pipe or microporosity
5. Dimensional measurement for sink marks on flat surfaces',
 '1. Redesign risers — increase volume, use exothermic sleeves or insulating covers
2. Add chills to thick sections or hotspots to accelerate cooling
3. Redesign gating for directional solidification — thin to thick
4. Reduce pouring temperature to minimum recommended for alloy
5. Increase riser neck diameter to prevent premature freezing
6. Add feed paths or padding to isolated heavy sections
7. Consider changing alloy to one with narrower freezing range',
 '1. Use solidification simulation software to design gating and risers
2. Place chills at all identified hotspots during pattern design
3. Standardize riser sizing formulas by casting weight and alloy
4. Regular thermocouple calibration to control pouring temperature
5. Implement first-article inspection with sectioning for new parts',
 'Shrinkage defects often recur on the same part because riser design is not revised. Always update pattern drawings when riser changes are made. Feed paths and padding dimensions must be added to the permanent pattern record.',
 'Critical: Through-thickness shrinkage cavity causing structural failure. Major: Localized shrinkage in thick sections. Minor: Microporosity not affecting load-bearing capacity.',
 'porosity, blow_hole, surface_defect'),

('blow_hole',
 '1. Excessive moisture in moulding sand (>4%)
2. Inadequate sand mixing — uneven moisture distribution
3. Poor venting — gas cannot escape mould cavity
4. High clay content or bentonite not properly activated
5. Contaminated returns sand with excessive fines
6. Core gas evolution during pouring (core binder decomposition)
7. Inadequate drying of mould or cores before pour',
 '1. Visual inspection — round or elongated cavities, often with smooth walls
2. Break open casting to examine cavity walls — sand particles indicate source
3. Sand moisture testing of moulding sand
4. Check vent paths for blockages
5. Examine core quality and binder type',
 '1. Reduce and control moulding sand moisture to 2.5-3.5%
2. Improve sand preparation — ensure even mixing and mulling
3. Add or clear vent channels in cope and drag
4. Reduce clay content if excessive; ensure proper mulling time
5. Clean returns sand to remove excess fines and contaminants
6. Switch to low-gas core binders where possible
7. Extend mould and core drying time before assembly',
 '1. Implement automated sand moisture monitoring
2. Establish sand preparation SOP with regular testing
3. Routine vent inspection before every pour
4. Control returns sand quality with screening and cooling
5. Train moulders on proper sand preparation and venting
6. Use cores with gas-evolution-resistant binders',
 'Blow holes are almost always a sand preparation or venting issue. Implementing automated moisture control and mandatory vent inspection before each pour can virtually eliminate this defect.',
 'Critical: Large blow holes causing rejection of entire casting. Major: Multiple blow holes affecting surface integrity. Minor: Small isolated blow holes acceptable if not in critical areas.',
 'porosity, sand_inclusion'),

('sand_inclusion',
 '1. Erosion of mould or core surface during metal pour
2. Low mould or core strength — insufficient compaction
3. Turbulent metal flow cutting into mould walls
4. Poor mould coating or no coating applied
5. Inadequate sand-to-metal ratio in critical areas
6. Core shift or movement during pour
7. Excessive metal velocity through gates',
 '1. Visual inspection — sand particles embedded in casting surface
2. Penetrant testing for surface-connected inclusions
3. Examine mould after knockout for erosion patterns
4. Check core hardness and strength
5. Review gating design for metal velocity',
 '1. Increase mould and core compaction/strength
2. Apply proper mould coating (zircon or graphite-based)
3. Redesign gating to reduce metal velocity — enlarge gates
4. Improve sand-to-metal ratio in eroded areas
5. Secure cores with proper prints and chaplets
6. Reduce pouring height to minimize turbulence
7. Use harder sand in areas prone to erosion',
 '1. Standardize mould compaction procedures and testing
2. Apply mould coating as mandatory step
3. Design gating systems for metal velocity below 0.5 m/s
4. Regular core strength testing
5. Use core prints and chaplets to prevent core movement
6. Sand-to-metal ratio minimum 3:1 in critical areas',
 'Sand inclusions are the third most common foundry defect. Proper mould coating application and gating velocity control are the two most effective preventive measures.',
 'Critical: Deep sand inclusions compromising structural integrity. Major: Surface sand inclusions requiring weld repair. Minor: Superficial sand particles removed by cleaning.',
 'blow_hole, surface_defect'),

('crack',
 '1. Hot tearing — excessive restraint during solidification contraction
2. Cold cracking — residual stresses from uneven cooling
3. Sharp internal corners or inadequate fillet radii
4. Rapid cooling from mould material (e.g., green sand vs chemically bonded)
5. Poor alloy composition — high sulfur or phosphorus
6. Inadequate stress relief heat treatment
7. Machining stresses revealing pre-existing cracks
8. Excessive section thickness differences causing differential cooling',
 '1. Visual inspection — look for linear discontinuities
2. Dye penetrant inspection (DPI) for fine surface cracks
3. Magnetic particle inspection (MPI) for ferrous castings
4. Ultrasonic testing for subsurface cracks
5. Metallurgical examination to determine crack origin (hot vs cold)',
 '1. Increase fillet radii to minimum 6mm at all junctions
2. Add mold coating to reduce friction during contraction
3. Improve mould yield — allow more contraction before solidification
4. Modify alloy composition — reduce sulfur and phosphorus
5. Implement stress relief heat treatment before machining
6. Use chills to control cooling rate in thick sections
7. Redesign casting to minimize section thickness variations
8. Preheat mould or use insulating materials to slow cooling',
 '1. Minimum 6mm fillet radius at all internal corners — design rule
2. Standardize stress relief heat treatment for crack-prone alloys
3. Control alloy chemistry — S < 0.06%, P < 0.05%
4. Use computer simulation to identify hotspot stress concentration areas
5. Implement first-article inspection with DPI for new parts',
 'Hot tears are the most common crack type in foundries. They always occur at junctions or fillets. Increasing fillet radius is the single most effective corrective action.',
 'Critical: Through-thickness crack causing part rejection. Major: Surface crack requiring weld repair. Minor: Hairline crack not propagating under service loads.',
 'shrinkage, surface_defect, dimensional_shift'),

('corrosion',
 '1. Contaminated shot blast media (moisture, oil, or foreign particles)
2. Inadequate cleaning after machining or heat treatment
3. Moisture ingress during storage (high humidity environment)
4. Inadequate protective coating or packaging
5. Galvanic corrosion from contact with dissimilar metals
6. Improper alloy composition — low chromium or nickel in stainless grades
7. Environmental exposure to chlorides or acids',
 '1. Visual inspection — pitting, discoloration, or rust staining
2. Surface roughness measurement
3. Chemical analysis of corrosion products
4. Check storage environment humidity levels
5. Examine shot blast media for contamination
6. Review alloy chemistry certificate',
 '1. Replace contaminated shot blast media immediately
2. Improve post-machining cleaning — degrease and dry thoroughly
3. Control storage environment — maintain humidity below 60% RH
4. Apply VCI (Vapor Corrosion Inhibitor) packaging or oil coating
5. Separate castings from dissimilar metals in storage
6. Verify alloy composition meets specification
7. Apply protective coating if required by specification',
 '1. Regular shot blast media inspection and replacement schedule
2. Standardize post-process cleaning and drying procedures
3. Climate-controlled storage for finished castings
4. VCI packaging for long-term storage
5. Material segregation to prevent galvanic corrosion
6. Incoming alloy chemistry verification',
 'Corrosion on castings is almost always a post-processing or storage issue, not a casting defect. Check shot blast media condition first — contaminated media is the most common cause.',
 'Critical: Deep pitting compromising wall thickness. Major: Surface corrosion requiring grinding or coating. Minor: Light discoloration removed by cleaning.',
 'surface_defect, blow_hole'),

('misrun',
 '1. Pouring temperature too low — metal freezes before filling mould
2. Inadequate gating system — insufficient flow rate
3. Thin section too thin for metal fluidity at given temperature
4. Mould temperature too cold — rapid chilling of metal front
5. Premature solidification due to high cooling rate
6. Interruption during pour (two-stage pour with cold lap)
7. Excessive metal oxidation forming skin that blocks flow',
 '1. Visual inspection — incomplete fill pattern, missing sections
2. Measure actual pour temperature with calibrated pyrometer
3. Check gating system dimensions and ratios
4. Examine mould temperature before pour
5. Review pour video for interruption or hesitation',
 '1. Increase pouring temperature to alloy specification minimum
2. Redesign gating — increase gate area, use multiple ingates
3. Preheat mould to 150-200C for thin-section castings
4. Increase section thickness where possible (consult customer)
5. Ensure continuous pour without interruption
6. Use ceramic filters to reduce oxide formation
7. Add padding to thin sections that fill last',
 '1. Calibrate pyrometers weekly
2. Standardize pouring temperature ranges by alloy type
3. Use solidification simulation to verify fill patterns before production
4. Preheat moulds for thin-wall or complex castings
5. Train pourers on continuous pour technique
6. Maintain ladles with proper insulation',
 'Misruns are always a temperature or flow issue. The first check should always be the actual pour temperature with a calibrated pyrometer — never rely on furnace temperature alone.',
 'Critical: Complete failure to fill critical section. Major: Partial fill requiring rework or scrap. Minor: Minor unfilled detail not affecting function.',
 'shrinkage, blow_hole'),

('surface_defect',
 '1. Burn-on or metal penetration into sand mould
2. Scabs — sand flakes adhering to casting surface
3. Veining — cracks in core showing as raised lines on casting
4. Rough surface from coarse sand or poor mould finish
5. Cold shut — two metal fronts meeting without fusion
6. Rat tails — thermal expansion marks in thin sections
7. Dimensional inaccuracy from pattern wear or mould shift',
 '1. Visual inspection — examine surface texture, adherence, discoloration
2. Surface roughness measurement (Ra or Rz)
3. Compare against surface finish specification
4. Examine mould surface condition after knockout
5. Check pattern dimensions for wear',
 '1. Apply proper mould coating to prevent burn-on and penetration
2. Improve sand fineness (AFS fineness number) for better surface finish
3. Increase compaction in areas showing rough surface
4. Preheat cores to reduce thermal shock and veining
5. Redesign gating to avoid cold shut formation
6. Repair or replace worn patterns
7. Improve mould closing accuracy to prevent shift',
 '1. Standardize sand fineness by casting surface requirement
2. Mandatory mould coating application
3. Regular pattern inspection and maintenance schedule
4. Control mould closing pressure and alignment
5. Preheat cores before assembly
6. Use finer facing sand in critical surface areas',
 'Surface defects are a broad category. The most common cause is inadequate mould coating or coarse sand. Always check coating application first.',
 'Critical: Surface defect requiring weld repair or causing rejection. Major: Defect affecting appearance or requiring machining allowance. Minor: Minor surface imperfection acceptable after cleaning.',
 'sand_inclusion, porosity, crack'),

('hard_spot',
 '1. Localized chill effect from dense mould sand or metallic inclusions
2. Internal chills not removed properly
3. Excessive chilling from core material
4. Metallic inclusions or foreign particles in mould
5. Uneven cooling rate causing localized hard zones
6. Improper heat treatment — inadequate austenitizing or tempering',
 '1. Hardness testing (Brinell or Rockwell) in suspected areas
2. Metallographic examination for microstructure variation
3. Ultrasonic testing for inclusions
4. Examine mould material density and composition
5. Review heat treatment records',
 '1. Remove or relocate internal chills causing localized hardening
2. Improve sand uniformity to avoid dense sand pockets
3. Screen returns sand to remove metallic inclusions
4. Adjust heat treatment parameters for uniform hardness
5. Use ceramic chills instead of metallic where possible
6. Implement controlled cooling after heat treatment',
 '1. Regular hardness testing at multiple locations
2. Screen returns sand with magnetic separator
3. Standardize heat treatment parameters by alloy and section size
4. Use non-metallic chills in critical areas
5. Maintain consistent mould compaction procedures',
 'Hard spots are often caused by internal chills that were not removed or by metallic inclusions in the mould. Magnetic separation of returns sand is an effective preventive measure.',
 'Critical: Hard spot in machining area causing tool breakage. Major: Localized hardness affecting wear resistance unevenly. Minor: Minor hardness variation acceptable.',
 'sand_inclusion, crack'),

('dimensional_shift',
 '1. Pattern wear or dimensional inaccuracy
2. Mould shift during closing or clamping
3. Uneven sand compaction causing distortion
4. Differential cooling causing warping
5. Core movement during pour
6. Inadequate machining allowance
7. Stress relief distortion after heat treatment',
 '1. Dimensional inspection — CMM or gauges
2. Compare casting dimensions against pattern dimensions
3. Check mould closing alignment and clamping pressure
4. Examine sand hardness uniformity across mould
5. Review heat treatment cycle for distortion',
 '1. Repair or replace worn patterns
2. Improve mould closing alignment fixtures
3. Ensure uniform sand compaction
4. Add machining allowance for warping-prone castings
5. Use conformable chills or padding to control distortion
6. Redesign gating for symmetrical fill to reduce warping
7. Implement fixture-controlled stress relief heat treatment',
 '1. Regular pattern dimensional verification
2. Standardized mould closing procedure with alignment checks
3. Uniform sand compaction testing
4. Allow adequate machining stock (minimum 3mm per side)
5. Use heat treatment fixtures to prevent distortion
6. Computer simulation for distortion prediction',
 'Dimensional shift is often cumulative — small pattern wear plus mould shift plus warping adds up. Address pattern accuracy first, then mould closing, then cooling/warping.',
 'Critical: Dimension out of tolerance requiring scrap. Major: Dimension requiring extensive rework. Minor: Within machining allowance.',
 'shrinkage, crack, surface_defect')

ON CONFLICT (defect_type) DO NOTHING;

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
