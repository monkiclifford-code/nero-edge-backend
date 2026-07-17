import { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate, useParams } from "react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/providers/trpc";
import { isDemoMode, demoApi } from "@/lib/demoApi";
import AppLayout from "@/components/layout/AppLayout";
import {
  Plus,
  Trash2,
  Save,
  AlertCircle,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  ClipboardList,
  Brain,
  Lightbulb,
  FileText,
} from "lucide-react";

interface InspectionRow {
  id: string;
  dimensionName: string;
  nominalValue: string;
  tolerancePlus: string;
  toleranceMinus: string;
  measuredValue: string;
}

function generateId() { return Math.random().toString(36).substring(2, 9); }

function evaluateRow(row: InspectionRow): { isPass: boolean | null; upper: number; lower: number } {
  const nominal = parseFloat(row.nominalValue);
  const plus = parseFloat(row.tolerancePlus);
  const minus = parseFloat(row.toleranceMinus);
  const measured = parseFloat(row.measuredValue);
  if (isNaN(nominal) || isNaN(plus) || isNaN(minus) || isNaN(measured)) return { isPass: null, upper: NaN, lower: NaN };
  const upper = nominal + plus;
  const lower = nominal - minus;
  return { isPass: measured >= lower && measured <= upper, upper, lower };
}

function isRowComplete(row: InspectionRow): boolean {
  return row.dimensionName.trim() !== "" && row.nominalValue.trim() !== "" && row.tolerancePlus.trim() !== "" && row.toleranceMinus.trim() !== "" && row.measuredValue.trim() !== "" && !isNaN(parseFloat(row.nominalValue)) && !isNaN(parseFloat(row.tolerancePlus)) && !isNaN(parseFloat(row.toleranceMinus)) && !isNaN(parseFloat(row.measuredValue));
}

export default function InspectionForm() {
  const navigate = useNavigate();
  const { jobId } = useParams<{ jobId: string }>();
  const [operator, setOperator] = useState<{ id: number; name: string } | null>(null);
  const [rows, setRows] = useState<InspectionRow[]>([{ id: generateId(), dimensionName: "", nominalValue: "", tolerancePlus: "", toleranceMinus: "", measuredValue: "" }]);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showFailModal, setShowFailModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveResult, setSaveResult] = useState<{ duration: number; fails: number } | null>(null);
  const [savedInspectionId, setSavedInspectionId] = useState<number | null>(null);
  const [preWarnData, setPreWarnData] = useState<ReturnType<typeof demoApi.getPreInspectionWarning> | null>(null);
  const startTimeRef = useRef<string>(new Date().toISOString());

  useEffect(() => {
    const saved = localStorage.getItem("cnc_operator");
    if (!saved) { navigate("/"); return; }
    try { setOperator(JSON.parse(saved)); } catch { navigate("/"); }
  }, [navigate]);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => { if (hasUnsavedChanges) { e.preventDefault(); e.returnValue = ""; } };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasUnsavedChanges]);

  const jobQuery = trpc.job.getById.useQuery({ id: Number(jobId) }, { enabled: !!jobId && !isNaN(Number(jobId)) && !isDemoMode() });
  const preInspectionWarning = trpc.ai.getPreInspectionWarning.useQuery(
    { operatorId: operator?.id ?? 0, partNumber: (isDemoMode() ? demoApi.getJobById(Number(jobId)) : jobQuery.data)?.partNumber ?? "" },
    { enabled: !!operator?.id && ((isDemoMode() ? demoApi.getJobById(Number(jobId)) : jobQuery.data)?.partNumber ?? "").length > 0 && !isDemoMode() }
  );

  const createInspection = trpc.inspection.create.useMutation({
    onSuccess: (data) => {
      setSaved(true); setError(""); setHasUnsavedChanges(false); setIsSaving(false);
      setSaveResult({ duration: data.durationSeconds ?? 0, fails: data.failCount ?? 0 });
      setSavedInspectionId(data.inspectionId ?? null);
    },
    onError: () => {
      if (isDemoMode() && operator && jobId) {
        const items = rows.filter(isRowComplete).map((r) => {
          const { isPass } = evaluateRow(r);
          return { dimensionName: r.dimensionName.trim(), nominalValue: parseFloat(r.nominalValue), tolerancePlus: parseFloat(r.tolerancePlus), toleranceMinus: parseFloat(r.toleranceMinus), measuredValue: parseFloat(r.measuredValue), isPass: isPass ?? false };
        });
        const result = demoApi.createInspection({ jobId: Number(jobId), operatorId: operator.id, notes: notes.trim() || undefined, items });
        setSaved(true); setError(""); setHasUnsavedChanges(false); setIsSaving(false);
        setSaveResult({ duration: result.durationSeconds ?? 0, fails: result.failCount ?? 0 });
        setSavedInspectionId(result.inspectionId ?? null);
        return;
      }
      setError("Failed to save inspection. Please try again."); setIsSaving(false);
    },
  });

  useEffect(() => {
    if (isDemoMode() && operator && jobId) {
      const job = demoApi.getJobById(Number(jobId));
      if (job) setPreWarnData(demoApi.getPreInspectionWarning(operator.id, job.partNumber));
    }
  }, [operator, jobId]);

  const addRow = () => { setRows((prev) => [...prev, { id: generateId(), dimensionName: "", nominalValue: "", tolerancePlus: "", toleranceMinus: "", measuredValue: "" }]); setSaved(false); setHasUnsavedChanges(true); };
  const removeRow = (id: string) => { setRows((prev) => prev.filter((r) => r.id !== id)); setSaved(false); setHasUnsavedChanges(true); };
  const updateRow = (id: string, field: keyof InspectionRow, value: string) => { setRows((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: value } : r))); setSaved(false); setHasUnsavedChanges(true); };

  const hasFailures = useCallback(() => rows.some((row) => evaluateRow(row).isPass === false), [rows]);

  const handleSave = () => {
    setError(""); setSaved(false); setSaveResult(null);
    if (!operator) { setError("No operator logged in."); return; }
    if (!jobId || isNaN(Number(jobId))) { setError("Invalid job."); return; }
    const incompleteRows = rows.filter((r) => !isRowComplete(r));
    if (incompleteRows.length > 0) { setError(`All rows must be fully filled. ${incompleteRows.length} row(s) are incomplete.`); return; }
    const items = rows.map((r) => { const { isPass } = evaluateRow(r); return { dimensionName: r.dimensionName.trim(), nominalValue: parseFloat(r.nominalValue), tolerancePlus: parseFloat(r.tolerancePlus), toleranceMinus: parseFloat(r.toleranceMinus), measuredValue: parseFloat(r.measuredValue), isPass: isPass ?? false }; });
    const failCount = items.filter((i) => !i.isPass).length;
    if (failCount > 0 && notes.trim().length === 0) { setShowFailModal(true); return; }
    setIsSaving(true);
    createInspection.mutate({ jobId: Number(jobId), operatorId: operator.id, notes: notes.trim() || undefined, startedAt: startTimeRef.current, items });
  };

  const job = isDemoMode() ? demoApi.getJobById(Number(jobId)) : jobQuery.data;
  const preWarn = isDemoMode() ? preWarnData : preInspectionWarning.data;

  return (
    <AppLayout
      title="Digital Inspection"
      subtitle={job ? `Job: ${job.jobNumber} | Part: ${job.partNumber} | Rev: ${job.revision}` : ""}
      showBack
      onBack={() => navigate("/job-entry")}
      action={
        <button className="forge-btn-secondary flex items-center gap-2" onClick={() => navigate(`/setup-sheet/${jobId}`)}>
          <FileText className="h-4 w-4" /> Setup Sheet
        </button>
      }
    >
      <div className="max-w-5xl mx-auto space-y-5">
        {preWarn?.hasWarning && (
          <div className="forge-card border-l-4 border-l-rose-500">
            <div className="forge-card-body">
              <div className="flex items-start gap-3">
                <Brain className="h-5 w-5 text-rose-400 flex-shrink-0 mt-0.5" />
                <div className="space-y-2 w-full">
                  <p className="text-sm font-bold text-white/90">You previously had {preWarn.previousIssueCount} issue{preWarn.previousIssueCount! > 1 ? "s" : ""} on this part</p>
                  {preWarn.previousIssues?.map((issue, i) => (
                    <div key={i} className="rounded-lg bg-[hsl(220,14%,13%)] border border-[hsl(220,14%,18%)] p-3 text-sm">
                      <p className="text-rose-300 font-semibold">Previous root cause: {issue.rootCause}</p>
                      <p className="text-white/50 mt-1 flex items-start gap-1"><Lightbulb className="h-4 w-4 text-emerald-400 mt-0.5 flex-shrink-0" />{issue.correctiveAction}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Inspection Dimensions */}
        <div className="forge-card">
          <div className="forge-card-header">
            <h2 className="forge-card-title flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-emerald-400" /> Inspection Dimensions
            </h2>
          </div>
          <div className="forge-card-body space-y-4">
            <div className="hidden md:grid grid-cols-12 gap-3 text-[11px] font-semibold uppercase tracking-wider text-white/40 px-1">
              <div className="col-span-3">Dimension</div>
              <div className="col-span-2">Nominal</div>
              <div className="col-span-1 text-center">Tol +</div>
              <div className="col-span-1 text-center">Tol -</div>
              <div className="col-span-2">Measured</div>
              <div className="col-span-2">Result</div>
              <div className="col-span-1"></div>
            </div>
            {rows.map((row, index) => {
              const { isPass, upper, lower } = evaluateRow(row);
              const hasResult = isPass !== null;
              const complete = isRowComplete(row);
              const rowBg = hasResult
                ? (isPass ? "border-emerald-500/30 bg-emerald-950/20" : "border-rose-500/30 bg-rose-950/20")
                : complete
                  ? "border-[hsl(220,14%,18%)] bg-[hsl(220,14%,11%)]"
                  : "border-amber-500/20 bg-amber-950/10";
              return (
                <div key={row.id} className={`rounded-lg border p-3 md:p-4 transition-colors ${rowBg}`}>
                  <div className="md:hidden mb-2 text-sm font-semibold text-white/40">Row {index + 1}</div>
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-start">
                    <div className="md:col-span-3">
                      <Label className="md:hidden text-xs font-semibold mb-1 block text-white/50">Dimension</Label>
                      <Input value={row.dimensionName} onChange={(e) => updateRow(row.id, "dimensionName", e.target.value)} placeholder="e.g. OD @ Section A" className={`forge-input ${!complete && row.dimensionName.trim() === "" ? "border-amber-500/50" : ""}`} />
                    </div>
                    <div className="md:col-span-2">
                      <Label className="md:hidden text-xs font-semibold mb-1 block text-white/50">Nominal</Label>
                      <Input type="number" step="0.0001" value={row.nominalValue} onChange={(e) => updateRow(row.id, "nominalValue", e.target.value)} placeholder="0.0000" className={`forge-input ${!complete && (row.nominalValue.trim() === "" || isNaN(parseFloat(row.nominalValue))) ? "border-amber-500/50" : ""}`} />
                    </div>
                    <div className="md:col-span-1">
                      <Label className="md:hidden text-xs font-semibold mb-1 block text-white/50">Tol +</Label>
                      <Input type="number" step="0.0001" value={row.tolerancePlus} onChange={(e) => updateRow(row.id, "tolerancePlus", e.target.value)} placeholder="+" className={`forge-input text-center ${!complete && (row.tolerancePlus.trim() === "" || isNaN(parseFloat(row.tolerancePlus))) ? "border-amber-500/50" : ""}`} />
                    </div>
                    <div className="md:col-span-1">
                      <Label className="md:hidden text-xs font-semibold mb-1 block text-white/50">Tol -</Label>
                      <Input type="number" step="0.0001" value={row.toleranceMinus} onChange={(e) => updateRow(row.id, "toleranceMinus", e.target.value)} placeholder="-" className={`forge-input text-center ${!complete && (row.toleranceMinus.trim() === "" || isNaN(parseFloat(row.toleranceMinus))) ? "border-amber-500/50" : ""}`} />
                    </div>
                    <div className="md:col-span-2">
                      <Label className="md:hidden text-xs font-semibold mb-1 block text-white/50">Measured</Label>
                      <Input type="number" step="0.0001" value={row.measuredValue} onChange={(e) => updateRow(row.id, "measuredValue", e.target.value)} placeholder="0.0000" className={`forge-input font-semibold ${!complete && (row.measuredValue.trim() === "" || isNaN(parseFloat(row.measuredValue))) ? "border-amber-500/50" : hasResult ? (isPass ? "border-emerald-500/50" : "border-rose-500/50") : ""}`} />
                    </div>
                    <div className="md:col-span-2 flex items-center gap-2">
                      <Label className="md:hidden text-xs font-semibold mb-1 block text-white/50">Result</Label>
                      {hasResult ? (
                        <div className={`flex items-center gap-2 rounded-md px-3 py-2 text-xs font-bold w-full justify-center ${isPass ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20" : "bg-rose-500/15 text-rose-400 border border-rose-500/20"}`}>
                          {isPass ? <><CheckCircle2 className="h-4 w-4" /> PASS</> : <><XCircle className="h-4 w-4" /> FAIL</>}
                        </div>
                      ) : <div className="text-xs text-white/30 w-full text-center py-2">Enter values</div>}
                    </div>
                    <div className="md:col-span-1 flex items-center justify-end">
                      <Button variant="ghost" size="sm" className="h-10 w-10 text-rose-400 hover:bg-rose-500/10" onClick={() => removeRow(row.id)} disabled={rows.length === 1}>
                        <Trash2 className="h-5 w-5" />
                      </Button>
                    </div>
                  </div>
                  {hasResult && <div className="mt-2 text-xs text-white/30 md:pl-1">Limits: {lower.toFixed(4)} to {upper.toFixed(4)}</div>}
                </div>
              );
            })}
            <button className="w-full h-12 text-sm font-semibold border-dashed border-2 border-[hsl(220,14%,20%)] hover:border-[hsl(220,14%,30%)] hover:bg-white/5 rounded-md transition-all flex items-center justify-center gap-2 text-white/60" onClick={addRow}>
              <Plus className="h-5 w-5" /> Add Dimension Row
            </button>
          </div>
        </div>

        {/* Notes */}
        <div className="forge-card">
          <div className="forge-card-header">
            <h2 className="forge-card-title">
              Notes
              {hasFailures() && <span className="ml-2 text-xs font-normal text-rose-400 normal-case tracking-normal flex items-center gap-1"><AlertTriangle className="h-3.5 w-3.5" /> Required — out-of-tolerance detected</span>}
            </h2>
          </div>
          <div className="forge-card-body">
            <textarea
              value={notes}
              onChange={(e) => { setNotes(e.target.value); setHasUnsavedChanges(true); }}
              placeholder={hasFailures() ? "Out-of-tolerance detected. You MUST explain the issue before saving..." : "Enter any inspection notes, anomalies, or observations..."}
              className={`w-full rounded-md border bg-[hsl(220,14%,13%)] px-3 py-2 text-sm text-white placeholder:text-white/30 focus-visible:outline-none focus-visible:ring-1 min-h-[100px] ${hasFailures() && notes.trim() === "" ? "border-rose-500/50 focus-visible:ring-rose-500/30" : "border-[hsl(220,14%,20%)] focus-visible:ring-[hsl(24,95%,53%)]/30"}`}
            />
          </div>
        </div>

        {error && <div className="rounded-lg bg-rose-950/40 border border-rose-500/20 p-4 text-rose-300 text-sm font-medium flex items-start gap-2"><AlertTriangle className="h-5 w-5 mt-0.5 flex-shrink-0" />{error}</div>}
        {saved && saveResult && (
          <div className="rounded-lg bg-emerald-950/40 border border-emerald-500/20 p-4 text-emerald-300 text-sm font-medium flex items-start gap-3">
            <CheckCircle2 className="h-5 w-5 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-bold">Inspection saved successfully!</p>
              <p className="text-xs mt-1">Duration: {Math.floor(saveResult.duration / 60)}m {saveResult.duration % 60}s | Failed dimensions: {saveResult.fails}</p>
              {saveResult.fails > 0 && savedInspectionId && jobId && (
                <button className="mt-3 h-12 px-4 text-sm font-bold bg-rose-600 hover:bg-rose-500 text-white rounded-md transition-all flex items-center gap-2" onClick={() => navigate(`/ncr/${jobId}/${savedInspectionId}`)}>
                  <ClipboardList className="h-4 w-4" /> Create NCR — Serious Issue
                </button>
              )}
            </div>
          </div>
        )}

        <Button className="w-full h-16 text-lg font-bold bg-[hsl(220,14%,16%)] hover:bg-[hsl(220,14%,20%)] text-white border border-[hsl(220,14%,24%)] mb-4 disabled:opacity-60" onClick={handleSave} disabled={isSaving}>
          {isSaving ? <><Loader2 className="mr-3 h-6 w-6 animate-spin" /> Saving...</> : <><Save className="mr-3 h-6 w-6" /> Save Inspection Results</>}
        </Button>
      </div>

      {showFailModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-lg forge-card shadow-2xl">
            <div className="forge-card-header">
              <h2 className="forge-card-title text-rose-400 flex items-center gap-2"><AlertTriangle className="h-5 w-5" /> Out of Tolerance Detected</h2>
            </div>
            <div className="forge-card-body space-y-4">
              <p className="text-sm text-white/70">One or more dimensions are out of tolerance. Before saving, you must enter an explanation in the Notes field describing the issue.</p>
              <div className="flex gap-3">
                <button className="forge-btn-primary flex-1" onClick={() => setShowFailModal(false)}>Go Back & Add Notes</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
