import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/providers/trpc";
import { isDemoMode, demoApi } from "@/lib/demoApi";
import AppLayout from "@/components/layout/AppLayout";
import {
  FileText, ClipboardList, AlertTriangle, CheckCircle2,
  Lightbulb, Brain, Award, Camera, Plus, Trash2, Save, Pencil, Upload, X, Aperture
} from "lucide-react";

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
}

function getDefaultSetup(): SetupData {
  return {
    workholding: [
      { label: "Vise Jaw Type", value: "" },
      { label: "Fixture Number", value: "" },
      { label: "Clamping Torque", value: "" },
      { label: "Part Zero Location", value: "" },
      { label: "Work Offset (G54)", value: "" },
      { label: "Gauge Length", value: "" },
    ],
    tools: [
      { id: "t1", number: "T01", description: "", toolId: "", offset: "H01 / D01" },
      { id: "t2", number: "T02", description: "", toolId: "", offset: "H02 / D02" },
    ],
    programNotes: [
      { label: "Program Number", value: "" },
      { label: "Feed Override", value: "100%" },
      { label: "Spindle Speed Override", value: "100%" },
      { label: "Special Instructions", value: "" },
    ],
  };
}

function loadSetup(jobId: string): SetupData {
  try {
    const saved = localStorage.getItem(`cnc_setup_${jobId}`);
    if (saved) return JSON.parse(saved);
  } catch { /* ignore */ }
  return getDefaultSetup();
}

function saveSetup(jobId: string, data: SetupData) {
  localStorage.setItem(`cnc_setup_${jobId}`, JSON.stringify(data));
}

export default function SetupSheet() {
  const navigate = useNavigate();
  const { jobId } = useParams<{ jobId: string }>();
  const [setupMarked, setSetupMarked] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState(false);
  const [setup, setSetup] = useState<SetupData>(() => loadSetup(jobId ?? "0"));

  // Camera / Upload modal state
  const [showImageModal, setShowImageModal] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);

  // ─── Start camera: activate first, then attach stream via effect ───
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      cameraStreamRef.current = stream;
      setCameraActive(true); // Video element will render after this
    } catch (err) {
      console.error("Camera error:", err);
      alert("Could not access camera. Please ensure camera permissions are granted.\n\nIf using a work computer, your IT department may have blocked camera access. Try uploading an image instead.");
    }
  };

  // Attach stream to video element AFTER it renders
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
    saveImageAndNavigate(dataUrl);
    stopCamera();
    setShowImageModal(false);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      saveImageAndNavigate(dataUrl);
      setShowImageModal(false);
    };
    reader.readAsDataURL(file);
  };

  const saveImageAndNavigate = (dataUrl: string) => {
    if (!jobId) return;
    // Save image to localStorage for the annotation editor to pick up
    localStorage.setItem(`cnc_setup_annotations_${jobId}_pending`, dataUrl);
    // Also save as a full annotation setup
    const saved: any = {
      imageDataUrl: dataUrl,
      annotations: [],
      version: 1,
      savedAt: new Date().toISOString(),
    };
    localStorage.setItem(`cnc_setup_annotations_${jobId}`, JSON.stringify(saved));
    // Navigate to annotation editor
    navigate(`/setup-annotate/${jobId}`);
  };

  const openImageModal = () => {
    setShowImageModal(true);
    setCameraActive(false);
  };

  const closeImageModal = () => {
    stopCamera();
    setShowImageModal(false);
  };

  useEffect(() => {
    const savedOp = localStorage.getItem("cnc_operator");
    if (!savedOp) { navigate("/"); return; }
  }, [navigate]);

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

  const jobQuery = trpc.job.getById.useQuery(
    { id: Number(jobId) },
    { enabled: !!jobId && !isNaN(Number(jobId)) && !isDemoMode() }
  );

  const setupInsights = trpc.ai.getSetupInsights.useQuery(
    { partNumber: (isDemoMode() ? demoApi.getJobById(Number(jobId)) : jobQuery.data)?.partNumber ?? "" },
    { enabled: ((isDemoMode() ? demoApi.getJobById(Number(jobId)) : jobQuery.data)?.partNumber ?? "").length > 0 && !isDemoMode() }
  );

  const bestKnownMethod = trpc.feedback.getBestKnownMethod.useQuery(
    { partNumber: (isDemoMode() ? demoApi.getJobById(Number(jobId)) : jobQuery.data)?.partNumber ?? "" },
    { enabled: ((isDemoMode() ? demoApi.getJobById(Number(jobId)) : jobQuery.data)?.partNumber ?? "").length > 0 && !isDemoMode() }
  );

  const job = isDemoMode() ? demoApi.getJobById(Number(jobId)) : jobQuery.data;
  const insights = isDemoMode() ? demoApi.getSetupInsights(job?.partNumber ?? "") : setupInsights.data;
  const bkm = isDemoMode() ? demoApi.getBestKnownMethod(job?.partNumber ?? "") : bestKnownMethod.data;

  const handleSave = () => {
    if (jobId) saveSetup(jobId, setup);
    setSaved(true);
    setEditing(false);
    setTimeout(() => setSaved(false), 3000);
  };

  const updateWorkholding = (index: number, value: string) => {
    setSetup((prev) => ({
      ...prev,
      workholding: prev.workholding.map((w, i) => i === index ? { ...w, value } : w),
    }));
  };

  const addTool = () => {
    const nextNum = setup.tools.length + 1;
    setSetup((prev) => ({
      ...prev,
      tools: [...prev.tools, {
        id: `t${Date.now()}`,
        number: `T${String(nextNum).padStart(2, "0")}`,
        description: "", toolId: "", offset: `H${nextNum} / D${nextNum}`,
      }],
    }));
  };

  const removeTool = (id: string) => {
    setSetup((prev) => ({ ...prev, tools: prev.tools.filter((t) => t.id !== id) }));
  };

  const updateTool = (id: string, field: keyof ToolEntry, value: string) => {
    setSetup((prev) => ({
      ...prev,
      tools: prev.tools.map((t) => t.id === id ? { ...t, [field]: value } : t),
    }));
  };

  const updateProgramNote = (index: number, value: string) => {
    setSetup((prev) => ({
      ...prev,
      programNotes: prev.programNotes.map((p, i) => i === index ? { ...p, value } : p),
    }));
  };

  return (
    <AppLayout
      title="Setup Sheet"
      subtitle={job ? `Job: ${job.jobNumber} | Part: ${job.partNumber}` : ""}
      showBack
      onBack={() => navigate("/job-entry")}
      action={
        <div className="flex gap-2">
          {editing ? (
            <button className="forge-btn-primary flex items-center gap-2" onClick={handleSave}>
              <Save className="h-4 w-4" /> Save
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
      <div className="max-w-4xl mx-auto space-y-5">

        {/* Saved confirmation */}
        {saved && (
          <div className="rounded-lg border border-emerald-500/20 bg-emerald-950/30 px-4 py-3 flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-emerald-400 flex-shrink-0" />
            <p className="text-sm text-emerald-300 font-medium">Setup sheet saved successfully!</p>
          </div>
        )}

        {/* Setup Viewed Confirmation */}
        {setupMarked && (
          <div className="rounded-lg border border-emerald-500/20 bg-emerald-950/30 px-4 py-3 flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-emerald-400 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-emerald-300">Setup Sheet marked as viewed.</p>
              <p className="text-xs text-emerald-400/70">Inspection is now unlocked for this job.</p>
            </div>
          </div>
        )}

        {/* AI: Previous Setup Insights */}
        {insights?.hasInsights && insights.insights.length > 0 && (
          <div className="forge-card border-l-4 border-l-blue-500">
            <div className="forge-card-header">
              <h2 className="forge-card-title flex items-center gap-2">
                <Brain className="h-4 w-4 text-blue-400" />
                Previous Setup Insights
                <span className="text-[10px] font-normal text-white/40 normal-case tracking-normal">(from past NCRs)</span>
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

        {/* Best Known Method */}
        {bkm?.hasData && (
          <div className="forge-card border-l-4 border-l-emerald-500">
            <div className="forge-card-header">
              <h2 className="forge-card-title flex items-center gap-2">
                <Award className="h-4 w-4 text-emerald-400" />
                Best Known Method
                <span className="text-[10px] font-normal text-white/40 normal-case tracking-normal">(from successful runs)</span>
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

        {/* Setup Photo & Annotation Links */}
        <div className="forge-card">
          <div className="forge-card-body">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <Camera className="h-5 w-5 text-blue-400 flex-shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-white/80">Setup Photos & Annotations</p>
                  <p className="text-xs text-white/40">Document setup with visual annotations for future operators</p>
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <button className="h-11 px-5 rounded-md font-semibold text-sm transition-all duration-150 active:scale-[0.98] flex-1 flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-400 text-white shadow-lg shadow-orange-500/30" onClick={openImageModal}>
                <Pencil className="h-4 w-4" /> Annotate Setup
              </button>
              <button className="forge-btn-secondary flex items-center justify-center gap-2" onClick={() => navigate(`/setup-images/${jobId}`)}>
                <Camera className="h-4 w-4" /> Upload
              </button>
            </div>
          </div>
        </div>

        {/* Job Info */}
        {job && (
          <div className="forge-card">
            <div className="forge-card-header">
              <h2 className="forge-card-title">Job Information</h2>
            </div>
            <div className="forge-card-body">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-xs text-white/40 uppercase tracking-wider font-semibold">Job Number</p>
                  <p className="font-semibold text-white/80">{job.jobNumber}</p>
                </div>
                <div>
                  <p className="text-xs text-white/40 uppercase tracking-wider font-semibold">Part Number</p>
                  <p className="font-semibold text-white/80">{job.partNumber}</p>
                </div>
                <div>
                  <p className="text-xs text-white/40 uppercase tracking-wider font-semibold">Material</p>
                  <p className="font-semibold text-white/80">{job.materialNumber}</p>
                </div>
                <div>
                  <p className="text-xs text-white/40 uppercase tracking-wider font-semibold">Revision</p>
                  <p className="font-semibold text-white/80">{job.revision}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Workholding / Fixtures - EDITABLE */}
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

        {/* Tool List - EDITABLE */}
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

        {/* Program / Notes - EDITABLE */}
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

      </div>

      {/* ─── Camera / Upload Modal ─── */}
      {showImageModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={closeImageModal}>
          <div className="bg-[hsl(220,14%,10%)] border border-[hsl(220,14%,20%)] rounded-xl shadow-2xl max-w-lg w-full mx-4 overflow-hidden" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-[hsl(220,14%,16%)]">
              <h3 className="text-sm font-semibold text-white/80">Setup Image</h3>
              <button onClick={closeImageModal} className="h-8 w-8 rounded-lg flex items-center justify-center text-white/40 hover:text-white/80 hover:bg-white/5 transition-all">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Camera Preview */}
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

            {/* Options */}
            {!cameraActive && (
              <div className="p-6 flex flex-col gap-3">
                <p className="text-xs text-white/40 text-center mb-2">Choose how to add a setup image</p>
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
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </div>
            )}
          </div>
        </div>
      )}
    </AppLayout>
  );
}
// deploy trigger

