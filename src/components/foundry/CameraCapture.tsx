import { useState, useRef, useCallback, useEffect } from "react";
import {
  Camera, X, Zap, ZapOff, RefreshCw, Circle,
  ChevronLeft, ImagePlus, Timer, CheckCircle2,
} from "lucide-react";

interface CameraCaptureProps {
  onCapture: (imageDataUrl: string) => void;
  onClose: () => void;
}

export default function CameraCapture({ onCapture, onClose }: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [isReady, setIsReady] = useState(false);
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const [flashOn, setFlashOn] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [capturedImages, setCapturedImages] = useState<string[]>([]);
  const [showGallery, setShowGallery] = useState(false);
  const [error, setError] = useState("");

  // Start camera
  const startCamera = useCallback(async () => {
    setError("");
    try {
      // Stop existing stream
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }

      const constraints: MediaStreamConstraints = {
        video: {
          facingMode,
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play();
          setIsReady(true);
        };
      }
    } catch (err: any) {
      setError(err.name === "NotAllowedError"
        ? "Camera permission denied. Please allow camera access."
        : "Could not start camera. Ensure a camera is connected."
      );
    }
  }, [facingMode]);

  useEffect(() => {
    startCamera();
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, [startCamera]);

  // Toggle flash (torch) if supported
  const toggleFlash = useCallback(async () => {
    try {
      const track = streamRef.current?.getVideoTracks()[0];
      if (!track) return;
      const capabilities = track.getCapabilities() as any;
      if (capabilities?.torch) {
        await track.applyConstraints({
          advanced: [{ torch: !flashOn }] as any,
        });
        setFlashOn((f) => !f);
      }
    } catch {
      // Torch not supported on this device
    }
  }, [flashOn]);

  // Switch camera
  const switchCamera = useCallback(() => {
    setFacingMode((f) => (f === "environment" ? "user" : "environment"));
  }, []);

  // Take photo
  const takePhoto = useCallback(() => {
    if (!videoRef.current || !canvasRef.current || !isReady) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Mirror if front camera
    if (facingMode === "user") {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }

    ctx.drawImage(video, 0, 0);

    // Add watermark
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.font = "bold 16px sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.fillText(`ForgeTraceIQ | ${new Date().toLocaleString()}`, 16, canvas.height - 16);

    const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
    setCapturedImages((prev) => [...prev, dataUrl]);
    onCapture(dataUrl);
  }, [isReady, facingMode, onCapture]);

  // Countdown capture
  const countdownCapture = useCallback(() => {
    setCountdown(3);
    const interval = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(interval);
          setTimeout(() => {
            takePhoto();
            setCountdown(0);
          }, 200);
          return 0;
        }
        return c - 1;
      });
    }, 1000);
  }, [takePhoto]);

  return (
    <div className="fixed inset-0 z-[100] bg-black flex flex-col">
      {/* Hidden canvas for capture */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-black/80 flex-shrink-0 z-10">
        <button onClick={onClose} className="h-10 w-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/70 transition-colors">
          <X className="h-5 w-5" />
        </button>
        <span className="text-sm font-semibold text-white/60">ForgeTraceIQ Camera</span>
        <div className="flex items-center gap-2">
          <button
            onClick={toggleFlash}
            className={`h-10 w-10 rounded-full flex items-center justify-center transition-colors ${
              flashOn ? "bg-amber-500/30 text-amber-400" : "bg-white/10 text-white/50 hover:bg-white/20"
            }`}
          >
            {flashOn ? <Zap className="h-5 w-5" /> : <ZapOff className="h-5 w-5" />}
          </button>
          <button
            onClick={switchCamera}
            className="h-10 w-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/50 transition-colors"
          >
            <RefreshCw className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-rose-950/80 px-4 py-3 text-center">
          <p className="text-sm text-rose-300">{error}</p>
          <button onClick={startCamera} className="mt-2 text-xs text-rose-400 underline">Retry</button>
        </div>
      )}

      {/* Viewfinder */}
      <div className="flex-1 relative bg-black flex items-center justify-center overflow-hidden">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover"
        />

        {/* Focus brackets overlay */}
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
          <div className="w-48 h-48 border-2 border-white/20 rounded-lg relative">
            <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-white/50" />
            <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-white/50" />
            <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-white/50" />
            <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-white/50" />
          </div>
        </div>

        {/* Countdown overlay */}
        {countdown > 0 && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/30 z-20">
            <div className="w-24 h-24 rounded-full bg-white/10 backdrop-blur flex items-center justify-center border-2 border-white/30">
              <span className="text-5xl font-black text-white">{countdown}</span>
            </div>
          </div>
        )}

        {/* Captured count badge */}
        {capturedImages.length > 0 && (
          <div className="absolute top-4 right-4 bg-black/60 rounded-full px-3 py-1.5 flex items-center gap-1.5">
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            <span className="text-sm font-bold text-white">{capturedImages.length}</span>
          </div>
        )}
      </div>

      {/* Bottom controls - Tablet optimized */}
      <div className="bg-black/90 px-4 py-4 flex-shrink-0">
        <div className="flex items-center justify-center gap-8">
          {/* Gallery toggle */}
          <button
            onClick={() => setShowGallery((s) => !s)}
            className="h-14 w-14 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/60 transition-colors relative"
          >
            <ImagePlus className="h-6 w-6" />
            {capturedImages.length > 0 && (
              <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-orange-500 text-[10px] font-bold text-white flex items-center justify-center">
                {capturedImages.length}
              </span>
            )}
          </button>

          {/* Shutter button - LARGE for tablet */}
          <button
            onClick={countdownCapture}
            disabled={!isReady || countdown > 0}
            className="h-20 w-20 rounded-full border-4 border-white/40 flex items-center justify-center transition-all active:scale-95 disabled:opacity-50"
          >
            <div className="h-16 w-16 rounded-full bg-white hover:bg-orange-400 transition-colors" />
          </button>

          {/* Timer */}
          <button
            onClick={countdownCapture}
            className="h-14 w-14 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/60 transition-colors"
          >
            <Timer className="h-6 w-6" />
          </button>
        </div>

        {/* Gallery strip */}
        {showGallery && capturedImages.length > 0 && (
          <div className="mt-3 flex gap-2 overflow-x-auto pb-2">
            {capturedImages.map((img, i) => (
              <div key={i} className="flex-shrink-0 relative">
                <img
                  src={img}
                  alt={`Capture ${i + 1}`}
                  className="h-16 w-16 rounded-lg object-cover border border-white/20"
                />
                <span className="absolute bottom-0.5 right-0.5 text-[9px] bg-black/60 text-white px-1 rounded">
                  {i + 1}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
