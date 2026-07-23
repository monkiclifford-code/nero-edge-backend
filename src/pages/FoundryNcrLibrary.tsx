import { useState } from "react";
import { useNavigate } from "react-router";
import { trpc } from "@/providers/trpc";
import AppLayout from "@/components/layout/AppLayout";
import {
  Search, Package, Clock, User, Tag, RotateCcw,
  ArrowRight, X, BookOpen, ShieldCheck, ShieldAlert,
  AlertTriangle, Filter, FileText, ChevronDown, ChevronLeft,
  History, Wrench, Image, CheckCircle2,
} from "lucide-react";
import { FOUNDRY_DEFECT_TYPES, SEVERITY_LEVELS } from "@/lib/foundryConstants";

const STATUS_OPTIONS = [
  { value: "", label: "All Statuses" },
  { value: "open", label: "Open" },
  { value: "in_progress", label: "In Progress" },
  { value: "resolved", label: "Resolved" },
  { value: "closed", label: "Closed" },
];

function getStatusColor(status: string) {
  switch (status) {
    case "open": return "text-rose-400 bg-rose-500/15 border-rose-500/30";
    case "in_progress": return "text-amber-400 bg-amber-500/15 border-amber-500/30";
    case "resolved": return "text-emerald-400 bg-emerald-500/15 border-emerald-500/30";
    case "closed": return "text-white/40 bg-white/5 border-white/10";
    default: return "text-white/40 bg-white/5 border-white/10";
  }
}

function getSeverityColor(severity: string) {
  switch (severity) {
    case "critical": return "text-rose-400";
    case "major": return "text-orange-400";
    case "minor": return "text-amber-400";
    default: return "text-white/40";
  }
}

export default function FoundryNcrLibrary() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [partFilter, setPartFilter] = useState("");
  const [jobFilter, setJobFilter] = useState("");
  const [defectFilter, setDefectFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [severityFilter, setSeverityFilter] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [selectedNcrId, setSelectedNcrId] = useState<number | null>(null);

  // Use listAllNcrs when no filters, searchNcrs when filters applied
  const hasFilters = partFilter || jobFilter || defectFilter || statusFilter || severityFilter || searchQuery;
  const listAllQuery = trpc.foundry.listAllNcrs.useQuery(
    { limit: 50, offset: 0 },
    { enabled: !hasFilters }
  );
  const searchQuery_result = trpc.foundry.searchNcrs.useQuery(
    {
      partNumber: partFilter || undefined,
      jobNumber: jobFilter || undefined,
      ncrNumber: searchQuery ? searchQuery : undefined,
      defectType: defectFilter || undefined,
      status: statusFilter || undefined,
      severity: severityFilter || undefined,
      limit: 50,
    },
    { enabled: !!hasFilters }
  );
  // Use the right data source
  const listData = hasFilters ? searchQuery_result.data : listAllQuery.data;
  const listLoading = hasFilters ? searchQuery_result.isLoading : listAllQuery.isLoading;

  const ncrDetail = trpc.foundry.getNcrById.useQuery(
    { id: selectedNcrId! },
    { enabled: !!selectedNcrId }
  );

  const approveMutation = trpc.foundry.approveNcr.useMutation({
    onSuccess: () => ncrDetail.refetch(),
  });

  const updateStatus = trpc.foundry.updateStatus.useMutation({
    onSuccess: () => { listAllQuery.refetch(); searchQuery_result.refetch(); ncrDetail.refetch(); },
  });

  const clearFilters = () => {
    setSearchQuery(""); setPartFilter(""); setJobFilter("");
    setDefectFilter(""); setStatusFilter(""); setSeverityFilter("");
  };

  // ─── DETAIL VIEW ───
  if (selectedNcrId && ncrDetail.data) {
    const ncr = ncrDetail.data;
    return (
      <AppLayout
        title={`NCR #${ncr.id}`}
        subtitle={`Part: ${ncr.partNumber} | Defect: ${ncr.defectType?.replace(/_/g, " ")} | V${ncr.version}`}
        showBack
        onBack={() => setSelectedNcrId(null)}
        action={
          <div className="flex gap-2">
            {ncr.approvalStatus === "pending" && (
              <button
                className="forge-btn-primary flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500"
                onClick={() => {
                  const op = localStorage.getItem("cnc_operator");
                  const name = op ? JSON.parse(op).name : "Supervisor";
                  approveMutation.mutate({ ncrId: ncr.id, approverName: name, status: "approved" });
                }}
                disabled={approveMutation.isPending}
              >
                {approveMutation.isPending ? <RotateCcw className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                Approve
              </button>
            )}
          </div>
        }
      >
        <div className="max-w-5xl mx-auto space-y-5 pb-8">
          {/* Header Card */}
          <div className={`forge-card border-l-4 ${ncr.approvalStatus === "approved" ? "border-l-emerald-500" : "border-l-amber-500"}`}>
            <div className="forge-card-body">
              <div className="flex items-center gap-2 mb-3 flex-wrap">
                <FileText className="h-4 w-4 text-blue-400" />
                <span className="text-sm font-bold text-white/80">NCR Record</span>
                <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full">v{ncr.version}</span>
                {ncr.approvalStatus === "approved" ? (
                  <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full flex items-center gap-1">
                    <ShieldCheck className="h-3 w-3" /> Approved
                  </span>
                ) : (
                  <span className="text-xs bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full flex items-center gap-1">
                    <ShieldAlert className="h-3 w-3" /> Pending Approval
                  </span>
                )}
                <span className={`text-xs px-2 py-0.5 rounded-full border flex items-center gap-1 ${getStatusColor(ncr.status)}`}>
                  <AlertTriangle className="h-3 w-3" /> {ncr.status?.toUpperCase()}
                </span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div><p className="text-xs text-white/40 uppercase tracking-wider font-semibold">Job</p><p className="font-semibold text-white/80">{ncr.jobNumber}</p></div>
                <div><p className="text-xs text-white/40 uppercase tracking-wider font-semibold">Part</p><p className="font-semibold text-white/80">{ncr.partNumber}</p></div>
                <div><p className="text-xs text-white/40 uppercase tracking-wider font-semibold">Material</p><p className="font-semibold text-white/80">{ncr.materialNumber || "—"}</p></div>
                <div><p className="text-xs text-white/40 uppercase tracking-wider font-semibold">Revision</p><p className="font-semibold text-white/80">{ncr.revision || "—"}</p></div>
                <div><p className="text-xs text-white/40 uppercase tracking-wider font-semibold">Created By</p><p className="font-semibold text-white/80">{ncr.operatorName}</p></div>
                <div><p className="text-xs text-white/40 uppercase tracking-wider font-semibold">Date</p><p className="font-semibold text-white/80">{new Date(ncr.createdAt).toLocaleDateString()}</p></div>
                <div><p className="text-xs text-white/40 uppercase tracking-wider font-semibold">Severity</p><p className={`font-semibold ${getSeverityColor(ncr.severity)}`}>{ncr.severity?.toUpperCase()}</p></div>
                <div><p className="text-xs text-white/40 uppercase tracking-wider font-semibold">Defect</p><p className="font-semibold text-white/80">{ncr.defectType?.replace(/_/g, " ")}</p></div>
                {ncr.approvedBy && (
                  <div><p className="text-xs text-white/40 uppercase tracking-wider font-semibold">Approved By</p><p className="font-semibold text-emerald-400">{ncr.approvedBy}</p></div>
                )}
              </div>
            </div>
          </div>

          {/* Problem / Root Cause / Corrective Action */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="forge-card border-l-4 border-l-rose-500">
              <div className="forge-card-header"><h2 className="forge-card-title text-sm">Problem Description</h2></div>
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
                <AlertTriangle className="h-5 w-5 text-rose-400" />
                <div>
                  <p className="text-sm font-semibold text-white/80">Scrap Quantified</p>
                  <p className="text-lg font-bold text-rose-400">${Number(ncr.scrapCost).toLocaleString()}</p>
                </div>
              </div>
            </div>
          )}

          {/* Images */}
          {ncr.images && ncr.images.length > 0 && (
            <div className="forge-card">
              <div className="forge-card-header">
                <h2 className="forge-card-title flex items-center gap-2"><Image className="h-4 w-4 text-blue-400" /> Attached Images ({ncr.images.length})</h2>
              </div>
              <div className="forge-card-body">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {ncr.images.map((img: any, idx: number) => (
                    <div key={img.id} className="relative group rounded-lg overflow-hidden border border-[hsl(220,14%,16%)]">
                      <img src={img.imageUrl} alt={`NCR image ${idx + 1}`} className="w-full h-40 object-cover" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Version History */}
          {ncr.versions && ncr.versions.length > 0 && (
            <div className="forge-card border-l-4 border-l-purple-500">
              <div className="forge-card-header">
                <h2 className="forge-card-title flex items-center gap-2"><History className="h-4 w-4 text-purple-400" /> Version History</h2>
              </div>
              <div className="forge-card-body space-y-2">
                {ncr.versions.map((v: any) => (
                  <div key={v.id} className="p-3 rounded-lg bg-[hsl(220,14%,13%)] border border-[hsl(220,14%,16%)]">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-purple-500/20 flex items-center justify-center flex-shrink-0">
                        <span className="text-xs font-bold text-purple-400">v{v.version}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white/80">{v.changeSummary || `Version ${v.version}`}</p>
                        <p className="text-xs text-white/40 flex items-center gap-1">
                          <User className="h-3 w-3" /> {v.operatorName}
                          <Clock className="h-3 w-3 ml-2" /> {new Date(v.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Status Actions */}
          <div className="flex flex-wrap gap-2">
            {STATUS_OPTIONS.filter(s => s.value && s.value !== ncr.status).map(s => (
              <button key={s.value} onClick={() => updateStatus.mutate({ id: ncr.id, status: s.value as any })}
                disabled={updateStatus.isPending}
                className="h-8 px-3 rounded-md text-xs font-semibold border border-white/10 hover:border-orange-500/40 hover:bg-orange-500/10 text-white/60 hover:text-orange-400 transition-all">
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </AppLayout>
    );
  }

  // ─── LIST VIEW ───
  return (
    <AppLayout
      title="Foundry NCR Library"
      subtitle={`${listData?.total ?? 0} NCR records${hasFilters ? " (filtered)" : ""}`}
      showBack
      onBack={() => navigate("/foundry-dashboard")}
      action={
        <button className="forge-btn-primary flex items-center gap-2" onClick={() => navigate("/foundry-ncr")}>
          <ArrowRight className="h-4 w-4" /> New NCR
        </button>
      }
    >
      <div className="max-w-5xl mx-auto space-y-5 pb-8">
        {/* Header */}
        <div className="forge-card border-l-4 border-l-orange-500">
          <div className="forge-card-body flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-orange-500/15 flex items-center justify-center flex-shrink-0">
              <BookOpen className="h-6 w-6 text-orange-400" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white/90">Foundry NCR Library</h2>
              <p className="text-xs text-white/40 mt-0.5">Search and review non-conformance reports. Every version is preserved.</p>
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
            <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by NCR number..."
              className="w-full h-11 pl-10 pr-4 rounded-lg border border-[hsl(220,14%,20%)] bg-[hsl(220,14%,10%)] text-sm text-white placeholder:text-white/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/40" />
            {searchQuery && (
              <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60"><X className="h-4 w-4" /></button>
            )}
          </div>
          <button className="forge-btn-secondary flex items-center gap-2" onClick={() => setShowFilters(!showFilters)}>
            <Filter className="h-4 w-4" /> Filters {hasFilters && <span className="w-5 h-5 rounded-full bg-orange-500 text-white text-[10px] font-bold flex items-center justify-center">!</span>}
          </button>
        </div>

        {/* Filters */}
        {showFilters && (
          <div className="rounded-lg border border-[hsl(220,14%,18%)] bg-[hsl(220,14%,8%)] p-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            <div>
              <label className="text-[10px] text-white/40 uppercase tracking-wider font-semibold mb-1 block">Part Number</label>
              <input type="text" value={partFilter} onChange={(e) => setPartFilter(e.target.value)} placeholder="e.g. SM178007"
                className="w-full h-9 px-3 rounded-md border border-[hsl(220,14%,22%)] bg-[hsl(220,14%,14%)] text-sm text-white placeholder:text-white/30 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-orange-500/40" />
            </div>
            <div>
              <label className="text-[10px] text-white/40 uppercase tracking-wider font-semibold mb-1 block">Job Number</label>
              <input type="text" value={jobFilter} onChange={(e) => setJobFilter(e.target.value)} placeholder="e.g. JOB-001"
                className="w-full h-9 px-3 rounded-md border border-[hsl(220,14%,22%)] bg-[hsl(220,14%,14%)] text-sm text-white placeholder:text-white/30 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-orange-500/40" />
            </div>
            <div>
              <label className="text-[10px] text-white/40 uppercase tracking-wider font-semibold mb-1 block">Defect Type</label>
              <select value={defectFilter} onChange={(e) => setDefectFilter(e.target.value)}
                className="w-full h-9 px-2 rounded-md border border-[hsl(220,14%,22%)] bg-[hsl(220,14%,14%)] text-sm text-white">
                <option value="">All Defects</option>
                {FOUNDRY_DEFECT_TYPES.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
              </select>
            </div>
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
                <option value="">All Severities</option>
                {SEVERITY_LEVELS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
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

        {/* Loading */}
        {listLoading && (
          <div className="text-center py-12"><RotateCcw className="h-8 w-8 text-orange-400 animate-spin mx-auto mb-3" /><p className="text-sm text-white/40">Loading NCRs...</p></div>
        )}

        {/* Empty */}
        {!listLoading && listData && listData.results.length === 0 && (
          <div className="text-center py-12">
            <Package className="h-12 w-12 text-white/10 mx-auto mb-3" />
            <p className="text-sm text-white/40 font-semibold">No NCRs found</p>
            <p className="text-xs text-white/20 mt-1">{hasFilters ? "Try adjusting filters" : "Create your first Foundry NCR"}</p>
          </div>
        )}

        {/* Results */}
        {!listLoading && listData && listData.results.length > 0 && (
          <div className="space-y-2">
            {listData.results.map((ncr) => (
              <button
                key={ncr.id}
                onClick={() => setSelectedNcrId(ncr.id)}
                className="w-full text-left rounded-lg border border-[hsl(220,14%,16%)] bg-[hsl(220,14%,10%)] hover:border-orange-500/30 hover:bg-[hsl(220,14%,12%)] transition-all p-4 flex items-center gap-4 group"
              >
                <div className="flex-shrink-0 text-center w-14">
                  <span className="text-lg font-bold text-white/80">#{ncr.id}</span>
                  <p className="text-[9px] text-blue-400 font-semibold">v{ncr.version}</p>
                </div>
                <div className="flex-shrink-0">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full border flex items-center gap-1 ${ncr.approvalStatus === "approved" ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" : "bg-amber-500/15 text-amber-400 border-amber-500/30"}`}>
                    {ncr.approvalStatus === "approved" ? <ShieldCheck className="h-3 w-3" /> : <ShieldAlert className="h-3 w-3" />}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                    <span className="text-sm font-bold text-white/90">{ncr.partNumber}</span>
                    <span className={`text-[10px] font-bold ${getSeverityColor(ncr.severity)}`}>{ncr.severity?.toUpperCase()}</span>
                    <span className="text-[10px] text-white/30">{ncr.defectType?.replace(/_/g, " ")}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded border ${getStatusColor(ncr.status)}`}>{ncr.status?.toUpperCase()}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-white/40">
                    <span>Job: {ncr.jobNumber}</span>
                    <span><Clock className="h-3 w-3 inline mr-0.5" />{new Date(ncr.createdAt).toLocaleDateString()}</span>
                    <span className="flex items-center gap-1"><User className="h-3 w-3" /> {ncr.operatorName}</span>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-white/20 group-hover:text-orange-400 transition-colors flex-shrink-0" />
              </button>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
