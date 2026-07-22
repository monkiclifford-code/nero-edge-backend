import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { trpc } from "@/providers/trpc";
import { isDemoMode, demoApi } from "@/lib/demoApi";
import AppLayout from "@/components/layout/AppLayout";
import {
  FileText, ClipboardList, AlertTriangle, CheckCircle2,
  Lightbulb, Brain, Award, Camera, Plus, Trash2, Save,
  Pencil, Upload, X, Aperture, History, User, Clock,
  RotateCcw, ArrowRight, Package, Copy
} from "lucide-react";

// ─── Types ───
interface ToolEntry {
  id: string;
  number: string;
  description: string;
  toolId: string;
  offset: string;
}

interface SetupData {
  workholding: { label: string; value: string }[];
  tools: ToolEntry[];
  programNotes: { label: string; value: string }[];
  generalNotes: string;
  images: { id?: number; imageData: string; annotations: any[] }[];
}

const DEFAULT_WORKHOLDING = [
  { label: "Vise Jaw Type", value: "" },
  { label: "Fixture Number", value: "" },
  { label: "Clamping Torque", value: "" },
  { label: "Part Zero Location", value: "" },
  { label: "Work Offset (G54)", value: "" },
  { label: "Gauge Length", value: "" },
];

const DEFAULT_TOOLS: ToolEntry[] = [
  { id: "t1", number: "T01", description: "", toolId: "", offset: "H01 / D01" },
  { id: "t2", number: "T02", description: "", toolId: "", offset: "H02 / D02" },
];

const DEFAULT_PROGRAM_NOTES = [
  { label: "Program Number", value: "" },
  { label: "Feed Override", value: "100%" },
  { label: "Spindle Speed Override", value: "100%" },
  { label: "Special Instructions", value: "" },
];

function getDefaultSetup(): SetupData {
  return {
    workholding: DEFAULT_WORKHOLDING.map(w => ({ ...w })),
    tools: DEFAULT_TOOLS.map(t => ({ ...t })),
    programNotes: DEFAULT_PROGRAM_NOTES.map(p => ({ ...p })),
    generalNotes: "",
    images: [],
  };
}

export default function SetupSheet() {
  const navigate = useNavigate();
  const { jobId } = useParams<{ jobId: string }>();
  const numericJobId = Number(jobId);

  // Auth check
  const [operator, setOperator] = useState<{ id: number; name: string; operatorId: string } | null>(null);

  useEffect(() => {
    const savedOp = localStorage.getItem("cnc_operator");
    if (!savedOp) { navigate("/"); return; }
    try { setOperator(JSON.parse(savedOp)); } catch { navigate("/"); }
  }, [navigate]);

  // ─── tRPC: Query existing setup from DATABASE ───
  const setupQuery = trpc.setupSheet.getByJobId.useQuery(
    { jobId: numericJobId },
    { enabled: !isNaN(numericJobId) && numericJobId > 0 && !isDemoMode() }
  );

  // ─── tRPC: Save mutation ───
  const saveMutation = trpc.setupSheet.save.useMutation({
    onSuccess: (data) => {
      setSavedMsg(data.message);
      setEditing(false);
      setupQuery.refetch();
      setTimeout(() => setSavedMsg(""), 4000);
    },
    onError: (err) => {
      setErrorMsg("Save failed: " + err.message);
      setTimeout(() => setErrorMsg(""), 5000);
    },
  });

  // ─── Job data ───
  const jobQuery = trpc.job.getById.useQuery(
    { id: numericJobId },
    { enabled: !!jobId && !isNaN(numericJobId) && !isDemoMode() }
  );

  // ─── Query existing setup by PART NUMBER (for cross-job lookup) ───
  // NOTE: MUST be declared AFTER jobQuery since it depends on jobQuery.data
  const existingSetupByPart = trpc.setupSheet.getByPartNumber.useQuery(
    { partNumber: jobQuery.data?.partNumber ?? "", revision: jobQuery.data?.revision },
    { enabled: !!jobQuery.data?.partNumber && !isDemoMode() }
  );

  const setupInsights = trpc.ai.getSetupInsights.useQuery(
    { partNumber: (isDemoMode() ? demoApi.getJobById(numericJobId) : jobQuery.data)?.partNumber ?? "" },
    { enabled: ((isDemoMode() ? demoApi.getJobById(numericJobId) : jobQuery.data)?.partNumber ?? "").length > 0 && !isDemoMode() }
  );

  const bestKnownMethod = trpc.feedback.getBestKnownMethod.useQuery(
    { partNumber: (isDemoMode() ? demoApi.getJobById(numericJobId) : jobQuery.data)?.partNumber ?? "" },
    { enabled: ((isDemoMode() ? demoApi.getJobById(numericJobId) : jobQuery.data)?.partNumber ?? "").length > 0 && !isDemoMode() }
  );

  const job = isDemoMode() ? demoApi.getJobById(numericJobId) : jobQuery.data;
  const insights = isDemoMode() ? demoApi.getSetupInsights(job?.partNumber ?? "") : setupInsights.data;
  const bkm = isDemoMode() ? demoApi.getBestKnownMethod(job?.partNumber ?? "") : bestKnownMethod.data;
  const dbSetup = setupQuery.data;

  // ─── Local state ───
  const [setup, setSetup] = useState<SetupData>(getDefaultSetup);
  const [editing, setEditing] = useState(false);
  const [savedMsg, setSavedMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [showVersions, setShowVersions] = useState(false);
  const [setupMarked, setSetupMarked] = useState(false);
  const [previousLoaded, setPreviousLoaded] = useState(false);

  // ─── COPY PREVIOUS SETUP feature ───
  const [showCopyBanner, setShowCopyBanner] = useState(false);
  const [copyMsg, setCopyMsg] = useState("");
  const [copySource, setCopySource] = useState<{ jobId: number; version: number; partNumber: string; revision: string; operatorName: string } | null>(null);

  useEffect(() => {
    if (existingSetupByPart.data && !dbSetup && existingSetupByPart.data.jobId !== numericJobId) {
      setShowCopyBanner(true);
    } else {
      setShowCopyBanner(false);
    }
  }, [existingSetupByPart.data, dbSetup, numericJobId]);

  const copyPreviousSetup = () => {
    const prev = existingSetupByPart.data;
    if (!prev) return;
    const loaded: SetupData = {
      workholding: prev.workholding?.length > 0
        ? prev.workholding.map((w: any) => ({ label: w.label, value: w.value || "" }))
        : DEFAULT_WORKHOLDING.map(w => ({ ...w })),
      tools: prev.tools?.length > 0
        ? prev.tools.map((t: any, i: number) => ({
            id: `t${t.id}`,
            number: t.toolNumber,
            description: t.description || "",
            toolId: t.toolId || "",
            offset: t.offset || `H${String(i + 1).padStart(2, "0")} / D${String(i + 1).padStart(2, "0")}`,
          }))
        : DEFAULT_TOOLS.map(t => ({ ...t })),
      programNotes: prev.programNotes
        ? JSON.parse(prev.programNotes)
        : DEFAULT_PROGRAM_NOTES.map(p => ({ ...p })),
      generalNotes: prev.generalNotes || "",
      images: prev.images?.map((img: any) => ({
        id: img.id,
        imageData: img.imageData,
        annotations: img.annotations || [],
      })) || [],
    };
    setSetup(loaded);
    setEditing(true);
    setShowCopyBanner(false);
    setCopySource({
      jobId: prev.jobId,
      version: prev.version,
      partNumber: prev.partNumber,
      revision: prev.revision,
      operatorName: prev.operatorName,
    });
    setCopyMsg(`Copied from Job #${prev.jobId} Setup V${prev.version}. Edit and save for this job.`);
    setTimeout(() => setCopyMsg(""), 6000);
  };

  // ─── Auto-load from DATABASE when setup query returns ───
  useEffect(() => {
    if (dbSetup) {
      const loaded: SetupData = {
        workholding: dbSetup.workholding.length > 0
          ? dbSetup.workholding.map(w => ({ label: w.label, value: w.value || "" }))
          : DEFAULT_WORKHOLDING.map(w => ({ ...w })),
        tools: dbSetup.tools.length > 0
          ? dbSetup.tools.map((t, i) => ({
              id: `t${t.id}`,
              number: t.toolNumber,
              description: t.description || "",
              toolId: t.toolId || "",
              offset: t.offset || `H${String(i + 1).padStart(2, "0")} / D${String(i + 1).padStart(2, "0")}`,
            }))
          : DEFAULT_TOOLS.map(t => ({ ...t })),
        programNotes: dbSetup.programNotes
          ? JSON.parse(dbSetup.programNotes)
          : DEFAULT_PROGRAM_NOTES.map(p => ({ ...p })),
        generalNotes: dbSetup.generalNotes || "",
        images: dbSetup.images.map(img => ({
          id: img.id,
          imageData: img.imageData,
          annotations: img.annotations || [],
        })),
      };
      setSetup(loaded);
      setPreviousLoaded(true);
      setTimeout(() => setPreviousLoaded(false), 4000);
    }
  }, [dbSetup]);

  // ─── Mark setup as viewed ───
  useEffect(() => {
    if (jobId) {
      const viewedJobs = JSON.parse(localStorage.getItem("cnc_setup_viewed") || "[]");
      if (!viewedJobs.includes(jobId)) {
        viewedJobs.push(jobId);
        localStorage.setItem("cnc_setup_viewed", JSON.stringify(viewedJobs));
      }
      setSetupMarked(true);
    }
  }, [jobId]);

  // ─── Camera / Upload modal state ───
  const [showImageModal, setShowImageModal] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      cameraStreamRef.current = stream;
      setCameraActive(true);
    } catch (err) {
      console.error("Camera error:", err);
      alert("Could not access camera. Please ensure camera permissions are granted.\n\nIf using a work computer, your IT department may have blocked camera access. Try uploading an image instead.");
    }
  };

  useEffect(() => {
    if (cameraActive && videoRef.current && cameraStreamRef.current) {
      videoRef.current.srcObject = cameraStreamRef.current;
      videoRef.current.play().catch(() => {});
    }
  }, [cameraActive]);

  const stopCamera = () => {
    if (cameraStreamRef.current) {
      cameraStreamRef.current.getTracks().forEach((track) => track.stop());
      cameraStreamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraActive(false);
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
    addImage(dataUrl);
    stopCamera();
    setShowImageModal(false);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      addImage(ev.target?.result as string);
      setShowImageModal(false);
    };
    reader.readAsDataURL(file);
  };

  const addImage = (dataUrl: string) => {
    setSetup(prev => ({
      ...prev,
      images: [...prev.images, { imageData: dataUrl, annotations: [] }],
    }));
  };

  const removeImage = (index: number) => {
    setSetup(prev => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index),
    }));
  };

  const openImageModal = () => {
    setShowImageModal(true);
    setCameraActive(false);
  };

  const closeImageModal = () => {
    stopCamera();
    setShowImageModal(false);
  };

  // ─── Save handler: DATABASE SAVE ───
  const handleSave = () => {
    if (!job || !operator) return;

    saveMutation.mutate({
      jobId: numericJobId,
      partNumber: job?.partNumber ?? "",
      revision: job?.revision ?? "A",
      materialNumber: job?.materialNumber ?? "",
      operatorId: operator.id,
      operatorName: operator.name,
      programNotes: JSON.stringify(setup.programNotes),
      generalNotes: setup.generalNotes,
      workholding: setup.workholding.map((w, i) => ({
        label: w.label,
        value: w.value,
        displayOrder: i,
      })),
      tools: setup.tools.map((t, i) => ({
        toolNumber: t.number,
        description: t.description,
        toolId: t.toolId,
        offset: t.offset,
        displayOrder: i,
      })),
      images: setup.images.map((img, i) => ({
        imageData: img.imageData,
        displayOrder: i,
        annotations: img.annotations || [],
      })),
      copiedFromJobId: copySource?.jobId,
      copiedFromVersion: copySource?.version,
      changeSummary: dbSetup
        ? `Edited by ${operator.name}`
        : copySource
          ? `Copied from Job #${copySource.jobId} V${copySource.version} by ${operator.name}`
          : `Initial setup by ${operator.name}`,
    });
  };

  // ─── Field updaters ───
  const updateWorkholding = (index: number, value: string) => {
    setSetup(prev => ({
      ...prev,
      workholding: prev.workholding.map((w, i) => i === index ? { ...w, value } : w),
    }));
  };

  const addTool = () => {
    const nextNum = setup.tools.length + 1;
    setSetup(prev => ({
      ...prev,
      tools: [...prev.tools, {
        id: `t${Date.now()}`,
        number: `T${String(nextNum).padStart(2, "0")}`,
        description: "", toolId: "", offset: `H${nextNum} / D${nextNum}`,
      }],
    }));
  };

  const removeTool = (id: string) => {
    setSetup(prev => ({ ...prev, tools: prev.tools.filter(t => t.id !== id) }));
  };

  const updateTool = (id: string, field: keyof ToolEntry, value: string) => {
    setSetup(prev => ({
      ...prev,
      tools: prev.tools.map(t => t.id === id ? { ...t, [field]: value } : t),
    }));
  };

  const updateProgramNote = (index: number, value: string) => {
    setSetup(prev => ({
      ...prev,
      programNotes: prev.programNotes.map((p, i) => i === index ? { ...p, value } : p),
    }));
  };

  // ─── Navigate to annotation editor ───
  const openAnnotationEditor = (imageIndex: number) => {
    // Save image data for immediate loading
    localStorage.setItem(`cnc_setup_annotations_${jobId}_pending_index`, String(imageIndex));
    localStorage.setItem(`cnc_setup_annotations_${jobId}_pending_image`, setup.images[imageIndex]?.imageData || "");
    // Save FULL setup context so editor can save even without DB data
    localStorage.setItem(`cnc_setup_context_${jobId}`, JSON.stringify({
      workholding: setup.workholding.map(w => ({ label: w.label, value: w.value, displayOrder: 0 })),
      tools: setup.tools.map(t => ({ toolNumber: t.number, description: t.description, toolId: t.toolId, offset: t.offset, displayOrder: 0 })),
      programNotes: JSON.stringify(setup.programNotes),
      generalNotes: setup.generalNotes,
    }));
    navigate(`/setup-annotate/${jobId}`);
  };

  // ─── Loading / Error states ───
  const isLoading = setupQuery.isLoading || jobQuery.isLoading;

  return (
    <AppLayout
      title="Setup Sheet"
      subtitle={job ? `Job: ${job.jobNumber} | Part: ${job.partNumber} | Rev: ${job.revision}` : ""}
      showBack
      onBack={() => navigate("/job-entry")}
      action={
        <div className="flex gap-2">
          {dbSetup && (
            <button
              className="forge-btn-secondary flex items-center gap-2"
              onClick={() => setShowVersions(!showVersions)}
            >
              <History className="h-4 w-4" /> Versions ({dbSetup.version})
            </button>
          )}
          {editing ? (
            <button
              className="forge-btn-primary flex items-center gap-2"
              onClick={handleSave}
              disabled={saveMutation.isPending}
            >
              {saveMutation.isPending ? (
                <RotateCcw className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {saveMutation.isPending ? "Saving..." : "Save"}
            </button>
          ) : (
            <button className="forge-btn-secondary flex items-center gap-2" onClick={() => setEditing(true)}>
              <Pencil className="h-4 w-4" /> Edit Setup
            </button>
          )}
          <button className="forge-btn-primary flex items-center gap-2" onClick={() => navigate(`/inspection/${jobId}`)}>
            <ClipboardList className="h-4 w-4" /> Inspect
          </button>
        </div>
      }
    >
      <div className="max-w-5xl mx-auto space-y-5">

        {/* Loading state */}
        {isLoading && (
          <div className="rounded-lg border border-blue-500/20 bg-blue-950/30 px-4 py-3 flex items-center gap-3">
            <RotateCcw className="h-5 w-5 text-blue-400 animate-spin flex-shrink-0" />
            <p className="text-sm text-blue-300 font-medium">Loading setup data...</p>
          </div>
        )}

        {/* Success messages */}
        {savedMsg && (
          <div className="rounded-lg border border-emerald-500/20 bg-emerald-950/30 px-4 py-3 flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-emerald-400 flex-shrink-0" />
            <p className="text-sm text-emerald-300 font-medium">{savedMsg}</p>
          </div>
        )}

        {previousLoaded && dbSetup && (
          <div className="rounded-lg border border-blue-500/20 bg-blue-950/30 px-4 py-3 flex items-center gap-3">
            <Package className="h-5 w-5 text-blue-400 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-blue-300">Previous setup loaded from database!</p>
              <p className="text-xs text-blue-400/70">
                Version {dbSetup.version} by {dbSetup.operatorName} on {new Date(dbSetup.updatedAt).toLocaleString()}
              </p>
            </div>
          </div>
        )}

        {setupMarked && (
          <div className="rounded-lg border border-emerald-500/20 bg-emerald-950/30 px-4 py-3 flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-emerald-400 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-emerald-300">Setup Sheet marked as viewed.</p>
              <p className="text-xs text-emerald-400/70">Inspection is now unlocked for this job.</p>
            </div>
          </div>
        )}

        {errorMsg && (
          <div className="rounded-lg border border-rose-500/20 bg-rose-950/30 px-4 py-3 flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-rose-400 flex-shrink-0" />
            <p className="text-sm text-rose-300 font-medium">{errorMsg}</p>
          </div>
        )}

        {/* ─── Copy Previous Setup Banner ─── */}
        {showCopyBanner && existingSetupByPart.data && (
          <div className="rounded-lg border border-blue-500/20 bg-blue-950/30 px-4 py-3 flex items-center gap-3">
            <Package className="h-5 w-5 text-blue-400 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-blue-300">
                Previous setup found for {job?.partNumber} (Rev {job?.revision}) from Job #{existingSetupByPart.data.jobId}!
              </p>
              <p className="text-xs text-blue-400/70">
                Version {existingSetupByPart.data.version} by {existingSetupByPart.data.operatorName} — {new Date(existingSetupByPart.data.updatedAt).toLocaleDateString()}
              </p>
            </div>
            <button
              onClick={copyPreviousSetup}
              className="h-9 px-4 rounded-md bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 text-xs font-semibold transition-all flex items-center gap-1.5 flex-shrink-0"
            >
              <Copy className="h-3.5 w-3.5" /> Copy Setup
            </button>
          </div>
        )}

        {copyMsg && (
          <div className="rounded-lg border border-emerald-500/20 bg-emerald-950/30 px-4 py-3 flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-emerald-400 flex-shrink-0" />
            <p className="text-sm text-emerald-300 font-medium">{copyMsg}</p>
          </div>
        )}

        {/* ─── Copied From Audit Card ─── */}
        {dbSetup?.copiedFromJobId && (
          <div className="forge-card border-l-4 border-l-purple-500">
            <div className="forge-card-body">
              <div className="flex items-center gap-2 mb-2">
                <Copy className="h-4 w-4 text-purple-400" />
                <span className="text-sm font-bold text-white/80">Copied From</span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-xs text-white/40 uppercase tracking-wider font-semibold">Source Job</p>
                  <p className="font-semibold text-purple-400">Job #{dbSetup.copiedFromJobId}</p>
                </div>
                <div>
                  <p className="text-xs text-white/40 uppercase tracking-wider font-semibold">Source Version</p>
                  <p className="font-semibold text-white/80">V{dbSetup.copiedFromVersion}</p>
                </div>
                <div>
                  <p className="text-xs text-white/40 uppercase tracking-wider font-semibold">Part</p>
                  <p className="font-semibold text-white/80">{job?.partNumber}</p>
                </div>
                <div>
                  <p className="text-xs text-white/40 uppercase tracking-wider font-semibold">Revision</p>
                  <p className="font-semibold text-white/80">{job?.revision}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ─── Setup Metadata Card ─── */}
        {dbSetup && (
          <div className="forge-card border-l-4 border-l-blue-500">
            <div className="forge-card-body">
              <div className="flex items-center gap-2 mb-3">
                <User className="h-4 w-4 text-blue-400" />
                <span className="text-sm font-bold text-white/80">Setup Record</span>
                <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full">
                  v{dbSetup.version}
                </span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-xs text-white/40 uppercase tracking-wider font-semibold">Created By</p>
                  <p className="font-semibold text-white/80">{dbSetup.operatorName}</p>
                </div>
                <div>
                  <p className="text-xs text-white/40 uppercase tracking-wider font-semibold">Date</p>
                  <p className="font-semibold text-white/80">{new Date(dbSetup.createdAt).toLocaleDateString()}</p>
                </div>
                <div>
                  <p className="text-xs text-white/40 uppercase tracking-wider font-semibold">Last Updated</p>
                  <p className="font-semibold text-white/80">{new Date(dbSetup.updatedAt).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-xs text-white/40 uppercase tracking-wider font-semibold">Status</p>
                  <p className="font-semibold text-emerald-400">Latest</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ─── Version History Panel ─── */}
        {showVersions && dbSetup && dbSetup.versions.length > 0 && (
          <div className="forge-card border-l-4 border-l-purple-500">
            <div className="forge-card-header">
              <h2 className="forge-card-title flex items-center gap-2">
                <History className="h-4 w-4 text-purple-400" />
                Version History
              </h2>
            </div>
            <div className="forge-card-body space-y-2">
              {dbSetup.versions.map((v) => (
                <div key={v.id} className="flex items-center gap-3 p-2 rounded-lg bg-[hsl(220,14%,13%)] border border-[hsl(220,14%,16%)]">
                  <div className="h-8 w-8 rounded-full bg-purple-500/20 flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-bold text-purple-400">v{v.version}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white/80">{v.changeSummary || `Version ${v.version}`}</p>
                    <p className="text-xs text-white/40 flex items-center gap-1">
                      <User className="h-3 w-3" /> {v.operatorName}
                      <Clock className="h-3 w-3 ml-2" /> {new Date(v.createdAt).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ─── AI Insights ─── */}
        {insights?.hasInsights && insights.insights.length > 0 && (
          <div className="forge-card border-l-4 border-l-blue-500">
            <div className="forge-card-header">
              <h2 className="forge-card-title flex items-center gap-2">
                <Brain className="h-4 w-4 text-blue-400" />
                Previous Setup Insights
              </h2>
            </div>
            <div className="forge-card-body space-y-3">
              {insights.insights.map((insight, i) => (
                <div key={i} className="rounded-lg border border-[hsl(220,14%,16%)] bg-[hsl(220,14%,13%)] p-3">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-semibold text-white/80">{insight.rootCause}</p>
                      <p className="text-sm text-white/50 mt-1 flex items-start gap-1">
                        <Lightbulb className="h-4 w-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                        {insight.correctiveAction}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ─── Best Known Method ─── */}
        {bkm?.hasData && (
          <div className="forge-card border-l-4 border-l-emerald-500">
            <div className="forge-card-header">
              <h2 className="forge-card-title flex items-center gap-2">
                <Award className="h-4 w-4 text-emerald-400" />
                Best Known Method
              </h2>
            </div>
            <div className="forge-card-body space-y-2">
              {bkm.bestProgramType && (
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-white/70">
                    Most successful program: <strong className="text-white/90">{bkm.bestProgramType.replace("_", " ").toUpperCase()}</strong>
                  </p>
                </div>
              )}
              {bkm.mostCommonRootCause && (
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-400 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-white/70">
                    Watch for: <strong className="text-white/90">{bkm.mostCommonRootCause}</strong>
                  </p>
                </div>
              )}
              {bkm.mostCommonCorrectiveAction && (
                <div className="flex items-start gap-2">
                  <Lightbulb className="h-4 w-4 text-blue-400 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-white/70">
                    Best practice: <strong className="text-white/90">{bkm.mostCommonCorrectiveAction}</strong>
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ─── Setup Photos ─── */}
        <div className="forge-card">
          <div className="forge-card-header">
            <h2 className="forge-card-title flex items-center gap-2">
              <Camera className="h-4 w-4 text-blue-400" />
              Setup Photos
              {setup.images.length > 0 && (
                <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full">{setup.images.length}</span>
              )}
            </h2>
          </div>
          <div className="forge-card-body">
            {setup.images.length === 0 ? (
              <div className="text-center py-6">
                <Camera className="h-10 w-10 text-white/10 mx-auto mb-2" />
                <p className="text-sm text-white/30 mb-4">No setup photos yet</p>
                <button onClick={openImageModal} className="forge-btn-primary text-sm">
                  <Plus className="h-4 w-4" /> Add Setup Photo
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {setup.images.map((img, idx) => (
                    <div key={idx} className="relative group rounded-lg overflow-hidden border border-[hsl(220,14%,16%)] bg-[hsl(220,14%,10%)]">
                      <img
                        src={img.imageData}
                        alt={`Setup ${idx + 1}`}
                        className="w-full h-40 object-cover cursor-pointer hover:opacity-80 transition-opacity"
                        onClick={() => openAnnotationEditor(idx)}
                      />
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                        <button
                          onClick={() => openAnnotationEditor(idx)}
                          className="h-8 px-3 rounded-md bg-orange-500/80 hover:bg-orange-500 text-white text-xs font-semibold flex items-center gap-1"
                        >
                          <Pencil className="h-3 w-3" /> Annotate
                        </button>
                        {editing && (
                          <button
                            onClick={() => removeImage(idx)}
                            className="h-8 px-3 rounded-md bg-rose-500/80 hover:bg-rose-500 text-white text-xs font-semibold flex items-center gap-1"
                          >
                            <Trash2 className="h-3 w-3" /> Remove
                          </button>
                        )}
                      </div>
                      <div className="absolute top-2 left-2 bg-black/60 rounded-md px-1.5 py-0.5 text-[10px] text-white/60 font-mono">
                        #{idx + 1}
                      </div>
                      {img.annotations && img.annotations.length > 0 && (
                        <div className="absolute top-2 right-2 bg-orange-500/80 rounded-full h-5 w-5 flex items-center justify-center">
                          <span className="text-[10px] text-white font-bold">{img.annotations.length}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                {editing && (
                  <button onClick={openImageModal} className="forge-btn-secondary text-sm w-full flex items-center justify-center gap-2">
                    <Plus className="h-4 w-4" /> Add Another Photo
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ─── Job Info ─── */}
        {job && (
          <div className="forge-card">
            <div className="forge-card-header">
              <h2 className="forge-card-title">Job Information</h2>
            </div>
            <div className="forge-card-body">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-xs text-white/40 uppercase tracking-wider font-semibold">Job Number</p>
                  <p className="font-semibold text-white/80">{job?.jobNumber ?? "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-white/40 uppercase tracking-wider font-semibold">Part Number</p>
                  <p className="font-semibold text-white/80">{job?.partNumber ?? "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-white/40 uppercase tracking-wider font-semibold">Material</p>
                  <p className="font-semibold text-white/80">{job?.materialNumber ?? "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-white/40 uppercase tracking-wider font-semibold">Revision</p>
                  <p className="font-semibold text-white/80">{job?.revision ?? "—"}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ─── Workholding / Fixtures ─── */}
        <div className="forge-card">
          <div className="forge-card-header">
            <h2 className="forge-card-title flex items-center gap-2">
              <FileText className="h-4 w-4 text-white/60" />
              Workholding / Fixtures
            </h2>
          </div>
          <div className="forge-card-body">
            <div className="space-y-3 text-sm">
              {setup.workholding.map((item, i) => (
                <div key={i} className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1 border-b border-[hsl(220,14%,16%)] pb-2 last:border-0 last:pb-0">
                  <span className="text-white/40 text-xs uppercase tracking-wider font-semibold">{item.label}</span>
                  {editing ? (
                    <input
                      type="text"
                      value={item.value}
                      onChange={(e) => updateWorkholding(i, e.target.value)}
                      placeholder={`Enter ${item.label}...`}
                      className="w-full sm:w-64 h-10 px-3 rounded-md border border-white/20 bg-[hsl(220,14%,16%)] text-sm text-white placeholder:text-white/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/40 focus-visible:border-orange-500/40"
                    />
                  ) : (
                    <span className="font-medium text-white/70">{item.value || <em className="text-white/20">—</em>}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ─── Tool List ─── */}
        <div className="forge-card">
          <div className="forge-card-header flex items-center justify-between">
            <h2 className="forge-card-title">Tool List</h2>
            {editing && (
              <button onClick={addTool} className="text-xs flex items-center gap-1 text-orange-400 hover:text-orange-300 font-semibold">
                <Plus className="h-3.5 w-3.5" /> Add Tool
              </button>
            )}
          </div>
          <div className="forge-card-body">
            <div className="overflow-x-auto">
              <table className="forge-table">
                <thead>
                  <tr>
                    <th className="w-16">#</th>
                    <th>Tool Description</th>
                    <th>Tool ID</th>
                    <th>Offset</th>
                    {editing && <th className="w-10"></th>}
                  </tr>
                </thead>
                <tbody>
                  {setup.tools.map((tool) => (
                    <tr key={tool.id}>
                      <td className="font-semibold text-white/80">{tool.number}</td>
                      <td>
                        {editing ? (
                          <input
                            type="text"
                            value={tool.description}
                            onChange={(e) => updateTool(tool.id, "description", e.target.value)}
                            placeholder="e.g. 3/4 Face Mill"
                            className="w-full h-8 px-2 rounded border border-white/20 bg-[hsl(220,14%,16%)] text-sm text-white placeholder:text-white/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/40 focus-visible:border-orange-500/40"
                          />
                        ) : (
                          <span className="text-white/70">{tool.description || <em className="text-white/20">—</em>}</span>
                        )}
                      </td>
                      <td>
                        {editing ? (
                          <input
                            type="text"
                            value={tool.toolId}
                            onChange={(e) => updateTool(tool.id, "toolId", e.target.value)}
                            placeholder="e.g. FM-750-003"
                            className="w-full h-8 px-2 rounded border border-white/20 bg-[hsl(220,14%,16%)] text-sm text-white placeholder:text-white/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/40 focus-visible:border-orange-500/40"
                          />
                        ) : (
                          <span className="text-white/70">{tool.toolId || <em className="text-white/20">—</em>}</span>
                        )}
                      </td>
                      <td>
                        {editing ? (
                          <input
                            type="text"
                            value={tool.offset}
                            onChange={(e) => updateTool(tool.id, "offset", e.target.value)}
                            placeholder="e.g. H01 / D01"
                            className="w-full h-8 px-2 rounded border border-white/20 bg-[hsl(220,14%,16%)] text-sm text-white placeholder:text-white/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/40 focus-visible:border-orange-500/40"
                          />
                        ) : (
                          <span className="text-white/70">{tool.offset}</span>
                        )}
                      </td>
                      {editing && (
                        <td>
                          <button onClick={() => removeTool(tool.id)} className="h-7 w-7 rounded-full bg-rose-500/10 hover:bg-rose-500/20 flex items-center justify-center text-rose-400 transition-all">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* ─── Program / Notes ─── */}
        <div className="forge-card">
          <div className="forge-card-header">
            <h2 className="forge-card-title">Program / Notes</h2>
          </div>
          <div className="forge-card-body">
            <div className="space-y-3 text-sm">
              {setup.programNotes.map((note, i) => (
                <div key={i} className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1 border-b border-[hsl(220,14%,16%)] pb-2 last:border-0 last:pb-0">
                  <span className="text-white/40 text-xs uppercase tracking-wider font-semibold">{note.label}</span>
                  {editing ? (
                    <input
                      type="text"
                      value={note.value}
                      onChange={(e) => updateProgramNote(i, e.target.value)}
                      placeholder={`Enter ${note.label}...`}
                      className="w-full sm:w-80 h-9 px-3 rounded-md border border-white/20 bg-[hsl(220,14%,16%)] text-sm text-white placeholder:text-white/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/40 focus-visible:border-orange-500/40"
                    />
                  ) : (
                    <span className="font-medium text-white/70">{note.value || <em className="text-white/20">—</em>}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ─── General Setup Notes ─── */}
        <div className="forge-card">
          <div className="forge-card-header">
            <h2 className="forge-card-title flex items-center gap-2">
              <FileText className="h-4 w-4 text-emerald-400" />
              General Setup Notes
            </h2>
          </div>
          <div className="forge-card-body">
            {editing ? (
              <textarea
                value={setup.generalNotes}
                onChange={(e) => setSetup(prev => ({ ...prev, generalNotes: e.target.value }))}
                placeholder="Add general notes about this setup...&#10;e.g. Use soft jaws, check runout before machining, coolant at 8%..."
                className="w-full h-32 resize-none rounded-lg border border-[hsl(220,14%,22%)] bg-[hsl(220,14%,14%)] text-sm text-white placeholder:text-white/30 p-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/40 focus-visible:border-orange-500/40"
              />
            ) : (
              <div className="text-sm text-white/70 whitespace-pre-wrap min-h-[3rem]">
                {setup.generalNotes || <em className="text-white/20">No notes added yet.</em>}
              </div>
            )}
          </div>
        </div>

      </div>

      {/* ─── Camera / Upload Modal ─── */}
      {showImageModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={closeImageModal}>
          <div className="bg-[hsl(220,14%,10%)] border border-[hsl(220,14%,20%)] rounded-xl shadow-2xl max-w-lg w-full mx-4 overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-[hsl(220,14%,16%)]">
              <h3 className="text-sm font-semibold text-white/80">Add Setup Photo</h3>
              <button onClick={closeImageModal} className="h-8 w-8 rounded-lg flex items-center justify-center text-white/40 hover:text-white/80 hover:bg-white/5 transition-all">
                <X className="h-4 w-4" />
              </button>
            </div>

            {cameraActive && (
              <div className="relative bg-black">
                <video ref={videoRef} className="w-full aspect-video object-cover" autoPlay playsInline muted />
                <canvas ref={canvasRef} className="hidden" />
                <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-3">
                  <button onClick={capturePhoto} className="h-14 w-14 rounded-full bg-orange-500 hover:bg-orange-400 flex items-center justify-center shadow-lg transition-all">
                    <div className="h-10 w-10 rounded-full border-2 border-white" />
                  </button>
                </div>
              </div>
            )}

            {!cameraActive && (
              <div className="p-6 flex flex-col gap-3">
                <p className="text-xs text-white/40 text-center mb-2">Choose how to add a setup photo</p>
                <button
                  onClick={startCamera}
                  className="w-full h-14 rounded-lg bg-orange-500/10 hover:bg-orange-500/20 border border-orange-500/30 flex items-center justify-center gap-3 transition-all group"
                >
                  <Aperture className="h-6 w-6 text-orange-400 group-hover:scale-110 transition-transform" />
                  <span className="text-sm font-semibold text-orange-400">Take Photo with Camera</span>
                </button>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full h-14 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 flex items-center justify-center gap-3 transition-all group"
                >
                  <Upload className="h-6 w-6 text-blue-400 group-hover:scale-110 transition-transform" />
                  <span className="text-sm font-semibold text-blue-400">Upload Image from Device</span>
                </button>
                <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
              </div>
            )}
          </div>
        </div>
      )}
    </AppLayout>
  );
}
