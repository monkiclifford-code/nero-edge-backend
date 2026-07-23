import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router";
import { trpc } from "@/providers/trpc";
import { isDemoMode, demoApi } from "@/lib/demoApi";
import { compressImage, compressFile } from "@/lib/imageCompress";
import AppLayout from "@/components/layout/AppLayout";
import {
  FOUNDRY_DEFECT_TYPES, NCR_CLASSIFICATIONS, SEVERITY_LEVELS,
  getDefectLabel, getDefectColor,
  type DefectType, type NcrClassification, type SeverityLevel,
} from "@/lib/foundryConstants";
import {
  Camera, Upload, Brain, Save, Loader2, X, AlertTriangle,
  CheckCircle2, Microscope, Trash2, Sparkles,
  QrCode, Monitor, ImageIcon, ShieldAlert, BookOpen,
  Pencil, ShieldCheck,
} from "lucide-react";
import AIPredictionCard from "@/components/foundry/AIPredictionCard";
import ConfidenceBadge from "@/components/foundry/ConfidenceBadge";
import FullscreenImageViewer from "@/components/foundry/FullscreenImageViewer";
import CameraCapture from "@/components/foundry/CameraCapture";
import QRCodePanel from "@/components/foundry/QRCodePanel";

interface UploadedImage {
  id: number;
  url: string;
  aiPrediction: ReturnType<typeof demoApi.runAiVision> | null;
  aiStatus: "idle" | "processing" | "completed" | "failed";
  sizeKB?: number;
}

const MAX_IMAGES = 10;

function getBase64SizeKB(dataUrl: string): number {
  return Math.round((dataUrl.length * 3) / 4 / 1024);
}

export default function FoundryNCRPage() {
  const navigate = useNavigate();
  const [operator, setOperator] = useState<{ id: number; name: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form state
  const [jobId, setJobId] = useState("1");
  const [partNumber, setPartNumber] = useState("");
  const [ncrType, setNcrType] = useState<NcrClassification>("foundry");
  const [defectType, setDefectType] = useState<DefectType>("porosity");
  const [severity, setSeverity] = useState<SeverityLevel>("major");
  const [problemDescription, setProblemDescription] = useState("");
  const [rootCause, setRootCause] = useState("");
  const [correctiveAction, setCorrectiveAction] = useState("");
  const [scrapQuantified, setScrapQuantified] = useState(false);
  const [scrapCost, setScrapCost] = useState("");

  // Image state
  const [images, setImages] = useState<UploadedImage[]>([]);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);
  const [showCamera, setShowCamera] = useState(false);
  const [showQRPanel, setShowQRPanel] = useState(false);

  // tRPC mutations (version-controlled)
  const saveNcr = trpc.foundry.saveNcr.useMutation();
  const attachImage = trpc.foundry.attachImage.useMutation();
  const approveNcr = trpc.foundry.approveNcr.useMutation();

  // Submit state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedNcrId, setSubmittedNcrId] = useState<number | null>(null);
  const [submittedVersion, setSubmittedVersion] = useState(1);
  const [editMode, setEditMode] = useState(false);
  const [editNcrId, setEditNcrId] = useState<number | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const saved = localStorage.getItem("cnc_operator");
    if (!saved) { navigate("/"); return; }
    try { setOperator(JSON.parse(saved)); } catch { navigate("/"); }
  }, [navigate]);

  const [compressingCount, setCompressingCount] = useState(0);

  // ── Add compressed image (NO auto-AI — submit is instant) ──
  const addCompressedImage = useCallback((compressedUrl: string) => {
    setImages((prev) => {
      if (prev.length >= MAX_IMAGES) return prev; // Hard limit
      return [...prev, {
        id: Date.now() + Math.random(),
        url: compressedUrl,
        aiPrediction: null,
        aiStatus: "idle",
        sizeKB: getBase64SizeKB(compressedUrl),
      }];
    });
  }, []);

  // ── Handle file upload with compression ──
  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    setCompressingCount((c) => c + files.length);

    for (const file of Array.from(files)) {
      try {
        const compressed = await compressFile(file, { maxWidth: 1024, maxHeight: 1024, quality: 0.75 });
        addCompressedImage(compressed);
      } catch {
        // fallback: use original
        const url = URL.createObjectURL(file);
        addCompressedImage(url);
      }
      setCompressingCount((c) => Math.max(0, c - 1));
    }
    e.target.value = "";
  }, [addCompressedImage]);

  // ── Handle camera capture with compression ──
  const handleCameraCapture = useCallback(async (imageDataUrl: string) => {
    setCompressingCount((c) => c + 1);
    try {
      const compressed = await compressImage(imageDataUrl, { maxWidth: 1024, maxHeight: 1024, quality: 0.75 });
      addCompressedImage(compressed);
    } catch {
      addCompressedImage(imageDataUrl);
    }
    setCompressingCount((c) => Math.max(0, c - 1));
  }, [addCompressedImage]);

  // ── Handle QR-received images ──
  const handleQRImages = useCallback((dataUrls: string[]) => {
    dataUrls.forEach((url) => addCompressedImage(url));
  }, [addCompressedImage]);

  const removeImage = useCallback((id: number) => {
    setImages((prev) => prev.filter((img) => img.id !== id));
  }, []);

  const openViewer = useCallback((index: number) => {
    setViewerIndex(index);
    setViewerOpen(true);
  }, []);

  const handleSubmit = useCallback(async () => {
    setError("");
    if (!operator) { setError("No operator logged in."); return; }
    if (!partNumber.trim()) { setError("Part number is required."); return; }
    if (!problemDescription.trim()) { setError("Problem description is required."); return; }
    setIsSubmitting(true);

    try {
      let ncrId: number;
      let ncrVersion = 1;

      if (isDemoMode()) {
        const result = demoApi.createFoundryNcr({
          jobId: Number(jobId) || 1,
          operatorId: operator.id,
          ncrType, defectType,
          problemDescription: problemDescription.trim(),
          rootCause: rootCause.trim() || undefined,
          correctiveAction: correctiveAction.trim() || undefined,
          severity, scrapQuantified,
          scrapCost: scrapCost ? parseFloat(scrapCost) : undefined,
        });
        ncrId = result.foundryNcrId;
        images.forEach((img) => {
          demoApi.attachFoundryImage({ foundryNcrId: ncrId, imageUrl: img.url, uploadedBy: operator.id });
        });
      } else {
        // Version-controlled save
        const result = await saveNcr.mutateAsync({
          jobId: Number(jobId) || 1,
          operatorId: operator.id,
          operatorName: operator.name,
          ncrType, defectType,
          problemDescription: problemDescription.trim(),
          rootCause: rootCause.trim() || undefined,
          correctiveAction: correctiveAction.trim() || undefined,
          severity, scrapQuantified,
          scrapCost: scrapCost ? parseFloat(scrapCost) : undefined,
          existingNcrId: editMode && editNcrId ? editNcrId : undefined,
          changeSummary: editMode ? `Edited by ${operator.name}` : `Initial NCR by ${operator.name}`,
        });
        ncrId = result.foundryNcrId;
        ncrVersion = result.version;
        // Attach images
        for (const img of images) {
          await attachImage.mutateAsync({
            foundryNcrId: ncrId,
            imageUrl: img.url,
            uploadedBy: operator.id,
          });
        }
      }
      setSubmittedNcrId(ncrId);
      setSubmittedVersion(ncrVersion);
      setEditMode(false);
      setEditNcrId(null);
    } catch (err: any) {
      setError(err.message || "Failed to save NCR.");
    }
    setIsSubmitting(false);
  }, [operator, partNumber, problemDescription, defectType, jobId, ncrType, severity, rootCause, correctiveAction, scrapQuantified, scrapCost, images, createNcr, attachImage]);

  // ─── Success Screen ───
  if (submittedNcrId) {
    return (
      <AppLayout title={editMode ? "NCR Updated" : "Foundry NCR Created"} subtitle="" showBack onBack={() => setSubmittedNcrId(null)}>
        <div className="max-w-xl mx-auto py-12 text-center space-y-5">
          <div className="w-20 h-20 rounded-full bg-emerald-500/15 border-2 border-emerald-500/30 flex items-center justify-center mx-auto">
            <CheckCircle2 className="h-10 w-10 text-emerald-400" />
          </div>
          <h2 className="text-2xl font-bold text-[hsl(220,14%,15%)]">
            {editMode ? "NCR Updated" : "Foundry NCR Submitted"}
          </h2>
          <div className="space-y-2">
            <p className="text-sm text-[hsl(220,14%,55%)]">NCR #{submittedNcrId} has been logged successfully.</p>
            <div className="flex items-center justify-center gap-3">
              <span className="text-xs bg-blue-500/20 text-blue-400 px-3 py-1 rounded-full font-semibold">
                Version {submittedVersion}
              </span>
              <span className="text-xs bg-amber-500/20 text-amber-400 px-3 py-1 rounded-full font-semibold flex items-center gap-1">
                <ShieldAlert className="h-3 w-3" /> Pending Approval
              </span>
            </div>
            <p className="text-xs text-white/30">A supervisor must approve before this becomes the active NCR.</p>
          </div>
          <div className="flex gap-3 justify-center pt-2">
            <button className="forge-btn-primary h-14 px-6" onClick={() => {
              setSubmittedNcrId(null); setEditMode(false); setEditNcrId(null);
              setProblemDescription(""); setRootCause("");
              setCorrectiveAction(""); setImages([]); setScrapCost(""); setScrapQuantified(false);
            }}>Create Another NCR</button>
            <button className="forge-btn-secondary h-14 px-6" onClick={() => navigate("/foundry-ncr-library")}>NCR Library</button>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout
      title={editMode ? `Edit NCR #${editNcrId}` : "Foundry NCR"}
      subtitle={editMode ? "Update existing NCR — creates new version" : "Create Non-Conformance Report with AI Vision"}
      showBack
      onBack={() => navigate("/job-entry")}
      action={
        <div className="flex gap-2">
          <button className="forge-btn-secondary flex items-center gap-2" onClick={() => navigate("/foundry-ncr-library")}>
            <BookOpen className="h-4 w-4" /> Library
          </button>
          {editMode && (
            <button className="forge-btn-secondary flex items-center gap-2" onClick={() => { setEditMode(false); setEditNcrId(null); }}>
              <X className="h-4 w-4" /> Cancel Edit
            </button>
          )}
        </div>
      }
    >
      <div className="max-w-4xl mx-auto space-y-5 pb-8">

        {/* ── Section 1: Classification ── */}
        <div className="forge-card">
          <div className="forge-card-header">
            <h2 className="forge-card-title flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-500/20 text-blue-400 text-xs font-bold">1</span>
              NCR Classification
            </h2>
          </div>
          <div className="forge-card-body space-y-4">
            <div>
              <label className="text-sm font-semibold text-[hsl(220,14%,65%)] mb-2 block">NCR Type</label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {NCR_CLASSIFICATIONS.map((t) => (
                  <button key={t.value} onClick={() => setNcrType(t.value)}
                    className={`h-12 text-sm font-semibold rounded-md transition-all border ${ncrType === t.value ? "border-blue-500/50 bg-blue-500/15 text-blue-400" : "border-[hsl(220,13%,90%)] hover:border-white/20 text-[hsl(220,14%,40%)]"}`}>
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-sm font-semibold text-[hsl(220,14%,65%)] mb-2 block">
                Defect Type <span className="text-rose-400">*</span>
                {images.some((i) => i.aiStatus === "completed") && (
                  <span className="ml-2 text-xs font-normal text-blue-400 inline-flex items-center gap-1"><Sparkles className="h-3 w-3" /> AI-detected</span>
                )}
              </label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {FOUNDRY_DEFECT_TYPES.map((d) => (
                  <button key={d.value} onClick={() => setDefectType(d.value)}
                    className={`h-12 text-sm font-semibold rounded-md transition-all border flex items-center gap-2 px-3 ${defectType === d.value ? "border-orange-500/50 bg-orange-500/10 text-orange-400" : "border-[hsl(220,13%,90%)] hover:border-white/20 text-[hsl(220,14%,40%)]"}`}>
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: d.color }} />{d.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-sm font-semibold text-[hsl(220,14%,65%)] mb-2 block">Severity</label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {SEVERITY_LEVELS.map((s) => (
                  <button key={s.value} onClick={() => setSeverity(s.value)}
                    className={`h-12 text-sm font-semibold rounded-md transition-all border ${severity === s.value ? "border-rose-500/50 bg-rose-500/10 text-rose-400" : "border-[hsl(220,13%,90%)] hover:border-white/20 text-[hsl(220,14%,40%)]"}`}>
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── Section 2: Image Capture ── */}
        <div className="forge-card">
          <div className="forge-card-header">
            <h2 className="forge-card-title flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-500/20 text-blue-400 text-xs font-bold">2</span>
              Image Capture & AI Analysis
            </h2>
          </div>
          <div className="forge-card-body space-y-4">
            {/* Option A: Tablet */}
            <div className="rounded-lg border border-blue-500/20 bg-blue-950/20 p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Monitor className="h-4 w-4 text-blue-400" />
                  <p className="text-xs font-semibold uppercase tracking-wider text-blue-300">Option A — Tablet Camera</p>
                </div>
                <span className="text-[10px] font-bold text-[hsl(220,14%,70%)]">{images.length}/{MAX_IMAGES}</span>
              </div>
              {images.length >= MAX_IMAGES ? (
                <div className="rounded-md bg-amber-950/30 border border-amber-500/20 p-3 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-400 flex-shrink-0" />
                  <p className="text-xs text-amber-300">Maximum {MAX_IMAGES} images reached. Remove some to add more.</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handleFileSelect} className="hidden" />
                  <button className="h-14 text-sm font-semibold border border-[hsl(220,14%,22%)] hover:border-orange-500/50 hover:bg-orange-500/5 rounded-md transition-all flex items-center justify-center gap-2 text-[hsl(220,14%,40%)]"
                    onClick={() => fileInputRef.current?.click()}>
                    <Upload className="h-4 w-4" /> Upload File
                  </button>
                  <button className="h-14 text-sm font-semibold bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 rounded-md transition-all flex items-center justify-center gap-2 text-blue-400"
                    onClick={() => setShowCamera(true)}>
                    <Camera className="h-4 w-4" /> Open Camera
                  </button>
                </div>
              )}
            </div>

            {/* Option B: Phone QR */}
            <div className="rounded-lg border border-emerald-500/20 bg-emerald-950/20 p-4">
              <div className="flex items-center gap-2 mb-3">
                <QrCode className="h-4 w-4 text-emerald-400" />
                <p className="text-xs font-semibold uppercase tracking-wider text-emerald-300">Option B — Send from Phone</p>
              </div>
              <button className="w-full h-14 text-sm font-semibold bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30 rounded-md transition-all flex items-center justify-center gap-2 text-emerald-400"
                onClick={() => setShowQRPanel(true)}>
                <QrCode className="h-4 w-4" /> Show QR Code for Phone Transfer
              </button>
            </div>

            {/* Compressing indicator */}
            {compressingCount > 0 && (
              <div className="flex items-center gap-3 rounded-lg bg-blue-950/30 border border-blue-500/20 p-3">
                <Loader2 className="h-4 w-4 text-blue-400 animate-spin" />
                <span className="text-xs font-semibold text-blue-300">Compressing {compressingCount} photo{compressingCount > 1 ? "s" : ""}...</span>
              </div>
            )}

            {/* Image grid */}
            {images.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wider text-[hsl(220,14%,55%)]">
                    {images.length} image{images.length > 1 ? "s" : ""} attached
                  </p>
                  <p className="text-[10px] text-emerald-400/70">Ready to submit</p>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {images.map((img, idx) => {
                    const { aiPrediction, aiStatus } = img;
                    return (
                      <div key={img.id} className="relative rounded-lg border border-[hsl(220,13%,88%)] overflow-hidden group">
                        <div className="relative">
                          <img src={img.url} alt={`Defect ${idx + 1}`} className="w-full h-36 object-cover cursor-pointer" onClick={() => openViewer(idx)} />
                          {/* File size badge */}
                          {img.sizeKB && (
                            <span className="absolute top-2 right-2 text-[9px] font-bold text-[hsl(220,14%,40%)] bg-black/50 px-1.5 py-0.5 rounded">
                              {img.sizeKB} KB
                            </span>
                          )}
                        </div>
                        {aiStatus === "completed" && aiPrediction?.topPrediction && (
                          <div className="absolute top-2 left-2"><ConfidenceBadge confidence={aiPrediction.topPrediction.confidence} size="sm" /></div>
                        )}
                        {aiStatus === "processing" && (
                          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                            <div className="flex items-center gap-2 text-blue-400"><Brain className="h-5 w-5 animate-pulse" /><span className="text-xs font-semibold">Analyzing...</span></div>
                          </div>
                        )}
                        {aiStatus === "idle" && (
                          <div className="absolute bottom-2 left-2 right-2">
                            <button className="w-full h-8 text-xs font-semibold bg-blue-600/80 hover:bg-blue-500 text-white rounded-md transition-all flex items-center justify-center gap-1"
                              onClick={() => {
                                setImages((prev) => prev.map((i) => i.id === img.id ? { ...i, aiStatus: "processing" } : i));
                                setTimeout(() => {
                                  const result = demoApi.runAiVision(img.url, img.id);
                                  setImages((prev) => prev.map((i) => i.id === img.id ? { ...i, aiPrediction: result, aiStatus: "completed" } : i));
                                  if (result.topPrediction) setDefectType(result.topPrediction.defectType as DefectType);
                                }, 1000);
                              }}><Microscope className="h-3 w-3" /> Analyze</button>
                          </div>
                        )}
                        <button onClick={() => removeImage(img.id)} className="absolute top-2 right-2 h-7 w-7 rounded-full bg-black/60 hover:bg-rose-500/80 flex items-center justify-center text-[hsl(220,14%,65%)] transition-all opacity-0 group-hover:opacity-100">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
                {images.some((i) => i.aiStatus === "completed") && (
                  <div className="space-y-3">
                    {images.filter((i) => i.aiStatus === "completed" && i.aiPrediction).map((img) => (
                      <AIPredictionCard key={img.id} predictions={img.aiPrediction!.predictions} topPrediction={img.aiPrediction!.topPrediction}
                        processingTimeMs={img.aiPrediction!.processingTimeMs} provider="mock" status="completed" />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── Section 3: Problem Details ── */}
        <div className="forge-card">
          <div className="forge-card-header">
            <h2 className="forge-card-title flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-500/20 text-blue-400 text-xs font-bold">3</span>
              Problem Details
            </h2>
          </div>
          <div className="forge-card-body space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-semibold text-[hsl(220,14%,65%)] mb-1.5 block">Job ID</label>
                <input type="text" value={jobId} onChange={(e) => setJobId(e.target.value)}
                  className="w-full h-12 px-4 rounded-md border border-[hsl(220,14%,22%)] bg-white text-sm text-black placeholder:text-[hsl(220,14%,50%)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[hsl(24,95%,53%)]/30" placeholder="Job ID" />
              </div>
              <div>
                <label className="text-sm font-semibold text-[hsl(220,14%,65%)] mb-1.5 block">Part Number <span className="text-rose-400">*</span></label>
                <input type="text" value={partNumber} onChange={(e) => setPartNumber(e.target.value)}
                  className="w-full h-12 px-4 rounded-md border border-[hsl(220,14%,22%)] bg-white text-sm text-black placeholder:text-[hsl(220,14%,50%)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[hsl(24,95%,53%)]/30" placeholder="e.g. PN-CAST-1234" />
              </div>
            </div>
            <div>
              <label className="text-sm font-semibold text-[hsl(220,14%,65%)] mb-1.5 block">Problem Description <span className="text-rose-400">*</span></label>
              <textarea value={problemDescription} onChange={(e) => setProblemDescription(e.target.value)} placeholder="Describe the foundry defect observed..."
                className="w-full rounded-md border border-[hsl(220,14%,22%)] bg-white px-3 py-2 text-sm text-black placeholder:text-[hsl(220,14%,50%)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[hsl(24,95%,53%)]/30 min-h-[100px]" />
            </div>
            <div>
              <label className="text-sm font-semibold text-[hsl(220,14%,65%)] mb-1.5 block">Root Cause</label>
              <textarea value={rootCause} onChange={(e) => setRootCause(e.target.value)} placeholder="What caused this defect?"
                className="w-full rounded-md border border-[hsl(220,14%,22%)] bg-white px-3 py-2 text-sm text-black placeholder:text-[hsl(220,14%,50%)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[hsl(24,95%,53%)]/30 min-h-[80px]" />
            </div>
            <div>
              <label className="text-sm font-semibold text-[hsl(220,14%,65%)] mb-1.5 block">Corrective Action</label>
              <textarea value={correctiveAction} onChange={(e) => setCorrectiveAction(e.target.value)} placeholder="What action will be taken to prevent recurrence?"
                className="w-full rounded-md border border-[hsl(220,14%,22%)] bg-white px-3 py-2 text-sm text-black placeholder:text-[hsl(220,14%,50%)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[hsl(24,95%,53%)]/30 min-h-[80px]" />
            </div>
            <div className="space-y-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={scrapQuantified} onChange={(e) => setScrapQuantified(e.target.checked)} className="h-4 w-4 rounded border-[hsl(220,14%,60%)] bg-white" />
                <span className="text-sm font-semibold text-[hsl(220,14%,65%)]">Quantify scrap cost</span>
              </label>
              {scrapQuantified && (
                <div>
                  <label className="text-sm font-semibold text-[hsl(220,14%,65%)] mb-1.5 block">Scrap Cost ($)</label>
                  <input type="number" value={scrapCost} onChange={(e) => setScrapCost(e.target.value)} placeholder="e.g. 350.00"
                    className="w-full h-12 px-4 rounded-md border border-[hsl(220,14%,22%)] bg-white text-sm text-black placeholder:text-[hsl(220,14%,50%)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[hsl(24,95%,53%)]/30" />
                </div>
              )}
            </div>
          </div>
        </div>

        {error && (
          <div className="rounded-lg bg-rose-950/40 border border-rose-500/20 p-4 text-rose-300 text-sm font-medium flex items-start gap-2">
            <AlertTriangle className="h-5 w-5 mt-0.5 flex-shrink-0" />{error}
          </div>
        )}

        {/* Image count + Submit */}
        <div className="space-y-3">
          {images.length > 0 && (
            <div className="flex items-center justify-between rounded-lg bg-emerald-950/30 border border-emerald-500/20 px-4 py-3">
              <div className="flex items-center gap-2">
                <ImageIcon className="h-4 w-4 text-emerald-400" />
                <span className="text-sm font-semibold text-emerald-300">
                  {images.length}/{MAX_IMAGES} image{images.length > 1 ? "s" : ""} ready
                </span>
              </div>
              <span className="text-[10px] text-emerald-400/60 font-mono">
                {images.reduce((sum, img) => sum + (img.sizeKB ?? 0), 0)} KB total
              </span>
            </div>
          )}
          <button className="w-full h-16 text-lg font-bold bg-rose-600 hover:bg-rose-500 text-white rounded-md transition-all flex items-center justify-center gap-2 disabled:opacity-60"
            onClick={handleSubmit} disabled={isSubmitting || compressingCount > 0}>
            {isSubmitting ? (
              <><Loader2 className="h-6 w-6 animate-spin" /> Submitting...</>
            ) : compressingCount > 0 ? (
              <><Loader2 className="h-6 w-6 animate-spin" /> Compressing {compressingCount}...</>
            ) : (
              <><Save className="h-6 w-6" /> {editMode ? `Update NCR V${submittedVersion + 1}` : `Save Foundry NCR`} {images.length > 0 && `(${images.length})`}</>
            )}
          </button>
        </div>
      </div>

      {/* Modals */}
      {viewerOpen && (
        <FullscreenImageViewer
          images={images.map((img) => ({ id: img.id, imageUrl: img.url, thumbnailUrl: img.url,
            predictedType: img.aiPrediction?.topPrediction?.defectType ?? null,
            aiConfidence: img.aiPrediction?.topPrediction?.confidence?.toString() ?? null }))}
          initialIndex={viewerIndex} onClose={() => setViewerOpen(false)} />
      )}
      {showCamera && <CameraCapture onCapture={handleCameraCapture} onClose={() => setShowCamera(false)} />}
      {showQRPanel && <QRCodePanel onImagesReceived={handleQRImages} onClose={() => setShowQRPanel(false)} />}
    </AppLayout>
  );
}
