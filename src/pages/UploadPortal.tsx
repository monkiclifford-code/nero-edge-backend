import { useState, useRef, useCallback } from "react";
import { useParams } from "react-router";
import {
  addImageToSession, getSession,
  type TransferImage,
} from "@/lib/imageTransfer";
import {
  Upload, ImagePlus, X, CheckCircle2, AlertTriangle,
  Camera, Send, Trash2,
} from "lucide-react";

export default function UploadPortal() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedImages, setSelectedImages] = useState<Array<{ id: string; dataUrl: string; file: File }>>([]);
  const [uploading, setUploading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [dragOver, setDragOver] = useState(false);

  // Validate session
  const session = sessionId ? getSession(sessionId) : null;

  const handleFiles = useCallback((files: FileList | null) => {
    if (!files) return;
    setError("");

    Array.from(files).forEach((file) => {
      if (!file.type.startsWith("image/")) return;

      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        if (dataUrl) {
          setSelectedImages((prev) => [
            ...prev,
            { id: `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`, dataUrl, file },
          ]);
        }
      };
      reader.readAsDataURL(file);
    });
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFiles(e.target.files);
    e.target.value = "";
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    handleFiles(e.dataTransfer.files);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => setDragOver(false);

  const removeImage = (id: string) => {
    setSelectedImages((prev) => prev.filter((img) => img.id !== id));
  };

  const handleSend = () => {
    if (!sessionId || selectedImages.length === 0) return;

    setUploading(true);
    setError("");

    let successCount = 0;
    selectedImages.forEach((img) => {
      const transferImage: TransferImage = {
        id: img.id,
        dataUrl: img.dataUrl,
        name: img.file.name,
        size: img.file.size,
        timestamp: new Date().toISOString(),
      };
      if (addImageToSession(sessionId, transferImage)) {
        successCount++;
      }
    });

    setUploading(false);
    if (successCount === selectedImages.length) {
      setDone(true);
    } else {
      setError("Some images could not be transferred. Please try again.");
    }
  };

  // Expired or invalid session
  if (!session) {
    return (
      <div className="min-h-screen bg-[#06080e] flex items-center justify-center p-6">
        <div className="w-full max-w-sm forge-card text-center py-10">
          <AlertTriangle className="h-12 w-12 text-amber-400 mx-auto mb-3" />
          <h2 className="text-lg font-bold text-white/80 mb-2">Session Expired</h2>
          <p className="text-sm text-white/40 mb-4">
            This upload link has expired or is invalid.
          </p>
          <p className="text-xs text-white/30">
            Please go back to the tablet and generate a new QR code.
          </p>
        </div>
      </div>
    );
  }

  // Success state
  if (done) {
    return (
      <div className="min-h-screen bg-[#06080e] flex items-center justify-center p-6">
        <div className="w-full max-w-sm forge-card text-center py-10">
          <div className="w-16 h-16 rounded-full bg-emerald-500/15 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="h-8 w-8 text-emerald-400" />
          </div>
          <h2 className="text-lg font-bold text-white/90 mb-2">Images Sent!</h2>
          <p className="text-sm text-white/50 mb-1">
            {selectedImages.length} image{selectedImages.length > 1 ? "s" : ""} successfully transferred.
          </p>
          <p className="text-xs text-white/30">
            Check the tablet — images will appear automatically.
          </p>
          <button
            onClick={() => {
              setDone(false);
              setSelectedImages([]);
            }}
            className="mt-6 h-11 px-5 rounded-md text-sm font-semibold border border-[hsl(220,14%,20%)] hover:bg-white/5 text-white/60 transition-all"
          >
            Send More Images
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#06080e] flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-[hsl(220,14%,16%)] bg-[hsl(220,14%,9%)]">
        <img src="/forgeraceiq-logo.png" alt="" className="h-7 w-auto" />
        <span className="text-sm font-bold tracking-wider text-white/80">ForgeTraceIQ</span>
      </div>

      <div className="flex-1 flex items-start justify-center p-4 pt-6">
        <div className="w-full max-w-md space-y-4">
          {/* Title */}
          <div className="text-center mb-2">
            <div className="w-12 h-12 rounded-full bg-blue-500/15 flex items-center justify-center mx-auto mb-3">
              <Upload className="h-6 w-6 text-blue-400" />
            </div>
            <h1 className="text-lg font-bold text-white/90">Upload Images</h1>
            <p className="text-xs text-white/40 mt-1">Select images from your phone to send to the workstation</p>
          </div>

          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            capture="environment"
            onChange={handleFileSelect}
            className="hidden"
          />

          {/* Drop zone / Tap area */}
          <div
            onClick={() => fileInputRef.current?.click()}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            className={`rounded-xl border-2 border-dashed transition-all p-6 text-center cursor-pointer active:scale-[0.98] ${
              dragOver
                ? "border-blue-500/50 bg-blue-500/5"
                : "border-[hsl(220,14%,20%)] hover:border-[hsl(220,14%,30%)] bg-[hsl(220,14%,10%)]"
            }`}
          >
            <div className="flex flex-col items-center gap-2">
              <div className="h-14 w-14 rounded-full bg-white/5 flex items-center justify-center">
                {dragOver ? <ImagePlus className="h-7 w-7 text-blue-400" /> : <Camera className="h-7 w-7 text-white/40" />}
              </div>
              <p className="text-sm font-semibold text-white/60">
                Tap to take photo or select images
              </p>
              <p className="text-xs text-white/30">
                Supports: Camera, Gallery, Drag & Drop
              </p>
            </div>
          </div>

          {/* Selected images preview */}
          {selectedImages.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wider text-white/40">
                  {selectedImages.length} image{selectedImages.length > 1 ? "s" : ""} selected
                </p>
                <button
                  onClick={() => setSelectedImages([])}
                  className="text-xs text-rose-400 hover:text-rose-300 flex items-center gap-1"
                >
                  <Trash2 className="h-3 w-3" /> Clear all
                </button>
              </div>

              <div className="grid grid-cols-3 gap-2">
                {selectedImages.map((img) => (
                  <div key={img.id} className="relative aspect-square rounded-lg overflow-hidden border border-[hsl(220,14%,16%)]">
                    <img src={img.dataUrl} alt="" className="w-full h-full object-cover" />
                    <button
                      onClick={(e) => { e.stopPropagation(); removeImage(img.id); }}
                      className="absolute top-1 right-1 h-6 w-6 rounded-full bg-black/60 hover:bg-rose-500/80 flex items-center justify-center text-white/70 transition-colors"
                    >
                      <X className="h-3 w-3" />
                    </button>
                    <p className="absolute bottom-0 left-0 right-0 text-[9px] text-white/50 bg-black/50 px-1.5 py-0.5 truncate">
                      {(img.file.size / 1024).toFixed(0)} KB
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="rounded-lg bg-rose-950/40 border border-rose-500/20 p-3 text-rose-300 text-sm flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
              {error}
            </div>
          )}

          {/* Send button */}
          {selectedImages.length > 0 && (
            <button
              onClick={handleSend}
              disabled={uploading}
              className="w-full h-14 text-base font-bold bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white rounded-lg transition-all flex items-center justify-center gap-2 disabled:opacity-60 shadow-lg shadow-blue-900/30 active:scale-[0.98]"
            >
              {uploading ? (
                <>
                  <span className="inline-block h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="h-5 w-5" />
                  Send {selectedImages.length} Image{selectedImages.length > 1 ? "s" : ""} to Workstation
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-[hsl(220,14%,16%)] bg-[hsl(220,14%,9%)] text-center">
        <p className="text-[10px] text-white/20">ForgeTraceIQ — Secure local transfer. Images stay within your network.</p>
      </div>
    </div>
  );
}
