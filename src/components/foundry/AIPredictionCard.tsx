import { Brain, Clock, Zap, AlertTriangle, CheckCircle2 } from "lucide-react";
import { getDefectLabel } from "@/lib/foundryConstants";

interface Prediction {
  defectType: string;
  confidence: number;
  label?: string;
}

interface AIPredictionCardProps {
  predictions: Prediction[];
  topPrediction: Prediction | null;
  processingTimeMs?: number;
  provider?: string;
  status?: "pending" | "processing" | "completed" | "failed";
  errorMessage?: string | null;
}

export default function AIPredictionCard({
  predictions,
  topPrediction,
  processingTimeMs,
  provider = "mock",
  status = "completed",
  errorMessage,
}: AIPredictionCardProps) {
  if (status === "failed") {
    return (
      <div className="forge-card border-l-4 border-l-rose-500">
        <div className="forge-card-body flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-rose-400 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-rose-300">AI Analysis Failed</p>
            <p className="text-xs text-white/40">{errorMessage ?? "Unknown error"}</p>
          </div>
        </div>
      </div>
    );
  }

  if (status === "pending" || status === "processing") {
    return (
      <div className="forge-card">
        <div className="forge-card-body flex items-center gap-3 py-4">
          <div className="relative">
            <Brain className="h-6 w-6 text-blue-400 animate-pulse" />
            <div className="absolute inset-0 h-6 w-6 rounded-full bg-blue-400/20 animate-ping" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white/70">Analyzing image with AI...</p>
            <p className="text-xs text-white/40">Provider: {provider}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="forge-card border-l-4 border-l-blue-500">
      <div className="forge-card-body space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-blue-400" />
            <h3 className="text-sm font-bold text-white/80">AI Visual Analysis</h3>
          </div>
          <div className="flex items-center gap-2 text-xs text-white/30">
            {processingTimeMs && (
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {processingTimeMs}ms
              </span>
            )}
            <span className="flex items-center gap-1 capitalize">
              <Zap className="h-3 w-3" />
              {provider}
            </span>
          </div>
        </div>

        {/* Top Prediction */}
        {topPrediction && (
          <div className={`rounded-lg border p-3 ${
            topPrediction.confidence >= 80
              ? "bg-emerald-950/30 border-emerald-500/20"
              : topPrediction.confidence >= 60
                ? "bg-amber-950/30 border-amber-500/20"
                : "bg-rose-950/30 border-rose-500/20"
          }`}>
            <div className="flex items-center gap-2 mb-1">
              {topPrediction.confidence >= 80 ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              ) : (
                <AlertTriangle className="h-4 w-4 text-amber-400" />
              )}
              <span className="text-xs font-semibold uppercase tracking-wider text-white/40">Primary Detection</span>
            </div>
            <p className="text-lg font-bold text-white/90">
              {getDefectLabel(topPrediction.defectType)}
            </p>
            <div className="mt-2 flex items-center gap-3">
              {/* Confidence bar */}
              <div className="flex-1 h-2 rounded-full bg-white/10 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    topPrediction.confidence >= 80
                      ? "bg-emerald-400"
                      : topPrediction.confidence >= 60
                        ? "bg-amber-400"
                        : "bg-rose-400"
                  }`}
                  style={{ width: `${topPrediction.confidence}%` }}
                />
              </div>
              <span className={`text-sm font-bold ${
                topPrediction.confidence >= 80
                  ? "text-emerald-400"
                  : topPrediction.confidence >= 60
                    ? "text-amber-400"
                    : "text-rose-400"
              }`}>
                {topPrediction.confidence}%
              </span>
            </div>
          </div>
        )}

        {/* All predictions */}
        {predictions.length > 1 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-white/40">All Predictions</p>
            {predictions.map((p, i) => (
              <div key={i} className="flex items-center gap-3 text-sm">
                <span className="text-white/50 w-6">{i + 1}.</span>
                <span className="text-white/70 flex-1">{getDefectLabel(p.defectType)}</span>
                <div className="w-20 h-1.5 rounded-full bg-white/10 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-blue-400/60"
                    style={{ width: `${p.confidence}%` }}
                  />
                </div>
                <span className="text-white/40 w-10 text-right text-xs">{p.confidence}%</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
