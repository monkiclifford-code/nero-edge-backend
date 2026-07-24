import { useState } from "react";
import { useNavigate } from "react-router";
import { trpc } from "@/providers/trpc";
import AppLayout from "@/components/layout/AppLayout";
import {
  getDefectLabel, getDefectColor, getSeverityColor,
  FOUNDRY_DEFECT_TYPES,
} from "@/lib/foundryConstants";
import {
  AlertTriangle, Brain, TrendingUp, Repeat, Image,
  Microscope, Flame, DollarSign, ShieldAlert, ChevronRight,
  ChevronDown, ChevronUp, Factory, Sparkles, Clock,
  CheckCircle2, User, Wrench, FileText, BarChart3, Eye,
  BookOpen, ArrowRight, Package,
} from "lucide-react";

function DefectBar({ type, count, maxCount }: { type: string; count: number; maxCount: number }) {
  const pct = maxCount > 0 ? (count / maxCount) * 100 : 0;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="flex items-center gap-1.5 text-white/40">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: getDefectColor(type) }} />
          {getDefectLabel(type)}
        </span>
        <span className="font-bold text-white/80">{count}</span>
      </div>
      <div className="h-2 rounded-full bg-white/5 overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.max(pct, 4)}%`, backgroundColor: getDefectColor(type) }} />
      </div>
    </div>
  );
}

function ExpandCard({ title, icon: Icon, iconColor, children, defaultOpen = false, rightAction }: {
  title: string; icon: any; iconColor: string; children: React.ReactNode; defaultOpen?: boolean; rightAction?: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="forge-card">
      <div className="forge-card-header cursor-pointer" onClick={() => setOpen(!open)}>
        <h2 className="forge-card-title flex items-center gap-2">
          <Icon className={`h-4 w-4 ${iconColor}`} /> {title}
        </h2>
        <div className="flex items-center gap-2">
          {rightAction}
          {open ? <ChevronUp className="h-4 w-4 text-white/40" /> : <ChevronDown className="h-4 w-4 text-white/40" />}
        </div>
      </div>
      {open && <div className="forge-card-body">{children}</div>}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    open: "bg-rose-500/15 text-rose-400 border-rose-500/20",
    in_progress: "bg-amber-500/15 text-amber-400 border-amber-500/20",
    resolved: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
    closed: "bg-white/5 text-white/30 border-white/10",
  };
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded border ${colors[status] || colors.closed} font-semibold uppercase`}>
      {status?.replace(/_/g, " ")}
    </span>
  );
}

export default function FoundryDashboardPage() {
  const navigate = useNavigate();
  const [selectedDefectForAi, setSelectedDefectForAi] = useState<string | null>(null);
  const [selectedNcrId, setSelectedNcrId] = useState<number | null>(null);

  // tRPC queries
  const kpisQuery = trpc.foundry.getDashboardKpis.useQuery();
  const recentNcrs = trpc.foundry.getRecentNcrs.useQuery({ limit: 10 });
  const riskAlerts = trpc.foundry.getRiskAlerts.useQuery();
  const aiRecommendation = trpc.foundry.getAiRecommendation.useQuery(
    { defectType: selectedDefectForAi! },
    { enabled: !!selectedDefectForAi }
  );
  const visualHistory = trpc.foundry.getVisualHistory.useQuery({ limit: 8 });
  const ncrDetail = trpc.foundry.getNcrById.useQuery(
    { id: selectedNcrId! },
    { enabled: !!selectedNcrId }
  );

  const kpis = kpisQuery.data?.kpis ?? { totalNcrs: 0, openNcrs: 0, criticalCount: 0, pendingApproval: 0, totalScrapCost: 0 };
  const topDefects = kpisQuery.data?.topDefects ?? [];
  const trend = kpisQuery.data?.trend ?? [];
  const maxDefectCount = topDefects.length > 0 ? Math.max(...topDefects.map(d => d.count)) : 1;
  const totalScrap = kpis.totalScrapCost;

  // ─── NCR DETAIL PANEL (inline) ───
  if (selectedNcrId && ncrDetail.data) {
    const ncr = ncrDetail.data;
    return (
      <AppLayout
        title={`NCR #${ncr.id}`}
        subtitle={`${ncr.partNumber || "—"} | ${ncr.defectType?.replace(/_/g, " ")}`}
        showBack
        onBack={() => setSelectedNcrId(null)}
      >
        <div className="max-w-4xl mx-auto space-y-4 pb-8">
          <div className="forge-card border-l-4 border-l-blue-500">
            <div className="forge-card-body">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                <div><p className="text-[10px] text-white/40 uppercase font-bold">Part</p><p className="font-semibold text-white/80">{ncr.partNumber || "—"}</p></div>
                <div><p className="text-[10px] text-white/40 uppercase font-bold">Job</p><p className="font-semibold text-white/80">{ncr.jobNumber || "—"}</p></div>
                <div><p className="text-[10px] text-white/40 uppercase font-bold">Severity</p><p className="font-semibold text-amber-400">{ncr.severity?.toUpperCase()}</p></div>
                <div><p className="text-[10px] text-white/40 uppercase font-bold">Status</p><p className="font-semibold text-white/80">{ncr.status?.toUpperCase()}</p></div>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="forge-card border-l-4 border-l-rose-500">
              <div className="forge-card-header"><h2 className="forge-card-title text-sm">Problem</h2></div>
              <div className="forge-card-body"><p className="text-sm text-white/70 whitespace-pre-wrap">{ncr.problemDescription}</p></div>
            </div>
            <div className="forge-card border-l-4 border-l-blue-500">
              <div className="forge-card-header"><h2 className="forge-card-title text-sm flex items-center gap-2"><Brain className="h-4 w-4" /> AI Analysis</h2></div>
              <div className="forge-card-body">
                {selectedDefectForAi === ncr.defectType && aiRecommendation.data?.hasKnowledge ? (
                  <div className="space-y-2 text-xs text-white/60">
                    <p><strong className="text-white/80">Possible Causes:</strong></p>
                    <p className="whitespace-pre-wrap">{aiRecommendation.data.possibleCauses}</p>
                  </div>
                ) : (
                  <button
                    className="text-xs text-blue-400 hover:text-blue-300 font-semibold flex items-center gap-1"
                    onClick={() => setSelectedDefectForAi(ncr.defectType ?? null)}
                  >
                    <Sparkles className="h-3 w-3" /> Get AI Analysis for {ncr.defectType?.replace(/_/g, " ")}
                  </button>
                )}
              </div>
            </div>
          </div>
          {ncr.rootCause && (
            <div className="forge-card border-l-4 border-l-amber-500">
              <div className="forge-card-header"><h2 className="forge-card-title text-sm">Root Cause</h2></div>
              <div className="forge-card-body"><p className="text-sm text-white/70 whitespace-pre-wrap">{ncr.rootCause}</p></div>
            </div>
          )}
          {ncr.correctiveAction && (
            <div className="forge-card border-l-4 border-l-emerald-500">
              <div className="forge-card-header"><h2 className="forge-card-title text-sm">Corrective Action</h2></div>
              <div className="forge-card-body"><p className="text-sm text-white/70 whitespace-pre-wrap">{ncr.correctiveAction}</p></div>
            </div>
          )}
          {ncr.images && ncr.images.length > 0 && (
            <div className="forge-card">
              <div className="forge-card-header"><h2 className="forge-card-title text-sm">Images ({ncr.images.length})</h2></div>
              <div className="forge-card-body">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {ncr.images.map((img: any, i: number) => (
                    <img key={img.id} src={img.imageUrl} alt={`img ${i + 1}`} className="w-full h-24 object-cover rounded-lg border border-[hsl(220,14%,16%)]" />
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout
      title="Foundry Command Center"
      subtitle="AI-powered foundry quality control dashboard"
      action={
        <div className="flex gap-2">
          <button className="forge-btn-secondary flex items-center gap-2" onClick={() => navigate("/foundry-ncr-library")}>
            <BookOpen className="h-4 w-4" /> NCR Library
          </button>
          <button className="forge-btn-primary flex items-center gap-2" onClick={() => navigate("/foundry-ncr")}>
            <AlertTriangle className="h-4 w-4" /> New NCR
          </button>
        </div>
      }
    >
      <div className="space-y-5 pb-8">

        {/* ═══ KPI ROW ═══ */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { label: "Total NCRs", value: kpis.totalNcrs, icon: Factory, color: "text-blue-400" },
            { label: "Open", value: kpis.openNcrs, icon: AlertTriangle, color: "text-rose-400" },
            { label: "Critical", value: kpis.criticalCount, icon: ShieldAlert, color: "text-red-400" },
            { label: "Pending Approval", value: kpis.pendingApproval, icon: Clock, color: "text-amber-400" },
            { label: "Scrap Cost", value: `$${kpis.totalScrapCost.toLocaleString()}`, icon: DollarSign, color: "text-emerald-400" },
          ].map((kpi, i) => (
            <div key={i} className="forge-card p-4 hover:border-orange-500/30 transition-all cursor-pointer" onClick={() => navigate("/foundry-ncr-library")}>
              <div className="flex items-center gap-2 mb-2"><kpi.icon className={`h-4 w-4 ${kpi.color}`} />
                <span className="text-[10px] uppercase tracking-wider font-semibold text-white/40">{kpi.label}</span>
              </div>
              <p className="text-2xl font-bold text-white/90">{kpi.value}</p>
            </div>
          ))}
        </div>

        {/* ═══ RECENT NCR RECORDS (LIVE) ═══ */}
        <ExpandCard title="Recent NCR Records" icon={FileText} iconColor="text-blue-400" defaultOpen={true}
          rightAction={
            <button className="text-xs text-blue-400 hover:text-blue-300 font-semibold flex items-center gap-1" onClick={(e) => { e.stopPropagation(); navigate("/foundry-ncr-library"); }}>
              View All <ArrowRight className="h-3 w-3" />
            </button>
          }>
          {recentNcrs.isLoading && <div className="text-center py-4"><p className="text-xs text-white/40">Loading NCRs...</p></div>}
          {!recentNcrs.isLoading && recentNcrs.data && recentNcrs.data.length === 0 && (
            <div className="text-center py-8">
              <Package className="h-10 w-10 text-white/10 mx-auto mb-2" />
              <p className="text-sm text-white/40 font-semibold">No NCRs recorded yet</p>
              <p className="text-xs text-white/20">Create your first Foundry NCR to see live data</p>
            </div>
          )}
          {!recentNcrs.isLoading && recentNcrs.data && recentNcrs.data.length > 0 && (
            <div className="space-y-2">
              {recentNcrs.data.map((ncr) => (
                <div key={ncr.id}
                  className="rounded-lg border border-[hsl(220,14%,16%)] bg-[hsl(220,14%,10%)] hover:border-orange-500/30 hover:bg-[hsl(220,14%,12%)] transition-all cursor-pointer"
                  onClick={() => setSelectedNcrId(ncr.id)}>
                  <div className="p-3 flex items-center gap-3">
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: getDefectColor(ncr.defectType) }} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold text-white/90">#{ncr.id}</span>
                        <span className="text-xs text-white/60">{ncr.jobNumber || "—"}</span>
                        <span className="text-xs text-white/40">{ncr.partNumber || "—"}</span>
                        <StatusBadge status={ncr.status ?? "open"} />
                        <span className={`text-[10px] font-bold ${getSeverityColor(ncr.severity)}`}>{ncr.severity?.toUpperCase()}</span>
                      </div>
                      <p className="text-xs text-white/40 truncate mt-0.5">{ncr.problemDescription?.slice(0, 80)}...</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {ncr.imageCount > 0 && <span className="text-[10px] text-blue-400/60 flex items-center gap-0.5"><Image className="h-3 w-3" />{ncr.imageCount}</span>}
                      <span className="text-[10px] text-white/30">{new Date(ncr.createdAt).toLocaleDateString()}</span>
                      <ChevronRight className="h-3.5 w-3.5 text-white/20" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ExpandCard>

        {/* ═══ TOP DEFECTS + AI RECOMMENDATIONS ═══ */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <ExpandCard title="Top Defects" icon={Flame} iconColor="text-orange-400" defaultOpen={true}>
            <div className="space-y-3">
              {topDefects.length === 0 && <p className="text-xs text-white/40 text-center py-4">No defect data yet</p>}
              {topDefects.map((d) => (
                <div key={d.defectType} className="cursor-pointer" onClick={() => setSelectedDefectForAi(d.defectType ?? null)}>
                  <DefectBar type={d.defectType ?? ""} count={d.count} maxCount={maxDefectCount} />
                </div>
              ))}
            </div>
            {selectedDefectForAi && aiRecommendation.data?.hasKnowledge && (
              <div className="mt-4 rounded-lg bg-purple-500/10 border border-purple-500/20 p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-purple-400" />
                  <p className="text-sm font-bold text-purple-400">AI Analysis: {getDefectLabel(selectedDefectForAi)}</p>
                </div>
                <div className="space-y-2 text-xs text-white/60">
                  <div>
                    <p className="font-semibold text-white/80 mb-1">Possible Causes:</p>
                    <p className="whitespace-pre-wrap leading-relaxed">{aiRecommendation.data.possibleCauses}</p>
                  </div>
                  <div>
                    <p className="font-semibold text-white/80 mb-1">Recommended Actions:</p>
                    <p className="whitespace-pre-wrap leading-relaxed">{aiRecommendation.data.correctiveActions}</p>
                  </div>
                  {aiRecommendation.data.preventiveActions && (
                    <div>
                      <p className="font-semibold text-white/80 mb-1">Preventive Measures:</p>
                      <p className="whitespace-pre-wrap leading-relaxed">{aiRecommendation.data.preventiveActions}</p>
                    </div>
                  )}
                  {aiRecommendation.data.lessonsLearned && (
                    <div className="rounded bg-purple-500/10 p-2 border border-purple-500/10">
                      <p className="font-semibold text-purple-400/80 mb-1">Lessons Learned:</p>
                      <p className="text-white/50">{aiRecommendation.data.lessonsLearned}</p>
                    </div>
                  )}
                </div>
              </div>
            )}
            {selectedDefectForAi && !aiRecommendation.data?.hasKnowledge && (
              <div className="mt-4 rounded-lg bg-amber-500/10 border border-amber-500/20 p-3">
                <p className="text-xs text-amber-400">No AI knowledge base entry for this defect yet.</p>
              </div>
            )}
          </ExpandCard>

          {/* ═══ RISK ALERTS (REAL) ═══ */}
          <ExpandCard title="Risk Alerts" icon={ShieldAlert} iconColor="text-rose-400" defaultOpen={true}>
            {riskAlerts.isLoading && <p className="text-xs text-white/40 text-center py-4">Loading alerts...</p>}
            {!riskAlerts.isLoading && riskAlerts.data && riskAlerts.data.length === 0 && (
              <div className="text-center py-6">
                <CheckCircle2 className="h-8 w-8 text-emerald-500/30 mx-auto mb-2" />
                <p className="text-sm text-white/40">No risk alerts</p>
                <p className="text-xs text-white/20">System will alert when repeat defects are detected</p>
              </div>
            )}
            {!riskAlerts.isLoading && riskAlerts.data && riskAlerts.data.length > 0 && (
              <div className="space-y-3">
                {riskAlerts.data.map((alert, i) => (
                  <div key={i} className={`rounded-lg p-3 border ${
                    alert.severity === "critical" ? "bg-rose-500/10 border-rose-500/20" :
                    alert.severity === "major" ? "bg-orange-500/10 border-orange-500/20" :
                    "bg-amber-500/10 border-amber-500/20"
                  }`}>
                    <div className="flex items-center gap-2 mb-1">
                      <AlertTriangle className={`h-4 w-4 flex-shrink-0 ${
                        alert.severity === "critical" ? "text-rose-400" : alert.severity === "major" ? "text-orange-400" : "text-amber-400"
                      }`} />
                      <span className="text-sm font-bold text-white/80">{alert.partNumber}</span>
                      {alert.defectType && (
                        <span className="text-[10px] flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: getDefectColor(alert.defectType) }} />
                          <span className="text-white/40">{alert.defectType.replace(/_/g, " ")}</span>
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-white/50">{alert.message}</p>
                    <p className="text-[10px] text-blue-400/60 mt-1">{alert.recommendation}</p>
                  </div>
                ))}
              </div>
            )}
          </ExpandCard>
        </div>

        {/* ═══ DEFECT TREND ═══ */}
        <ExpandCard title="NCR Trend" icon={BarChart3} iconColor="text-blue-400" defaultOpen={false}>
          {trend.length === 0 ? (
            <p className="text-xs text-white/40 text-center py-4">No trend data yet</p>
          ) : (
            <>
              <div className="flex items-end gap-1 h-40">
                {trend.map((t, i) => {
                  const maxC = Math.max(...trend.map(nt => nt.count), 1);
                  const h = (t.count / maxC) * 100;
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1" title={`${t.date}: ${t.count} NCRs`}>
                      <div className="w-full rounded-t-sm bg-orange-500/60 hover:bg-orange-500 transition-all min-h-[4px]" style={{ height: `${Math.max(h, 4)}%` }} />
                    </div>
                  );
                })}
              </div>
              <div className="flex justify-between text-[10px] text-white/30 mt-2">
                <span>{trend[0]?.date}</span><span>{trend[trend.length - 1]?.date}</span>
              </div>
            </>
          )}
        </ExpandCard>

        {/* ═══ VISUAL GALLERY (REAL IMAGES) ═══ */}
        <ExpandCard title="Visual Defect Gallery" icon={Image} iconColor="text-blue-400" defaultOpen={true}
          rightAction={
            <button className="text-xs text-blue-400 hover:text-blue-300 font-semibold flex items-center gap-1" onClick={(e) => { e.stopPropagation(); navigate("/visual-history"); }}>
              View All <ArrowRight className="h-3 w-3" />
            </button>
          }>
          {visualHistory.isLoading && <p className="text-xs text-white/40 text-center py-4">Loading images...</p>}
          {!visualHistory.isLoading && visualHistory.data && visualHistory.data.images.length === 0 && (
            <div className="text-center py-6">
              <Image className="h-8 w-8 text-white/10 mx-auto mb-2" />
              <p className="text-xs text-white/40">No images yet. Create an NCR with photos to build the gallery.</p>
            </div>
          )}
          {!visualHistory.isLoading && visualHistory.data && visualHistory.data.images.length > 0 && (
            <div className="grid grid-cols-4 md:grid-cols-4 gap-2">
              {visualHistory.data.images.map((item) => (
                <div key={item.imageId}
                  className="relative aspect-square rounded-lg overflow-hidden border border-[hsl(220,14%,16%)] cursor-pointer hover:border-orange-500/30 transition-all group bg-[hsl(220,14%,10%)]"
                  onClick={() => navigate(`/visual-history?ncr=${item.ncrId}`)}>
                  <img src={item.imageUrl} alt={item.defectType ?? ""} className="w-full h-full object-cover" />
                  <div className="absolute top-1 left-1">
                    <span className="text-[9px] bg-black/60 text-white/70 px-1.5 py-0.5 rounded font-bold">NCR#{item.ncrId}</span>
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-1.5 py-0.5">
                    <p className="text-[9px] text-white/50 truncate">{item.partNumber}</p>
                  </div>
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <Eye className="h-5 w-5 text-white/80" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </ExpandCard>

        {/* ═══ AI KNOWLEDGE ENGINE INFO ═══ */}
        <ExpandCard title="AI Knowledge Engine" icon={Brain} iconColor="text-purple-400" defaultOpen={false}>
          <div className="flex items-start gap-3">
            <Brain className="h-5 w-5 text-purple-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-white/80">Foundry Defect Knowledge Base</p>
              <p className="text-xs text-white/40 mt-1">
                The AI engine analyzes NCR data against {FOUNDRY_DEFECT_TYPES.length} defect types
                with manufacturing knowledge for root cause analysis and corrective action recommendations.
              </p>
              <div className="flex flex-wrap gap-2 mt-3">
                {FOUNDRY_DEFECT_TYPES.map(d => (
                  <button key={d.value}
                    className="text-[10px] px-2 py-1 rounded-full bg-white/5 border border-white/10 text-white/40 hover:border-purple-500/30 hover:text-purple-400 transition-all"
                    onClick={() => setSelectedDefectForAi(d.value)}>
                    {d.label}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-white/20 mt-2">Click any defect type above to see AI analysis</p>
            </div>
          </div>
        </ExpandCard>

      </div>
    </AppLayout>
  );
}
