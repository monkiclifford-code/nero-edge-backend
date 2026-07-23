import { useState } from "react";
import { useNavigate } from "react-router";
import { trpc } from "@/providers/trpc";
import AppLayout from "@/components/layout/AppLayout";
import {
  FOUNDRY_DEFECT_TYPES, getDefectLabel, getDefectColor,
  type DefectType,
} from "@/lib/foundryConstants";
import {
  Search, Brain, Filter, Grid3X3, LayoutList,
  ImageOff, Clock, User, Package, FileText,
  RotateCcw, X, ChevronDown, ChevronUp,
} from "lucide-react";
import ConfidenceBadge from "@/components/foundry/ConfidenceBadge";
import FullscreenImageViewer from "@/components/foundry/FullscreenImageViewer";

export default function VisualHistoryPage() {
  const navigate = useNavigate();
  const [defectType, setDefectType] = useState<DefectType | "all">("all");
  const [partNumber, setPartNumber] = useState("");
  const [ncrNumber, setNcrNumber] = useState("");
  const [jobNumber, setJobNumber] = useState("");
  const [materialNumber, setMaterialNumber] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedNcr, setSelectedNcr] = useState<number | null>(null);

  // Fetch visual history from database
  const historyQuery = trpc.foundry.getVisualHistory.useQuery(
    {
      ...(partNumber ? { partNumber } : {}),
      ...(ncrNumber ? { ncrNumber } : {}),
      ...(jobNumber ? { jobNumber } : {}),
      ...(materialNumber ? { materialNumber } : {}),
      ...(defectType !== "all" ? { defectType } : {}),
      ...(dateFrom ? { dateFrom } : {}),
      ...(dateTo ? { dateTo } : {}),
      limit: 50,
    },
    { enabled: true }
  );

  const ncrDetail = trpc.foundry.getNcrById.useQuery(
    { id: selectedNcr! },
    { enabled: !!selectedNcr }
  );

  const images = historyQuery.data?.images ?? [];
  const total = historyQuery.data?.total ?? 0;
  const hasFilters = partNumber || ncrNumber || jobNumber || materialNumber || dateFrom || dateTo || defectType !== "all";

  const clearFilters = () => {
    setPartNumber(""); setNcrNumber(""); setJobNumber("");
    setMaterialNumber(""); setDateFrom(""); setDateTo("");
    setDefectType("all");
  };

  const openViewer = (index: number) => {
    setViewerIndex(index);
    setViewerOpen(true);
  };

  // ─── NCR DETAIL PANEL ───
  if (selectedNcr && ncrDetail.data) {
    const ncr = ncrDetail.data;
    return (
      <AppLayout
        title={`NCR #${ncr.id}`}
        subtitle={`${ncr.partNumber} | ${ncr.defectType?.replace(/_/g, " ")} | V${ncr.version}`}
        showBack
        onBack={() => setSelectedNcr(null)}
      >
        <div className="max-w-5xl mx-auto space-y-5 pb-8">
          {/* Header */}
          <div className={`forge-card border-l-4 ${ncr.approvalStatus === "approved" ? "border-l-emerald-500" : "border-l-amber-500"}`}>
            <div className="forge-card-body">
              <div className="flex items-center gap-2 mb-3 flex-wrap">
                <FileText className="h-4 w-4 text-blue-400" />
                <span className="text-sm font-bold text-white/80">NCR Detail</span>
                <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full">v{ncr.version}</span>
                {ncr.approvalStatus === "approved" ? (
                  <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full">Approved</span>
                ) : (
                  <span className="text-xs bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full">Pending Approval</span>
                )}
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div><p className="text-xs text-white/40 uppercase tracking-wider font-semibold">Job</p><p className="font-semibold text-white/80">{ncr.jobNumber}</p></div>
                <div><p className="text-xs text-white/40 uppercase tracking-wider font-semibold">Part</p><p className="font-semibold text-white/80">{ncr.partNumber}</p></div>
                <div><p className="text-xs text-white/40 uppercase tracking-wider font-semibold">Material</p><p className="font-semibold text-white/80">{ncr.materialNumber || "—"}</p></div>
                <div><p className="text-xs text-white/40 uppercase tracking-wider font-semibold">Revision</p><p className="font-semibold text-white/80">{ncr.revision || "—"}</p></div>
                <div><p className="text-xs text-white/40 uppercase tracking-wider font-semibold">Created By</p><p className="font-semibold text-white/80">{ncr.operatorName}</p></div>
                <div><p className="text-xs text-white/40 uppercase tracking-wider font-semibold">Date</p><p className="font-semibold text-white/80">{new Date(ncr.createdAt).toLocaleDateString()}</p></div>
                <div><p className="text-xs text-white/40 uppercase tracking-wider font-semibold">Severity</p><p className="font-semibold text-amber-400">{ncr.severity?.toUpperCase()}</p></div>
                <div><p className="text-xs text-white/40 uppercase tracking-wider font-semibold">Status</p><p className="font-semibold text-white/80">{ncr.status?.toUpperCase()}</p></div>
              </div>
            </div>
          </div>

          {/* Problem / Root Cause / Corrective Action */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="forge-card border-l-4 border-l-rose-500">
              <div className="forge-card-header"><h2 className="forge-card-title text-sm">Problem</h2></div>
              <div className="forge-card-body"><p className="text-sm text-white/70 whitespace-pre-wrap">{ncr.problemDescription}</p></div>
            </div>
            <div className="forge-card border-l-4 border-l-amber-500">
              <div className="forge-card-header"><h2 className="forge-card-title text-sm">Root Cause</h2></div>
              <div className="forge-card-body"><p className="text-sm text-white/70 whitespace-pre-wrap">{ncr.rootCause || <em className="text-white/20">Not specified</em>}</p></div>
            </div>
            <div className="forge-card border-l-4 border-l-emerald-500">
              <div className="forge-card-header"><h2 className="forge-card-title text-sm">Corrective Action</h2></div>
              <div className="forge-card-body"><p className="text-sm text-white/70 whitespace-pre-wrap">{ncr.correctiveAction || <em className="text-white/20">Not specified</em>}</p></div>
            </div>
          </div>

          {/* Scrap Cost */}
          {ncr.scrapQuantified && ncr.scrapCost && (
            <div className="forge-card border-l-4 border-l-rose-500">
              <div className="forge-card-body flex items-center gap-3">
                <div className="text-2xl font-bold text-rose-400">${Number(ncr.scrapCost).toLocaleString()}</div>
                <p className="text-sm text-white/40">Scrap Cost</p>
              </div>
            </div>
          )}

          {/* NCR Images */}
          {ncr.images && ncr.images.length > 0 && (
            <div className="forge-card">
              <div className="forge-card-header">
                <h2 className="forge-card-title">NCR Images ({ncr.images.length})</h2>
              </div>
              <div className="forge-card-body">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {ncr.images.map((img: any, idx: number) => (
                    <div key={img.id} className="rounded-lg overflow-hidden border border-[hsl(220,14%,16%)]">
                      <img src={img.imageUrl} alt={`NCR image ${idx + 1}`} className="w-full h-40 object-cover" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </AppLayout>
    );
  }

  // ─── GALLERY VIEW ───
  return (
    <AppLayout
      title="Visual Defect History"
      subtitle={`${total} defect image${total !== 1 ? "s" : ""} in quality memory`}
      showBack
      onBack={() => navigate("/foundry-dashboard")}
    >
      <div className="space-y-5 pb-8 max-w-6xl mx-auto">
        {/* Stats Row */}
        <div className="grid grid-cols-3 gap-3">
          <div className="forge-card p-4 text-center">
            <p className="text-2xl font-bold text-white/80">{total}</p>
            <p className="text-xs text-white/40 uppercase tracking-wider font-semibold mt-1">Total Images</p>
          </div>
          <div className="forge-card p-4 text-center">
            <p className="text-2xl font-bold text-blue-400">
              {images.filter(i => i.approvalStatus === "approved").length}
            </p>
            <p className="text-xs text-white/40 uppercase tracking-wider font-semibold mt-1">Approved</p>
          </div>
          <div className="forge-card p-4 text-center">
            <p className="text-2xl font-bold text-amber-400">
              {new Set(images.map(i => i.partNumber)).size}
            </p>
            <p className="text-xs text-white/40 uppercase tracking-wider font-semibold mt-1">Parts Tracked</p>
          </div>
        </div>

        {/* Search & Filters */}
        <div className="forge-card">
          <div className="forge-card-body space-y-3">
            {/* Main search row */}
            <div className="flex flex-col md:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
                <input
                  type="text"
                  value={partNumber}
                  onChange={(e) => setPartNumber(e.target.value)}
                  placeholder="Search by part number..."
                  className="w-full h-11 pl-10 pr-4 rounded-lg border border-[hsl(220,14%,20%)] bg-[hsl(220,14%,10%)] text-sm text-white placeholder:text-white/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/40"
                />
                {partNumber && (
                  <button onClick={() => setPartNumber("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60"><X className="h-4 w-4" /></button>
                )}
              </div>
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="forge-btn-secondary flex items-center gap-2 flex-shrink-0"
              >
                <Filter className="h-4 w-4" />
                Filters
                {hasFilters && <span className="w-5 h-5 rounded-full bg-orange-500 text-white text-[10px] font-bold flex items-center justify-center">!</span>}
                {showFilters ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
              <div className="flex border border-[hsl(220,14%,18%)] rounded-lg overflow-hidden flex-shrink-0">
                <button onClick={() => setViewMode("grid")}
                  className={`h-11 px-3 flex items-center gap-1.5 text-sm font-semibold transition-all ${viewMode === "grid" ? "bg-orange-500/15 text-orange-400" : "text-white/40 hover:text-white/60"}`}>
                  <Grid3X3 className="h-4 w-4" />
                </button>
                <button onClick={() => setViewMode("list")}
                  className={`h-11 px-3 flex items-center gap-1.5 text-sm font-semibold transition-all ${viewMode === "list" ? "bg-orange-500/15 text-orange-400" : "text-white/40 hover:text-white/60"}`}>
                  <LayoutList className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Expanded filters */}
            {showFilters && (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 pt-2 border-t border-[hsl(220,14%,16%)]">
                <div>
                  <label className="text-[10px] text-white/40 uppercase tracking-wider font-semibold mb-1 block">NCR Number</label>
                  <input type="text" value={ncrNumber} onChange={(e) => setNcrNumber(e.target.value)} placeholder="#17"
                    className="w-full h-9 px-3 rounded-md border border-[hsl(220,14%,22%)] bg-[hsl(220,14%,14%)] text-sm text-white placeholder:text-white/30 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-orange-500/40" />
                </div>
                <div>
                  <label className="text-[10px] text-white/40 uppercase tracking-wider font-semibold mb-1 block">Job Number</label>
                  <input type="text" value={jobNumber} onChange={(e) => setJobNumber(e.target.value)} placeholder="JOB-001"
                    className="w-full h-9 px-3 rounded-md border border-[hsl(220,14%,22%)] bg-[hsl(220,14%,14%)] text-sm text-white placeholder:text-white/30 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-orange-500/40" />
                </div>
                <div>
                  <label className="text-[10px] text-white/40 uppercase tracking-wider font-semibold mb-1 block">Material Number</label>
                  <input type="text" value={materialNumber} onChange={(e) => setMaterialNumber(e.target.value)}
                    className="w-full h-9 px-3 rounded-md border border-[hsl(220,14%,22%)] bg-[hsl(220,14%,14%)] text-sm text-white placeholder:text-white/30 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-orange-500/40" />
                </div>
                <div>
                  <label className="text-[10px] text-white/40 uppercase tracking-wider font-semibold mb-1 block">Date From</label>
                  <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
                    className="w-full h-9 px-3 rounded-md border border-[hsl(220,14%,22%)] bg-[hsl(220,14%,14%)] text-sm text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-orange-500/40" />
                </div>
                <div>
                  <label className="text-[10px] text-white/40 uppercase tracking-wider font-semibold mb-1 block">Date To</label>
                  <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
                    className="w-full h-9 px-3 rounded-md border border-[hsl(220,14%,22%)] bg-[hsl(220,14%,14%)] text-sm text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-orange-500/40" />
                </div>
                <div className="flex items-end">
                  {hasFilters && (
                    <button onClick={clearFilters}
                      className="h-9 px-3 rounded-md text-xs font-semibold text-white/50 hover:text-white/80 hover:bg-white/5 border border-white/10 transition-all flex items-center gap-1">
                      <RotateCcw className="h-3.5 w-3.5" /> Clear All
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Defect type pills */}
            <div className="flex flex-wrap gap-2">
              <button onClick={() => setDefectType("all")}
                className={`h-8 px-3 text-xs font-semibold rounded-full transition-all ${defectType === "all" ? "bg-orange-500/15 text-orange-400 border border-orange-500/30" : "bg-white/5 text-white/40 hover:text-white/60 border border-white/10"}`}>
                All
              </button>
              {FOUNDRY_DEFECT_TYPES.map((d) => (
                <button key={d.value} onClick={() => setDefectType(d.value)}
                  className={`h-8 px-3 text-xs font-semibold rounded-full transition-all flex items-center gap-1.5 ${defectType === d.value ? "border border-orange-500/30" : "bg-white/5 text-white/40 hover:text-white/60 border border-white/10"}`}
                  style={defectType === d.value ? { backgroundColor: d.color + "20", color: d.color, borderColor: d.color + "50" } : {}}>
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: d.color }} />
                  {d.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Loading */}
        {historyQuery.isLoading && (
          <div className="text-center py-12">
            <RotateCcw className="h-8 w-8 text-orange-400 animate-spin mx-auto mb-3" />
            <p className="text-sm text-white/40">Loading defect history...</p>
          </div>
        )}

        {/* Empty */}
        {!historyQuery.isLoading && images.length === 0 && (
          <div className="text-center py-16">
            <ImageOff className="h-12 w-12 text-white/10 mx-auto mb-3" />
            <p className="text-sm text-white/40 font-semibold">
              {hasFilters ? "No images match your filters" : "No defect images in history yet"}
            </p>
            <p className="text-xs text-white/20 mt-1">
              {hasFilters ? "Try adjusting your search" : "Create a Foundry NCR with images to build your quality memory"}
            </p>
          </div>
        )}

        {/* Gallery Grid */}
        {!historyQuery.isLoading && images.length > 0 && viewMode === "grid" && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {images.map((item, index) => (
              <div key={item.imageId} className="rounded-lg border border-[hsl(220,14%,16%)] overflow-hidden group cursor-pointer hover:border-orange-500/30 transition-all bg-[hsl(220,14%,10%)]">
                {/* Image */}
                <div className="relative aspect-[4/3]" onClick={() => openViewer(index)}>
                  <img src={item.imageUrl} alt={item.defectType} className="w-full h-full object-cover" />
                  {/* NCR badge */}
                  <div className="absolute top-2 left-2">
                    <button onClick={(e) => { e.stopPropagation(); setSelectedNcr(item.ncrId); }}
                      className="text-[10px] bg-black/60 backdrop-blur-sm text-white/80 px-2 py-0.5 rounded-full font-bold hover:bg-orange-500/80 hover:text-white transition-all">
                      NCR #{item.ncrId}
                    </button>
                  </div>
                  {/* Approval badge */}
                  <div className="absolute top-2 right-2">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${item.approvalStatus === "approved" ? "bg-emerald-500/80 text-white" : "bg-amber-500/80 text-white"}`}>
                      {item.approvalStatus === "approved" ? "Approved" : "Pending"}
                    </span>
                  </div>
                  {/* Hover overlay */}
                  <div className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className="text-sm font-semibold text-white flex items-center gap-1"><Brain className="h-4 w-4" /> View</span>
                  </div>
                </div>
                {/* Info */}
                <div className="p-2.5">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: getDefectColor(item.defectType) }} />
                    <span className="text-xs font-semibold text-white/80">{getDefectLabel(item.defectType)}</span>
                  </div>
                  <p className="text-[10px] text-white/40 truncate">{item.partNumber} | {item.jobNumber}</p>
                  <div className="flex items-center gap-2 mt-1 text-[10px] text-white/30">
                    <span className="flex items-center gap-0.5"><Clock className="h-2.5 w-2.5" /> {new Date(item.imageCreatedAt).toLocaleDateString()}</span>
                    <span className="flex items-center gap-0.5"><User className="h-2.5 w-2.5" /> {item.operatorName}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Gallery List */}
        {!historyQuery.isLoading && images.length > 0 && viewMode === "list" && (
          <div className="space-y-2">
            {images.map((item, index) => (
              <div key={item.imageId}
                className="forge-card hover:border-orange-500/30 transition-all cursor-pointer"
                onClick={() => openViewer(index)}>
                <div className="forge-card-body flex items-center gap-4">
                  <img src={item.imageUrl} alt={item.defectType} className="h-16 w-20 object-cover rounded-md flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: getDefectColor(item.defectType) }} />
                      <span className="text-sm font-semibold text-white/80">{getDefectLabel(item.defectType)}</span>
                      <button onClick={(e) => { e.stopPropagation(); setSelectedNcr(item.ncrId); }}
                        className="text-[10px] bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded-full font-bold hover:bg-blue-500/30 transition-all">
                        NCR #{item.ncrId}
                      </button>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${item.approvalStatus === "approved" ? "bg-emerald-500/15 text-emerald-400" : "bg-amber-500/15 text-amber-400"}`}>
                        {item.approvalStatus === "approved" ? "Approved" : "Pending"}
                      </span>
                    </div>
                    <p className="text-xs text-white/40">{item.partNumber} | {item.jobNumber} | {item.materialNumber || "No material"}</p>
                    <div className="flex items-center gap-3 mt-0.5 text-[10px] text-white/30">
                      <span className="flex items-center gap-0.5"><Clock className="h-2.5 w-2.5" /> {new Date(item.imageCreatedAt).toLocaleDateString()}</span>
                      <span className="flex items-center gap-0.5"><User className="h-2.5 w-2.5" /> {item.operatorName}</span>
                      <span className="flex items-center gap-0.5"><Package className="h-2.5 w-2.5" /> Rev {item.revision || "—"}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* AI Memory Banner */}
        <div className="forge-card border-l-4 border-l-blue-500">
          <div className="forge-card-body flex items-start gap-3">
            <Brain className="h-5 w-5 text-blue-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-white/80">ForgeTraceIQ Quality Memory</p>
              <p className="text-xs text-white/40 mt-1">
                Every defect image captured through Foundry NCRs is permanently stored and searchable.
                {total > 0 ? ` Currently tracking ${total} images across ${new Set(images.map(i => i.partNumber)).size} unique parts.` : " Start building your defect database by creating NCRs with images."}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Fullscreen Viewer */}
      {viewerOpen && (
        <FullscreenImageViewer
          images={images.map((g) => ({
            id: g.imageId,
            imageUrl: g.imageUrl,
            thumbnailUrl: g.thumbnailUrl ?? g.imageUrl,
            predictedType: g.defectType,
            aiConfidence: null,
          }))}
          initialIndex={viewerIndex}
          onClose={() => setViewerOpen(false)}
        />
      )}
    </AppLayout>
  );
}
