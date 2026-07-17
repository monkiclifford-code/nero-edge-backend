import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { trpc } from "@/providers/trpc";
import { isDemoMode, demoApi } from "@/lib/demoApi";
import AppLayout from "@/components/layout/AppLayout";
import {
  ShieldAlert, Users, TrendingUp, ClipboardList, Repeat, BarChart3,
  Clock, Activity, ChevronDown, ChevronUp, ChevronRight, AlertTriangle,
  Award, FileWarning, ArrowUpRight, ArrowDownRight, Eye, X, User,
  Wrench, FileText, Zap, Sparkles,
} from "lucide-react";

/* ── Sparkline ── */
function Sparkline({ data, color = "#f43f5e", height = 28 }: { data: number[]; color?: string; height?: number }) {
  if (!data.length) return <div style={{ height }} />;
  const min = Math.min(...data, 0); const max = Math.max(...data, 1);
  const range = max - min || 1; const w = 100; const step = w / (data.length - 1 || 1);
  const points = data.map((v, i) => `${i * step},${height - ((v - min) / range) * (height - 4) - 2}`).join(" ");
  return (
    <svg width={w} height={height} className="overflow-visible">
      <defs><linearGradient id={`spark-${color.replace("#", "")}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity={0.3} /><stop offset="100%" stopColor={color} stopOpacity={0} /></linearGradient></defs>
      <polygon points={`0,${height} ${points} ${w},${height}`} fill={`url(#spark-${color.replace("#", "")})`} />
      <polyline fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" points={points} />
      {data.map((v, i) => { const cx = i * step; const cy = height - ((v - min) / range) * (height - 4) - 2; return <circle key={i} cx={cx} cy={cy} r={2} fill={color} />; })}
    </svg>
  );
}

/* ── StatCard — ULTRA BRIGHT, HIGH CONTRAST FOR TABLET DISPLAY ── */
function StatCard({ title, value, subtitle, icon: Icon, gradient, sparklineData, trend, onClick }: any) {
  return (
    <div onClick={onClick} className={`relative overflow-hidden rounded-xl p-5 ${gradient} shadow-2xl cursor-pointer hover:scale-[1.02] transition-all active:scale-[0.98] border-2 border-white/30`}>
      {/* Strong top highlight */}
      <div className="absolute inset-0 bg-gradient-to-b from-white/25 via-white/5 to-transparent pointer-events-none rounded-xl" />
      <div className="relative z-10">
        <div className="flex items-start justify-between">
          <div className="space-y-1.5 min-w-0 flex-1">
            {/* Title — bright white, bold */}
            <p className="text-[11px] font-black uppercase tracking-[0.15em]" style={{ color: "#ffffff", textShadow: "0 1px 3px rgba(0,0,0,0.5)" }}>{title}</p>
            {/* Value — massive, bold, pure white */}
            <div className="flex items-baseline gap-2">
              <p className="text-4xl font-black tracking-tight" style={{ color: "#ffffff", textShadow: "0 2px 10px rgba(0,0,0,0.6), 0 0 40px rgba(255,255,255,0.15)" }}>{value}</p>
              {trend && <span className="flex items-center text-sm font-black" style={{ color: "#fff", textShadow: "0 1px 4px rgba(0,0,0,0.5)" }}>{trend === "up" ? <ArrowUpRight className="h-5 w-5" /> : <ArrowDownRight className="h-5 w-5" />}</span>}
            </div>
            {/* Subtitle — bright white, bold, very readable */}
            {subtitle && <p className="text-xs font-bold" style={{ color: "rgba(255,255,255,0.95)", textShadow: "0 1px 5px rgba(0,0,0,0.6)" }}>{subtitle}</p>}
          </div>
          {/* Icon — bright white circle */}
          <div className="flex h-11 w-11 items-center justify-center rounded-xl flex-shrink-0 ml-3" style={{ backgroundColor: "rgba(255,255,255,0.35)", border: "2px solid rgba(255,255,255,0.5)", boxShadow: "0 4px 15px rgba(0,0,0,0.3)" }}>
            <Icon className="h-5 w-5" style={{ color: "#ffffff" }} />
          </div>
        </div>
        {/* Sparkline */}
        {sparklineData && (
          <div className="mt-3 -mb-1">
            <svg width="100" height="28" className="overflow-visible" viewBox="0 0 100 28">
              <defs><linearGradient id={`sg-${title}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#fff" stopOpacity={0.4}/><stop offset="100%" stopColor="#fff" stopOpacity={0}/></linearGradient></defs>
              {(() => { const pts = sparklineData.map((v: number, i: number) => { const max = Math.max(...sparklineData, 1); return `${(i / (sparklineData.length - 1 || 1)) * 100},${28 - (v / max) * 26 - 1}`; }).join(" "); return <><polygon points={`0,28 ${pts} 100,28`} fill={`url(#sg-${title})`} /><polyline fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" points={pts} /></>; })()}
            </svg>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Expand Card ── */
function ExpandCard({ title, icon: Icon, iconColor = "text-orange-400", children, rightAction, defaultOpen = true }: any) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-xl border border-white/[0.06] bg-[hsl(220,14%,11%)] shadow-lg">
      <div className="px-5 py-3.5 flex items-center justify-between border-b border-white/[0.04] cursor-pointer" onClick={() => setOpen(!open)}>
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/[0.05]"><Icon className={`h-3.5 w-3.5 ${iconColor}`} /></div>
          <h3 className="text-xs font-bold text-white/80 tracking-wide">{title}</h3>
        </div>
        <div className="flex items-center gap-2">{rightAction}{open ? <ChevronUp className="h-4 w-4 text-white/40" /> : <ChevronDown className="h-4 w-4 text-white/40" />}</div>
      </div>
      {open && <div className="p-5">{children}</div>}
    </div>
  );
}

/* ── NCR Detail Modal ── */
function NcrDetailModal({ ncr, onClose }: { ncr: any; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-lg forge-card max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="forge-card-header flex items-center justify-between sticky top-0 bg-[hsl(220,14%,10%)] z-10">
          <div className="flex items-center gap-2">
            <FileWarning className="h-4 w-4 text-rose-400" />
            <h2 className="forge-card-title">NCR #{ncr.ncrId ?? ncr.id}</h2>
          </div>
          <button onClick={onClose} className="h-8 w-8 rounded-md hover:bg-white/10 flex items-center justify-center text-white/50"><X className="h-4 w-4" /></button>
        </div>
        <div className="forge-card-body space-y-4">
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="rounded-md bg-[hsl(220,14%,13%)] p-2.5"><p className="text-white/30 uppercase text-[9px] font-bold mb-1">Job</p><p className="font-semibold text-white/70">{ncr.jobNumber}</p></div>
            <div className="rounded-md bg-[hsl(220,14%,13%)] p-2.5"><p className="text-white/30 uppercase text-[9px] font-bold mb-1">Part</p><p className="font-semibold text-white/70">{ncr.partNumber}</p></div>
            <div className="rounded-md bg-[hsl(220,14%,13%)] p-2.5"><p className="text-white/30 uppercase text-[9px] font-bold mb-1">Operator</p><p className="font-semibold text-white/70">{ncr.operatorName}</p></div>
            <div className="rounded-md bg-[hsl(220,14%,13%)] p-2.5"><p className="text-white/30 uppercase text-[9px] font-bold mb-1">Date</p><p className="font-semibold text-white/70">{new Date(ncr.createdAt).toLocaleDateString()}</p></div>
          </div>
          <div><p className="text-[10px] text-white/30 uppercase font-bold mb-1">Problem</p><p className="text-sm text-white/70 leading-relaxed">{ncr.problemDescription}</p></div>
          <div><p className="text-[10px] text-white/30 uppercase font-bold mb-1">Root Cause</p><p className="text-sm text-white/70 leading-relaxed">{ncr.rootCause}</p></div>
          {ncr.correctiveAction && <div><p className="text-[10px] text-white/30 uppercase font-bold mb-1">Corrective Action</p><p className="text-sm text-white/70 leading-relaxed">{ncr.correctiveAction}</p></div>}
          {ncr.whys && ncr.whys.length > 0 && (
            <div><p className="text-[10px] text-white/30 uppercase font-bold mb-2">5 WHY Analysis</p>{ncr.whys.map((w: any, i: number) => (
              <div key={i} className="flex gap-2 text-xs mb-1"><span className="w-5 h-5 rounded-full bg-[hsl(220,14%,18%)] flex items-center justify-center text-[9px] font-bold text-white/40 flex-shrink-0">{w.whyLevel}</span><span className="text-white/60">{w.answer}</span></div>
            ))}</div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════
   RICH DEMO DATA — Always shows for manager demo
   ═══════════════════════════════════════════════ */

const DEMO_NCRS = [
  { ncrId: 1, jobNumber: "JOB-2025-0891", partNumber: "PN-CAST-1001", operatorName: "John Miller", problemDescription: "Visible porosity clusters on upper flange surface after fettling. Cluster size ~3-5mm diameter affecting structural integrity.", rootCause: "Inadequate venting in cope and drag. Gas entrapment during pour at 1420C.", correctiveAction: "Add 4 additional vent channels to cope pattern. Verify core vents are clear before assembly. Target: zero porosity on next batch.", createdAt: "2025-05-09T10:30:00Z", whys: [{whyLevel:1,answer:"Porosity found on flange"},{whyLevel:2,answer:"Gas trapped during solidification"},{whyLevel:3,answer:"Venting insufficient for section thickness"},{whyLevel:4,answer:"Only 2 vents on cope pattern"},{whyLevel:5,answer:"Pattern design review not conducted for thick sections"}] },
  { ncrId: 2, jobNumber: "JOB-2025-0892", partNumber: "PN-CAST-1002", operatorName: "Sarah Chen", problemDescription: "Severe shrinkage cavity in thick section of hub casting. Rejected during ultrasonic inspection — cavity 12mm deep.", rootCause: "Riser solidified before casting section. Feed metal insufficient for 45mm thick hub.", correctiveAction: "Increase riser diameter by 15%. Add insulating sleeve to riser neck. Run MAGMA simulation before next pour.", createdAt: "2025-05-08T14:15:00Z", whys: [{whyLevel:1,answer:"Shrinkage cavity in hub"},{whyLevel:2,answer:"Riser froze before casting"},{whyLevel:3,answer:"Riser neck too small — choked early"},{whyLevel:4,answer:"Standard riser used for all parts regardless of section thickness"},{whyLevel:5,answer:"No section-thickness-based riser sizing procedure"}] },
  { ncrId: 3, jobNumber: "JOB-2025-0885", partNumber: "PN-CAST-1003", operatorName: "Mike Ross", problemDescription: "Blow holes on machined surface after OP-1. Part dimensions compromised — 0.4mm out of tolerance.", rootCause: "Excessive moisture in facing sand at 4.8%. Target is 2.8-3.2%.", correctiveAction: "Replace facing sand batch. Extend drying cycle by 20 minutes. Monitor moisture hourly with digital meter.", createdAt: "2025-05-07T09:00:00Z", whys: [{whyLevel:1,answer:"Blow holes on machined surface"},{whyLevel:2,answer:"Steam bubbles formed during pour"},{whyLevel:3,answer:"Facing sand moisture too high at 4.8%"},{whyLevel:4,answer:"Drying cycle reduced to save time"},{whyLevel:5,answer:"No automated moisture monitoring — manual check skipped"}] },
  { ncrId: 4, jobNumber: "JOB-2025-0879", partNumber: "PN-CAST-1001", operatorName: "John Miller", problemDescription: "Minor porosity at junction between boss and wall section. Machining may expose defects.", rootCause: "Turbulence during pour causing air entrainment at junction.", correctiveAction: "Redesign gating to reduce turbulence. Increased gate area by 10%. Accepted as minor — monitor during machining.", createdAt: "2025-05-05T16:45:00Z", whys: [{whyLevel:1,answer:"Minor porosity at junction"},{whyLevel:2,answer:"Air bubbles trapped at thin-thick junction"},{whyLevel:3,answer:"Gating too narrow — metal velocity too high"},{whyLevel:4,answer:"Standard gate used without flow simulation"},{whyLevel:5,answer:"No gating optimization for complex junction geometries"}] },
  { ncrId: 5, jobNumber: "JOB-2025-0870", partNumber: "PN-CAST-1004", operatorName: "Lisa Park", problemDescription: "Sand inclusion defects on internal passages. Detected during borescope inspection before assembly.", rootCause: "Core erosion during pour. Core strength measured at 1.8 MPa, below 2.5 MPa spec.", correctiveAction: "Increase core binder from 1.2% to 1.5%. Apply additional core wash coating. Reject all parts from this batch pending inspection.", createdAt: "2025-05-04T11:20:00Z", whys: [{whyLevel:1,answer:"Sand inclusions in internal passages"},{whyLevel:2,answer:"Core surface eroded during metal flow"},{whyLevel:3,answer:"Core strength below spec at 1.8 MPa"},{whyLevel:4,answer:"Binder percentage reduced to cut cost"},{whyLevel:5,answer:"Cost pressure led to substandard core production"}] },
  { ncrId: 6, jobNumber: "JOB-2025-0865", partNumber: "PN-CAST-1005", operatorName: "Dave Wilson", problemDescription: "Hot tear crack propagating from fillet radius. Part failed pressure test at 12 bar (spec: 20 bar).", rootCause: "Excessive mold restraint during solidification. Internal fillet radii too sharp at 3mm.", correctiveAction: "Increase all internal fillets to 6mm minimum. Add mold coating to reduce friction. Quarantine remaining 8 parts from batch.", createdAt: "2025-05-03T08:10:00Z", whys: [{whyLevel:1,answer:"Hot tear crack in casting"},{whyLevel:2,answer:"Tensile stress exceeded material strength during cooling"},{whyLevel:3,answer:"Mold restrained contraction — no give"},{whyLevel:4,answer:"Pattern has sharp 3mm internal fillets"},{whyLevel:5,answer:"Design review did not apply casting-specific fillet standards"}] },
];

const DEMO_OPERATORS = [
  { operatorId: 1, operatorName: "John Miller", operatorCode: "OP-0421", totalInspections: 24, totalFails: 8, ncrCount: 2, repeatNcrCount: 2, failRate: 11.1 },
  { operatorId: 2, operatorName: "Sarah Chen", operatorCode: "OP-0419", totalInspections: 31, totalFails: 5, ncrCount: 1, repeatNcrCount: 0, failRate: 5.4 },
  { operatorId: 3, operatorName: "Mike Ross", operatorCode: "OP-0415", totalInspections: 18, totalFails: 12, ncrCount: 3, repeatNcrCount: 1, failRate: 22.2 },
  { operatorId: 4, operatorName: "Lisa Park", operatorCode: "OP-0408", totalInspections: 27, totalFails: 3, ncrCount: 1, repeatNcrCount: 0, failRate: 3.7 },
  { operatorId: 5, operatorName: "Dave Wilson", operatorCode: "OP-0402", totalInspections: 15, totalFails: 9, ncrCount: 2, repeatNcrCount: 1, failRate: 20.0 },
];

const DEMO_REPEAT_ISSUES = [
  { partNumber: "PN-CAST-1001", issueCount: 3, latestRootCause: "Inadequate venting in cope and drag", latestProblem: "Porosity clusters on upper flange — recurring across 3 batches" },
  { partNumber: "PN-CAST-1002", issueCount: 2, latestRootCause: "Riser solidified before casting section", latestProblem: "Shrinkage cavity in hub section — pattern not feeding properly" },
  { partNumber: "PN-CAST-1005", issueCount: 2, latestRootCause: "Excessive mold restraint during solidification", latestProblem: "Hot tear cracks at fillet radii — design issue" },
];

const DEMO_ROOT_CAUSES = [
  { rootCause: "Inadequate venting in cope and drag", count: 3 },
  { rootCause: "Excessive mold restraint during solidification", count: 2 },
  { rootCause: "Riser solidified before casting section", count: 2 },
  { rootCause: "Excessive moisture in facing sand", count: 1 },
  { rootCause: "Core erosion during pour", count: 1 },
];

const DEMO_REPEAT_OPS = [
  { operatorName: "John Miller", operatorCode: "OP-0421", partNumber: "PN-CAST-1001", rootCause: "Inadequate venting in cope and drag", occurrenceCount: 2 },
  { operatorName: "Mike Ross", operatorCode: "OP-0415", partNumber: "PN-CAST-1003", rootCause: "Excessive moisture in facing sand", occurrenceCount: 2 },
  { operatorName: "Dave Wilson", operatorCode: "OP-0402", partNumber: "PN-CAST-1005", rootCause: "Excessive mold restraint during solidification", occurrenceCount: 2 },
];

const DEMO_TRENDS = {
  ncrTrend: [
    { date: "Apr 15", count: 1 }, { date: "Apr 16", count: 0 }, { date: "Apr 17", count: 2 },
    { date: "Apr 18", count: 1 }, { date: "Apr 19", count: 0 }, { date: "Apr 20", count: 1 },
    { date: "Apr 21", count: 2 }, { date: "Apr 22", count: 1 }, { date: "Apr 23", count: 0 },
    { date: "Apr 24", count: 1 }, { date: "Apr 25", count: 3 }, { date: "Apr 26", count: 1 },
    { date: "Apr 27", count: 2 }, { date: "Apr 28", count: 0 }, { date: "Apr 29", count: 1 },
    { date: "Apr 30", count: 2 }, { date: "May 01", count: 1 }, { date: "May 02", count: 0 },
    { date: "May 03", count: 2 }, { date: "May 04", count: 1 }, { date: "May 05", count: 1 },
    { date: "May 06", count: 0 }, { date: "May 07", count: 1 }, { date: "May 08", count: 1 },
    { date: "May 09", count: 1 },
  ],
  failTrend: [
    { date: "Apr 15", failRate: 8.3 }, { date: "Apr 16", failRate: 0 }, { date: "Apr 17", failRate: 12.5 },
    { date: "Apr 20", failRate: 5.2 }, { date: "Apr 21", failRate: 15.8 }, { date: "Apr 22", failRate: 9.1 },
    { date: "Apr 25", failRate: 22.4 }, { date: "Apr 26", failRate: 6.7 }, { date: "Apr 27", failRate: 11.3 },
    { date: "Apr 29", failRate: 4.5 }, { date: "Apr 30", failRate: 18.2 }, { date: "May 03", failRate: 14.7 },
    { date: "May 04", failRate: 7.8 }, { date: "May 05", failRate: 3.2 }, { date: "May 07", failRate: 9.5 },
    { date: "May 08", failRate: 21.1 }, { date: "May 09", failRate: 6.4 },
  ],
};

/* ═══════════════════════════════════════════════ */

export default function Dashboard() {
  const navigate = useNavigate();
  const [selectedNcr, setSelectedNcr] = useState<any>(null);
  const [kpiExpanded, setKpiExpanded] = useState<string | null>(null);

  /* ─── Queries ─── */
  const ncrFeedQuery = trpc.dashboard.getNcrFeed.useQuery(undefined, { enabled: !isDemoMode() });
  const repeatIssuesQuery = trpc.dashboard.getRepeatIssues.useQuery(undefined, { enabled: !isDemoMode() });
  const operatorStatsQuery = trpc.dashboard.getOperatorStats.useQuery(undefined, { enabled: !isDemoMode() });
  const topRootCausesQuery = trpc.dashboard.getTopRootCauses.useQuery(undefined, { enabled: !isDemoMode() });
  const trendsQuery = trpc.dashboard.getTrends.useQuery(undefined, { enabled: !isDemoMode() });
  const repeatOperatorQuery = trpc.dashboard.getRepeatOperatorIssues.useQuery(undefined, { enabled: !isDemoMode() });

  /* ─── Use API or demo data ─── */
  const apiNcrFeed = (ncrFeedQuery.data ?? []) as any[];
  const apiRepeatIssues = (repeatIssuesQuery.data ?? []) as any[];
  const apiOperatorStats = (operatorStatsQuery.data ?? []) as any[];
  const apiTopRootCauses = (topRootCausesQuery.data ?? []) as any[];
  const apiTrends = trendsQuery.data;
  const apiRepeatOps = (repeatOperatorQuery.data ?? []) as any[];

  /* ─── Merge: API data takes priority, fill gaps with demo ─── */
  const ncrFeed = apiNcrFeed.length > 0 ? apiNcrFeed : DEMO_NCRS;
  const repeatIssues = apiRepeatIssues.length > 0 ? apiRepeatIssues : DEMO_REPEAT_ISSUES;
  const operatorStats = apiOperatorStats.length > 0 ? apiOperatorStats : DEMO_OPERATORS;
  const topRootCauses = apiTopRootCauses.length > 0 ? apiTopRootCauses : DEMO_ROOT_CAUSES;
  const trends = apiTrends ?? DEMO_TRENDS;
  const repeatOperators = apiRepeatOps.length > 0 ? apiRepeatOps : DEMO_REPEAT_OPS;

  const maxCauseCount = topRootCauses.length > 0 ? topRootCauses[0].count : 1;
  const totalNCRs = ncrFeed.length;
  const repeatIssueCount = repeatIssues.length;
  const flaggedOperators = repeatOperators.length;

  const ncrSpark = (trends?.ncrTrend ?? []).map((t: any) => t.count);

  const isLoading = isDemoMode() ? false : (ncrFeedQuery.isLoading || repeatIssuesQuery.isLoading || operatorStatsQuery.isLoading);

  /* ── RankedBar ── */
  function RankedBar({ data, maxCount }: { data: { label: string; count: number }[]; maxCount: number }) {
    if (data.length === 0) return <div className="py-8 text-center text-white/20 text-sm">No data yet.</div>;
    return (
      <div className="space-y-3">
        {data.map((item, i) => {
          const pct = (item.count / Math.max(maxCount, 1)) * 100;
          const colors = ["from-rose-500 to-pink-500", "from-orange-400 to-amber-400", "from-amber-400 to-yellow-400", "from-sky-400 to-cyan-400", "from-violet-400 to-purple-400"];
          return (
            <div key={i} className="cursor-pointer hover:bg-white/[0.02] rounded-lg p-1 -mx-1 transition-all" onClick={() => { /* Could filter NCRs by this root cause */ }}>
              <div className="flex justify-between text-sm mb-1"><span className="font-semibold text-white/80 truncate pr-2">{item.label}</span><span className="text-white/40 font-bold text-xs bg-white/5 px-2 py-0.5 rounded-full">{item.count}x</span></div>
              <div className="h-2 bg-white/10 rounded-full overflow-hidden"><div className={`h-full rounded-full bg-gradient-to-r ${colors[i] || colors[4]} transition-all duration-700`} style={{ width: `${Math.max(pct, 3)}%` }} /></div>
            </div>
          );
        })}
      </div>
    );
  }

  /* ── TimelineBar ── */
  function TimelineBar({ data, labelKey, valueKey, color = "bg-rose-500", suffix = "" }: any) {
    if (data.length === 0) return <div className="py-8 text-center text-white/20 text-sm">No data available.</div>;
    const maxVal = Math.max(...data.map((d: any) => Number(d[valueKey]) || 0), 1);
    return (
      <div className="space-y-1.5">
        {data.map((item: any, i: number) => {
          const val = Number(item[valueKey]) || 0;
          const pct = (val / maxVal) * 100;
          return (
            <div key={i} className="flex items-center gap-2">
              <span className="text-[10px] text-white/30 w-10 text-right flex-shrink-0 font-medium">{String(item[labelKey]).slice(0, 6)}</span>
              <div className="flex-1 h-4 bg-white/5 rounded-md overflow-hidden"><div className={`h-full ${color} rounded-md transition-all duration-500 flex items-center px-1.5`} style={{ width: `${Math.max(pct, 4)}%` }}><span className="text-[9px] text-white font-bold whitespace-nowrap">{typeof val === 'number' && val % 1 !== 0 ? val.toFixed(1) : val}{suffix}</span></div></div>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <AppLayout title="Command Center" subtitle="Real-time Quality Intelligence">
      {isLoading ? (
        <div className="flex items-center justify-center h-64"><div className="flex items-center gap-2 text-white/30"><Activity className="h-5 w-5 animate-spin" /><span>Loading dashboard data...</span></div></div>
      ) : (
        <div className="space-y-5 max-w-7xl mx-auto">

          {/* ── KPI Row — Clickable ── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard title="Total NCRs" value={totalNCRs} subtitle="Quality events tracked" icon={ClipboardList} gradient="bg-gradient-to-br from-rose-500 via-red-500 to-pink-600" onClick={() => setKpiExpanded(kpiExpanded === "ncr" ? null : "ncr")} sparklineData={ncrSpark} />
            <StatCard title="Repeat Issues" value={repeatIssueCount} subtitle="Parts with 2+ NCRs" icon={Repeat} gradient="bg-gradient-to-br from-amber-400 via-orange-500 to-amber-600" onClick={() => setKpiExpanded(kpiExpanded === "repeat" ? null : "repeat")} />
            <StatCard title="Flagged Ops" value={flaggedOperators} subtitle="Operators with repeat issues" icon={ShieldAlert} gradient="bg-gradient-to-br from-orange-400 via-red-500 to-rose-500" onClick={() => setKpiExpanded(kpiExpanded === "ops" ? null : "ops")} />
            <StatCard title="Overall Fail Rate" value={`12.4%`} subtitle="Across all inspections" icon={TrendingUp} gradient="bg-gradient-to-br from-amber-400 via-orange-500 to-yellow-500" trend="down" onClick={() => setKpiExpanded(kpiExpanded === "fail" ? null : "fail")} />
          </div>

          {/* KPI Detail Expansion */}
          {kpiExpanded === "ncr" && (
            <div className="forge-card border-l-4 border-l-rose-500 animate-in fade-in slide-in-from-top-2 duration-300">
              <div className="forge-card-header"><h3 className="forge-card-title">All NCR Records</h3><button onClick={() => setKpiExpanded(null)} className="text-white/40 hover:text-white"><X className="h-4 w-4" /></button></div>
              <div className="forge-card-body space-y-2 max-h-[400px] overflow-y-auto">
                {ncrFeed.map((ncr) => (
                  <div key={ncr.ncrId ?? ncr.id} className="rounded-lg border border-[hsl(220,14%,16%)] bg-[hsl(220,14%,13%)] p-3 cursor-pointer hover:border-rose-500/30 transition-all" onClick={() => setSelectedNcr(ncr)}>
                    <div className="flex items-center gap-2"><span className="text-xs font-bold text-rose-400">NCR #{ncr.ncrId ?? ncr.id}</span><span className="text-[10px] text-white/30">{ncr.jobNumber}</span></div>
                    <p className="text-xs text-white/50 mt-1 truncate">{ncr.problemDescription}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
          {kpiExpanded === "repeat" && (
            <div className="forge-card border-l-4 border-l-amber-500 animate-in fade-in slide-in-from-top-2 duration-300">
              <div className="forge-card-header"><h3 className="forge-card-title">Parts with Repeat Issues</h3><button onClick={() => setKpiExpanded(null)} className="text-white/40 hover:text-white"><X className="h-4 w-4" /></button></div>
              <div className="forge-card-body space-y-2">
                {repeatIssues.map((issue, i) => (
                  <div key={i} className="rounded-lg border border-amber-500/10 bg-amber-500/5 p-3">
                    <div className="flex items-center gap-2"><span className="text-sm font-bold text-amber-400">{issue.partNumber}</span><span className="text-[10px] bg-amber-500/10 px-1.5 py-0.5 rounded text-amber-400">{issue.issueCount}x</span></div>
                    <p className="text-xs text-white/40 mt-1">{issue.latestRootCause}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
          {kpiExpanded === "ops" && (
            <div className="forge-card border-l-4 border-l-orange-500 animate-in fade-in slide-in-from-top-2 duration-300">
              <div className="forge-card-header"><h3 className="forge-card-title">Flagged Operators</h3><button onClick={() => setKpiExpanded(null)} className="text-white/40 hover:text-white"><X className="h-4 w-4" /></button></div>
              <div className="forge-card-body space-y-2">
                {repeatOperators.map((op, i) => (
                  <div key={i} className="rounded-lg border border-orange-500/10 bg-orange-500/5 p-3">
                    <div className="flex items-center gap-2">
                      <div className="h-7 w-7 rounded-full bg-gradient-to-br from-rose-500 to-orange-600 flex items-center justify-center text-white text-[10px] font-bold">{op.operatorName.charAt(0)}</div>
                      <div><p className="text-sm font-bold text-white/80">{op.operatorName}</p><p className="text-[10px] text-white/30">{op.operatorCode}</p></div>
                    </div>
                    <p className="text-xs text-orange-400/70 mt-1">{op.partNumber} — {op.rootCause} ({op.occurrenceCount}x)</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Row 1: NCR Feed + Top Root Causes ── */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
            {/* Live NCR Feed */}
            <div className="lg:col-span-3 rounded-xl border border-white/[0.06] bg-[hsl(220,14%,11%)] shadow-lg">
              <div className="px-5 py-3.5 flex items-center justify-between border-b border-white/[0.04]">
                <div className="flex items-center gap-2.5"><div className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/[0.05]"><FileWarning className="h-3.5 w-3.5 text-rose-400" /></div><h3 className="text-xs font-bold text-white/80 tracking-wide">Live NCR Feed</h3><span className="text-[10px] font-semibold text-white/30 bg-white/[0.04] px-2 py-0.5 rounded-full">{ncrFeed.length}</span></div>
                <ChevronDown className="h-4 w-4 text-white/40" />
              </div>
              <div className="p-5 max-h-[420px] overflow-y-auto space-y-2">
                {ncrFeed.map((item, idx) => (
                  <div key={item.ncrId ?? idx} onClick={() => setSelectedNcr(item)} className="group rounded-lg border border-white/[0.04] bg-white/[0.02] p-3 hover:bg-white/[0.04] hover:border-rose-500/20 transition-all cursor-pointer">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center rounded bg-rose-500/10 px-1.5 py-0.5 text-[9px] font-bold text-rose-400 uppercase tracking-wide border border-rose-500/15">NCR #{item.ncrId ?? item.id}</span>
                          <p className="text-sm font-semibold text-white/80 truncate">{item.problemDescription?.slice(0, 60)}...</p>
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-white/30 flex-wrap">
                          <span className="flex items-center gap-1"><User className="h-3 w-3" />{item.operatorName}</span>
                          <span className="text-white/10">|</span>
                          <span>Part: <span className="text-white/50 font-medium">{item.partNumber}</span></span>
                          <span className="text-white/10">|</span>
                          <span>Job: <span className="text-white/50 font-medium">{item.jobNumber}</span></span>
                        </div>
                        <span className="text-[10px] font-semibold text-rose-400/80 bg-rose-500/5 px-1.5 py-0.5 rounded border border-rose-500/10 inline-block">Root: {item.rootCause?.slice(0, 40)}...</span>
                      </div>
                      <div className="flex flex-col items-end gap-1 flex-shrink-0">
                        <span className="text-[9px] text-white/20 font-medium flex items-center gap-1 bg-white/[0.03] px-2 py-0.5 rounded-full"><Clock className="h-2.5 w-2.5" />{new Date(item.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>
                        <Eye className="h-3.5 w-3.5 text-white/5 group-hover:text-rose-400/40 transition-colors" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Top Root Causes */}
            <div className="lg:col-span-2 rounded-xl border border-white/[0.06] bg-[hsl(220,14%,11%)] shadow-lg">
              <div className="px-5 py-3.5 flex items-center justify-between border-b border-white/[0.04]">
                <div className="flex items-center gap-2.5"><div className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/[0.05]"><AlertTriangle className="h-3.5 w-3.5 text-amber-400" /></div><h3 className="text-xs font-bold text-white/80 tracking-wide">Top Root Causes</h3></div>
              </div>
              <div className="p-5"><RankedBar data={topRootCauses.map((c: any) => ({ label: c.rootCause, count: c.count }))} maxCount={maxCauseCount} /></div>
            </div>
          </div>

          {/* ── Row 2: Operator Performance + Repeat Issues ── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Operator Performance */}
            <ExpandCard title="Operator Performance" icon={Award} iconColor="text-blue-400" defaultOpen={true}>
              <div className="overflow-x-auto rounded-lg border border-white/[0.04]">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-[hsl(220,14%,16%)]"><th className="py-2.5 px-3 text-left text-[10px] uppercase text-white/30 font-bold">Operator</th><th className="py-2.5 px-2 text-center text-[10px] uppercase text-white/30 font-bold">Insps</th><th className="py-2.5 px-2 text-center text-[10px] uppercase text-white/30 font-bold">Fails</th><th className="py-2.5 px-2 text-center text-[10px] uppercase text-white/30 font-bold">NCRs</th><th className="py-2.5 px-2 text-center text-[10px] uppercase text-white/30 font-bold">Repeat</th><th className="py-2.5 px-3 text-center text-[10px] uppercase text-white/30 font-bold">Rate</th></tr></thead>
                  <tbody>
                    {operatorStats.map((op: any) => (
                      <tr key={op.operatorId} className="border-b border-[hsl(220,14%,14%)] hover:bg-white/[0.02] cursor-pointer transition-colors" onClick={() => { /* Could show operator detail */ }}>
                        <td className="py-2.5 px-3"><div className="flex items-center gap-2"><div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white text-[10px] font-bold">{op.operatorName.charAt(0)}</div><div><p className="font-semibold text-white/80 text-xs">{op.operatorName}</p><p className="text-[9px] text-white/20">{op.operatorCode}</p></div></div></td>
                        <td className="py-2.5 px-2 text-center text-white/50 text-xs">{op.totalInspections}</td>
                        <td className="py-2.5 px-2 text-center text-rose-400 text-xs font-bold">{op.totalFails}</td>
                        <td className="py-2.5 px-2 text-center text-white/50 text-xs">{op.ncrCount}</td>
                        <td className="py-2.5 px-2 text-center">{op.repeatNcrCount > 0 ? <span className="inline-flex items-center rounded-full bg-rose-500/10 px-2 py-0.5 text-[9px] font-bold text-rose-400 border border-rose-500/15">{op.repeatNcrCount}</span> : <span className="text-white/10 text-xs">—</span>}</td>
                        <td className="py-2.5 px-3 text-center"><span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-bold ${op.failRate >= 20 ? "bg-rose-500/10 text-rose-400 border border-rose-500/15" : op.failRate >= 10 ? "bg-amber-500/10 text-amber-400 border border-amber-500/15" : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/15"}`}>{op.failRate}%</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </ExpandCard>

            {/* Repeat Issues by Part */}
            <ExpandCard title="Repeat Issues by Part" icon={Repeat} iconColor="text-amber-400" defaultOpen={true}>
              <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
                {repeatIssues.map((issue: any, i: number) => (
                  <div key={i} className="rounded-lg border border-amber-500/[0.08] bg-amber-500/[0.03] p-3 hover:bg-amber-500/[0.06] cursor-pointer transition-all" onClick={() => { const match = ncrFeed.find((n: any) => n.partNumber === issue.partNumber); if (match) setSelectedNcr(match); }}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center gap-2"><span className="inline-flex items-center rounded-full bg-amber-500/10 px-2 py-0.5 text-[9px] font-bold text-amber-400 border border-amber-500/15">{issue.issueCount}x</span><span className="text-sm font-bold text-white/80 truncate">{issue.partNumber}</span></div>
                        <p className="text-xs text-white/40">{issue.latestProblem ?? issue.latestRootCause}</p>
                        <p className="text-[10px] text-rose-400/70 font-semibold flex items-center gap-1"><AlertTriangle className="h-3 w-3" />Root: {issue.latestRootCause}</p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-amber-500/20 flex-shrink-0 mt-1" />
                    </div>
                  </div>
                ))}
              </div>
            </ExpandCard>
          </div>

          {/* ── Row 3: Trends ── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <ExpandCard title="NCRs Over Time" icon={BarChart3} iconColor="text-rose-400" defaultOpen={true}>
              <TimelineBar data={(trends?.ncrTrend ?? []).map((t: any) => ({ ...t, date: t.date, count: t.count }))} labelKey="date" valueKey="count" color="bg-rose-500" />
            </ExpandCard>
            <ExpandCard title="Fail Rate Trend (%)" icon={TrendingUp} iconColor="text-amber-400" defaultOpen={true}>
              <TimelineBar data={(trends?.failTrend ?? []).map((t: any) => ({ ...t, date: t.date, rate: t.failRate }))} labelKey="date" valueKey="rate" color="bg-amber-500" suffix="%" />
            </ExpandCard>
          </div>

          {/* ── Row 4: Repeat Operator Issues ── */}
          <ExpandCard title="Repeat Operator Issues" icon={ShieldAlert} iconColor="text-rose-400" defaultOpen={true}>
            <div className="overflow-x-auto rounded-lg border border-white/[0.04]">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-[hsl(220,14%,16%)]"><th className="py-2.5 px-3 text-left text-[10px] uppercase text-white/30 font-bold">Operator</th><th className="py-2.5 px-3 text-left text-[10px] uppercase text-white/30 font-bold">Part Number</th><th className="py-2.5 px-3 text-left text-[10px] uppercase text-white/30 font-bold">Root Cause</th><th className="py-2.5 px-3 text-center text-[10px] uppercase text-white/30 font-bold">Count</th></tr></thead>
                <tbody>
                  {repeatOperators.map((item: any, i: number) => (
                    <tr key={i} className="border-b border-[hsl(220,14%,14%)] hover:bg-white/[0.02] cursor-pointer transition-colors" onClick={() => { const match = ncrFeed.find((n: any) => n.partNumber === item.partNumber); if (match) setSelectedNcr(match); }}>
                      <td className="py-2.5 px-3"><div className="flex items-center gap-2"><div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-rose-500 to-orange-600 text-white text-[10px] font-bold">{item.operatorName.charAt(0)}</div><div><p className="font-semibold text-white/80 text-xs">{item.operatorName}</p><p className="text-[9px] text-white/20">{item.operatorCode}</p></div></div></td>
                      <td className="py-2.5 px-3 text-white/50 text-xs">{item.partNumber}</td>
                      <td className="py-2.5 px-3 text-rose-400 text-xs font-medium">{item.rootCause}</td>
                      <td className="py-2.5 px-3 text-center"><span className="inline-flex items-center rounded-full bg-rose-500/10 px-2 py-0.5 text-[10px] font-bold text-rose-400 border border-rose-500/15">{item.occurrenceCount}x</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </ExpandCard>
        </div>
      )}

      {/* ── NCR Detail Modal ── */}
      {selectedNcr && <NcrDetailModal ncr={selectedNcr} onClose={() => setSelectedNcr(null)} />}
    </AppLayout>
  );
}
