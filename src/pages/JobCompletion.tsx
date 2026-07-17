import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/providers/trpc";
import { isDemoMode, demoApi } from "@/lib/demoApi";
import AppLayout from "@/components/layout/AppLayout";
import {
  Save,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Wrench,
  Settings,
  FileText,
  Star,
} from "lucide-react";

export default function JobCompletion() {
  const navigate = useNavigate();
  const { jobId } = useParams<{ jobId: string }>();
  const [operator, setOperator] = useState<{ id: number; name: string } | null>(null);

  const [result, setResult] = useState("");
  const [offsetAdjustment, setOffsetAdjustment] = useState("");
  const [toolChange, setToolChange] = useState("no");
  const [feedAdjustment, setFeedAdjustment] = useState("");
  const [speedAdjustment, setSpeedAdjustment] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

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

  const submitFeedback = trpc.feedback.create.useMutation({
    onSuccess: () => {
      setSaved(true);
      setError("");
    },
    onError: () => {
      if (isDemoMode() && operator && jobId) {
        demoApi.submitFeedback({
          jobId: Number(jobId),
          operatorId: operator.id,
          result: result as "pass" | "fail",
          offsetAdjustment: offsetAdjustment ? parseFloat(offsetAdjustment) : undefined,
          toolChange: toolChange === "yes",
          feedAdjustment: feedAdjustment ? parseFloat(feedAdjustment) : undefined,
          speedAdjustment: speedAdjustment ? parseInt(speedAdjustment) : undefined,
          notes: notes.trim() || undefined,
        });
        setSaved(true);
        setError("");
        return;
      }
      setError("Failed to submit feedback. Please try again.");
    },
  });

  const handleSubmit = () => {
    setError("");
    if (!operator) {
      setError("No operator logged in.");
      return;
    }
    if (!result) {
      setError("Please select a result (PASS or FAIL).");
      return;
    }

    if (isDemoMode()) {
      demoApi.submitFeedback({
        jobId: Number(jobId),
        operatorId: operator.id,
        result: result as "pass" | "fail",
        offsetAdjustment: offsetAdjustment ? parseFloat(offsetAdjustment) : undefined,
        toolChange: toolChange === "yes",
        feedAdjustment: feedAdjustment ? parseFloat(feedAdjustment) : undefined,
        speedAdjustment: speedAdjustment ? parseInt(speedAdjustment) : undefined,
        notes: notes.trim() || undefined,
      });
      setSaved(true);
      setError("");
      return;
    }

    submitFeedback.mutate({
      jobId: Number(jobId),
      operatorId: operator.id,
      result: result as "pass" | "fail",
      offsetAdjustment: offsetAdjustment ? parseFloat(offsetAdjustment) : undefined,
      toolChange: toolChange === "yes",
      feedAdjustment: feedAdjustment ? parseFloat(feedAdjustment) : undefined,
      speedAdjustment: speedAdjustment ? parseInt(speedAdjustment) : undefined,
      notes: notes.trim() || undefined,
    });
  };

  const job = isDemoMode() ? demoApi.getJobById(Number(jobId)) : jobQuery.data;

  return (
    <AppLayout
      title="Job Completion"
      subtitle={job ? `Job: ${job.jobNumber} | Part: ${job.partNumber}` : ""}
      showBack
      onBack={() => navigate("/job-entry")}
    >
      <div className="max-w-2xl mx-auto space-y-5">
        {saved ? (
          <div className="forge-card border-l-4 border-l-emerald-500">
            <div className="forge-card-body py-8 text-center space-y-4">
              <CheckCircle2 className="h-16 w-16 text-emerald-400 mx-auto" />
              <p className="text-xl font-bold text-white/90">Feedback Submitted Successfully!</p>
              <p className="text-sm text-white/50">Your feedback helps the AI learn and improve recommendations.</p>
              <div className="flex gap-3 justify-center pt-2">
                <button className="forge-btn-primary h-14 px-6 text-base" onClick={() => navigate("/job-entry")}>
                  Start New Job
                </button>
                <button className="forge-btn-secondary h-14 px-6 text-base" onClick={() => navigate("/dashboard")}>
                  View Dashboard
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="forge-card">
            <div className="forge-card-header">
              <h2 className="forge-card-title flex items-center gap-2">
                <FileText className="h-4 w-4 text-emerald-400" />
                Machining Feedback
              </h2>
            </div>
            <div className="forge-card-body space-y-5">
              <p className="text-xs text-white/40">Record what happened so the system can learn.</p>

              {/* Result */}
              <div className="space-y-2">
                <Label className="text-sm font-semibold text-white/70">
                  Final Result <span className="text-rose-400">*</span>
                </Label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setResult("pass")}
                    className={`h-16 text-lg font-bold rounded-md transition-all flex items-center justify-center gap-2 ${
                      result === "pass"
                        ? "bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/30"
                        : "border border-[hsl(220,14%,20%)] hover:bg-emerald-950/30 text-white/60"
                    }`}
                  >
                    <CheckCircle2 className="h-6 w-6" />
                    PASS
                  </button>
                  <button
                    type="button"
                    onClick={() => setResult("fail")}
                    className={`h-16 text-lg font-bold rounded-md transition-all flex items-center justify-center gap-2 ${
                      result === "fail"
                        ? "bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-900/30"
                        : "border border-[hsl(220,14%,20%)] hover:bg-rose-950/30 text-white/60"
                    }`}
                  >
                    <XCircle className="h-6 w-6" />
                    FAIL
                  </button>
                </div>
              </div>

              {/* Tool Change */}
              <div className="space-y-2">
                <Label className="text-sm font-semibold text-white/70 flex items-center gap-2">
                  <Wrench className="h-4 w-4" />
                  Tool Changed?
                </Label>
                <Select value={toolChange} onValueChange={setToolChange}>
                  <SelectTrigger className="h-12 text-sm bg-[hsl(220,14%,13%)] border-[hsl(220,14%,20%)] text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[hsl(220,14%,10%)] border-[hsl(220,14%,18%)] text-white">
                    <SelectItem value="no">No — Same tool used</SelectItem>
                    <SelectItem value="yes">Yes — Tool was changed</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Offset Adjustment */}
              <div className="space-y-2">
                <Label className="text-sm font-semibold text-white/70">Offset Adjustment (if any)</Label>
                <Input
                  type="number"
                  step="0.001"
                  value={offsetAdjustment}
                  onChange={(e) => setOffsetAdjustment(e.target.value)}
                  placeholder="e.g. 0.05 (positive = moved outward)"
                  className="forge-input"
                />
              </div>

              {/* Feed & Speed Adjustments */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm font-semibold text-white/70 flex items-center gap-2">
                    <Settings className="h-4 w-4" />
                    Feed Override (%)
                  </Label>
                  <Input
                    type="number"
                    value={feedAdjustment}
                    onChange={(e) => setFeedAdjustment(e.target.value)}
                    placeholder="e.g. 80 for 80%"
                    className="forge-input"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-semibold text-white/70 flex items-center gap-2">
                    <Settings className="h-4 w-4" />
                    Speed Override (%)
                  </Label>
                  <Input
                    type="number"
                    value={speedAdjustment}
                    onChange={(e) => setSpeedAdjustment(e.target.value)}
                    placeholder="e.g. 90 for 90%"
                    className="forge-input"
                  />
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <Label className="text-sm font-semibold text-white/70">Notes</Label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="What went well? What would you change next time?"
                  className="w-full rounded-md border border-[hsl(220,14%,20%)] bg-[hsl(220,14%,13%)] px-3 py-2 text-sm text-white placeholder:text-white/30 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[hsl(24,95%,53%)]/30 min-h-[100px]"
                />
              </div>

              {/* Error */}
              {error && (
                <div className="rounded-lg bg-rose-950/40 border border-rose-500/20 p-3 text-rose-300 text-sm font-medium flex items-start gap-2">
                  <AlertTriangle className="h-5 w-5 flex-shrink-0" />
                  {error}
                </div>
              )}

              {/* Submit */}
              <Button
                className="w-full h-16 text-lg font-bold bg-emerald-600 hover:bg-emerald-500"
                onClick={handleSubmit}
                disabled={submitFeedback.isPending}
              >
                {submitFeedback.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-6 w-6 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-6 w-6" />
                    Submit Feedback & Close Job
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
