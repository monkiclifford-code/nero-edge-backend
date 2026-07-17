import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { isDemoMode, demoApi } from "@/lib/demoApi";
import AppLayout from "@/components/layout/AppLayout";
import {
  getDefectLabel, getDefectColor, getSeverityColor,
  FOUNDRY_DEFECT_TYPES,
} from "@/lib/foundryConstants";
import {
  AlertTriangle, Brain, TrendingUp, Repeat, Image,
  Microscope, Flame, DollarSign, ShieldAlert, ChevronRight,
  ChevronDown, ChevronUp, Factory, Sparkles, X, Clock,
  CheckCircle2, User, Wrench, FileText, BarChart3, Eye,
} from "lucide-react";
import ConfidenceBadge from "@/components/foundry/ConfidenceBadge";

function DefectBar({ type, count, maxCount }: { type: string; count: number; maxCount: number }) {
  const pct = maxCount > 0 ? (count / maxCount) * 100 : 0;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="flex items-center gap-1.5 text-[hsl(220,14%,40%)]">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: getDefectColor(type) }} />
          {getDefectLabel(type)}
        </span>
        <span className="font-bold text-[hsl(220,14%,25%)]">{count}</span>
      </div>
      <div className="h-2 rounded-full bg-white/5 overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.max(pct, 4)}%`, backgroundColor: getDefectColor(type) }} />
      </div>
    </div>
  );
}

// ── Expandable Card Wrapper ──
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
          {open ? <ChevronUp className="h-4 w-4 text-[hsl(220,14%,55%)]" /> : <ChevronDown className="h-4 w-4 text-[hsl(220,14%,55%)]" />}
        </div>
      </div>
      {open && <div className="forge-card-body">{children}</div>}
    </div>
  );
}

// ── NCR Detail Row ──
function NcrDetailRow({ ncr }: { ncr: any }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="rounded-lg bg-white border border-[hsl(220,13%,90%)] overflow-hidden">
      <div className="p-3 cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <div className="flex items-center gap-3">
          <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: getDefectColor(ncr.defectType) }} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-[hsl(220,14%,25%)]">{ncr.jobNumber}</span>
              <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded" style={{
                backgroundColor: `${ncr.severity === 'critical' ? '#dc2626' : ncr.severity === 'major' ? '#f97316' : '#eab308'}20`,
                color: ncr.severity === 'critical' ? '#f87171' : ncr.severity === 'major' ? '#fb923c' : '#facc15',
              }}>{ncr.severity}</span>
            </div>
            <p className="text-xs text-[hsl(220,14%,55%)] truncate mt-0.5">{ncr.partNumber} — {getDefectLabel(ncr.defectType)}</p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="text-[10px] text-[hsl(220,14%,60%)]">{ncr.date}</span>
            {expanded ? <ChevronUp className="h-3.5 w-3.5 text-[hsl(220,14%,55%)]" /> : <ChevronDown className="h-3.5 w-3.5 text-[hsl(220,14%,55%)]" />}
          </div>
        </div>
      </div>
      {expanded && (
        <div className="px-3 pb-3 border-t border-[hsl(220,13%,88%)] space-y-2">
          <div className="pt-2">
            <p className="text-[10px] uppercase tracking-wider font-semibold text-[hsl(220,14%,60%)] mb-1">Problem Description</p>
            <p className="text-xs text-[hsl(220,14%,40%)]">{ncr.problem}</p>
          </div>
          {ncr.rootCause && (
            <div>
              <p className="text-[10px] uppercase tracking-wider font-semibold text-[hsl(220,14%,60%)] mb-1">Root Cause</p>
              <p className="text-xs text-[hsl(220,14%,40%)]">{ncr.rootCause}</p>
            </div>
          )}
          {ncr.correctiveAction && (
            <div>
              <p className="text-[10px] uppercase tracking-wider font-semibold text-[hsl(220,14%,60%)] mb-1">Corrective Action</p>
              <p className="text-xs text-[hsl(220,14%,40%)]">{ncr.correctiveAction}</p>
            </div>
          )}
          <div className="flex items-center gap-3 pt-1">
            <span className="flex items-center gap-1 text-[10px] text-[hsl(220,14%,60%)]"><User className="h-3 w-3" />{ncr.operator}</span>
            <span className="flex items-center gap-1 text-[10px] text-[hsl(220,14%,60%)]"><Clock className="h-3 w-3" />{ncr.date}</span>
            {ncr.scrapCost && <span className="flex items-center gap-1 text-[10px] text-emerald-400/60"><DollarSign className="h-3 w-3" />${ncr.scrapCost} scrap</span>}
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// RICH DEMO DATA FOR MANAGER PRESENTATION
// ═══════════════════════════════════════════════════════════

const DEMO_NCRS = [
  { id: 1, jobNumber: "JOB-2025-0891", partNumber: "PN-CAST-1001", defectType: "porosity", severity: "major", status: "open", problem: "Visible porosity clusters on the upper flange surface after fettling. Cluster size approximately 3-5mm diameter.", rootCause: "Inadequate venting in cope and drag. Gas entrapment during pour.", correctiveAction: "Add 4 additional vent channels to cope pattern. Verify core vents are clear before assembly.", operator: "John Miller", date: "May 9", scrapCost: 350, batchNumber: "BATCH-2025-042", aiConfidence: 87 },
  { id: 2, jobNumber: "JOB-2025-0892", partNumber: "PN-CAST-1002", defectType: "shrinkage", severity: "critical", status: "open", problem: "Severe shrinkage cavity in the thick section of the hub casting. Rejected during ultrasonic inspection.", rootCause: "Inadequate riser feeding. Riser solidified before casting section.", correctiveAction: "Increase riser diameter by 15%. Add insulating sleeve to riser neck. Verify feed path with simulation.", operator: "Sarah Chen", date: "May 8", scrapCost: 890, batchNumber: "BATCH-2025-043", aiConfidence: 92 },
  { id: 3, jobNumber: "JOB-2025-0885", partNumber: "PN-CAST-1003", defectType: "blow_hole", severity: "major", status: "in_progress", problem: "Blow holes detected on machined surface after first OP. Part dimensions compromised.", rootCause: "Excessive moisture in facing sand. Drying cycle too short.", correctiveAction: "Reduce facing sand moisture to 2.8-3.2%. Extend drying cycle by 20 minutes. Monitor hourly.", operator: "Mike Ross", date: "May 7", scrapCost: 420, batchNumber: "BATCH-2025-041", aiConfidence: 78 },
  { id: 4, jobNumber: "JOB-2025-0879", partNumber: "PN-CAST-1001", defectType: "porosity", severity: "minor", status: "resolved", problem: "Minor porosity at junction between boss and wall section.", rootCause: "Turbulence during pour causing air entrainment at junction.", correctiveAction: "Redesign gating to reduce turbulence. Increased gate area by 10%.", operator: "John Miller", date: "May 5", scrapCost: 120, batchNumber: "BATCH-2025-038", aiConfidence: 64 },
  { id: 5, jobNumber: "JOB-2025-0870", partNumber: "PN-CAST-1004", defectType: "sand_inclusion", severity: "major", status: "open", problem: "Sand inclusion defects on internal passages. Detected during borescope inspection.", rootCause: "Core erosion during pour. Core strength below specification.", correctiveAction: "Increase core strength to minimum 2.5 MPa. Apply additional core wash coating.", operator: "Lisa Park", date: "May 4", scrapCost: 560, batchNumber: "BATCH-2025-039", aiConfidence: 81 },
  { id: 6, jobNumber: "JOB-2025-0865", partNumber: "PN-CAST-1005", defectType: "crack", severity: "critical", status: "open", problem: "Hot tear crack propagating from fillet radius. Part failed pressure test.", rootCause: "Excessive restraint from mold and core during solidification. Sharp internal fillet radii.", correctiveAction: "Increase fillet radii to minimum 6mm. Add mold coating to reduce friction. Modify pattern.", operator: "Dave Wilson", date: "May 3", scrapCost: 1200, batchNumber: "BATCH-2025-040", aiConfidence: 95 },
  { id: 7, jobNumber: "JOB-2025-0858", partNumber: "PN-CAST-1002", defectType: "corrosion", severity: "major", status: "in_progress", problem: "Corrosion pitting on casting surface after shot blast. Material loss in localized areas.", rootCause: "Contaminated shot blast media. Moisture ingress in media storage.", correctiveAction: "Replace shot blast media. Verify media dryness with moisture meter. Inspect storage area for leaks.", operator: "Sarah Chen", date: "May 2", scrapCost: 340, batchNumber: "BATCH-2025-037", aiConfidence: 73 },
  { id: 8, jobNumber: "JOB-2025-0850", partNumber: "PN-CAST-1006", defectType: "misrun", severity: "major", status: "resolved", problem: "Misrun on thin-wall section of the bracket casting. Incomplete fill pattern.", rootCause: "Pour temperature too low. Metal fluidity insufficient for thin section.", correctiveAction: "Increase pour temperature by 30C minimum. Verify with pyrometer before each pour.", operator: "Tom Harris", date: "Apr 30", scrapCost: 280, batchNumber: "BATCH-2025-036", aiConfidence: 88 },
];

const DEMO_TOP_DEFECTS = [
  { defectType: "porosity", count: 12 },
  { defectType: "shrinkage", count: 8 },
  { defectType: "blow_hole", count: 6 },
  { defectType: "sand_inclusion", count: 5 },
  { defectType: "crack", count: 4 },
  { defectType: "corrosion", count: 3 },
  { defectType: "surface_defect", count: 3 },
  { defectType: "misrun", count: 2 },
];

const DEMO_TREND = [
  { date: "Apr 20", count: 2 }, { date: "Apr 21", count: 1 }, { date: "Apr 22", count: 3 },
  { date: "Apr 23", count: 0 }, { date: "Apr 24", count: 2 }, { date: "Apr 25", count: 4 },
  { date: "Apr 26", count: 1 }, { date: "Apr 27", count: 2 }, { date: "Apr 28", count: 3 },
  { date: "Apr 29", count: 1 }, { date: "Apr 30", count: 2 }, { date: "May 1", count: 3 },
  { date: "May 2", count: 2 }, { date: "May 3", count: 4 }, { date: "May 4", count: 1 },
  { date: "May 5", count: 2 }, { date: "May 6", count: 1 }, { date: "May 7", count: 3 },
  { date: "May 8", count: 2 }, { date: "May 9", count: 1 },
];

const DEMO_AI_INSIGHTS = [
  {
    icon: TrendingUp, color: "text-amber-400", bg: "bg-amber-500/15", border: "border-amber-500/20",
    title: "Porosity increasing on Part PN-CAST-1001",
    description: "4 foundry NCRs in the last 14 days — up from 1 in prior period. Trending +300%.",
    detail: "Analysis of Part PN-CAST-1001 shows porosity defects concentrated in the upper flange region. Root cause pattern suggests inadequate venting in cope section. AI recommends: add 4 vent channels, verify core clearance, and monitor gas evolution rate during pour.",
  },
  {
    icon: Repeat, color: "text-rose-400", bg: "bg-rose-500/15", border: "border-rose-500/20",
    title: "Casting batch BATCH-2025-043 linked to multiple NCRs",
    description: "This batch has 3 linked NCRs including 1 critical shrinkage defect.",
    detail: "Batch BATCH-2025-043 (PN-CAST-1002, poured May 6) shows anomalous defect density. The critical shrinkage NCR suggests a systemic issue with riser design. Other linked NCRs include surface defect and dimensional shift. Recommend: hold remaining batch inventory pending inspection review.",
  },
  {
    icon: ShieldAlert, color: "text-orange-400", bg: "bg-orange-500/15", border: "border-orange-500/20",
    title: "FURNACE-2 temperature variance pattern detected",
    description: "Temperature readings show 45C variance over last 5 pours. Standard is +/- 15C.",
    detail: "FURNACE-2 thermocouple readings indicate increasing temperature instability. The variance correlates with increased misrun and cold shut defects across parts poured from this furnace. Recommend: thermocouple calibration, burner inspection, and ladle preheat verification.",
  },
];

const DEMO_REPEAT_DEFECTS = [
  { partNumber: "PN-CAST-1001", defectType: "porosity", occurrenceCount: 4, latestDescription: "Upper flange porosity clusters — venting issue recurring across 4 batches", ncrIds: [1, 4, 9, 12] },
  { partNumber: "PN-CAST-1002", defectType: "shrinkage", occurrenceCount: 3, latestDescription: "Hub section shrinkage — riser feeding inadequate on thick sections", ncrIds: [2, 7, 11] },
  { partNumber: "PN-CAST-1003", defectType: "blow_hole", occurrenceCount: 2, latestDescription: "Blow holes on machined surfaces — facing sand moisture issue", ncrIds: [3, 10] },
  { partNumber: "PN-CAST-1005", defectType: "crack", occurrenceCount: 2, latestDescription: "Hot tear cracks at fillet radii — restraint during solidification", ncrIds: [6, 14] },
];

const DEMO_RISK_ALERTS = [
  { batchNumber: "BATCH-2025-043", partNumber: "PN-CAST-1002", ncrCount: 3, scrapCost: 1530, reason: "Multiple defects including 1 critical" },
  { batchNumber: "BATCH-2025-042", partNumber: "PN-CAST-1001", ncrCount: 2, scrapCost: 470, reason: "Repeat porosity defects" },
  { batchNumber: "FURNACE-2", partNumber: "Multiple parts", ncrCount: 5, scrapCost: 2340, reason: "Temperature variance detected" },
];

const DEMO_SCRAP = [
  { defectType: "crack", label: "Crack", cost: 1200, color: "#dc2626" },
  { defectType: "shrinkage", label: "Shrinkage", cost: 890, color: "#06b6d4" },
  { defectType: "blow_hole", label: "Blow Hole", cost: 560, color: "#ef4444" },
  { defectType: "sand_inclusion", label: "Sand Inclusion", cost: 420, color: "#a855f7" },
  { defectType: "porosity", label: "Porosity", cost: 350, color: "#f97316" },
  { defectType: "corrosion", label: "Corrosion", cost: 340, color: "#eab308" },
  { defectType: "misrun", label: "Misrun", cost: 280, color: "#ec4899" },
  { defectType: "surface_defect", label: "Surface", cost: 120, color: "#84cc16" },
];

const maxDefectCount = Math.max(...DEMO_TOP_DEFECTS.map((d) => d.count));

export default function FoundryDashboardPage() {
  const navigate = useNavigate();
  const [insightExpanded, setInsightExpanded] = useState<number | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem("cnc_operator");
    if (!saved) navigate("/");
  }, [navigate]);

  // Use demo API data if available, otherwise use hardcoded DEMO data
  const dashboardData = isDemoMode() ? demoApi.getFoundryDashboardKpis() : null;
  const hasApiData = dashboardData && dashboardData.kpis.totalNcrs > 0;

  const kpis = hasApiData ? dashboardData.kpis : { totalNcrs: 8, openNcrs: 4, criticalCount: 2, totalScrapCost: 4160, aiAnalyzed: 8 };
  const topDefects = hasApiData ? dashboardData.topDefects : DEMO_TOP_DEFECTS;
  const ncrTrend = hasApiData ? dashboardData.ncrTrend : DEMO_TREND;
  const ncrs = hasApiData ? dashboardData.topDefects.map((d: any) => ({
    id: d.id ?? 0, jobNumber: d.jobNumber ?? "JOB-0000", partNumber: d.partNumber ?? "Unknown",
    defectType: d.defectType, severity: d.severity ?? "major", problem: d.problemDescription ?? "No description",
    rootCause: d.rootCause, correctiveAction: d.correctiveAction, operator: d.operatorName ?? "Operator",
    date: d.createdAt ? new Date(d.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "",
    scrapCost: d.scrapCost, batchNumber: d.batchNumber, aiConfidence: d.aiConfidence,
  })) : DEMO_NCRS;

  const totalScrap = DEMO_SCRAP.reduce((sum, d) => sum + d.cost, 0);

  return (
    <AppLayout
      title="Foundry Command Center"
      subtitle="AI-powered foundry quality control dashboard"
      action={
        <button className="forge-btn-primary flex items-center gap-2" onClick={() => navigate("/foundry-ncr")}>
          <AlertTriangle className="h-4 w-4" /> New Foundry NCR
        </button>
      }
    >
      <div className="space-y-5 pb-8">

        {/* ── KPI Row ── */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { label: "Total NCRs", value: kpis.totalNcrs, icon: Factory, color: "text-blue-400" },
            { label: "Open", value: kpis.openNcrs, icon: AlertTriangle, color: "text-rose-400" },
            { label: "Critical", value: kpis.criticalCount, icon: ShieldAlert, color: "text-red-400" },
            { label: "Scrap Cost", value: `$${kpis.totalScrapCost.toLocaleString()}`, icon: DollarSign, color: "text-emerald-400" },
            { label: "AI Analyzed", value: kpis.aiAnalyzed, icon: Brain, color: "text-blue-400" },
          ].map((kpi, i) => (
            <div key={i} className="forge-card p-4 hover:border-[hsl(220,14%,30%)] transition-all cursor-pointer" onClick={() => navigate("/foundry-ncr")}>
              <div className="flex items-center gap-2 mb-2"><kpi.icon className={`h-4 w-4 ${kpi.color}`} />
                <span className="text-[10px] uppercase tracking-wider font-semibold text-[hsl(220,14%,55%)]">{kpi.label}</span>
              </div>
              <p className="text-2xl font-bold text-[hsl(220,14%,15%)]">{kpi.value}</p>
            </div>
          ))}
        </div>

        {/* ── Top Defects (clickable with NCR list) ── */}
        <ExpandCard title="Top Foundry Defects" icon={Flame} iconColor="text-orange-400" defaultOpen={true}>
          <div className="space-y-3">
            {topDefects.map((d: any) => (
              <DefectBar key={d.defectType} type={d.defectType} count={d.count} maxCount={maxDefectCount} />
            ))}
          </div>
          {/* NCR List */}
          <div className="mt-4 border-t border-[hsl(220,13%,88%)] pt-4 space-y-2">
            <p className="text-[10px] uppercase tracking-wider font-semibold text-[hsl(220,14%,55%)] mb-2">Recent NCR Records</p>
            {DEMO_NCRS.slice(0, 5).map((ncr) => (
              <NcrDetailRow key={ncr.id} ncr={ncr} />
            ))}
          </div>
        </ExpandCard>

        {/* ── NCR Trend ── */}
        <ExpandCard title="Defect Trend (20 Days)" icon={BarChart3} iconColor="text-blue-400" defaultOpen={true}>
          <div className="flex items-end gap-1 h-40">
            {ncrTrend.map((t: any, i: number) => {
              const maxC = Math.max(...ncrTrend.map((nt: any) => nt.count));
              const h = maxC > 0 ? (t.count / maxC) * 100 : 0;
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-1" title={`${t.date}: ${t.count} NCRs`}>
                  <div className="w-full rounded-t-sm bg-[hsl(24,95%,53%)]/60 hover:bg-[hsl(24,95%,53%)] transition-all min-h-[4px]" style={{ height: `${Math.max(h, 4)}%` }} />
                </div>
              );
            })}
          </div>
          <div className="flex justify-between text-[10px] text-[hsl(220,14%,65%)] mt-2">
            <span>Apr 20</span><span>May 9</span>
          </div>
          {/* Trend NCR list */}
          <div className="mt-4 border-t border-[hsl(220,13%,88%)] pt-4 space-y-2">
            <p className="text-[10px] uppercase tracking-wider font-semibold text-[hsl(220,14%,55%)] mb-2">NCRs This Period</p>
            {DEMO_NCRS.slice(5).map((ncr) => (
              <NcrDetailRow key={ncr.id} ncr={ncr} />
            ))}
          </div>
        </ExpandCard>

        {/* ── AI Insight Engine ── */}
        <ExpandCard title="AI Insight Engine" icon={Sparkles} iconColor="text-purple-400" defaultOpen={true}>
          <div className="space-y-3">
            {DEMO_AI_INSIGHTS.map((insight, i) => (
              <div key={i} className={`rounded-lg border ${insight.border} ${insight.bg} overflow-hidden`}>
                <div className="p-3 cursor-pointer" onClick={() => setInsightExpanded(insightExpanded === i ? null : i)}>
                  <div className="flex items-start gap-2.5">
                    <insight.icon className={`h-4 w-4 ${insight.color} flex-shrink-0 mt-0.5`} />
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-[hsl(220,14%,25%)]">{insight.title}</p>
                      <p className="text-xs text-[hsl(220,14%,50%)] mt-1">{insight.description}</p>
                    </div>
                    {insightExpanded === i ? <ChevronUp className="h-4 w-4 text-[hsl(220,14%,55%)] flex-shrink-0" /> : <ChevronDown className="h-4 w-4 text-[hsl(220,14%,55%)] flex-shrink-0" />}
                  </div>
                </div>
                {insightExpanded === i && (
                  <div className="px-3 pb-3 border-t border-white/5">
                    <p className="text-xs text-[hsl(220,14%,40%)] mt-2 leading-relaxed">{insight.detail}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/15 border border-blue-500/20 px-2 py-0.5 text-[10px] font-bold text-blue-400">
                        <Brain className="h-2.5 w-2.5" /> AI Generated
                      </span>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </ExpandCard>

        {/* ── Repeat Defects ── */}
        <ExpandCard title="Repeat Defects" icon={Repeat} iconColor="text-amber-400" defaultOpen={false}>
          <div className="space-y-3">
            {DEMO_REPEAT_DEFECTS.map((d, i) => (
              <div key={i}>
                <div className="flex items-center gap-3 rounded-lg bg-white border border-[hsl(220,13%,90%)] p-3">
                  <div className="w-10 h-10 rounded-full bg-amber-500/15 flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-bold text-amber-400">{d.occurrenceCount}x</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[hsl(220,14%,25%)]">{d.partNumber}</p>
                    <p className="text-xs text-[hsl(220,14%,55%)] flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ backgroundColor: getDefectColor(d.defectType) }} />
                      {getDefectLabel(d.defectType)}
                    </p>
                  </div>
                  <span className="text-[10px] text-amber-400/60 font-bold">{d.ncrIds.length} NCRs</span>
                </div>
                <div className="ml-4 mt-1 rounded-md bg-[hsl(220,14%,11%)] border-l-2 border-amber-500/30 p-2">
                  <p className="text-xs text-[hsl(220,14%,55%)]">{d.latestDescription}</p>
                  <p className="text-[10px] text-amber-400/50 mt-1">Linked: {d.ncrIds.map((id) => `#${id}`).join(", ")}</p>
                </div>
              </div>
            ))}
          </div>
        </ExpandCard>

        {/* ── Row: Gallery + Risk Alerts ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Visual Gallery */}
          <ExpandCard title="Visual Defect Gallery" icon={Image} iconColor="text-blue-400" defaultOpen={true}
            rightAction={<button className="text-xs text-blue-400 hover:text-blue-300 font-semibold flex items-center gap-1" onClick={(e) => { e.stopPropagation(); navigate("/visual-history"); }}>View All <ChevronRight className="h-3 w-3" /></button>}>
            <div className="grid grid-cols-4 md:grid-cols-4 gap-2">
              {DEMO_NCRS.slice(0, 8).map((ncr, i) => (
                <div key={i} className="relative aspect-square rounded-md overflow-hidden border border-[hsl(220,13%,88%)] cursor-pointer hover:border-[hsl(220,14%,30%)] transition-all group"
                  onClick={() => navigate("/visual-history")}>
                  <img src={`https://picsum.photos/seed/defect${ncr.id}/200/200`} alt={ncr.defectType} className="w-full h-full object-cover" />
                  <div className="absolute top-1 left-1"><ConfidenceBadge confidence={ncr.aiConfidence} size="sm" /></div>
                  <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-1.5 py-0.5">
                    <p className="text-[9px] text-[hsl(220,14%,50%)] truncate">{ncr.jobNumber}</p>
                  </div>
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <Eye className="h-5 w-5 text-[hsl(220,14%,35%)]" />
                  </div>
                </div>
              ))}
            </div>
          </ExpandCard>

          {/* Risk Alerts */}
          <ExpandCard title="Risk Alerts" icon={ShieldAlert} iconColor="text-rose-400" defaultOpen={true}>
            <div className="space-y-3">
              {DEMO_RISK_ALERTS.map((alert, i) => (
                <div key={i} className={`rounded-lg p-3 ${i === 0 ? "bg-rose-950/30 border border-rose-500/20" : i === 1 ? "bg-orange-950/30 border border-orange-500/20" : "bg-amber-950/30 border border-amber-500/20"}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <AlertTriangle className={`h-4 w-4 flex-shrink-0 ${i === 0 ? "text-rose-400" : i === 1 ? "text-orange-400" : "text-amber-400"}`} />
                    <span className="text-sm font-bold text-[hsl(220,14%,25%)]">{alert.batchNumber}</span>
                  </div>
                  <p className="text-xs text-[hsl(220,14%,55%)]">{alert.partNumber}</p>
                  <div className="flex items-center gap-3 mt-2">
                    <span className="text-xs text-rose-400 font-bold">{alert.ncrCount} linked NCRs</span>
                    <span className="text-xs text-emerald-400/60">${alert.scrapCost.toLocaleString()} scrap</span>
                  </div>
                  <p className="text-[10px] text-[hsl(220,14%,60%)] mt-1">{alert.reason}</p>
                </div>
              ))}
            </div>
          </ExpandCard>
        </div>

        {/* ── Scrap Analysis ── */}
        <ExpandCard title="Scrap Cost by Defect Type" icon={DollarSign} iconColor="text-emerald-400" defaultOpen={false}>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {DEMO_SCRAP.map((d) => (
              <div key={d.defectType} className="rounded-lg bg-white border border-[hsl(220,13%,90%)] p-3 text-center hover:border-[hsl(220,14%,30%)] transition-all cursor-pointer">
                <span className="w-3 h-3 rounded-full mx-auto mb-2 block" style={{ backgroundColor: d.color }} />
                <p className="text-xs text-[hsl(220,14%,55%)]">{d.label}</p>
                <p className="text-lg font-bold text-emerald-400 mt-1">${d.cost.toLocaleString()}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 rounded-lg bg-emerald-950/20 border border-emerald-500/20 p-3 flex items-center justify-between">
            <span className="text-sm font-semibold text-[hsl(220,14%,40%)]">Total Scrap Cost</span>
            <span className="text-xl font-bold text-emerald-400">${totalScrap.toLocaleString()}</span>
          </div>
        </ExpandCard>

        {/* ── AI Pattern Detection ── */}
        <ExpandCard title="AI Visual Pattern Detection" icon={Brain} iconColor="text-blue-400" defaultOpen={false}>
          <div className="flex items-start gap-3">
            <Brain className="h-5 w-5 text-blue-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-[hsl(220,14%,25%)]">Visual Pattern Engine</p>
              <p className="text-xs text-[hsl(220,14%,55%)] mt-1">
                The AI system compares uploaded images against historical defect records
                to identify similar visual patterns and predict defect types with confidence scoring.
              </p>
              <div className="flex flex-wrap gap-2 mt-3">
                {["Mock (active)", "OpenAI Vision", "Ollama", "DeepSeek", "YOLO"].map((p) => (
                  <span key={p} className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-[hsl(220,14%,60%)]">{p}</span>
                ))}
              </div>
            </div>
          </div>
        </ExpandCard>

      </div>
    </AppLayout>
  );
}
