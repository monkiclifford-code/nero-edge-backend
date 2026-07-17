import { useState, useCallback, useEffect } from "react";
import { X, ZoomIn, ZoomOut, RotateCcw, ChevronLeft, ChevronRight, Brain } from "lucide-react";

interface FullscreenImageViewerProps {
  images: Array<{
    id: number;
    imageUrl: string;
    thumbnailUrl?: string | null;
    predictedType?: string | null;
    aiConfidence?: string | null;
  }>;
  initialIndex: number;
  onClose: () => void;
}

export default function FullscreenImageViewer({ images, initialIndex, onClose }: FullscreenImageViewerProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const currentImage = images[currentIndex];

  const handleZoomIn = useCallback(() => setZoom((z) => Math.min(z + 0.5, 5)), []);
  const handleZoomOut = useCallback(() => {
    setZoom((z) => Math.max(z - 0.5, 1));
    if (zoom <= 1.5) setPan({ x: 0, y: 0 });
  }, [zoom]);
  const handleReset = useCallback(() => { setZoom(1); setPan({ x: 0, y: 0 }); }, []);

  const handlePrev = useCallback(() => {
    setCurrentIndex((i) => (i > 0 ? i - 1 : images.length - 1));
    handleReset();
  }, [images.length, handleReset]);

  const handleNext = useCallback(() => {
    setCurrentIndex((i) => (i < images.length - 1 ? i + 1 : 0));
    handleReset();
  }, [images.length, handleReset]);

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") handlePrev();
      if (e.key === "ArrowRight") handleNext();
      if (e.key === "+" || e.key === "=") handleZoomIn();
      if (e.key === "-") handleZoomOut();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose, handlePrev, handleNext, handleZoomIn, handleZoomOut]);

  // Touch swipe support
  const [touchStartX, setTouchStartX] = useState(0);
  const handleTouchStart = (e: React.TouchEvent) => setTouchStartX(e.touches[0].clientX);
  const handleTouchEnd = (e: React.TouchEvent) => {
    const diff = touchStartX - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 50) diff > 0 ? handleNext() : handlePrev();
  };

  // Pan when zoomed
  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoom > 1) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  };
  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging && zoom > 1) {
      setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
    }
  };
  const handleMouseUp = () => setIsDragging(false);

  if (!currentImage) return null;

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/95 flex flex-col"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-3 bg-black/60 border-b border-white/10 flex-shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-sm text-white/70 font-semibold">
            {currentIndex + 1} / {images.length}
          </span>
          {currentImage.predictedType && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-500/15 border border-blue-500/20 px-2.5 py-1 text-xs font-semibold text-blue-400">
              <Brain className="h-3 w-3" />
              AI: {currentImage.predictedType}
              {currentImage.aiConfidence && ` (${currentImage.aiConfidence}%)`}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleZoomOut} className="h-9 w-9 rounded-md bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors text-white/70">
            <ZoomOut className="h-4 w-4" />
          </button>
          <span className="text-xs text-white/50 w-12 text-center">{Math.round(zoom * 100)}%</span>
          <button onClick={handleZoomIn} className="h-9 w-9 rounded-md bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors text-white/70">
            <ZoomIn className="h-4 w-4" />
          </button>
          <button onClick={handleReset} className="h-9 w-9 rounded-md bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors text-white/70">
            <RotateCcw className="h-4 w-4" />
          </button>
          <div className="w-px h-6 bg-white/10 mx-1" />
          <button onClick={onClose} className="h-9 w-9 rounded-md bg-white/10 hover:bg-rose-500/30 flex items-center justify-center transition-colors text-white/70">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Image Area */}
      <div className="flex-1 flex items-center justify-center relative overflow-hidden">
        {/* Prev/Next arrows */}
        {images.length > 1 && (
          <>
            <button
              onClick={handlePrev}
              className="absolute left-4 z-10 h-12 w-12 rounded-full bg-black/50 hover:bg-black/70 flex items-center justify-center text-white/70 transition-colors"
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
            <button
              onClick={handleNext}
              className="absolute right-4 z-10 h-12 w-12 rounded-full bg-black/50 hover:bg-black/70 flex items-center justify-center text-white/70 transition-colors"
            >
              <ChevronRight className="h-6 w-6" />
            </button>
          </>
        )}

        {/* Image */}
        <img
          src={currentImage.imageUrl}
          alt={`Defect ${currentIndex + 1}`}
          className="max-w-full max-h-full object-contain transition-transform cursor-grab active:cursor-grabbing select-none"
          style={{
            transform: `scale(${zoom}) translate(${pan.x / zoom}px, ${pan.y / zoom}px)`,
            transition: isDragging ? "none" : "transform 0.15s ease-out",
          }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          draggable={false}
        />
      </div>

      {/* Thumbnail strip */}
      {images.length > 1 && (
        <div className="flex gap-2 px-4 py-3 bg-black/60 border-t border-white/10 overflow-x-auto flex-shrink-0">
          {images.map((img, i) => (
            <button
              key={img.id}
              onClick={() => { setCurrentIndex(i); handleReset(); }}
              className={`flex-shrink-0 rounded-md overflow-hidden border-2 transition-all ${
                i === currentIndex ? "border-blue-500" : "border-transparent hover:border-white/30"
              }`}
            >
              <img
                src={img.thumbnailUrl ?? img.imageUrl}
                alt={`Thumbnail ${i + 1}`}
                className="h-14 w-20 object-cover"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
