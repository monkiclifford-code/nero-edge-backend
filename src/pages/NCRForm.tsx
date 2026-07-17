import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/providers/trpc";
import { isDemoMode, demoApi } from "@/lib/demoApi";
import AppLayout from "@/components/layout/AppLayout";
import {
  Save,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  ClipboardList,
  Brain,
} from "lucide-react";

interface WhyEntry {
  level: number;
  answer: string;
}

export default function NCRForm() {
  const navigate = useNavigate();
  const { jobId, inspectionId } = useParams<{ jobId: string; inspectionId: string }>();
  const [operator, setOperator] = useState<{ id: number; name: string } | null>(null);

  const [problemDescription, setProblemDescription] = useState("");
  const [whys, setWhys] = useState<WhyEntry[]>([
    { level: 1, answer: "" },
    { level: 2, answer: "" },
    { level: 3, answer: "" },
    { level: 4, answer: "" },
    { level: 5, answer: "" },
  ]);
  const [rootCause, setRootCause] = useState("");
  const [correctiveAction, setCorrectiveAction] = useState("");

  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Suggestions state
  const [showRootSuggestions, setShowRootSuggestions] = useState(false);
  const [showActionSuggestions, setShowActionSuggestions] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("cnc_operator");
    if (!saved) {
      navigate("/");
      return;
    }
    try {
      setOperator(JSON.parse(saved));
    } catch {
      navigate("/");
    }
  }, [navigate]);

  const jobQuery = trpc.job.getById.useQuery(
    { id: Number(jobId) },
    { enabled: !!jobId && !isNaN(Number(jobId)) && !isDemoMode() }
  );

  const inspectionItemsQuery = trpc.inspection.getItems.useQuery(
    { inspectionId: Number(inspectionId) },
    { enabled: !!inspectionId && !isNaN(Number(inspectionId)) && !isDemoMode() }
  );

  // Repeat detection: fetch NCRs for same part number
  const repeatNcrQuery = trpc.ncr.getByPartNumber.useQuery(
    { partNumber: (isDemoMode() ? demoApi.getJobById(Number(jobId)) : jobQuery.data)?.partNumber ?? "" },
    { enabled: ((isDemoMode() ? demoApi.getJobById(Number(jobId)) : jobQuery.data)?.partNumber ?? "").length > 0 && !isDemoMode() }
  );

  // ENHANCED: Ranked suggestions with confidence
  const rootSuggestionQuery = trpc.ai.getRankedSuggestions.useQuery(
    { keyword: rootCause.length >= 2 ? rootCause : "x" },
    { enabled: rootCause.length >= 2 && !isDemoMode() }
  );

  const actionSuggestionQuery = trpc.ai.getRankedSuggestions.useQuery(
    { keyword: correctiveAction.length >= 2 ? correctiveAction : "x" },
    { enabled: correctiveAction.length >= 2 && !isDemoMode() }
  );

  // Operator coaching alert: same operator + same root cause
  const coachingAlert = trpc.ai.getCoachingAlert.useQuery(
    {
      operatorId: operator?.id ?? 0,
      rootCause: rootCause.length >= 3 ? rootCause : "x",
    },
    { enabled: operator?.id !== undefined && rootCause.length >= 3 && !isDemoMode() }
  );

  const createNcr = trpc.ncr.create.useMutation({
    onSuccess: () => {
      setSaved(true);
      setError("");
      setIsSaving(false);
    },
    onError: () => {
      if (isDemoMode() && operator && jobId) {
        demoApi.createNcr({
          jobId: Number(jobId),
          operatorId: operator.id,
          inspectionId: Number(inspectionId),
          problemDescription: problemDescription.trim(),
          whys: whys.map((w) => ({ whyLevel: w.level, answer: w.answer.trim() })),
          rootCause: rootCause.trim(),
          correctiveAction: correctiveAction.trim(),
        });
        setSaved(true);
        setError("");
        setIsSaving(false);
        return;
      }
      setError("Failed to save NCR. Please try again.");
      setIsSaving(false);
    },
  });

  // Auto-fill problem description from failed inspection items
  useEffect(() => {
    const items = isDemoMode()
      ? (inspectionId ? demoApi.getInspectionItems(Number(inspectionId)) : [])
      : (inspectionItemsQuery.data ?? []);
    if (items && items.length > 0) {
      const failures = items.filter((item: any) => item.isPass === false);
      if (failures.length > 0) {
        const desc = failures
          .map(
            (f: any) =>
              `${f.dimensionName}: measured ${Number(f.measuredValue).toFixed(4)} vs nominal ${Number(f.nominalValue).toFixed(4)} (tolerance \u00b1${Number(f.tolerancePlus).toFixed(4)})`
          )
          .join("; ");
        setProblemDescription(desc);
      }
    }
  }, [inspectionItemsQuery.data, inspectionId]);

  // Get repeat NCR for display
  const getRepeatNcr = () => {
    if (isDemoMode()) {
      const job = demoApi.getJobById(Number(jobId));
      if (!job) return null;
      const ncrs = demoApi.getNcrByPartNumber(job.partNumber);
      if (ncrs.length === 0) return null;
      const keywords = problemDescription
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((w) => w.length > 3);
      for (const prev of ncrs) {
        const prevText = (prev.problemDescription ?? "").toLowerCase();
        const matchCount = keywords.filter((k) => prevText.includes(k)).length;
        if (matchCount >= 2) return prev;
      }
      return null;
    }
    if (!repeatNcrQuery.data || repeatNcrQuery.data.length === 0) return null;
    const keywords = problemDescription
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length > 3);
    for (const prev of repeatNcrQuery.data) {
      const prevText = (prev.problemDescription ?? "").toLowerCase();
      const matchCount = keywords.filter((k) => prevText.includes(k)).length;
      if (matchCount >= 2) return prev;
    }
    return null;
  };

  const handleSave = () => {
    setError("");
    setSaved(false);
    if (!operator) {
      setError("No operator logged in.");
      return;
    }
    if (!jobId || isNaN(Number(jobId))) {
      setError("Invalid job.");
      return;
    }
    if (!problemDescription.trim()) {
      setError("Problem Description is required.");
      return;
    }
    if (whys.some((w) => !w.answer.trim())) {
      setError("All 5 WHY fields must be filled.");
      return;
    }
    if (!rootCause.trim()) {
      setError("Root Cause is required.");
      return;
    }
    if (!correctiveAction.trim()) {
      setError("Corrective Action is required.");
      return;
    }
    setIsSaving(true);
    createNcr.mutate({
      jobId: Number(jobId),
      operatorId: operator.id,
      inspectionId: Number(inspectionId),
      problemDescription: problemDescription.trim(),
      whys: whys.map((w) => ({ whyLevel: w.level, answer: w.answer.trim() })),
      rootCause: rootCause.trim(),
      correctiveAction: correctiveAction.trim(),
    });
  };

  const repeatNcr = getRepeatNcr();
  const job = isDemoMode() ? demoApi.getJobById(Number(jobId)) : jobQuery.data;
  const alert = isDemoMode() ? null : coachingAlert.data;

  return (
    <AppLayout
      title="NCR — 5 WHY"
      subtitle={job ? `Job: ${job.jobNumber} | Part: ${job.partNumber} | Rev: ${job.revision}` : ""}
      showBack
      onBack={() => navigate(`/inspection/${jobId}`)}
    >
      <div className="max-w-4xl mx-auto space-y-5">
        {/* Repeat Detection Banner */}
        {repeatNcr && (
          <div className="forge-card border-l-4 border-l-amber-500">
            <div className="forge-card-body">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-400 flex-shrink-0 mt-0.5" />
                <div className="space-y-2 w-full">
                  <p className="text-sm font-bold text-white/90">This issue has occurred before on this part!</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                    <div className="rounded-lg bg-[hsl(220,14%,13%)] border border-[hsl(220,14%,18%)] p-3">
                      <p className="font-semibold text-amber-300 text-xs uppercase tracking-wider">Previous Root Cause</p>
                      <p className="text-white/70 mt-1">{repeatNcr.rootCause}</p>
                    </div>
                    <div className="rounded-lg bg-[hsl(220,14%,13%)] border border-[hsl(220,14%,18%)] p-3">
                      <p className="font-semibold text-amber-300 text-xs uppercase tracking-wider">Previous Corrective Action</p>
                      <p className="text-white/70 mt-1">{repeatNcr.correctiveAction}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Operator Coaching Alert */}
        {alert?.hasAlert && (
          <div className="forge-card border-l-4 border-l-rose-500">
            <div className="forge-card-body">
              <div className="flex items-start gap-3">
                <Brain className="h-5 w-5 text-rose-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-bold text-white/90">You have encountered this issue {alert.occurrenceCount} times before</p>
                  <p className="text-xs text-white/50 mt-2">
                    <strong className="text-white/70">Previous corrective action:</strong> {alert.latestCorrectiveAction}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 1: Problem Description */}
        <div className="forge-card">
          <div className="forge-card-header">
            <h2 className="forge-card-title flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-rose-500/20 text-rose-400 text-xs font-bold">1</span>
              Problem Description
            </h2>
          </div>
          <div className="forge-card-body">
            <textarea
              value={problemDescription}
              onChange={(e) => setProblemDescription(e.target.value)}
              placeholder="Describe the problem based on failed inspection dimensions..."
              className="w-full rounded-md border border-[hsl(220,14%,20%)] bg-[hsl(220,14%,13%)] px-3 py-2 text-sm text-white placeholder:text-white/30 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[hsl(24,95%,53%)]/30 min-h-[100px]"
            />
            <p className="text-xs text-white/30 mt-2">Auto-filled from inspection failures. Edit if needed.</p>
          </div>
        </div>

        {/* Step 2: 5 WHY */}
        <div className="forge-card">
          <div className="forge-card-header">
            <h2 className="forge-card-title flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-orange-500/20 text-orange-400 text-xs font-bold">2</span>
              5 WHY Analysis
            </h2>
          </div>
          <div className="forge-card-body space-y-4">
            {whys.map((why, index) => (
              <div key={why.level} className="space-y-2">
                <Label className="text-sm font-semibold flex items-center gap-2 text-white/70">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[hsl(220,14%,18%)] text-white/60 text-[10px] font-bold">
                    {why.level}
                  </span>
                  Why {why.level}
                  {index === 0 && (
                    <span className="text-xs font-normal text-white/30">(start with the obvious cause)</span>
                  )}
                  {index === 4 && (
                    <span className="text-xs font-normal text-white/30">(dig to the root)</span>
                  )}
                </Label>
                <Input
                  value={why.answer}
                  onChange={(e) => {
                    const updated = [...whys];
                    updated[index].answer = e.target.value;
                    setWhys(updated);
                  }}
                  placeholder={`Answer Why ${why.level}...`}
                  className="forge-input"
                />
              </div>
            ))}
          </div>
        </div>

        {/* Step 3: Root Cause */}
        <div className="forge-card">
          <div className="forge-card-header">
            <h2 className="forge-card-title flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-rose-500/20 text-rose-400 text-xs font-bold">3</span>
              Root Cause <span className="text-rose-400 ml-1">*</span>
            </h2>
          </div>
          <div className="forge-card-body relative">
            <textarea
              value={rootCause}
              onChange={(e) => {
                setRootCause(e.target.value);
                setShowRootSuggestions(true);
              }}
              onFocus={() => setShowRootSuggestions(true)}
              onBlur={() => setTimeout(() => setShowRootSuggestions(false), 200)}
              placeholder="What is the fundamental root cause? Be specific."
              className="w-full rounded-md border border-[hsl(220,14%,20%)] bg-[hsl(220,14%,13%)] px-3 py-2 text-sm text-white placeholder:text-white/30 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[hsl(24,95%,53%)]/30 min-h-[80px]"
            />
            {/* Enhanced Suggestions Dropdown with Confidence */}
            {!isDemoMode() && showRootSuggestions &&
              rootSuggestionQuery.data &&
              rootSuggestionQuery.data.rootCauses.length > 0 && (
                <div className="absolute z-10 mt-1 w-full rounded-md border border-[hsl(220,14%,18%)] bg-[hsl(220,14%,10%)] shadow-lg max-h-56 overflow-y-auto">
                  <div className="px-3 py-2 text-[11px] font-semibold text-white/40 flex items-center gap-1 bg-[hsl(220,14%,14%)]">
                    <Brain className="h-3 w-3" />
                    Ranked suggestions from previous NCRs
                  </div>
                  {rootSuggestionQuery.data.rootCauses.map((s, i) => (
                    <button
                      key={i}
                      className="w-full px-3 py-2 text-left hover:bg-white/5 flex items-center justify-between gap-2"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setRootCause(s.text);
                        setShowRootSuggestions(false);
                      }}
                    >
                      <span className="text-sm text-white/70 truncate">{s.text}</span>
                      <span className="flex items-center gap-1 flex-shrink-0">
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                            s.confidence >= 50
                              ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20"
                              : s.confidence >= 25
                                ? "bg-amber-500/15 text-amber-400 border border-amber-500/20"
                                : "bg-white/5 text-white/40"
                          }`}
                        >
                          {s.confidence}%
                        </span>
                        <span className="text-[10px] text-white/30">({s.frequency}x)</span>
                      </span>
                    </button>
                  ))}
                </div>
              )}
          </div>
        </div>

        {/* Step 4: Corrective Action */}
        <div className="forge-card">
          <div className="forge-card-header">
            <h2 className="forge-card-title flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-bold">4</span>
              Corrective Action <span className="text-rose-400 ml-1">*</span>
            </h2>
          </div>
          <div className="forge-card-body relative">
            <textarea
              value={correctiveAction}
              onChange={(e) => {
                setCorrectiveAction(e.target.value);
                setShowActionSuggestions(true);
              }}
              onFocus={() => setShowActionSuggestions(true)}
              onBlur={() => setTimeout(() => setShowActionSuggestions(false), 200)}
              placeholder="What action will prevent this from recurring?"
              className="w-full rounded-md border border-[hsl(220,14%,20%)] bg-[hsl(220,14%,13%)] px-3 py-2 text-sm text-white placeholder:text-white/30 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[hsl(24,95%,53%)]/30 min-h-[80px]"
            />
            {/* Enhanced Suggestions Dropdown with Confidence */}
            {!isDemoMode() && showActionSuggestions &&
              actionSuggestionQuery.data &&
              actionSuggestionQuery.data.correctiveActions.length > 0 && (
                <div className="absolute z-10 mt-1 w-full rounded-md border border-[hsl(220,14%,18%)] bg-[hsl(220,14%,10%)] shadow-lg max-h-56 overflow-y-auto">
                  <div className="px-3 py-2 text-[11px] font-semibold text-white/40 flex items-center gap-1 bg-[hsl(220,14%,14%)]">
                    <Brain className="h-3 w-3" />
                    Ranked suggestions from previous NCRs
                  </div>
                  {actionSuggestionQuery.data.correctiveActions.map((s, i) => (
                    <button
                      key={i}
                      className="w-full px-3 py-2 text-left hover:bg-white/5 flex items-center justify-between gap-2"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setCorrectiveAction(s.text);
                        setShowActionSuggestions(false);
                      }}
                    >
                      <span className="text-sm text-white/70 truncate">{s.text}</span>
                      <span className="flex items-center gap-1 flex-shrink-0">
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                            s.confidence >= 50
                              ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20"
                              : s.confidence >= 25
                                ? "bg-amber-500/15 text-amber-400 border border-amber-500/20"
                                : "bg-white/5 text-white/40"
                          }`}
                        >
                          {s.confidence}%
                        </span>
                        <span className="text-[10px] text-white/30">({s.frequency}x)</span>
                      </span>
                    </button>
                  ))}
                </div>
              )}
          </div>
        </div>

        {/* Errors / Success */}
        {error && (
          <div className="rounded-lg bg-rose-950/40 border border-rose-500/20 p-4 text-rose-300 text-sm font-medium flex items-start gap-2">
            <AlertTriangle className="h-5 w-5 mt-0.5 flex-shrink-0" />
            {error}
          </div>
        )}

        {saved && (
          <div className="rounded-lg bg-emerald-950/40 border border-emerald-500/20 p-4 text-emerald-300 text-sm font-medium flex items-start gap-3">
            <CheckCircle2 className="h-5 w-5 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">NCR saved successfully!</p>
              <p className="text-xs mt-1">Quality team has been notified.</p>
            </div>
          </div>
        )}

        {/* Save Button */}
        <Button
          className="w-full h-16 text-lg font-bold bg-rose-600 hover:bg-rose-500 mb-4 disabled:opacity-60"
          onClick={handleSave}
          disabled={isSaving}
        >
          {isSaving ? (
            <>
              <Loader2 className="mr-3 h-6 w-6 animate-spin" />
              Saving NCR...
            </>
          ) : (
            <>
              <Save className="mr-3 h-6 w-6" />
              Save NCR
            </>
          )}
        </Button>
      </div>
    </AppLayout>
  );
}
