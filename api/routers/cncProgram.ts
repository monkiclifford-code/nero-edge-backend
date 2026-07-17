import { z } from "zod";
import { createRouter, publicQuery } from "../middleware";
import { getDb } from "../queries/connection";
import { cncPrograms, ncr } from "@db/schema";
import { eq, desc, sql } from "drizzle-orm";

// ===== G-CODE TEMPLATES =====

const TEMPLATES: Record<string, string> = {
  facing: `%
O1001 (FACING OPERATION)
(TOOL: {TOOL} - FACE MILL)
G54 G90 G40 G80
G28 U0 W0
T{TOOL} M6
G50 S{MAX_SPEED}
G96 S{SPEED} M3
G0 X{START_X} Z0.5 M8
G1 Z0 F{FEED}
G1 X{END_X} F{FEED}
G0 Z0.5
G28 U0 W0 M9
M30
%`,

  od_turning: `%
O1002 (OD TURNING)
(TOOL: {TOOL} - OD TURNING TOOL)
G54 G90 G40 G80
G28 U0 W0
T{TOOL} M6
G50 S{MAX_SPEED}
G96 S{SPEED} M3
G0 X{START_DIA} Z0.2 M8
G1 Z0 F{FEED}
G1 X{FINISH_DIA} F{FEED}
G0 X{START_DIA} Z0.2
G28 U0 W0 M9
M30
%`,

  id_turning: `%
O1003 (ID TURNING / BORING)
(TOOL: {TOOL} - BORING BAR)
G54 G90 G40 G80
G28 U0 W0
T{TOOL} M6
G50 S{MAX_SPEED}
G96 S{SPEED} M3
G0 X{START_DIA} Z0.2 M8
G1 Z-{LENGTH} F{FEED}
G1 X{FINISH_DIA} F{FEED}
G0 X{START_DIA} Z0.2
G28 U0 W0 M9
M30
%`,

  drilling: `%
O1004 (DRILLING CYCLE)
(TOOL: {TOOL} - DRILL)
G54 G90 G40 G80
G28 U0 W0
T{TOOL} M6
G97 S{SPEED} M3
G0 X0 Z0.2 M8
G83 Z-{DEPTH} R0.2 Q{PECK} F{FEED}
G80
G0 Z0.2
G28 U0 W0 M9
M30
%`,
};

// Safe ranges
const SAFE_FEED_MIN = 0.05;
const SAFE_FEED_MAX = 2.0;
const SAFE_SPEED_MIN = 100;
const SAFE_SPEED_MAX = 5000;

// Material-based recommendations (SFM and feed per rev)
const MATERIAL_SPECS: Record<string, { sfm: number; feed: number; note: string }> = {
  "AL-6061": { sfm: 800, feed: 0.15, note: "High speed, sharp tools" },
  "AL-7075": { sfm: 600, feed: 0.12, note: "Watch for built-up edge" },
  "SS-303": { sfm: 200, feed: 0.08, note: "Use coolant, slow peck" },
  "SS-316": { sfm: 120, feed: 0.06, note: "Work hardens — constant feed" },
  "TI-64": { sfm: 80, feed: 0.05, note: "Low speed, rigid setup" },
  "IN-718": { sfm: 50, feed: 0.04, note: "High heat — flood coolant" },
  "MS-360": { sfm: 400, feed: 0.12, note: "Stringy chips — use chip breaker" },
  "ST-1018": { sfm: 350, feed: 0.10, note: "General purpose mild steel" },
};

function generateGCode(type: string, params: {
  diameter: number;
  length: number;
  tool: string;
  feed: number;
  speed: number;
}): string {
  const template = TEMPLATES[type];
  if (!template) throw new Error("Unknown program type");

  const { diameter, length, tool, feed, speed } = params;

  // Convert RPM to surface speed for turning (SFM = RPM * PI * D / 12)
  const maxSpeed = Math.round(speed * 1.2);

  let code = template;

  code = code.replace(/{TOOL}/g, tool);
  code = code.replace(/{FEED}/g, feed.toFixed(4));
  code = code.replace(/{SPEED}/g, speed.toString());
  code = code.replace(/{MAX_SPEED}/g, maxSpeed.toString());

  if (type === "facing") {
    code = code.replace(/{START_X}/g, (diameter + 2).toFixed(2));
    code = code.replace(/{END_X}/g, "0");
  }

  if (type === "od_turning") {
    code = code.replace(/{START_DIA}/g, (diameter + 0.5).toFixed(4));
    code = code.replace(/{FINISH_DIA}/g, diameter.toFixed(4));
  }

  if (type === "id_turning") {
    code = code.replace(/{START_DIA}/g, (diameter - 0.5).toFixed(4));
    code = code.replace(/{FINISH_DIA}/g, diameter.toFixed(4));
    code = code.replace(/{LENGTH}/g, length.toFixed(4));
  }

  if (type === "drilling") {
    code = code.replace(/{DEPTH}/g, length.toFixed(4));
    code = code.replace(/{PECK}/g, (length / 4).toFixed(4));
  }

  return code;
}

function getAiSuggestion(material: string, operation: string) {
  const specs = MATERIAL_SPECS[material];
  if (!specs) return null;

  // Adjust based on operation type
  let feed = specs.feed;
  let speed = specs.sfm;

  if (operation === "drilling") {
    feed *= 0.7;
    speed *= 0.8;
  } else if (operation === "id_turning") {
    feed *= 0.85;
    speed *= 0.9;
  }

  return {
    feed: parseFloat(feed.toFixed(4)),
    speed: Math.round(speed),
    note: specs.note,
  };
}

export const cncProgramRouter = createRouter({
  // Generate G-code (no DB save)
  generate: publicQuery
    .input(
      z.object({
        programType: z.enum(["facing", "od_turning", "id_turning", "drilling"]),
        diameter: z.number().positive().max(500),
        length: z.number().positive().max(1000),
        material: z.string().min(1),
        tool: z.string().min(1).max(10),
        feed: z.number().min(SAFE_FEED_MIN).max(SAFE_FEED_MAX),
        speed: z.number().min(SAFE_SPEED_MIN).max(SAFE_SPEED_MAX),
      })
    )
    .mutation(async ({ input }) => {
      // Additional safety check
      if (input.diameter <= 0 || input.length <= 0) {
        throw new Error("Diameter and Length must be greater than 0");
      }
      if (input.feed < SAFE_FEED_MIN || input.feed > SAFE_FEED_MAX) {
        throw new Error(`Feed must be between ${SAFE_FEED_MIN} and ${SAFE_FEED_MAX}`);
      }
      if (input.speed < SAFE_SPEED_MIN || input.speed > SAFE_SPEED_MAX) {
        throw new Error(`Speed must be between ${SAFE_SPEED_MIN} and ${SAFE_SPEED_MAX}`);
      }

      const gcode = generateGCode(input.programType, {
        diameter: input.diameter,
        length: input.length,
        tool: input.tool,
        feed: input.feed,
        speed: input.speed,
      });

      // Get AI suggestion
      const suggestion = getAiSuggestion(input.material, input.programType);

      // Check NCR history for tool warnings
      let toolWarning: string | null = null;
      if (input.material) {
        const db = getDb();
        const ncrCount = await db
          .select({ count: sql<number>`COUNT(*)` })
          .from(ncr)
          .where(sql`${ncr.rootCause} LIKE '%tool%' AND ${ncr.createdAt} > DATE_SUB(NOW(), INTERVAL 30 DAY)`);
        if (Number(ncrCount[0]?.count ?? 0) > 0) {
          toolWarning = `${ncrCount[0]?.count} recent NCRs mention tool issues. Check tool condition before running.`;
        }
      }

      return {
        gcode,
        suggestion,
        toolWarning,
        safe: true,
      };
    }),

  // Save generated program
  save: publicQuery
    .input(
      z.object({
        operatorId: z.number().positive(),
        jobId: z.number().positive().optional(),
        programType: z.enum(["facing", "od_turning", "id_turning", "drilling"]),
        parameters: z.string().min(1), // JSON
        gcodeText: z.string().min(1),
      })
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const insertResult = await db
        .insert(cncPrograms)
        .values({
          operatorId: input.operatorId,
          jobId: input.jobId ?? null,
          programType: input.programType,
          parameters: input.parameters,
          gcodeText: input.gcodeText,
        });

      const insertedId = insertResult[0]?.insertId;
      return { success: true, programId: Number(insertedId) };
    }),

  // List saved programs
  list: publicQuery
    .input(z.object({ operatorId: z.number().positive() }).optional())
    .query(async ({ input }) => {
      const db = getDb();
      if (input?.operatorId) {
        return db
          .select()
          .from(cncPrograms)
          .where(eq(cncPrograms.operatorId, input.operatorId))
          .orderBy(desc(cncPrograms.createdAt));
      }
      return db.select().from(cncPrograms).orderBy(desc(cncPrograms.createdAt));
    }),

  // Get AI suggestion only
  getAiSuggestion: publicQuery
    .input(
      z.object({
        material: z.string().min(1),
        operation: z.enum(["facing", "od_turning", "id_turning", "drilling"]),
      })
    )
    .query(({ input }) => {
      const result = getAiSuggestion(input.material, input.operation);
      return result;
    }),
});
