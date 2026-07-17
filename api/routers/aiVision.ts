import { z } from "zod";
import { createRouter, publicQuery } from "../middleware";
import { getDb } from "../queries/connection";
import {
  aiVisualPredictions, foundryNcrImages, foundryDefects,
  FOUNDRY_DEFECT_TYPES, AI_VISION_PROVIDERS,
} from "@db/schema";
import { eq, desc, and, sql, count } from "drizzle-orm";

// ═══════════════════════════════════════════════════════════
// PROVIDER-AGNOSTIC AI VISION ARCHITECTURE
// ═══════════════════════════════════════════════════════════

interface VisionPrediction {
  defectType: string;
  confidence: number;
  label: string;
}

interface VisionProviderResult {
  predictions: VisionPrediction[];
  topPrediction: VisionPrediction | null;
  processingTimeMs: number;
  provider: string;
  model: string;
}

/** Abstract provider interface — new providers implement this */
interface VisionProvider {
  name: string;
  analyze(imageUrl: string): Promise<VisionProviderResult>;
}

/** Mock/Demo Provider — deterministic simulated responses */
class MockVisionProvider implements VisionProvider {
  name = "mock";
  model = "forgeraceiq-vision-mock-v1";

  async analyze(imageUrl: string): Promise<VisionProviderResult> {
    const start = Date.now();

    // Deterministic mock based on imageUrl hash
    const hash = this.simpleHash(imageUrl);
    const defectTypes = FOUNDRY_DEFECT_TYPES.slice(0, -1); // exclude "other"
    const primaryIdx = hash % defectTypes.length;
    const secondaryIdx = (hash + 3) % defectTypes.length;

    const predictions: VisionPrediction[] = [
      {
        defectType: defectTypes[primaryIdx],
        confidence: 60 + (hash % 35),
        label: this.labelize(defectTypes[primaryIdx]),
      },
      {
        defectType: defectTypes[secondaryIdx],
        confidence: 10 + (hash % 20),
        label: this.labelize(defectTypes[secondaryIdx]),
      },
    ];

    const processingTimeMs = Date.now() - start;

    return {
      predictions,
      topPrediction: predictions[0],
      processingTimeMs,
      provider: this.name,
      model: this.model,
    };
  }

  private simpleHash(str: string): number {
    let h = 0;
    for (let i = 0; i < str.length; i++) h = ((h << 5) - h + str.charCodeAt(i)) >>> 0;
    return h;
  }

  private labelize(type: string): string {
    return type.split("_").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
  }
}

/** OpenAI Vision Provider (prepared, not implemented — API key required) */
class OpenAIVisionProvider implements VisionProvider {
  name = "openai";
  model = "gpt-4o";
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async analyze(imageUrl: string): Promise<VisionProviderResult> {
    // TODO: Implement OpenAI vision API call
    // See: https://platform.openai.com/docs/guides/vision
    throw new Error("OpenAI Vision not yet configured. Set OPENAI_API_KEY env var.");
  }
}

/** Ollama Local Vision Provider (prepared) */
class OllamaVisionProvider implements VisionProvider {
  name = "ollama";
  model = "llava";
  private baseUrl: string;

  constructor(baseUrl = "http://localhost:11434") {
    this.baseUrl = baseUrl;
  }

  async analyze(imageUrl: string): Promise<VisionProviderResult> {
    // TODO: Implement Ollama vision call
    // See: ollama.com/blog/vision-models
    throw new Error("Ollama Vision not yet configured. Ensure Ollama is running locally.");
  }
}

/** Provider Registry — add new providers here */
function getProvider(providerName: string): VisionProvider {
  switch (providerName) {
    case "openai":
      return new OpenAIVisionProvider(process.env.OPENAI_API_KEY ?? "");
    case "ollama":
      return new OllamaVisionProvider(process.env.OLLAMA_BASE_URL);
    case "deepseek":
      // DeepSeek vision uses OpenAI-compatible API
      return new OpenAIVisionProvider(process.env.DEEPSEEK_API_KEY ?? "");
    case "yolo_local":
    default:
      return new MockVisionProvider();
  }
}

// ═══════════════════════════════════════════════════════════
// tRPC ROUTER
// ═══════════════════════════════════════════════════════════

export const aiVisionRouter = createRouter({
  // ─── Analyze Image ───
  analyze: publicQuery
    .input(
      z.object({
        imageUrl: z.string().min(1),
        imageId: z.number().positive(),
        provider: z.enum(AI_VISION_PROVIDERS).default("mock"),
      })
    )
    .mutation(async ({ input }) => {
      const db = getDb();

      // Create pending prediction record
      const pendingResult = await db.insert(aiVisualPredictions).values({
        imageId: input.imageId,
        provider: input.provider,
        status: "processing",
      });
      const predictionId = Number(pendingResult[0]?.insertId);

      try {
        const provider = getProvider(input.provider);
        const result = await provider.analyze(input.imageUrl);

        // Update prediction with results
        await db
          .update(aiVisualPredictions)
          .set({
            model: result.model,
            predictedDefectType: result.topPrediction?.defectType as any,
            confidence: result.topPrediction?.confidence.toString() ?? null,
            allPredictions: JSON.stringify(result.predictions),
            processingTimeMs: result.processingTimeMs,
            status: "completed",
          })
          .where(eq(aiVisualPredictions.id, predictionId));

        // If confidence is high enough, auto-create a defect record
        if (result.topPrediction && result.topPrediction.confidence >= 50) {
          // Get the NCR ID from the image
          const [img] = await db
            .select({ foundryNcrId: foundryNcrImages.foundryNcrId })
            .from(foundryNcrImages)
            .where(eq(foundryNcrImages.id, input.imageId));

          if (img) {
            // Check for repeat
            const existing = await db
              .select()
              .from(foundryDefects)
              .where(
                and(
                  eq(foundryDefects.defectType, result.topPrediction.defectType),
                  sql`${foundryDefects.createdAt} > DATE_SUB(NOW(), INTERVAL 30 DAY)`
                )
              )
              .orderBy(desc(foundryDefects.createdAt))
              .limit(1);

            const isRepeat = existing.length > 0;

            await db.insert(foundryDefects).values({
              foundryNcrId: img.foundryNcrId,
              partNumber: "unknown", // Will be updated from job
              defectType: result.topPrediction.defectType as any,
              confidence: result.topPrediction.confidence.toString(),
              aiPredicted: true,
              imageId: input.imageId,
              isRepeat,
              previousOccurrenceId: isRepeat ? existing[0].id : null,
            });
          }
        }

        return {
          success: true,
          predictionId,
          predictions: result.predictions,
          topPrediction: result.topPrediction,
          processingTimeMs: result.processingTimeMs,
        };
      } catch (error: any) {
        await db
          .update(aiVisualPredictions)
          .set({
            status: "failed",
            errorMessage: error.message ?? "Unknown error",
          })
          .where(eq(aiVisualPredictions.id, predictionId));

        throw new Error(`AI Vision analysis failed: ${error.message}`);
      }
    }),

  // ─── Get Predictions for Image ───
  getPredictions: publicQuery
    .input(z.object({ imageId: z.number().positive() }))
    .query(async ({ input }) => {
      const db = getDb();
      const results = await db
        .select()
        .from(aiVisualPredictions)
        .where(eq(aiVisualPredictions.imageId, input.imageId))
        .orderBy(desc(aiVisualPredictions.createdAt));
      return results;
    }),

  // ─── Find Similar Defects (Visual Pattern Matching) ───
  findSimilar: publicQuery
    .input(
      z.object({
        defectType: z.enum(FOUNDRY_DEFECT_TYPES),
        partNumber: z.string().optional(),
        limit: z.number().default(5),
      })
    )
    .query(async ({ input }) => {
      const db = getDb();
      const filters = [eq(foundryDefects.defectType, input.defectType)];
      if (input.partNumber) {
        filters.push(eq(foundryDefects.partNumber, input.partNumber));
      }

      const results = await db
        .select({
          id: foundryDefects.id,
          partNumber: foundryDefects.partNumber,
          defectType: foundryDefects.defectType,
          description: foundryDefects.description,
          location: foundryDefects.location,
          confidence: foundryDefects.confidence,
          createdAt: foundryDefects.createdAt,
          imageUrl: foundryNcrImages.imageUrl,
        })
        .from(foundryDefects)
        .leftJoin(foundryNcrImages, eq(foundryDefects.imageId, foundryNcrImages.id))
        .where(and(...filters))
        .orderBy(desc(foundryDefects.createdAt))
        .limit(input.limit);

      return results;
    }),

  // ─── Get AI Provider Status ───
  getProviderStatus: publicQuery.query(async () => {
    const providers = AI_VISION_PROVIDERS.map((p) => ({
      name: p,
      available: p === "mock", // Only mock is guaranteed available
      configured: p === "mock" || !!process.env.OPENAI_API_KEY || !!process.env.OLLAMA_BASE_URL,
    }));
    return providers;
  }),
});
