import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/providers/trpc";
import { isDemoMode, demoApi } from "@/lib/demoApi";
import { compressImage } from "@/lib/imageCompress";
import { useTheme } from "@/hooks/useTheme";
import ManufacturingBackground from "@/components/ManufacturingBackground";
import {
  ArrowRight, Zap, AlertTriangle, Factory,
  Server, ServerOff, Database, Wifi, WifiOff,
  Camera, X, User, RefreshCw, Sun, Moon,
} from "lucide-react";

type BackendStatus = "checking" | "online" | "offline";

export default function Login() {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const [name, setName] = useState("");
  const [operatorId, setOperatorId] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [backendStatus, setBackendStatus] = useState<BackendStatus>("checking");

  // Profile photo capture
  const [profilePhoto, setProfilePhoto] = useState<string | null>(null);
  const [showCamera, setShowCamera] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Load saved profile photo from localStorage on mount
  useEffect(() => {
    const savedPhoto = localStorage.getItem("cnc_operator_photo");
    if (savedPhoto) setProfilePhoto(savedPhoto);
  }, []);

  // Start camera
  const startCamera = useCallback(async () => {
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
      const constraints: MediaStreamConstraints = {
        video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play();
          setCameraReady(true);
        };
      }
    } catch {
      setError("Camera access denied or no camera found.");
      setShowCamera(false);
    }
  }, []);

  // Stop camera
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCameraReady(false);
  }, []);

  // Toggle camera modal
  const toggleCamera = useCallback(() => {
    if (!showCamera) {
      setShowCamera(true);
      setTimeout(() => startCamera(), 100);
    } else {
      stopCamera();
      setShowCamera(false);
    }
  }, [showCamera, startCamera, stopCamera]);

  // Take photo with compression
  const takePhoto = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current || !cameraReady) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    // Add watermark
    ctx.font = "bold 14px sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.fillText(`ForgeTraceIQ | ${new Date().toLocaleString()}`, 12, canvas.height - 12);
    const rawDataUrl = canvas.toDataURL("image/jpeg", 0.85);
    // Compress to ~400px profile thumbnail (~30-60KB)
    try {
      const compressed = await compressImage(rawDataUrl, { maxWidth: 400, maxHeight: 400, quality: 0.75 });
      setProfilePhoto(compressed);
      localStorage.setItem("cnc_operator_photo", compressed);
    } catch {
      // Fallback to raw if compression fails
      setProfilePhoto(rawDataUrl);
      localStorage.setItem("cnc_operator_photo", rawDataUrl);
    }
    stopCamera();
    setShowCamera(false);
  }, [cameraReady, stopCamera]);

  // File upload with compression
  const handlePhotoUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const { compressFile } = await import("@/lib/imageCompress");
    try {
      const compressed = await compressFile(file, { maxWidth: 400, maxHeight: 400, quality: 0.75 });
      setProfilePhoto(compressed);
      localStorage.setItem("cnc_operator_photo", compressed);
    } catch {
      // Fallback: read original
      const reader = new FileReader();
      reader.onload = (ev) => {
        const dataUrl = ev.target?.result as string;
        setProfilePhoto(dataUrl);
        localStorage.setItem("cnc_operator_photo", dataUrl);
      };
      reader.readAsDataURL(file);
    }
  }, []);

  // Check backend health on load
  useEffect(() => {
    if (isDemoMode()) {
      navigate("/job-entry");
      return;
    }

    async function checkBackend() {
      try {
        // Try to reach the tRPC endpoint
        const res = await fetch("/api/trpc/ping?input=%7B%7D", {
          method: "GET",
          signal: AbortSignal.timeout(3000),
        });
        // Check if response is actually JSON (tRPC backend) not HTML (static deploy)
        const contentType = res.headers.get("content-type") || "";
        const text = await res.text();
        const isJson = contentType.includes("json") || text.startsWith("{");
        // Also check it's not the HTML page
        const isHtml = text.startsWith("<!doctype") || text.startsWith("<html");
        
        if ((res.ok || res.status === 400) && isJson && !isHtml) {
          setBackendStatus("online");
        } else {
          setBackendStatus("offline");
        }
      } catch {
        setBackendStatus("offline");
      }
    }

    checkBackend();
  }, [navigate]);

  const createOperator = trpc.operator.create.useMutation({
    onSuccess: (data) => {
      setLoading(false);
      const operatorWithPhoto = { ...data.operator, photo: profilePhoto };
      localStorage.setItem("cnc_operator", JSON.stringify(operatorWithPhoto));
      navigate("/job-entry");
    },
    onError: (err) => {
      setLoading(false);
      setError(err.message || "Failed to create operator. Backend may be offline.");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!name.trim()) { setError("Please enter your name."); return; }
    if (!operatorId.trim()) { setError("Please enter your operator ID."); return; }
    setLoading(true);
    createOperator.mutate({ name: name.trim(), operatorId: operatorId.trim() });
  };

  const handleDemoMode = () => {
    const demoOperator = {
      id: 999999,
      name: name.trim() || "Demo Operator",
      operatorId: operatorId.trim() || "DEMO-001",
      photo: profilePhoto,
      createdAt: new Date().toISOString(),
      demo: true,
    };
    localStorage.setItem("cnc_operator", JSON.stringify(demoOperator));
    localStorage.setItem("cnc_demo_mode", "true");
    demoApi.seedFoundryData();
    navigate("/job-entry");
  };

  return (
    <div className="min-h-screen w-full relative overflow-hidden flex items-center justify-center">
      {/* FULL SCREEN Manufacturing Animation Background */}
      <div className="absolute inset-0 z-0">
        <ManufacturingBackground />
      </div>
      
      {/* Dark overlay for readability */}
      <div className="absolute inset-0 z-[1] bg-black/40" />

      {/* Theme toggle - top right */}
      <button
        onClick={toggleTheme}
        className="absolute top-4 right-4 z-50 h-10 w-10 rounded-full flex items-center justify-center transition-all bg-white/10 text-white/60 hover:bg-white/20"
        title="Switch Theme"
      >
        {theme === "light" ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
      </button>

        {/* Content */}
        <div className="relative z-10 w-full max-w-[500px] px-6">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <img src="/forgeraceiq-logo.png" alt="ForgeTraceIQ" className="h-28 w-auto drop-shadow-[0_0_30px_rgba(249,115,22,0.4)]" draggable={false} />
          <h2 className="text-3xl font-black tracking-[0.2em] text-white uppercase mt-4">ForgeTraceIQ</h2>
          <p className="text-sm font-medium tracking-[0.3em] uppercase text-orange-400/80 mt-2">Manufacturing Intelligence</p>
        </div>

        {/* Backend Status Indicator */}
        <div className={`rounded-lg border px-3 py-2 mb-4 flex items-center gap-2 ${
          backendStatus === "checking"
            ? "border-blue-500/20 bg-blue-950/20"
            : backendStatus === "online"
              ? "border-emerald-500/20 bg-emerald-950/20"
              : "border-amber-500/20 bg-amber-950/20"
        }`}>
          {backendStatus === "checking" && <><div className="relative"><Wifi className="h-4 w-4 text-blue-400 animate-pulse" /><div className="absolute inset-0 rounded-full bg-blue-400/20 animate-ping" /></div><span className="text-xs text-blue-300 font-semibold">Checking backend connection...</span></>}
          {backendStatus === "online" && <><Server className="h-4 w-4 text-emerald-400" /><Database className="h-3 w-3 text-emerald-400 -ml-2" /><span className="text-xs text-emerald-300 font-semibold">Backend Online — Full mode active</span></>}
          {backendStatus === "offline" && <><ServerOff className="h-4 w-4 text-amber-400" /><WifiOff className="h-3 w-3 text-amber-400 -ml-2" /><span className="text-xs text-amber-300 font-semibold">Backend Offline — Demo Mode available</span></>}
        </div>

        {/* Login card */}
        <div className={`rounded-xl border backdrop-blur-md shadow-2xl overflow-hidden transition-colors duration-300 ${
          theme === "light"
            ? "border-[hsl(220,13%,85%)] bg-white/90 shadow-gray-200/60"
            : "border-[hsl(220,14%,20%)] bg-[hsl(220,14%,8%)]/80 shadow-black/60"
        }`}>
          <div className="px-6 pt-6 pb-2">
            <div className="flex items-center gap-2 mb-1">
              <Factory className="h-4 w-4 text-orange-400/70" />
              <h3 className={`text-sm font-bold tracking-wide ${
                theme === "light" ? "text-[hsl(220,14%,25%)]" : "text-white/80"
              }`}>Operator Authentication</h3>
            </div>
            <p className={`text-[11px] font-medium ${
              theme === "light" ? "text-[hsl(220,14%,50%)]" : "text-white/30"
            }`}>Enter credentials to access the shop floor command center</p>
          </div>

          <div className="px-6 py-5">
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* ── Profile Photo Capture ── */}
              <div className="flex flex-col items-center gap-3 mb-2">
                <div className="relative">
                  <div className={`w-24 h-24 rounded-full border-2 flex items-center justify-center overflow-hidden ${
                    theme === "light"
                      ? "border-[hsl(220,13%,85%)] bg-[hsl(220,14%,96%)]"
                      : "border-[hsl(220,14%,22%)] bg-[hsl(220,14%,14%)]"
                  }`}>
                    {profilePhoto ? (
                      <img src={profilePhoto} alt="Profile" className="w-full h-full object-cover" />
                    ) : (
                      <User className={`h-10 w-10 ${theme === "light" ? "text-[hsl(220,14%,70%)]" : "text-white/20"}`} />
                    )}
                  </div>
                  {profilePhoto && (
                    <button
                      type="button"
                      onClick={() => { setProfilePhoto(null); localStorage.removeItem("cnc_operator_photo"); }}
                      className="absolute -top-1 -right-1 h-6 w-6 rounded-full bg-rose-500 hover:bg-rose-400 flex items-center justify-center text-white transition-colors"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <input type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" id="photo-upload" />
                  <label htmlFor="photo-upload" className={`h-8 px-3 text-xs font-semibold border rounded-md flex items-center gap-1.5 transition-all cursor-pointer ${
                    theme === "light"
                      ? "border-[hsl(220,13%,85%)] text-[hsl(220,14%,45%)] hover:border-orange-500/50 hover:text-orange-500"
                      : "border-[hsl(220,14%,22%)] text-white/60 hover:border-orange-500/50 hover:text-orange-400"
                  }`}>
                    <RefreshCw className="h-3.5 w-3.5" /> Upload
                  </label>
                  <button type="button" onClick={toggleCamera} className="h-8 px-3 text-xs font-semibold bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 rounded-md flex items-center gap-1.5 text-blue-400 transition-all">
                    <Camera className="h-3.5 w-3.5" /> Take Photo
                  </button>
                </div>
              </div>

              <div className={`border-t pt-4 ${theme === "light" ? "border-[hsl(220,13%,88%)]" : "border-[hsl(220,14%,18%)]"}`} />
              <div className="space-y-2">
                <Label htmlFor="name" className={`text-sm font-bold uppercase tracking-wider ${
                  theme === "light" ? "text-[hsl(220,14%,35%)]" : "text-white/70"
                }`}>Operator Name</Label>
                <Input id="name" placeholder="Enter your full name" value={name} onChange={(e) => setName(e.target.value)} className={`h-14 px-5 rounded-lg text-base ${
                  theme === "light"
                    ? "bg-[hsl(220,14%,97%)] border-[hsl(220,13%,85%)] text-[hsl(220,14%,15%)] placeholder:text-[hsl(220,14%,50%)] focus:border-orange-500/60"
                    : "bg-white/10 border-white/20 text-white placeholder:text-white/40 focus:border-orange-500/60"
                }`} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="operatorId" className={`text-sm font-bold uppercase tracking-wider ${
                  theme === "light" ? "text-[hsl(220,14%,35%)]" : "text-white/70"
                }`}>Operator ID</Label>
                <Input id="operatorId" placeholder="e.g. 20047" value={operatorId} onChange={(e) => setOperatorId(e.target.value)} className={`h-14 px-5 rounded-lg text-base ${
                  theme === "light"
                    ? "bg-[hsl(220,14%,97%)] border-[hsl(220,13%,85%)] text-[hsl(220,14%,15%)] placeholder:text-[hsl(220,14%,50%)] focus:border-orange-500/60"
                    : "bg-white/10 border-white/20 text-white placeholder:text-white/40 focus:border-orange-500/60"
                }`} />
              </div>

              {error && (
                <div className="rounded-lg bg-rose-950/40 border border-rose-500/20 px-3 py-2.5 text-xs text-rose-300">{error}</div>
              )}

              {/* Show Demo Mode ONLY when backend is offline */}
              {backendStatus === "offline" && (
                <div className="rounded-lg border border-amber-500/20 bg-amber-950/30 px-3 py-3">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs font-semibold text-amber-300 mb-1">Backend Not Connected</p>
                      <p className="text-[11px] text-amber-400/70 mb-2.5">The API server is not running. To use the real backend, deploy as a fullstack app from the portal.</p>
                      <p className="text-[10px] text-amber-400/50 mb-2">For now, use Demo Mode with pre-loaded data.</p>
                      <Button type="button" variant="outline" size="sm" onClick={handleDemoMode} className="h-7 text-[11px] border-amber-500/30 text-amber-300 hover:bg-amber-950/40 hover:text-amber-200">
                        Start Demo Mode
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* Show info when backend IS online */}
              {backendStatus === "online" && (
                <div className="rounded-lg border border-emerald-500/20 bg-emerald-950/30 px-3 py-2.5 flex items-center gap-2">
                  <Zap className="h-4 w-4 text-emerald-400 flex-shrink-0" />
                  <span className="text-xs text-emerald-300">Backend connected — operators will be saved to the database.</span>
                </div>
              )}

              <Button type="submit" disabled={loading} className="w-full h-14 rounded-lg bg-gradient-to-r from-orange-600 to-orange-500 hover:from-orange-500 hover:to-orange-400 text-white text-lg font-bold shadow-lg shadow-orange-900/30 transition-all active:scale-[0.98]">
                {loading ? (
                  <span className="flex items-center gap-2"><span className="inline-block h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />Authenticating...</span>
                ) : (
                  <span className="flex items-center justify-center gap-2"><ArrowRight className="h-5 w-5" />Start Work Session</span>
                )}
              </Button>
            </form>
          </div>

          <div className={`px-6 py-3 border-t ${
            theme === "light" ? "border-[hsl(220,13%,90%)] bg-[hsl(220,14%,97%)]/50" : "border-[hsl(220,14%,18%)] bg-[hsl(220,14%,10%)]/50"
          }`}>
            <p className={`text-[10px] text-center tracking-wider uppercase ${
              theme === "light" ? "text-[hsl(220,14%,55%)]" : "text-white/20"
            }`}>ForgeTraceIQ v1.0 — {backendStatus === "online" ? "Fullstack Mode" : "Static Preview"}</p>
          </div>
        </div>
      </div>
      {/* Fullscreen Camera Modal */}
      {showCamera && (
        <div className="fixed inset-0 z-[100] bg-black flex flex-col">
          <canvas ref={canvasRef} className="hidden" />
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-black/80 flex-shrink-0 z-10">
            <button onClick={toggleCamera} className="h-10 w-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/70 transition-colors">
              <X className="h-5 w-5" />
            </button>
            <span className="text-sm font-semibold text-white/60">Take Profile Photo</span>
            <div className="w-10" />
          </div>
          {/* Viewfinder */}
          <div className="flex-1 relative bg-black flex items-center justify-center overflow-hidden">
            <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
            {/* Face guide overlay */}
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              <div className="w-56 h-56 border-2 border-white/20 rounded-full relative">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-6 h-6 border-t-2 border-l-2 border-r-2 border-white/50 rounded-t-full" />
              </div>
            </div>
            {!cameraReady && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                <span className="text-sm text-white/50">Starting camera...</span>
              </div>
            )}
          </div>
          {/* Bottom controls */}
          <div className="bg-black/90 px-4 py-5 flex-shrink-0 flex items-center justify-center">
            <button
              onClick={takePhoto}
              disabled={!cameraReady}
              className="h-20 w-20 rounded-full border-4 border-white/40 flex items-center justify-center transition-all active:scale-95 disabled:opacity-40"
            >
              <div className="h-16 w-16 rounded-full bg-white hover:bg-orange-400 transition-colors" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
