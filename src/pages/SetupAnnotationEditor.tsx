import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate, useParams } from "react-router";
import AppLayout from "@/components/layout/AppLayout";
import {
  MousePointer, Pencil, Circle, Square, ArrowRight, Type,
  Hash, Undo2, Redo2, Save, ZoomIn, ZoomOut, Move,
  MessageSquare, Eraser, X, Plus, Minus, Camera, Upload,
  RotateCcw, Download, ChevronDown, Check
} from "lucide-react";

// ─── Types ───
type ToolType = "select" | "draw" | "arrow" | "circle" | "rect" | "line" | "text" | "marker" | "callout" | "eraser";
type ColorKey = "red" | "yellow" | "green" | "blue" | "white" | "black";

interface Point { x: number; y: number; }

interface Annotation {
  id: string;
  type: ToolType;
  color: string;
  points: Point[];
  text?: string;
  number?: number;
  strokeWidth?: number;
  // For callouts: targetPoint is where arrow points, calloutPos is box position
  targetPoint?: Point;
  calloutPos?: Point;
}

interface SavedSetup {
  imageDataUrl: string;
  annotations: Annotation[];
  version: number;
  savedAt: string;
}

const COLORS: Record<ColorKey, string> = {
  red: "#ef4444",
  yellow: "#eab308",
  green: "#22c55e",
  blue: "#3b82f6",
  white: "#ffffff",
  black: "#111111",
};

const STROKE_WIDTHS = [2, 4, 6, 8];

// ─── Helpers ───
let _idCounter = 0;
const uid = () => `a_${++_idCounter}_${Date.now().toString(36)}`;

const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

const midPoint = (a: Point, b: Point): Point => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

// Arrow head polygon
function arrowHeadPoly(tip: Point, tail: Point, size: number): Point[] {
  const angle = Math.atan2(tip.y - tail.y, tip.x - tail.x);
  const perp = angle + Math.PI / 2;
  const base = {
    x: tip.x - size * 2 * Math.cos(angle),
    y: tip.y - size * 2 * Math.sin(angle),
  };
  return [
    tip,
    { x: base.x + size * Math.cos(perp), y: base.y + size * Math.sin(perp) },
    { x: base.x - size * Math.cos(perp), y: base.y - size * Math.sin(perp) },
  ];
}

// ─── Component ───
export default function SetupAnnotationEditor() {
  const navigate = useNavigate();
  const { jobId } = useParams<{ jobId: string }>();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Core state
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [history, setHistory] = useState<Annotation[][]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  // Tool state
  const [activeTool, setActiveTool] = useState<ToolType>("draw");
  const [activeColor, setActiveColor] = useState<ColorKey>("red");
  const [strokeWidth, setStrokeWidth] = useState(3);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentPoints, setCurrentPoints] = useState<Point[]>([]);

  // Callout text input
  const [calloutInput, setCalloutInput] = useState<{ x: number; y: number; visible: boolean } | null>(null);
  const [calloutText, setCalloutText] = useState("");

  // Text input
  const [textInput, setTextInput] = useState<{ x: number; y: number; visible: boolean } | null>(null);
  const [textValue, setTextValue] = useState("");

  // Zoom/pan
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState<Point>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef<Point>({ x: 0, y: 0 });

  // Marker counter
  const [markerCount, setMarkerCount] = useState(1);

  // Saved state
  const [saved, setSaved] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showWidthPicker, setShowWidthPicker] = useState(false);

  // Load saved setup on mount
  useEffect(() => {
    if (!jobId) return;
    try {
      const saved = localStorage.getItem(`cnc_setup_annotations_${jobId}`);
      if (saved) {
        const data: SavedSetup = JSON.parse(saved);
        if (data.imageDataUrl) {
          const img = new Image();
          img.onload = () => setImage(img);
          img.src = data.imageDataUrl;
        }
        if (data.annotations) {
          setAnnotations(data.annotations);
          pushHistory(data.annotations);
        }
      }
    } catch { /* ignore */ }
  }, [jobId]);

  // Canvas drawing
  useEffect(() => {
    if (!image || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Size canvas to container
    const container = containerRef.current;
    if (container) {
      canvas.width = container.clientWidth;
      canvas.height = container.clientHeight;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();

    // Apply zoom & pan
    ctx.translate(pan.x, pan.y);
    ctx.scale(zoom, zoom);

    // Draw image centered
    const imgX = (canvas.width / zoom - image.width) / 2;
    const imgY = (canvas.height / zoom - image.height) / 2;
    ctx.drawImage(image, imgX, imgY);

    // Draw annotations
    annotations.forEach((ann) => drawAnnotation(ctx, ann, imgX, imgY));

    // Draw current in-progress annotation
    if (isDrawing && currentPoints.length > 0) {
      const tempAnn: Annotation = {
        id: "temp",
        type: activeTool,
        color: COLORS[activeColor],
        points: currentPoints,
        strokeWidth,
        text: activeTool === "callout" ? calloutText : undefined,
      };
      drawAnnotation(ctx, tempAnn, imgX, imgY);
    }

    ctx.restore();
  }, [image, annotations, isDrawing, currentPoints, zoom, pan, activeColor, activeTool, strokeWidth, calloutText]);

  // ─── Drawing function ───
  const drawAnnotation = (ctx: CanvasRenderingContext2D, ann: Annotation, imgX: number, imgY: number) => {
    ctx.strokeStyle = ann.color;
    ctx.fillStyle = ann.color;
    ctx.lineWidth = ann.strokeWidth || 3;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    const pts = ann.points.map((p) => ({ x: p.x + imgX, y: p.y + imgY }));

    switch (ann.type) {
      case "draw":
        if (pts.length < 2) return;
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) {
          const mid = midPoint(pts[i - 1], pts[i]);
          ctx.quadraticCurveTo(pts[i - 1].x, pts[i - 1].y, mid.x, mid.y);
        }
        ctx.stroke();
        break;

      case "line":
        if (pts.length < 2) return;
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
        ctx.stroke();
        break;

      case "arrow":
        if (pts.length < 2) return;
        const aStart = pts[0];
        const aEnd = pts[pts.length - 1];
        ctx.beginPath();
        ctx.moveTo(aStart.x, aStart.y);
        ctx.lineTo(aEnd.x, aEnd.y);
        ctx.stroke();
        // Arrow head
        const headSize = Math.max(8, (ann.strokeWidth || 3) * 3);
        const head = arrowHeadPoly(aEnd, aStart, headSize);
        ctx.beginPath();
        ctx.moveTo(head[0].x, head[0].y);
        ctx.lineTo(head[1].x, head[1].y);
        ctx.lineTo(head[2].x, head[2].y);
        ctx.closePath();
        ctx.fill();
        break;

      case "circle":
        if (pts.length < 2) return;
        const radius = dist(pts[0], pts[pts.length - 1]);
        ctx.beginPath();
        ctx.arc(pts[0].x, pts[0].y, radius, 0, Math.PI * 2);
        ctx.stroke();
        break;

      case "rect":
        if (pts.length < 2) return;
        ctx.strokeRect(
          Math.min(pts[0].x, pts[pts.length - 1].x),
          Math.min(pts[0].y, pts[pts.length - 1].y),
          Math.abs(pts[pts.length - 1].x - pts[0].x),
          Math.abs(pts[pts.length - 1].y - pts[0].y)
        );
        break;

      case "text":
        if (pts.length < 1 || !ann.text) return;
        ctx.font = `bold ${14 / zoom}px system-ui, sans-serif`;
        ctx.fillStyle = ann.color;
        ctx.fillText(ann.text, pts[0].x, pts[0].y);
        break;

      case "marker":
        if (pts.length < 1) return;
        const num = ann.number || 1;
        const markerRadius = 14;
        ctx.beginPath();
        ctx.arc(pts[0].x, pts[0].y, markerRadius, 0, Math.PI * 2);
        ctx.fillStyle = ann.color;
        ctx.fill();
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillStyle = "#ffffff";
        ctx.font = `bold ${13 / zoom}px system-ui, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(String(num), pts[0].x, pts[0].y);
        break;

      case "callout":
        if (pts.length < 1 || !ann.text) return;
        drawCallout(ctx, pts[0], ann.text, ann.color, imgX, imgY);
        break;
    }
  };

  // ─── Callout drawer ───
  const drawCallout = (ctx: CanvasRenderingContext2D, point: Point, text: string, color: string, imgX: number, imgY: number) => {
    const padding = 8;
    const cornerRadius = 6;
    ctx.font = `bold ${13 / zoom}px system-ui, sans-serif`;
    const metrics = ctx.measureText(text);
    const boxWidth = Math.max(metrics.width + padding * 2, 80);
    const boxHeight = 30;

    // Position callout box above and to the right of point
    let boxX = point.x + imgX + 20;
    let boxY = point.y + imgY - boxHeight - 20;
    if (boxY < 10) boxY = point.y + imgY + 20;

    // Draw connecting line
    ctx.beginPath();
    ctx.moveTo(point.x + imgX, point.y + imgY);
    ctx.lineTo(boxX + boxWidth / 2, boxY + boxHeight / 2);
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Draw dot at target point
    ctx.beginPath();
    ctx.arc(point.x + imgX, point.y + imgY, 4, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();

    // Draw callout box
    ctx.fillStyle = "rgba(20, 20, 30, 0.9)";
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    roundRect(ctx, boxX, boxY, boxWidth, boxHeight, cornerRadius);
    ctx.fill();
    ctx.stroke();

    // Draw text
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(text, boxX + padding, boxY + boxHeight / 2);
  };

  const roundRect = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  };

  // ─── Coordinate conversion ───
  const getCanvasPoint = (e: React.MouseEvent | React.TouchEvent): Point | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    let clientX: number, clientY: number;
    if ("touches" in e) {
      if (e.touches.length === 0) return null;
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }
    return {
      x: (clientX - rect.left - pan.x) / zoom,
      y: (clientY - rect.top - pan.y) / zoom,
    };
  };

  const getImageOffset = (): Point => {
    const canvas = canvasRef.current;
    if (!canvas || !image) return { x: 0, y: 0 };
    return {
      x: (canvas.width / zoom - image.width) / 2,
      y: (canvas.height / zoom - image.height) / 2,
    };
  };

  const toImageCoords = (pt: Point): Point => {
    const offset = getImageOffset();
    return { x: pt.x - offset.x, y: pt.y - offset.y };
  };

  // ─── Mouse/Touch handlers ───
  const handlePointerDown = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const pt = getCanvasPoint(e);
    if (!pt) return;

    if (activeTool === "select" || (e as React.MouseEvent).shiftKey) {
      setIsPanning(true);
      panStart.current = { x: (e as React.MouseEvent).clientX - pan.x, y: (e as React.MouseEvent).clientY - pan.y };
      return;
    }

    setIsDrawing(true);
    const imgPt = toImageCoords(pt);
    setCurrentPoints([imgPt]);
  };

  const handlePointerMove = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    if (isPanning) {
      setPan({
        x: (e as React.MouseEvent).clientX - panStart.current.x,
        y: (e as React.MouseEvent).clientY - panStart.current.y,
      });
      return;
    }
    if (!isDrawing) return;
    const pt = getCanvasPoint(e);
    if (!pt) return;
    const imgPt = toImageCoords(pt);
    setCurrentPoints((prev) => [...prev, imgPt]);
  };

  const handlePointerUp = () => {
    if (isPanning) {
      setIsPanning(false);
      return;
    }
    if (!isDrawing) return;
    setIsDrawing(false);

    if (currentPoints.length === 0) return;

    // For callout and text, show input instead of creating immediately
    if (activeTool === "callout") {
      const lastPt = currentPoints[currentPoints.length - 1];
      const offset = getImageOffset();
      setCalloutInput({
        x: (lastPt.x + offset.x) * zoom + pan.x,
        y: (lastPt.y + offset.y) * zoom + pan.y - 40,
        visible: true,
      });
      setCalloutText("");
      setCurrentPoints([]);
      return;
    }

    if (activeTool === "text") {
      const lastPt = currentPoints[currentPoints.length - 1];
      const offset = getImageOffset();
      setTextInput({
        x: (lastPt.x + offset.x) * zoom + pan.x,
        y: (lastPt.y + offset.y) * zoom + pan.y,
        visible: true,
      });
      setTextValue("");
      setCurrentPoints([]);
      return;
    }

    const newAnn: Annotation = {
      id: uid(),
      type: activeTool,
      color: COLORS[activeColor],
      points: [...currentPoints],
      strokeWidth,
      ...(activeTool === "marker" ? { number: markerCount } : {}),
    };

    if (activeTool === "marker") {
      setMarkerCount((c) => c + 1);
    }

    const newAnnotations = [...annotations, newAnn];
    setAnnotations(newAnnotations);
    pushHistory(newAnnotations);
    setCurrentPoints([]);
  };

  // ─── History ───
  const pushHistory = (anns: Annotation[]) => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push([...anns]);
    if (newHistory.length > 50) newHistory.shift();
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  };

  const undo = () => {
    if (historyIndex <= 0) return;
    const newIndex = historyIndex - 1;
    setHistoryIndex(newIndex);
    setAnnotations([...history[newIndex]]);
  };

  const redo = () => {
    if (historyIndex >= history.length - 1) return;
    const newIndex = historyIndex + 1;
    setHistoryIndex(newIndex);
    setAnnotations([...history[newIndex]]);
  };

  // ─── Save callout ───
  const saveCallout = () => {
    if (!calloutInput || !calloutText.trim()) {
      setCalloutInput(null);
      return;
    }
    const offset = getImageOffset();
    const imgX = (calloutInput.x - pan.x) / zoom - offset.x;
    const imgY = (calloutInput.y - pan.y + 40) / zoom - offset.y;

    const newAnn: Annotation = {
      id: uid(),
      type: "callout",
      color: COLORS[activeColor],
      points: [{ x: imgX, y: imgY }],
      text: calloutText.trim(),
      strokeWidth,
    };
    const newAnnotations = [...annotations, newAnn];
    setAnnotations(newAnnotations);
    pushHistory(newAnnotations);
    setCalloutInput(null);
    setCalloutText("");
  };

  // ─── Save text ───
  const saveText = () => {
    if (!textInput || !textValue.trim()) {
      setTextInput(null);
      return;
    }
    const offset = getImageOffset();
    const imgX = (textInput.x - pan.x) / zoom - offset.x;
    const imgY = (textInput.y - pan.y) / zoom - offset.y;

    const newAnn: Annotation = {
      id: uid(),
      type: "text",
      color: COLORS[activeColor],
      points: [{ x: imgX, y: imgY }],
      text: textValue.trim(),
      strokeWidth,
    };
    const newAnnotations = [...annotations, newAnn];
    setAnnotations(newAnnotations);
    pushHistory(newAnnotations);
    setTextInput(null);
    setTextValue("");
  };

  // ─── Save setup ───
  const saveSetup = () => {
    if (!jobId || !image) return;
    const data: SavedSetup = {
      imageDataUrl: image.src,
      annotations,
      version: 1,
      savedAt: new Date().toISOString(),
    };
    localStorage.setItem(`cnc_setup_annotations_${jobId}`, JSON.stringify(data));
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  // ─── Upload image ───
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        setImage(img);
        setAnnotations([]);
        setHistory([]);
        setHistoryIndex(-1);
        setMarkerCount(1);
        setZoom(1);
        setPan({ x: 0, y: 0 });
      };
      img.src = ev.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  // ─── Zoom ───
  const zoomIn = () => setZoom((z) => Math.min(z * 1.2, 5));
  const zoomOut = () => setZoom((z) => Math.max(z / 1.2, 0.3));
  const resetView = () => { setZoom(1); setPan({ x: 0, y: 0 }); };

  // ─── Eraser: remove annotation near point ───
  const eraseAt = useCallback((e: React.MouseEvent) => {
    const pt = getCanvasPoint(e);
    if (!pt) return;
    const imgPt = toImageCoords(pt);
    const THRESHOLD = 20;
    const newAnnotations = annotations.filter((ann) => {
      return !ann.points.some((p) => dist(p, imgPt) < THRESHOLD);
    });
    if (newAnnotations.length < annotations.length) {
      setAnnotations(newAnnotations);
      pushHistory(newAnnotations);
    }
  }, [annotations, zoom, pan]);

  // ─── Tool buttons ───
  const tools: { type: ToolType; icon: React.ReactNode; label: string }[] = [
    { type: "select", icon: <MousePointer className="h-4 w-4" />, label: "Select/Pan" },
    { type: "draw", icon: <Pencil className="h-4 w-4" />, label: "Draw" },
    { type: "arrow", icon: <ArrowRight className="h-4 w-4" />, label: "Arrow" },
    { type: "circle", icon: <Circle className="h-4 w-4" />, label: "Circle" },
    { type: "rect", icon: <Square className="h-4 w-4" />, label: "Rectangle" },
    { type: "line", icon: <Minus className="h-4 w-4" />, label: "Line" },
    { type: "text", icon: <Type className="h-4 w-4" />, label: "Text" },
    { type: "marker", icon: <Hash className="h-4 w-4" />, label: "Marker" },
    { type: "callout", icon: <MessageSquare className="h-4 w-4" />, label: "Callout" },
    { type: "eraser", icon: <Eraser className="h-4 w-4" />, label: "Eraser" },
  ];

  return (
    <AppLayout
      title="Setup Annotation Editor"
      subtitle={image ? `${annotations.length} annotations` : "Upload an image to start annotating"}
      showBack
      onBack={() => navigate(`/setup-sheet/${jobId}`)}
      action={
        <div className="flex gap-2">
          {saved && (
            <span className="text-xs text-emerald-400 flex items-center gap-1 mr-2">
              <Check className="h-3.5 w-3.5" /> Saved
            </span>
          )}
          <button className="forge-btn-secondary flex items-center gap-2" onClick={resetView}>
            <RotateCcw className="h-4 w-4" /> Reset View
          </button>
          <button className="forge-btn-primary flex items-center gap-2" onClick={saveSetup}>
            <Save className="h-4 w-4" /> Save Setup
          </button>
        </div>
      }
    >
      <div className="flex flex-col h-[calc(100vh-64px)]">

        {/* Toolbar */}
        <div className="flex items-center gap-1 px-3 py-2 border-b border-[hsl(220,14%,16%)] bg-[hsl(220,14%,8%)] overflow-x-auto">
          {/* Tools */}
          {tools.map((t) => (
            <button
              key={t.type}
              onClick={() => setActiveTool(t.type)}
              title={t.label}
              className={`h-9 w-9 rounded-md flex items-center justify-center transition-all flex-shrink-0 ${
                activeTool === t.type
                  ? "bg-orange-500/20 text-orange-400 border border-orange-500/40"
                  : "text-white/50 hover:text-white/80 hover:bg-white/5 border border-transparent"
              }`}
            >
              {t.icon}
            </button>
          ))}

          <div className="w-px h-6 bg-white/10 mx-1 flex-shrink-0" />

          {/* Color picker */}
          <div className="relative flex-shrink-0">
            <button
              onClick={() => setShowColorPicker(!showColorPicker)}
              className="h-9 px-2 rounded-md flex items-center gap-1.5 text-white/50 hover:text-white/80 hover:bg-white/5 border border-transparent transition-all"
            >
              <span className="w-4 h-4 rounded-full border border-white/20" style={{ backgroundColor: COLORS[activeColor] }} />
              <ChevronDown className="h-3 w-3" />
            </button>
            {showColorPicker && (
              <div className="absolute top-full left-0 mt-1 bg-[hsl(220,14%,12%)] border border-[hsl(220,14%,20%)] rounded-lg p-2 flex gap-1.5 z-50 shadow-xl">
                {(Object.keys(COLORS) as ColorKey[]).map((c) => (
                  <button
                    key={c}
                    onClick={() => { setActiveColor(c); setShowColorPicker(false); }}
                    className={`w-7 h-7 rounded-full border-2 transition-all ${
                      activeColor === c ? "border-white scale-110" : "border-transparent hover:border-white/30"
                    }`}
                    style={{ backgroundColor: COLORS[c] }}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Stroke width */}
          <div className="relative flex-shrink-0">
            <button
              onClick={() => setShowWidthPicker(!showWidthPicker)}
              className="h-9 px-2 rounded-md flex items-center gap-1.5 text-white/50 hover:text-white/80 hover:bg-white/5 border border-transparent transition-all"
            >
              <span className="w-5 h-0.5 bg-current rounded-full" style={{ height: strokeWidth }} />
              <ChevronDown className="h-3 w-3" />
            </button>
            {showWidthPicker && (
              <div className="absolute top-full left-0 mt-1 bg-[hsl(220,14%,12%)] border border-[hsl(220,14%,20%)] rounded-lg p-2 flex flex-col gap-2 z-50 shadow-xl">
                {STROKE_WIDTHS.map((w) => (
                  <button
                    key={w}
                    onClick={() => { setStrokeWidth(w); setShowWidthPicker(false); }}
                    className={`w-16 h-8 rounded flex items-center justify-center transition-all ${
                      strokeWidth === w ? "bg-orange-500/20" : "hover:bg-white/5"
                    }`}
                  >
                    <span className="w-8 bg-white/60 rounded-full" style={{ height: w }} />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="w-px h-6 bg-white/10 mx-1 flex-shrink-0" />

          {/* Undo/Redo */}
          <button onClick={undo} disabled={historyIndex <= 0} className="h-9 w-9 rounded-md flex items-center justify-center text-white/50 hover:text-white/80 hover:bg-white/5 disabled:opacity-20 transition-all flex-shrink-0" title="Undo">
            <Undo2 className="h-4 w-4" />
          </button>
          <button onClick={redo} disabled={historyIndex >= history.length - 1} className="h-9 w-9 rounded-md flex items-center justify-center text-white/50 hover:text-white/80 hover:bg-white/5 disabled:opacity-20 transition-all flex-shrink-0" title="Redo">
            <Redo2 className="h-4 w-4" />
          </button>

          <div className="w-px h-6 bg-white/10 mx-1 flex-shrink-0" />

          {/* Zoom */}
          <button onClick={zoomOut} className="h-9 w-9 rounded-md flex items-center justify-center text-white/50 hover:text-white/80 hover:bg-white/5 transition-all flex-shrink-0" title="Zoom Out">
            <ZoomOut className="h-4 w-4" />
          </button>
          <span className="text-xs text-white/40 font-mono w-12 text-center flex-shrink-0">{Math.round(zoom * 100)}%</span>
          <button onClick={zoomIn} className="h-9 w-9 rounded-md flex items-center justify-center text-white/50 hover:text-white/80 hover:bg-white/5 transition-all flex-shrink-0" title="Zoom In">
            <ZoomIn className="h-4 w-4" />
          </button>

          <div className="flex-1" />

          {/* Upload */}
          <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
          <button onClick={() => fileInputRef.current?.click()} className="h-9 px-3 rounded-md flex items-center gap-1.5 text-white/50 hover:text-white/80 hover:bg-white/5 border border-transparent transition-all flex-shrink-0 text-xs">
            <Upload className="h-4 w-4" /> Upload Image
          </button>
        </div>

        {/* Canvas Area */}
        <div ref={containerRef} className="flex-1 relative bg-[hsl(220,14%,6%)] overflow-hidden">
          {!image && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
              <div className="w-20 h-20 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
                <Camera className="h-10 w-10 text-white/20" />
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold text-white/40">No setup image loaded</p>
                <p className="text-xs text-white/20 mt-1">Upload an image to begin annotating</p>
              </div>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="forge-btn-primary flex items-center gap-2 mt-2"
              >
                <Upload className="h-4 w-4" /> Upload Setup Image
              </button>
            </div>
          )}

          <canvas
            ref={canvasRef}
            className="absolute inset-0 w-full h-full cursor-crosshair touch-none"
            onMouseDown={activeTool === "eraser" ? eraseAt : handlePointerDown}
            onMouseMove={handlePointerMove}
            onMouseUp={handlePointerUp}
            onMouseLeave={handlePointerUp}
            onTouchStart={handlePointerDown}
            onTouchMove={handlePointerMove}
            onTouchEnd={handlePointerUp}
            style={{ cursor: activeTool === "select" ? "grab" : activeTool === "eraser" ? "not-allowed" : "crosshair" }}
          />

          {/* Callout input overlay */}
          {calloutInput?.visible && (
            <div
              className="absolute z-50 flex flex-col gap-1"
              style={{ left: calloutInput.x, top: calloutInput.y }}
            >
              <div className="bg-[hsl(220,14%,10%)] border border-orange-500/40 rounded-lg shadow-xl p-2 flex flex-col gap-1.5 min-w-[220px]">
                <p className="text-[10px] font-semibold text-orange-400 uppercase tracking-wider">Add Comment Callout</p>
                <input
                  type="text"
                  value={calloutText}
                  onChange={(e) => setCalloutText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") saveCallout(); if (e.key === "Escape") setCalloutInput(null); }}
                  placeholder="e.g. Clock impeller boss for runout"
                  className="w-full h-8 px-2 rounded border border-[hsl(220,14%,22%)] bg-[hsl(220,14%,16%)] text-sm text-white placeholder:text-white/30 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-orange-500/40"
                  autoFocus
                />
                <div className="flex gap-1">
                  <button onClick={saveCallout} className="flex-1 h-7 text-xs font-semibold bg-orange-500/20 hover:bg-orange-500/30 text-orange-400 rounded transition-all">
                    Add
                  </button>
                  <button onClick={() => setCalloutInput(null)} className="h-7 px-2 text-xs text-white/40 hover:text-white/60 transition-all">
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Text input overlay */}
          {textInput?.visible && (
            <div
              className="absolute z-50"
              style={{ left: textInput.x, top: textInput.y }}
            >
              <div className="bg-[hsl(220,14%,10%)] border border-blue-500/40 rounded-lg shadow-xl p-2 flex flex-col gap-1.5 min-w-[180px]">
                <p className="text-[10px] font-semibold text-blue-400 uppercase tracking-wider">Add Text</p>
                <input
                  type="text"
                  value={textValue}
                  onChange={(e) => setTextValue(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") saveText(); if (e.key === "Escape") setTextInput(null); }}
                  placeholder="Enter text..."
                  className="w-full h-8 px-2 rounded border border-[hsl(220,14%,22%)] bg-[hsl(220,14%,16%)] text-sm text-white placeholder:text-white/30 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500/40"
                  autoFocus
                />
                <div className="flex gap-1">
                  <button onClick={saveText} className="flex-1 h-7 text-xs font-semibold bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded transition-all">
                    Add
                  </button>
                  <button onClick={() => setTextInput(null)} className="h-7 px-2 text-xs text-white/40 hover:text-white/60 transition-all">
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Active tool indicator */}
          <div className="absolute bottom-3 left-3 bg-black/60 backdrop-blur-sm rounded-md px-2.5 py-1 flex items-center gap-2">
            <span className="text-[10px] text-white/40 uppercase tracking-wider">Tool:</span>
            <span className="text-xs font-semibold text-orange-400 capitalize">{activeTool === "callout" ? "Comment Callout" : activeTool}</span>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
