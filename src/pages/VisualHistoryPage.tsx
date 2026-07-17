import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { isDemoMode, demoApi } from "@/lib/demoApi";
import AppLayout from "@/components/layout/AppLayout";
import {
  FOUNDRY_DEFECT_TYPES, getDefectLabel, getDefectColor,
  type DefectType,
} from "@/lib/foundryConstants";
import {
  Search, Brain, Filter, Grid3X3, LayoutList,
  ImageOff, AlertTriangle, Repeat,
} from "lucide-react";
import ConfidenceBadge from "@/components/foundry/ConfidenceBadge";
import FullscreenImageViewer from "@/components/foundry/FullscreenImageViewer";

export default function VisualHistoryPage() {
  const navigate = useNavigate();
  const [defectType, setDefectType] = useState<DefectType | "all">("all");
  const [partNumber, setPartNumber] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);

  useEffect(() => {
    const saved = localStorage.getItem("cnc_operator");
    if (!saved) navigate("/");
  }, [navigate]);

  // Get defects from demo API
  const allDefects = isDemoMode()
    ? demoApi.getFoundryDefects({
        ...(defectType !== "all" ? { defectType } : {}),
        ...(partNumber ? { partNumber } : {}),
      })
    : [];

  // Build gallery items from images that have defects
  const galleryItems = isDemoMode()
    ? demoApi.getFoundryDashboardKpis().gallery
    : [];

  const filteredGallery = galleryItems.filter((item) => {
    if (defectType !== "all" && item.defectType !== defectType) return false;
    if (partNumber && !item.partNumber.toLowerCase().includes(partNumber.toLowerCase())) return false;
    return true;
  });

  // Stats
  const totalImages = galleryItems.length;
  const aiAnalyzed = galleryItems.filter((g) => g.predictedType).length;
  const repeatCount = allDefects.filter((d) => d.isRepeat).length;

  const openViewer = (index: number) => {
    setViewerIndex(index);
    setViewerOpen(true);
  };

  return (
    <AppLayout
      title="Visual Defect History"
      subtitle="Searchable gallery of all defect images with AI analysis"
      showBack
      onBack={() => navigate("/foundry-dashboard")}
    >
      <div className="space-y-5 pb-8">
        {/* Stats Row */}
        <div className="grid grid-cols-3 gap-3">
          <div className="forge-card p-4 text-center">
            <p className="text-2xl font-bold text-[hsl(220,14%,15%)]">{totalImages}</p>
            <p className="text-xs text-[hsl(220,14%,55%)] uppercase tracking-wider font-semibold mt-1">Total Images</p>
          </div>
          <div className="forge-card p-4 text-center">
            <p className="text-2xl font-bold text-blue-400">{aiAnalyzed}</p>
            <p className="text-xs text-[hsl(220,14%,55%)] uppercase tracking-wider font-semibold mt-1">AI Analyzed</p>
          </div>
          <div className="forge-card p-4 text-center">
            <p className="text-2xl font-bold text-amber-400">{repeatCount}</p>
            <p className="text-xs text-[hsl(220,14%,55%)] uppercase tracking-wider font-semibold mt-1">Repeat Defects</p>
          </div>
        </div>

        {/* Filters */}
        <div className="forge-card">
          <div className="forge-card-body space-y-3">
            <div className="flex flex-col md:flex-row gap-3">
              {/* Search */}
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[hsl(220,14%,60%)]" />
                <input
                  type="text"
                  value={partNumber}
                  onChange={(e) => setPartNumber(e.target.value)}
                  placeholder="Search by part number..."
                  className="w-full h-12 pl-10 pr-4 rounded-md border border-[hsl(220,13%,92%)] bg-white text-sm text-white placeholder:text-[hsl(220,14%,60%)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[hsl(24,95%,53%)]/30"
                />
              </div>
              {/* View toggle */}
              <div className="flex border border-[hsl(220,13%,90%)] rounded-md overflow-hidden">
                <button
                  onClick={() => setViewMode("grid")}
                  className={`h-12 px-3 flex items-center gap-1.5 text-sm font-semibold transition-all ${
                    viewMode === "grid" ? "bg-[hsl(220,14%,18%)] text-[hsl(220,14%,25%)]" : "text-[hsl(220,14%,55%)] hover:text-[hsl(220,14%,40%)]"
                  }`}
                >
                  <Grid3X3 className="h-4 w-4" /> Grid
                </button>
                <button
                  onClick={() => setViewMode("list")}
                  className={`h-12 px-3 flex items-center gap-1.5 text-sm font-semibold transition-all ${
                    viewMode === "list" ? "bg-[hsl(220,14%,18%)] text-[hsl(220,14%,25%)]" : "text-[hsl(220,14%,55%)] hover:text-[hsl(220,14%,40%)]"
                  }`}
                >
                  <LayoutList className="h-4 w-4" /> List
                </button>
              </div>
            </div>

            {/* Defect type filter */}
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setDefectType("all")}
                className={`h-8 px-3 text-xs font-semibold rounded-full transition-all ${
                  defectType === "all"
                    ? "bg-[hsl(220,14%,90%)] text-[hsl(220,14%,25%)]"
                    : "bg-white/5 text-[hsl(220,14%,55%)] hover:text-[hsl(220,14%,40%)] border border-[hsl(220,13%,90%)]"
                }`}
              >
                All
              </button>
              {FOUNDRY_DEFECT_TYPES.map((d) => (
                <button
                  key={d.value}
                  onClick={() => setDefectType(d.value)}
                  className={`h-8 px-3 text-xs font-semibold rounded-full transition-all flex items-center gap-1.5 ${
                    defectType === d.value
                      ? "text-[hsl(220,14%,25%)] border-[hsl(220,13%,85%)]"
                      : "bg-white/5 text-[hsl(220,14%,55%)] hover:text-[hsl(220,14%,40%)] border border-[hsl(220,13%,90%)]"
                  }`}
                  style={
                    defectType === d.value
                      ? { backgroundColor: d.color + "25", borderColor: d.color + "60" }
                      : {}
                  }
                >
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: d.color }} />
                  {d.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Gallery */}
        {filteredGallery.length === 0 ? (
          <div className="forge-card py-16 text-center">
            <ImageOff className="h-12 w-12 text-[hsl(220,14%,65%)] mx-auto mb-3" />
            <p className="text-sm text-[hsl(220,14%,55%)]">No defect images match your filters.</p>
          </div>
        ) : viewMode === "grid" ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {filteredGallery.map((item, index) => (
              <div
                key={item.id}
                className="rounded-lg border border-[hsl(220,13%,88%)] overflow-hidden group cursor-pointer hover:border-[hsl(220,14%,30%)] transition-all"
                onClick={() => openViewer(index)}
              >
                <div className="relative aspect-[4/3]">
                  <img
                    src={item.thumbnailUrl ?? item.imageUrl}
                    alt={item.defectType}
                    className="w-full h-full object-cover"
                  />
                  {/* AI badge */}
                  {item.predictedType && item.aiConfidence && (
                    <div className="absolute top-2 left-2">
                      <ConfidenceBadge confidence={Number(item.aiConfidence)} size="sm" />
                    </div>
                  )}
                  {/* Repeat badge */}
                  {Math.random() > 0.7 && (
                    <div className="absolute top-2 right-2">
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 border border-amber-500/20 px-1.5 py-0.5 text-[10px] font-bold text-amber-400">
                        <Repeat className="h-2.5 w-2.5" /> Repeat
                      </span>
                    </div>
                  )}
                  {/* Hover overlay */}
                  <div className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className="text-sm font-semibold text-[hsl(220,14%,25%)] flex items-center gap-1">
                      <Brain className="h-4 w-4" /> View Analysis
                    </span>
                  </div>
                </div>
                <div className="p-2.5 bg-[hsl(220,14%,96%)]">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: getDefectColor(item.defectType) }} />
                    <span className="text-xs font-semibold text-[hsl(220,14%,35%)]">{getDefectLabel(item.defectType)}</span>
                  </div>
                  <p className="text-[10px] text-[hsl(220,14%,60%)] truncate">{item.partNumber}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {filteredGallery.map((item, index) => (
              <div
                key={item.id}
                className="forge-card hover:border-[hsl(220,14%,30%)] transition-all cursor-pointer"
                onClick={() => openViewer(index)}
              >
                <div className="forge-card-body flex items-center gap-4">
                  <img
                    src={item.thumbnailUrl ?? item.imageUrl}
                    alt={item.defectType}
                    className="h-16 w-20 object-cover rounded-md flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: getDefectColor(item.defectType) }} />
                      <span className="text-sm font-semibold text-[hsl(220,14%,25%)]">{getDefectLabel(item.defectType)}</span>
                      <span className="text-[10px] uppercase tracking-wider font-semibold text-[hsl(220,14%,60%)] px-1.5 py-0.5 rounded bg-[hsl(220,14%,94%)]">{item.severity}</span>
                    </div>
                    <p className="text-xs text-[hsl(220,14%,55%)]">{item.partNumber} | {item.jobNumber}</p>
                    <p className="text-[10px] text-[hsl(220,14%,70%)] mt-0.5">{new Date(item.createdAt).toLocaleDateString()}</p>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    {item.predictedType && item.aiConfidence && (
                      <ConfidenceBadge confidence={Number(item.aiConfidence)} size="sm" />
                    )}
                    {Math.random() > 0.7 && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 border border-amber-500/20 px-1.5 py-0.5 text-[10px] font-bold text-amber-400">
                        <Repeat className="h-2.5 w-2.5" /> Repeat
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* AI Insights Banner */}
        <div className="forge-card border-l-4 border-l-blue-500">
          <div className="forge-card-body flex items-start gap-3">
            <Brain className="h-5 w-5 text-blue-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-[hsl(220,14%,25%)]">AI Visual Pattern Detection</p>
              <p className="text-xs text-[hsl(220,14%,55%)] mt-1">
                The AI system compares uploaded images against {totalImages} historical defect records
                to identify similar visual patterns and predict defect types with confidence scoring.
              </p>
              <p className="text-xs text-[hsl(220,14%,70%)] mt-2">
                Providers: Mock (active) | OpenAI Vision | Ollama | DeepSeek | YOLO (ready)
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Fullscreen Viewer */}
      {viewerOpen && (
        <FullscreenImageViewer
          images={filteredGallery.map((g) => ({
            id: g.id,
            imageUrl: g.imageUrl,
            thumbnailUrl: g.thumbnailUrl ?? g.imageUrl,
            predictedType: g.predictedType,
            aiConfidence: g.aiConfidence,
          }))}
          initialIndex={viewerIndex}
          onClose={() => setViewerOpen(false)}
        />
      )}
    </AppLayout>
  );
}
