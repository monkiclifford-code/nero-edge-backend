import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/providers/trpc";
import { isDemoMode, demoApi } from "@/lib/demoApi";
import AppLayout from "@/components/layout/AppLayout";
import { Play, Brain, AlertTriangle, Lightbulb, FileText, ClipboardList, Star, Lock, Unlock, ArrowRight } from "lucide-react";

export default function JobEntry() {
  const navigate = useNavigate();
  const [operator, setOperator] = useState<{ id: number; name: string; operatorId: string } | null>(null);
  const [jobNumber, setJobNumber] = useState("");
  const [partNumber, setPartNumber] = useState("");
  const [materialNumber, setMaterialNumber] = useState("");
  const [revision, setRevision] = useState("A");
  const [error, setError] = useState("");
  const [createdJob, setCreatedJob] = useState<{ id: number; jobNumber: string; partNumber: string } | null>(null);
  const [setupViewed, setSetupViewed] = useState(false);
  const [aiInsightData, setAiInsightData] = useState<ReturnType<typeof demoApi.getJobInsight> | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem("cnc_operator");
    if (!saved) { navigate("/"); return; }
    try { setOperator(JSON.parse(saved)); } catch { navigate("/"); }
  }, [navigate]);

  useEffect(() => {
    if (createdJob) {
      const viewedJobs = JSON.parse(localStorage.getItem("cnc_setup_viewed") || "[]");
      setSetupViewed(viewedJobs.includes(String(createdJob.id)));
      if (isDemoMode()) {
        setAiInsightData(demoApi.getJobInsight(createdJob.partNumber));
      }
    }
  }, [createdJob]);

  const createJob = trpc.job.create.useMutation({
    onSuccess: (data) => {
      if (data.job) {
        setCreatedJob({ id: data.job.id, jobNumber: data.job.jobNumber, partNumber: data.job.partNumber });
        setError("");
      }
    },
    onError: () => {
      if (isDemoMode() && operator) {
        const result = demoApi.createJob({
          jobNumber: jobNumber.trim(),
          partNumber: partNumber.trim(),
          materialNumber: materialNumber.trim(),
          revision: revision.trim() || "A",
          operatorId: operator.id,
        });
        if (result.job) {
          setCreatedJob({ id: result.job.id, jobNumber: result.job.jobNumber, partNumber: result.job.partNumber });
          setError("");
          return;
        }
      }
      setError("Failed to create job. Please try again.");
    },
  });

  const aiInsight = trpc.ai.getJobInsight.useQuery(
    { partNumber: createdJob?.partNumber ?? "" },
    { enabled: !!createdJob?.partNumber && !isDemoMode() }
  );

  const handleStartJob = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!jobNumber.trim() || !partNumber.trim() || !materialNumber.trim()) {
      setError("Job Number, Part Number, and Material Number are required.");
      return;
    }
    if (!operator) { setError("No operator logged in."); return; }
    createJob.mutate({
      jobNumber: jobNumber.trim(),
      partNumber: partNumber.trim(),
      materialNumber: materialNumber.trim(),
      revision: revision.trim() || "A",
      operatorId: operator.id,
    });
  };

  const insight = isDemoMode() ? aiInsightData : aiInsight.data;

  return (
    <AppLayout title="Job Entry" subtitle="Start a new production job">
      <div className="max-w-3xl mx-auto space-y-5">
        {!createdJob && (
          <div className="forge-card">
            <div className="forge-card-header">
              <h2 className="forge-card-title flex items-center gap-2">
                <Play className="h-5 w-5 text-orange-400" /> Start New Job
              </h2>
            </div>
            <div className="forge-card-body">
              <form onSubmit={handleStartJob} className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold uppercase tracking-wider text-white/50">Job Number <span className="text-rose-400">*</span></Label>
                    <Input value={jobNumber} onChange={(e) => setJobNumber(e.target.value)} placeholder="e.g. JOB-2025-001" className="forge-input" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold uppercase tracking-wider text-white/50">Part Number <span className="text-rose-400">*</span></Label>
                    <Input value={partNumber} onChange={(e) => setPartNumber(e.target.value)} placeholder="e.g. PN-45678" className="forge-input" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold uppercase tracking-wider text-white/50">Material Number <span className="text-rose-400">*</span></Label>
                    <Input value={materialNumber} onChange={(e) => setMaterialNumber(e.target.value)} placeholder="e.g. MAT-AL-6061" className="forge-input" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold uppercase tracking-wider text-white/50">Revision</Label>
                    <Input value={revision} onChange={(e) => setRevision(e.target.value)} placeholder="A" className="forge-input" />
                  </div>
                </div>
                {error && <div className="rounded-lg bg-rose-950/40 border border-rose-500/20 px-3 py-2.5 text-sm text-rose-300">{error}</div>}
                <Button type="submit" className="w-full h-12 text-base font-bold bg-gradient-to-r from-orange-600 to-orange-500 hover:from-orange-500 hover:to-orange-400 text-white shadow-lg shadow-orange-900/30" disabled={createJob.isPending}>
                  <Play className="mr-2 h-5 w-5" /> {createJob.isPending ? "Starting Job..." : "Start Job"}
                </Button>
              </form>
            </div>
          </div>
        )}

        {createdJob && (
          <>
            {insight?.hasHistory && (
              <div className={`forge-card border-l-4 ${insight.riskLevel === "high" ? "border-l-rose-500" : insight.riskLevel === "medium" ? "border-l-amber-500" : "border-l-blue-500"}`}>
                <div className="forge-card-body">
                  <div className="flex items-start gap-3">
                    <Brain className={`h-5 w-5 flex-shrink-0 mt-0.5 ${insight.riskLevel === "high" ? "text-rose-400" : insight.riskLevel === "medium" ? "text-amber-400" : "text-blue-400"}`} />
                    <div className="space-y-2 w-full">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-bold text-white/90">
                          AI Insight — {insight.totalNCRs} NCR{insight.totalNCRs > 1 ? "s" : ""} on this part
                        </p>
                        <span className={`forge-badge-${insight.riskLevel === "high" ? "fail" : insight.riskLevel === "medium" ? "warn" : "info"}`}>{insight.riskLevel} risk</span>
                      </div>
                      <div className="rounded-lg bg-[hsl(220,14%,13%)] border border-[hsl(220,14%,18%)] p-3 space-y-2">
                        <p className="text-xs text-white/50 flex items-center gap-1.5"><AlertTriangle className="h-3.5 w-3.5 text-amber-400" /> Most common issue: <span className="font-semibold text-white/80">{insight.mostCommonRootCause}</span></p>
                        <p className="text-xs text-white/50 flex items-start gap-1.5"><Lightbulb className="h-3.5 w-3.5 text-emerald-400 mt-0.5 flex-shrink-0" /><span><strong className="text-white/70">Recommendation:</strong> {insight.recommendation}</span></p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {insight && !insight.hasHistory && (
              <div className="forge-card border-l-4 border-l-emerald-500">
                <div className="forge-card-body flex items-center gap-3">
                  <Brain className="h-5 w-5 text-emerald-400 flex-shrink-0" />
                  <p className="text-sm text-white/70 font-medium">No previous NCR history for this part. First time running this job!</p>
                </div>
              </div>
            )}

            <div className="forge-card border-l-4 border-l-emerald-500">
              <div className="forge-card-header">
                <h2 className="forge-card-title text-emerald-400">Job {createdJob.jobNumber} Started</h2>
              </div>
              <div className="forge-card-body space-y-4">
                <p className="text-sm text-white/60">Job created successfully. Choose next step:</p>
                {!setupViewed && (
                  <div className="rounded-lg bg-amber-950/30 border border-amber-500/20 px-3 py-2.5 text-sm text-amber-300 flex items-center gap-2">
                    <Lock className="h-4 w-4 flex-shrink-0" /> Inspection is locked until you view the Setup Sheet first.
                  </div>
                )}
                {setupViewed && (
                  <div className="rounded-lg bg-emerald-950/30 border border-emerald-500/20 px-3 py-2.5 text-sm text-emerald-300 flex items-center gap-2">
                    <Unlock className="h-4 w-4 flex-shrink-0" /> Setup Sheet viewed. Inspection is now unlocked.
                  </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <button className="forge-btn-secondary h-14 text-sm flex items-center justify-center gap-2" onClick={() => navigate(`/setup-sheet/${createdJob.id}`)}>
                    <FileText className="h-5 w-5" /> Setup Sheet
                  </button>
                  <button className={`forge-btn h-14 text-sm flex items-center justify-center gap-2 ${setupViewed ? "forge-btn-primary" : "bg-[hsl(220,14%,16%)] text-white/30 cursor-not-allowed"}`} onClick={() => { if (setupViewed) navigate(`/inspection/${createdJob.id}`); }} disabled={!setupViewed}>
                    <ClipboardList className="h-5 w-5" /> {setupViewed ? "Inspect" : "Locked"}
                  </button>
                  <button className="forge-btn-secondary h-14 text-sm flex items-center justify-center gap-2" onClick={() => navigate(`/job-completion/${createdJob.id}`)}>
                    <Star className="h-5 w-5" /> Complete Job
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </AppLayout>
  );
}
