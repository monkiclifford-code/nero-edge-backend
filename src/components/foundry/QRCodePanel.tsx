import { useState, useEffect, useRef } from "react";
import {
  Smartphone, Tablet, X, RefreshCw, CheckCircle2,
  Clock, Copy, AlertTriangle,
} from "lucide-react";
import {
  createTransferSession, getSession, getNewImages,
  type TransferImage,
} from "@/lib/imageTransfer";

interface QRCodePanelProps {
  onImagesReceived: (images: string[]) => void;
  onClose: () => void;
}

export default function QRCodePanel({ onImagesReceived, onClose }: QRCodePanelProps) {
  const [session, setSession] = useState(() => createTransferSession());
  const [receivedCount, setReceivedCount] = useState(0);
  const [copied, setCopied] = useState(false);
  const [timeLeft, setTimeLeft] = useState(30 * 60);
  const pollRef = useRef<ReturnType<typeof setInterval>>();

  const portalUrl = (() => {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    return `${origin}/upload/${session.sessionId}`;
  })();

  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(portalUrl)}`;

  // Poll for new images
  useEffect(() => {
    pollRef.current = setInterval(() => {
      const s = getSession(session.sessionId);
      if (!s) { setTimeLeft(0); return; }
      const newImages = getNewImages(session.sessionId, receivedCount);
      if (newImages.length > 0) {
        onImagesReceived(newImages.map((img) => img.dataUrl));
        setReceivedCount(s.images.length);
      }
      const remaining = Math.max(0, Math.floor((new Date(s.expiresAt).getTime() - Date.now()) / 1000));
      setTimeLeft(remaining);
    }, 1500);
    return () => clearInterval(pollRef.current);
  }, [session.sessionId, receivedCount, onImagesReceived]);

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;

  const handleCopy = () => {
    navigator.clipboard.writeText(portalUrl).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRefresh = () => {
    const newSession = createTransferSession();
    setSession(newSession);
    setReceivedCount(0);
    setTimeLeft(30 * 60);
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-md forge-card shadow-2xl">
        {/* Header */}
        <div className="forge-card-header flex items-center justify-between">
          <h2 className="forge-card-title flex items-center gap-2">
            <Smartphone className="h-4 w-4 text-blue-400" />
            Phone Image Transfer
          </h2>
          <button onClick={onClose} className="h-8 w-8 rounded-md hover:bg-white/10 flex items-center justify-center text-white/50 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="forge-card-body space-y-5">
          {/* Timer */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs text-white/40">
              <Clock className="h-3.5 w-3.5" />
              <span>Session expires in {minutes}:{seconds.toString().padStart(2, "0")}</span>
            </div>
            <button onClick={handleRefresh} className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1">
              <RefreshCw className="h-3 w-3" /> New Session
            </button>
          </div>

          {/* Instructions */}
          <div className="rounded-lg bg-blue-950/30 border border-blue-500/20 p-3 space-y-2">
            <p className="text-sm font-semibold text-blue-300 flex items-center gap-2">
              <Tablet className="h-4 w-4" /> How to transfer images:
            </p>
            <ol className="text-xs text-white/50 space-y-1.5 list-decimal list-inside">
              <li>Open your <strong className="text-white/70">phone camera</strong> or QR scanner</li>
              <li><strong className="text-white/70">Scan the QR code</strong> below</li>
              <li>Select images from your <strong className="text-white/70">phone gallery</strong></li>
              <li>Images appear here <strong className="text-white/70">automatically</strong></li>
            </ol>
          </div>

          {/* QR Code via API */}
          <div className="flex flex-col items-center gap-3">
            <div className="bg-white rounded-xl p-4 shadow-lg">
              <img src={qrCodeUrl} alt="QR Code" className="w-[200px] h-[200px]" />
            </div>
            <button onClick={handleCopy}
              className="text-xs flex items-center gap-1.5 text-white/40 hover:text-white/70 transition-colors">
              {copied ? <CheckCircle2 className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
              {copied ? "Copied!" : "Copy link to share"}
            </button>
          </div>

          {/* Received images */}
          {receivedCount > 0 && (
            <div className="rounded-lg bg-emerald-950/30 border border-emerald-500/20 p-3 flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-emerald-400 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-emerald-300">
                  {receivedCount} image{receivedCount > 1 ? "s" : ""} received from phone
                </p>
                <p className="text-xs text-emerald-400/60">Images have been added to this NCR</p>
              </div>
            </div>
          )}

          {/* URL display */}
          <div className="rounded-md bg-[hsl(220,14%,12%)] border border-[hsl(220,14%,18%)] px-3 py-2">
            <p className="text-[10px] text-white/20 uppercase tracking-wider font-semibold mb-1">Session URL</p>
            <p className="text-xs text-white/30 break-all font-mono">{portalUrl}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
