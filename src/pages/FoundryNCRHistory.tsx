import { useState } from "react";
import { useNavigate } from "react-router";
import { trpc } from "@/providers/trpc";
import AppLayout from "@/components/layout/AppLayout";
import {
  Search, Filter, X, Calendar, User, AlertTriangle,
  Clock, Wrench, Eye, ShieldCheck, Lock, ChevronDown,
  RotateCcw, ImageIcon, FileText, Tag, ArrowRight
} from "lucide-react";

const STATUS_OPTIONS = [
  { value: "", label: "All Statuses" },
  { value: "open", label: "Open" },
  { value: "under_investigation", label: "Under Investigation" },
  { value: "corrective_action", label: "Corrective Action" },
  { value: "verified", label: "Verified" },
  { value: "closed", label: "Closed" },
];

const SEVERITY_OPTIONS = [
  { value: "", label: "All Severities" },
  { value: "critical", label: "Critical" },
  { value: "major", label: "Major" },
  { value: "minor", label: "Minor" },
  { value: "observation", label: "Observation" },
];

function getStatusIcon(status: string) {
  switch (status) {
    case "open": return <AlertTriangle className="h-3.5 w-3.5" />;
    case "under_investigation": return <Search className="h-3.5 w-3.5" />;
    case "corrective_action": return <Wrench className="h-3.5 w-3.5" />;
    case "verified": return <ShieldCheck className="h-3.5 w-3.5" />;
    case "closed": return <Lock className="h-3.5 w-3.5" />;
    default: return <Clock className="h-3.5 w-3.5" />;
  }
}

function getStatusColor(status: string): string {
  switch (status) {
    case "open": return "text-rose-400 bg-rose-500/15 border-rose-500/30";
    case "under_investigation": return "text-amber-400 bg-amber-500/15 border-amber-500/30";
    case "corrective_action": return "text-blue-400 bg-blue-500/15 border-blue-500/30";
    case "verified": return "text-emerald-400 bg-emerald-500/15 border-emerald-500/30";
    case "closed": return "text-white/40 bg-white/5 border-white/10";
    default: return "text-white/40 bg-white/5 border-white/10";
  }
}

function getSeverityColor(severity: string): string {
  switch (severity) {
    case "critical": return "text-rose-400";
    case "major": return "text-orange-400";
    case "minor": return "text-amber-400";
    default: return "text-white/40";
  }
}

export default function FoundryNCRHistory() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [severityFilter, setSeverityFilter] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [selectedNcrId, setSelectedNcrId] = useState<number | null>(null);

  const searchNcrs = trpc.foundry.searchNcrs.useQuery({
    partNumber: searchQuery || undefined,
    jobNumber: searchQuery || undefined,
    status: statusFilter || undefined,
    severity: severityFilter || undefined,
    limit: 50,
  }, { enabled: true });

  const ncrDetail = trpc.foundry.getNcrById.useQuery(
    { id: selectedNcrId! },
    { enabled: !!selectedNcrId }
  );

  const updateStatus = trpc.foundry.updateStatus.useMutation({
    onSuccess: () => { searchNcrs.refetch(); ncrDetail.refetch(); },
  });

  const clearFilters = () => { setSearchQuery(""); setStatusFilter(""); setSeverityFilter(""); };
  const hasFilters = searchQuery || statusFilter || severityFilter;

  return (
    <AppLayout
      title={selectedNcrId ? `NCR #${selectedNcrId}` : "Foundry NCR History"}
      subtitle={selectedNcrId ? "Complete NCR Record" : `${searchNcrs.data?.total ?? 0} records found`}
      showBack
      onBack={() => selectedNcrId ? setSelectedNcrId(null) : navigate("/foundry-dashboard")}
      action={
        !selectedNcrId && (
          <div className="flex gap-2">
            <button className="forge-btn-secondary flex items-center gap-2" onClick={() => setShowFilters(!showFilters)}>
              <Filter className="h-4 w-4" /> Filters {hasFilters && <span className="w-5 h-5 rounded-full bg-orange-500 text-white text-[10px] font-bold flex items-center justify-center">!</span>}
            </button>
            <button className="forge-btn-primary flex items-center gap-2" onClick={() => navigate("/foundry-ncr")}>
              + New NCR
            </button>
          </div>
        )
      }
    >
      {/* DETAIL VIEW */}
      {selectedNcrId && ncrDetail.data && (
        <div className="max-w-4xl mx-auto space-y-5 pb-8">
          <div className="forge-card border-l-4 border-l-orange-500">
            <div className="forge-card-body">
              <div className="flex items-start justify-between flex-wrap gap-4">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-2xl font-bold text-white/90">NCR #{ncrDetail.data.id}</span>
                    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border flex items-center gap-1.5 ${getStatusColor(ncrDetail.data.status)}`}>
                      {getStatusIcon(ncrDetail.data.status)}
                      {ncrDetail.data.status.replace(/_/g, " ").toUpperCase()}
                    </span>
                    <span className={`text-xs font-bold ${getSeverityColor(ncrDetail.data.severity)}`}>
                      {ncrDetail.data.severity?.toUpperCase()}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-white/50">
                    <span className="flex items-center gap-1"><Tag className="h-3.5 w-3.5" /> {ncrDetail.data.defectType?.replace(/_/g, " ")}</span>
                    <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" /> {new Date(ncrDetail.data.createdAt).toLocaleString()}</span>
                    <span className="flex items-center gap-1"><User className="h-3.5 w-3.5" /> {ncrDetail.data.operatorName}</span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {STATUS_OPTIONS.filter(s => s.value && s.value !== ncrDetail.data!.status).map(s => (
                    <button key={s.value} onClick={() => updateStatus.mutate({ id: selectedNcrId, status: s.value as any })}
                      disabled={updateStatus.isPending}
                      className="h-8 px-3 rounded-md text-xs font-semibold border border-white/10 hover:border-orange-500/40 hover:bg-orange-500/10 text-white/60 hover:text-orange-400 transition-all">
                      → {s.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="forge-card">
            <div className="forge-card-header"><h2 className="forge-card-title flex items-center gap-2"><FileText className="h-4 w-4 text-blue-400" /> Job Information</h2></div>
            <div className="forge-card-body">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div><p className="text-xs text-white/40 uppercase tracking-wider font-semibold">Job Number</p><p className="font-semibold text-white/80">{ncrDetail.data.jobNumber}</p></div>
                <div><p className="text-xs text-white/40 uppercase tracking-wider font-semibold">Part Number</p><p className="font-semibold text-white/80">{ncrDetail.data.partNumber}</p></div>
                <div><p className="text-xs text-white/40 uppercase tracking-wider font-semibold">Material</p><p className="font-semibold text-white/80">{ncrDetail.data.materialNumber || "—"}</p></div>
                <div><p className="text-xs text-white/40 uppercase tracking-wider font-semibold">Revision</p><p className="font-semibold text-white/80">{ncrDetail.data.revision || "—"}</p></div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="forge-card border-l-4 border-l-rose-500">
              <div className="forge-card-header"><h2 className="forge-card-title text-sm">Problem Description</h2></div>
              <div className="forge-card-body"><p className="text-sm text-white/70 whitespace-pre-wrap">{ncrDetail.data.problemDescription}</p></div>
            </div>
            <div className="forge-card border-l-4 border-l-amber-500">
              <div className="forge-card-header"><h2 className="forge-card-title text-sm">Root Cause</h2></div>
              <div className="forge-card-body"><p className="text-sm text-white/70 whitespace-pre-wrap">{ncrDetail.data.rootCause || <em className="text-white/20">Not specified</em>}</p></div>
            </div>
            <div className="forge-card border-l-4 border-l-emerald-500">
              <div className="forge-card-header"><h2 className="forge-card-title text-sm">Corrective Action</h2></div>
              <div className="forge-card-body"><p className="text-sm text-white/70 whitespace-pre-wrap">{ncrDetail.data.correctiveAction || <em className="text-white/20">Not specified</em>}</p></div>
            </div>
          </div>

          {ncrDetail.data.scrapQuantified && (
            <div className="forge-card border-l-4 border-l-rose-500">
              <div className="forge-card-body flex items-center gap-3">
                <AlertTriangle className="h-5 w-5 text-rose-400" />
                <div>
                  <p className="text-sm font-semibold text-white/80">Scrap Quantified</p>
                  <p className="text-lg font-bold text-rose-400">R {Number(ncrDetail.data.scrapCost).toLocaleString()}</p>
                </div>
              </div>
            </div>
          )}

          {ncrDetail.data.images && ncrDetail.data.images.length > 0 && (
            <div className="forge-card">
              <div className="forge-card-header">
                <h2 className="forge-card-title flex items-center gap-2">
                  <ImageIcon className="h-4 w-4 text-blue-400" /> Attached Images ({ncrDetail.data.images.length})
                </h2>
              </div>
              <div className="forge-card-body">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {ncrDetail.data.images.map((img: any, idx: number) => (
                    <div key={img.id} className="relative group rounded-lg overflow-hidden border border-[hsl(220,14%,16%)]">
                      <img src={img.imageUrl} alt={`NCR image ${idx + 1}`} className="w-full h-40 object-cover" />
                      {img.aiPrediction && (
                        <div className="absolute bottom-0 left-0 right-0 bg-black/70 backdrop-blur-sm px-2 py-1">
                          <p className="text-[10px] text-blue-400 font-semibold">AI: {img.aiPrediction.predictedDefectType}</p>
                          <p className="text-[10px] text-white/50">Conf: {img.aiPrediction.confidence}%</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* LIST VIEW */}
      {!selectedNcrId && (
        <div className="max-w-6xl mx-auto space-y-4 pb-8">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
              <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by part number, job number, or NCR number..."
                className="w-full h-11 pl-10 pr-4 rounded-lg border border-[hsl(220,14%,20%)] bg-[hsl(220,14%,10%)] text-sm text-white placeholder:text-white/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/40" />
              {searchQuery && (
                <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60">
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          {showFilters && (
            <div className="rounded-lg border border-[hsl(220,14%,18%)] bg-[hsl(220,14%,8%)] p-4 grid grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <label className="text-[10px] text-white/40 uppercase tracking-wider font-semibold mb-1 block">Status</label>
                <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full h-9 px-2 rounded-md border border-[hsl(220,14%,22%)] bg-[hsl(220,14%,14%)] text-sm text-white">
                  {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] text-white/40 uppercase tracking-wider font-semibold mb-1 block">Severity</label>
                <select value={severityFilter} onChange={(e) => setSeverityFilter(e.target.value)}
                  className="w-full h-9 px-2 rounded-md border border-[hsl(220,14%,22%)] bg-[hsl(220,14%,14%)] text-sm text-white">
                  {SEVERITY_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
              <div className="flex items-end">
                {hasFilters && (
                  <button onClick={clearFilters} className="h-9 px-3 rounded-md text-xs font-semibold text-white/50 hover:text-white/80 hover:bg-white/5 border border-white/10 transition-all flex items-center gap-1">
                    <RotateCcw className="h-3.5 w-3.5" /> Clear All
                  </button>
                )}
              </div>
            </div>
          )}

          {searchNcrs.isLoading && (
            <div className="text-center py-12"><RotateCcw className="h-8 w-8 text-orange-400 animate-spin mx-auto mb-3" /><p className="text-sm text-white/40">Loading NCRs...</p></div>
          )}

          {searchNcrs.data && searchNcrs.data.results.length === 0 && (
            <div className="text-center py-12">
              <FileText className="h-12 w-12 text-white/10 mx-auto mb-3" />
              <p className="text-sm text-white/40 font-semibold">No NCRs found</p>
              <p className="text-xs text-white/20 mt-1">{hasFilters ? "Try adjusting your filters" : "Create your first Foundry NCR"}</p>
            </div>
          )}

          {searchNcrs.data && searchNcrs.data.results.length > 0 && (
            <div className="space-y-2">
              {searchNcrs.data.results.map((ncr) => (
                <button key={ncr.id} onClick={() => setSelectedNcrId(ncr.id)}
                  className="w-full text-left rounded-lg border border-[hsl(220,14%,16%)] bg-[hsl(220,14%,10%)] hover:border-orange-500/30 hover:bg-[hsl(220,14%,12%)] transition-all p-4 flex items-center gap-4 group">
                  <div className="flex-shrink-0 w-14 text-center">
                    <span className="text-lg font-bold text-white/80">#{ncr.id}</span>
                  </div>
                  <div className="flex-shrink-0">
                    <span className={`px-2 py-1 rounded-full text-[10px] font-semibold border flex items-center gap-1 ${getStatusColor(ncr.status)}`}>
                      {getStatusIcon(ncr.status)}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-sm font-semibold text-white/80 truncate">{ncr.partNumber}</span>
                      <span className={`text-[10px] font-bold ${getSeverityColor(ncr.severity)}`}>{ncr.severity?.toUpperCase()}</span>
                      <span className="text-[10px] text-white/30">{ncr.defectType?.replace(/_/g, " ")}</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-white/40">
                      <span>Job: {ncr.jobNumber}</span>
                      <span>{new Date(ncr.createdAt).toLocaleDateString()}</span>
                      <span className="flex items-center gap-1"><User className="h-3 w-3" /> {ncr.operatorName}</span>
                    </div>
                  </div>
                  <Eye className="h-4 w-4 text-white/20 group-hover:text-orange-400 transition-colors flex-shrink-0" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </AppLayout>
  );
}
