import { useState } from "react";
import { useNavigate } from "react-router";
import { trpc } from "@/providers/trpc";
import AppLayout from "@/components/layout/AppLayout";
import {
  Search, Package, Clock, User, Tag, RotateCcw,
  ArrowRight, X, BookOpen
} from "lucide-react";

export default function SetupLibrary() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [partFilter, setPartFilter] = useState("");
  const [materialFilter, setMaterialFilter] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  const listQuery = trpc.setupSheet.listAll.useQuery(
    {
      search: searchQuery || undefined,
      partNumber: partFilter || undefined,
      material: materialFilter || undefined,
      limit: 50,
    },
    { enabled: true }
  );

  const clearFilters = () => { setSearchQuery(""); setPartFilter(""); setMaterialFilter(""); };
  const hasFilters = searchQuery || partFilter || materialFilter;

  return (
    <AppLayout
      title="Setup Library"
      subtitle={`${listQuery.data?.total ?? 0} setup records`}
      showBack
      onBack={() => navigate("/job-entry")}
      action={
        <button className="forge-btn-primary flex items-center gap-2" onClick={() => navigate("/job-entry")}>
          <ArrowRight className="h-4 w-4" /> New Job
        </button>
      }
    >
      <div className="max-w-5xl mx-auto space-y-5 pb-8">
        <div className="forge-card border-l-4 border-l-orange-500">
          <div className="forge-card-body flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-orange-500/15 flex items-center justify-center flex-shrink-0">
              <BookOpen className="h-6 w-6 text-orange-400" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white/90">Digital Setup Library</h2>
              <p className="text-xs text-white/40 mt-0.5">Search and load previously saved setups. Every version is preserved.</p>
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by part number or job number..."
              className="w-full h-11 pl-10 pr-4 rounded-lg border border-[hsl(220,14%,20%)] bg-[hsl(220,14%,10%)] text-sm text-white placeholder:text-white/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/40"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <button className="forge-btn-secondary flex items-center gap-2" onClick={() => setShowFilters(!showFilters)}>
            {showFilters ? <X className="h-4 w-4" /> : <Tag className="h-4 w-4" />} Filters
          </button>
        </div>

        {showFilters && (
          <div className="rounded-lg border border-[hsl(220,14%,18%)] bg-[hsl(220,14%,8%)] p-4 grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="text-[10px] text-white/40 uppercase tracking-wider font-semibold mb-1 block">Part Number</label>
              <input type="text" value={partFilter} onChange={(e) => setPartFilter(e.target.value)} placeholder="e.g. A132948"
                className="w-full h-9 px-3 rounded-md border border-[hsl(220,14%,22%)] bg-[hsl(220,14%,14%)] text-sm text-white placeholder:text-white/30 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-orange-500/40" />
            </div>
            <div>
              <label className="text-[10px] text-white/40 uppercase tracking-wider font-semibold mb-1 block">Material</label>
              <input type="text" value={materialFilter} onChange={(e) => setMaterialFilter(e.target.value)} placeholder="e.g. Aluminium 7075"
                className="w-full h-9 px-3 rounded-md border border-[hsl(220,14%,22%)] bg-[hsl(220,14%,14%)] text-sm text-white placeholder:text-white/30 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-orange-500/40" />
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

        {listQuery.isLoading && (
          <div className="text-center py-12">
            <RotateCcw className="h-8 w-8 text-orange-400 animate-spin mx-auto mb-3" />
            <p className="text-sm text-white/40">Loading setups...</p>
          </div>
        )}

        {listQuery.data && listQuery.data.results.length === 0 && (
          <div className="text-center py-12">
            <Package className="h-12 w-12 text-white/10 mx-auto mb-3" />
            <p className="text-sm text-white/40 font-semibold">No setups found</p>
            <p className="text-xs text-white/20 mt-1">{hasFilters ? "Try different filters" : "Create a job and save your first setup"}</p>
          </div>
        )}

        {listQuery.data && listQuery.data.results.length > 0 && (
          <div className="space-y-2">
            {listQuery.data.results.map((setup) => (
              <button
                key={setup.id}
                onClick={() => navigate(`/setup-sheet/${setup.jobId}`)}
                className="w-full text-left rounded-lg border border-[hsl(220,14%,16%)] bg-[hsl(220,14%,10%)] hover:border-orange-500/30 hover:bg-[hsl(220,14%,12%)] transition-all p-4 flex items-center gap-4 group"
              >
                <div className="flex-shrink-0 w-14 text-center">
                  <div className="h-10 w-10 rounded-full bg-orange-500/15 flex items-center justify-center mx-auto mb-0.5">
                    <span className="text-sm font-bold text-orange-400">v{setup.version}</span>
                  </div>
                  <span className="text-[9px] font-semibold text-emerald-400 uppercase tracking-wider">Latest</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-bold text-white/90">{setup.partNumber}</span>
                    <span className="text-[10px] text-white/30">Rev {setup.revision}</span>
                    <span className="text-[10px] text-white/30">Job: {setup.jobNumber}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-white/40">
                    <span className="flex items-center gap-1"><Tag className="h-3 w-3" /> {setup.materialNumber}</span>
                    <span className="flex items-center gap-1"><User className="h-3 w-3" /> {setup.operatorName}</span>
                    <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {new Date(setup.updatedAt).toLocaleDateString()}</span>
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
