import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate, useParams } from "react-router";
import { trpc } from "@/providers/trpc";
import AppLayout from "@/components/layout/AppLayout";
import {
  MousePointer, Pencil, Circle, Square, ArrowRight, Type,
  Hash, Undo2, Redo2, Save, ZoomIn, ZoomOut,
  MessageSquare, Eraser, X, Minus, Camera, Upload,
  RotateCcw, ChevronDown, Check, ChevronLeft, ChevronRight,
  AlertTriangle
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
}

const COLORS: Record<ColorKey, string> = {
  red: "#ef4444", yellow: "#eab308", green: "#22c55e",
  blue: "#3b82f6", white: "#ffffff", black: "#111111",
};
const STROKE_WIDTHS = [2, 4, 6, 8];

// ─── Helpers ───
let _idCounter = 0;
const uid = () => `a_${++_idCounter}_${Date.now().toString(36)}`;
const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
const midPoint = (a: Point, b: Point): Point => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

function arrowHeadPoly(tip: Point, tail: Point, size: number): Point[] {
  const angle = Math.atan2(tip.y - tail.y, tip.x - tail.x);
  const perp = angle + Math.PI / 2;
  const base = { x: tip.x - size * 2 * Math.cos(angle), y: tip.y - size * 2 * Math.sin(angle) };
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
  const numericJobId = Number(jobId);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auth
  const [operator, setOperator] = useState<{ id: number; name: string } | null>(null);
  useEffect(() => {
    const saved = localStorage.getItem("cnc_operator");
    if (saved) try { setOperator(JSON.parse(saved)); } catch { /* ignore */ }
  }, []);

  // ─── tRPC: Load setup from DATABASE ───
  const setupQuery = trpc.setupSheet.getByJobId.useQuery(
    { jobId: numericJobId },
    { enabled: !isNaN(numericJobId) && numericJobId > 0 }
  );
  const saveMutation = trpc.setupSheet.save.useMutation({
    onSuccess: () => { setSaved(true); setTimeout(() => setSaved(false), 3000); setupQuery.refetch(); },
  });
  const jobQuery = trpc.job.getById.useQuery(
    { id: numericJobId },
    { enabled: !isNaN(numericJobId) && numericJobId > 0 }
  );

  // ─── Image navigation ───
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [image, setImage] = useState<HTMLImageElement | null>(null);

  // Get images from database
  const dbImages = setupQuery.data?.images || [];
  const currentDbImage = dbImages[currentImageIndex];

  // Load current image
  useEffect(() => {
    if (currentDbImage?.imageData) {
      const img = new Image();
      img.onload = () => setImage(img);
      img.src = currentDbImage.imageData;
    } else {
      setImage(null);
    }
    // Load annotations for this image
    if (currentDbImage?.annotations) {
      const loaded: Annotation[] = currentDbImage.annotations.map((a: any) => ({
        id: uid(),
        type: a.type as ToolType,
        color: a.color,
        points: typeof a.points === "string" ? JSON.parse(a.points) : a.points,
        text: a.text || undefined,
        number: a.number || undefined,
        strokeWidth: a.strokeWidth || undefined,
      }));
      setAnnotations(loaded);
      pushHistory(loaded);
    } else {
      setAnnotations([]);
      setHistory([]);
      setHistoryIndex(-1);
    }
    setMarkerCount(1);
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, [currentImageIndex, currentDbImage?.imageData]);

  // Core state
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [history, setHistory] = useState<Annotation[][]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  // Tool state
  const [activeTool, setActiveTool] = useState<ToolType>("draw");
  const [activeColor, setActiveColor] = useState<ColorKey>("red");
  const [strokeWidth, setStrokeWidth] = useState(3);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentPoints, setCurrentPoints] = useState<Point[]>([]);

  // Callout input
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

  const [markerCount, setMarkerCount] = useState(1);
  const [saved, setSaved] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showWidthPicker, setShowWidthPicker] = useState(false);
  const [setupNotes, setSetupNotes] = useState("");
  const [showNotesPanel, setShowNotesPanel] = useState(false);

  // Canvas drawing
  useEffect(() => {
    if (!image || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const container = containerRef.current;
    if (container) { canvas.width = container.clientWidth; canvas.height = container.clientHeight; }

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(pan.x, pan.y);
    ctx.scale(zoom, zoom);

    const imgX = (canvas.width / zoom - image.width) / 2;
    const imgY = (canvas.height / zoom - image.height) / 2;
    ctx.drawImage(image, imgX, imgY);

    annotations.forEach((ann) => drawAnnotation(ctx, ann, imgX, imgY));

    if (isDrawing && currentPoints.length > 0) {
      const tempAnn: Annotation = {
        id: "temp", type: activeTool, color: COLORS[activeColor],
        points: currentPoints, strokeWidth,
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
    const pts = ann.points.map(p => ({ x: p.x + imgX, y: p.y + imgY }));

    switch (ann.type) {
      case "draw":
        if (pts.length < 2) return;
        ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) { const mid = midPoint(pts[i - 1], pts[i]); ctx.quadraticCurveTo(pts[i - 1].x, pts[i - 1].y, mid.x, mid.y); }
        ctx.stroke(); break;
      case "line":
        if (pts.length < 2) return;
        ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y); ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y); ctx.stroke(); break;
      case "arrow":
        if (pts.length < 2) return;
        ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y); ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y); ctx.stroke();
        const headSize = Math.max(8, (ann.strokeWidth || 3) * 3);
        const head = arrowHeadPoly(pts[pts.length - 1], pts[0], headSize);
        ctx.beginPath(); ctx.moveTo(head[0].x, head[0].y); ctx.lineTo(head[1].x, head[1].y); ctx.lineTo(head[2].x, head[2].y); ctx.closePath(); ctx.fill();
        break;
      case "circle":
        if (pts.length < 2) return;
        const radius = dist(pts[0], pts[pts.length - 1]);
        ctx.beginPath(); ctx.arc(pts[0].x, pts[0].y, radius, 0, Math.PI * 2); ctx.stroke(); break;
      case "rect":
        if (pts.length < 2) return;
        ctx.strokeRect(Math.min(pts[0].x, pts[pts.length - 1].x), Math.min(pts[0].y, pts[pts.length - 1].y),
          Math.abs(pts[pts.length - 1].x - pts[0].x), Math.abs(pts[pts.length - 1].y - pts[0].y)); break;
      case "text":
        if (pts.length < 1 || !ann.text) return;
        ctx.font = `bold ${14 / zoom}px system-ui, sans-serif`; ctx.fillStyle = ann.color; ctx.fillText(ann.text, pts[0].x, pts[0].y); break;
      case "marker":
        if (pts.length < 1) return;
        const num = ann.number || 1; const mr = 14;
        ctx.beginPath(); ctx.arc(pts[0].x, pts[0].y, mr, 0, Math.PI * 2); ctx.fillStyle = ann.color; ctx.fill();
        ctx.strokeStyle = "#fff"; ctx.lineWidth = 2; ctx.stroke();
        ctx.fillStyle = "#fff"; ctx.font = `bold ${13 / zoom}px system-ui, sans-serif`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(String(num), pts[0].x, pts[0].y); break;
      case "callout":
        if (pts.length < 1 || !ann.text) return;
        drawCallout(ctx, pts[0], ann.text, ann.color, imgX, imgY); break;
    }
  };

  const drawCallout = (ctx: CanvasRenderingContext2D, point: Point, text: string, color: string, imgX: number, imgY: number) => {
    const padding = 8, cornerRadius = 6;
    ctx.font = `bold ${13 / zoom}px system-ui, sans-serif`;
    const metrics = ctx.measureText(text);
    const boxWidth = Math.max(metrics.width + padding * 2, 80), boxHeight = 30;
    let boxX = point.x + imgX + 20, boxY = point.y + imgY - boxHeight - 20;
    if (boxY < 10) boxY = point.y + imgY + 20;

    ctx.beginPath(); ctx.moveTo(point.x + imgX, point.y + imgY); ctx.lineTo(boxX + boxWidth / 2, boxY + boxHeight / 2);
    ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.stroke();
    ctx.beginPath(); ctx.arc(point.x + imgX, point.y + imgY, 4, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill();

    ctx.fillStyle = "rgba(20,20,30,0.9)"; ctx.strokeStyle = color; ctx.lineWidth = 2;
    roundRect(ctx, boxX, boxY, boxWidth, boxHeight, cornerRadius); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#fff"; ctx.textAlign = "left"; ctx.textBaseline = "middle";
    ctx.fillText(text, boxX + padding, boxY + boxHeight / 2);
  };

  const roundRect = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
  };

  // ─── Coordinate conversion ───
  const getCanvasPoint = (e: React.MouseEvent | React.TouchEvent): Point | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    let cx: number, cy: number;
    if ("touches" in e) { if (e.touches.length === 0) return null; cx = e.touches[0].clientX; cy = e.touches[0].clientY; }
    else { cx = e.clientX; cy = e.clientY; }
    return { x: (cx - rect.left - pan.x) / zoom, y: (cy - rect.top - pan.y) / zoom };
  };
  const getImageOffset = (): Point => {
    const canvas = canvasRef.current;
    if (!canvas || !image) return { x: 0, y: 0 };
    return { x: (canvas.width / zoom - image.width) / 2, y: (canvas.height / zoom - image.height) / 2 };
  };
  const toImageCoords = (pt: Point): Point => { const offset = getImageOffset(); return { x: pt.x - offset.x, y: pt.y - offset.y }; };

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
    setCurrentPoints([toImageCoords(pt)]);
  };
  const handlePointerMove = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    if (isPanning) { setPan({ x: (e as React.MouseEvent).clientX - panStart.current.x, y: (e as React.MouseEvent).clientY - panStart.current.y }); return; }
    if (!isDrawing) return;
    const pt = getCanvasPoint(e);
    if (!pt) return;
    setCurrentPoints(prev => [...prev, toImageCoords(pt)]);
  };
  const handlePointerUp = () => {
    if (isPanning) { setIsPanning(false); return; }
    if (!isDrawing) return;
    setIsDrawing(false);
    if (currentPoints.length === 0) return;

    if (activeTool === "callout") {
      const lastPt = currentPoints[currentPoints.length - 1];
      const offset = getImageOffset();
      setCalloutInput({ x: (lastPt.x + offset.x) * zoom + pan.x, y: (lastPt.y + offset.y) * zoom + pan.y - 40, visible: true });
      setCalloutText(""); setCurrentPoints([]); return;
    }
    if (activeTool === "text") {
      const lastPt = currentPoints[currentPoints.length - 1];
      const offset = getImageOffset();
      setTextInput({ x: (lastPt.x + offset.x) * zoom + pan.x, y: (lastPt.y + offset.y) * zoom + pan.y, visible: true });
      setTextValue(""); setCurrentPoints([]); return;
    }

    const newAnn: Annotation = {
      id: uid(), type: activeTool, color: COLORS[activeColor],
      points: [...currentPoints], strokeWidth,
      ...(activeTool === "marker" ? { number: markerCount } : {}),
    };
    if (activeTool === "marker") setMarkerCount(c => c + 1);
    const newAnnotations = [...annotations, newAnn];
    setAnnotations(newAnnotations); pushHistory(newAnnotations); setCurrentPoints([]);
  };

  // ─── History ───
  const pushHistory = (anns: Annotation[]) => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push([...anns]);
    if (newHistory.length > 50) newHistory.shift();
    setHistory(newHistory); setHistoryIndex(newHistory.length - 1);
  };
  const undo = () => { if (historyIndex <= 0) return; const newIndex = historyIndex - 1; setHistoryIndex(newIndex); setAnnotations([...history[newIndex]]); };
  const redo = () => { if (historyIndex >= history.length - 1) return; const newIndex = historyIndex + 1; setHistoryIndex(newIndex); setAnnotations([...history[newIndex]]); };

  // ─── Save callout / text ───
  const saveCallout = () => {
    if (!calloutInput || !calloutText.trim()) { setCalloutInput(null); return; }
    const offset = getImageOffset();
    const newAnn: Annotation = {
      id: uid(), type: "callout", color: COLORS[activeColor],
      points: [{ x: (calloutInput.x - pan.x) / zoom - offset.x, y: (calloutInput.y - pan.y + 40) / zoom - offset.y }],
      text: calloutText.trim(), strokeWidth,
    };
    const newAnnotations = [...annotations, newAnn];
    setAnnotations(newAnnotations); pushHistory(newAnnotations);
    setCalloutInput(null); setCalloutText("");
  };
  const saveText = () => {
    if (!textInput || !textValue.trim()) { setTextInput(null); return; }
    const offset = getImageOffset();
    const newAnn: Annotation = {
      id: uid(), type: "text", color: COLORS[activeColor],
      points: [{ x: (textInput.x - pan.x) / zoom - offset.x, y: (textInput.y - pan.y) / zoom - offset.y }],
      text: textValue.trim(), strokeWidth,
    };
    const newAnnotations = [...annotations, newAnn];
    setAnnotations(newAnnotations); pushHistory(newAnnotations);
    setTextInput(null); setTextValue("");
  };

  // ─── DATABASE SAVE ───
  const saveSetup = () => {
    if (!setupQuery.data || !operator || !jobQuery.data) return;

    // Build updated images array with current annotations
    const updatedImages = dbImages.map((dbImg, idx) => ({
      imageData: dbImg.imageData,
      displayOrder: idx,
      annotations: idx === currentImageIndex
        ? annotations.map(a => ({ type: a.type, color: a.color, points: a.points, text: a.text, number: a.number, strokeWidth: a.strokeWidth }))
        : (dbImg.annotations || []).map((a: any) => ({ type: a.type, color: a.color, points: typeof a.points === "string" ? JSON.parse(a.points) : a.points, text: a.text, number: a.number, strokeWidth: a.strokeWidth })),
    }));

    saveMutation.mutate({
      jobId: numericJobId,
      partNumber: jobQuery.data.partNumber,
      revision: jobQuery.data.revision,
      materialNumber: jobQuery.data.materialNumber,
      operatorId: operator.id,
      operatorName: operator.name,
      programNotes: setupQuery.data.programNotes || undefined,
      generalNotes: setupNotes || setupQuery.data.generalNotes || undefined,
      workholding: setupQuery.data.workholding.map((w: any) => ({ label: w.label, value: w.value || "", displayOrder: w.displayOrder || 0 })),
      tools: setupQuery.data.tools.map((t: any) => ({ toolNumber: t.toolNumber, description: t.description || undefined, toolId: t.toolId || undefined, offset: t.offset || undefined, displayOrder: t.displayOrder || 0 })),
      images: updatedImages,
      changeSummary: `Annotations updated on image ${currentImageIndex + 1}`,
    });
  };

  // ─── Upload new image ───
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      if (!setupQuery.data || !operator || !jobQuery.data) return;
      const newImages = [
        ...dbImages.map((img: any, idx: number) => ({
          imageData: img.imageData,
          displayOrder: idx,
          annotations: (img.annotations || []).map((a: any) => ({ type: a.type, color: a.color, points: typeof a.points === "string" ? JSON.parse(a.points) : a.points, text: a.text, number: a.number, strokeWidth: a.strokeWidth })),
        })),
        { imageData: ev.target?.result as string, displayOrder: dbImages.length, annotations: [] },
      ];
      saveMutation.mutate({
        jobId: numericJobId,
        partNumber: jobQuery.data!.partNumber,
        revision: jobQuery.data!.revision,
        materialNumber: jobQuery.data!.materialNumber,
        operatorId: operator.id,
        operatorName: operator.name,
        programNotes: setupQuery.data.programNotes || undefined,
        generalNotes: setupQuery.data.generalNotes || undefined,
        workholding: setupQuery.data.workholding.map((w: any) => ({ label: w.label, value: w.value || "", displayOrder: w.displayOrder || 0 })),
        tools: setupQuery.data.tools.map((t: any) => ({ toolNumber: t.toolNumber, description: t.description || undefined, toolId: t.toolId || undefined, offset: t.offset || undefined, displayOrder: t.displayOrder || 0 })),
        images: newImages,
        changeSummary: `Added new setup photo`,
      });
    };
    reader.readAsDataURL(file);
  };

  // ─── Zoom ───
  const zoomIn = () => setZoom(z => Math.min(z * 1.2, 5));
  const zoomOut = () => setZoom(z => Math.max(z / 1.2, 0.3));
  const resetView = () => { setZoom(1); setPan({ x: 0, y: 0 }); };

  // ─── Eraser ───
  const eraseAt = useCallback((e: React.MouseEvent) => {
    const pt = getCanvasPoint(e);
    if (!pt) return;
    const imgPt = toImageCoords(pt);
    const newAnnotations = annotations.filter(ann => !ann.points.some(p => dist(p, imgPt) < 20));
    if (newAnnotations.length < annotations.length) { setAnnotations(newAnnotations); pushHistory(newAnnotations); }
  }, [annotations, zoom, pan]);

  // ─── Tools ───
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

  const hasImages = dbImages.length > 0;

  return (
    <AppLayout
      title="Setup Annotation Editor"
      subtitle={hasImages ? `Image ${currentImageIndex + 1} of ${dbImages.length} | ${annotations.length} annotations` : "No setup images"}
      showBack
      onBack={() => navigate(`/setup-sheet/${jobId}`)}
      action={
        <div className="flex gap-2">
          {saved && (
            <span className="text-xs text-emerald-400 flex items-center gap-1 mr-2">
              <Check className="h-3.5 w-3.5" /> Saved to Database
            </span>
          )}
          <button className="forge-btn-secondary flex items-center gap-2" onClick={resetView}>
            <RotateCcw className="h-4 w-4" /> Reset View
          </button>
          <button className="forge-btn-secondary flex items-center gap-2" onClick={() => setShowNotesPanel(!showNotesPanel)}>
            <MessageSquare className="h-4 w-4" /> Notes
          </button>
          <button className="forge-btn-primary flex items-center gap-2" onClick={saveSetup} disabled={saveMutation.isPending || !hasImages}>
            {saveMutation.isPending ? <RotateCcw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saveMutation.isPending ? "Saving..." : "Save to Database"}
          </button>
        </div>
      }
    >
      <div className="flex flex-col h-[calc(100vh-64px)]">

        {/* Image Navigation Bar */}
        {hasImages && (
          <div className="flex items-center gap-2 px-3 py-1.5 border-b border-[hsl(220,14%,16%)] bg-[hsl(220,14%,8%)]">
            <button
              onClick={() => setCurrentImageIndex(i => Math.max(0, i - 1))}
              disabled={currentImageIndex === 0}
              className="h-7 w-7 rounded-md flex items-center justify-center text-white/50 hover:text-white/80 hover:bg-white/5 disabled:opacity-20 transition-all"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <div className="flex-1 flex gap-1 overflow-x-auto">
              {dbImages.map((img, idx) => (
                <button
                  key={idx}
                  onClick={() => setCurrentImageIndex(idx)}
                  className={`h-10 w-10 rounded-md overflow-hidden border-2 transition-all flex-shrink-0 ${
                    idx === currentImageIndex ? "border-orange-500" : "border-transparent hover:border-white/20"
                  }`}
                >
                  <img src={img.imageData} alt={`Thumbnail ${idx + 1}`} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
            <button
              onClick={() => setCurrentImageIndex(i => Math.min(dbImages.length - 1, i + 1))}
              disabled={currentImageIndex === dbImages.length - 1}
              className="h-7 w-7 rounded-md flex items-center justify-center text-white/50 hover:text-white/80 hover:bg-white/5 disabled:opacity-20 transition-all"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <div className="w-px h-6 bg-white/10 mx-1" />
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
            <button onClick={() => fileInputRef.current?.click()} className="h-7 px-2 rounded-md text-xs text-white/50 hover:text-white/80 hover:bg-white/5 transition-all flex items-center gap-1">
              <Plus className="h-3.5 w-3.5" /> Add
            </button>
          </div>
        )}

        {/* Toolbar */}
        <div className="flex items-center gap-1 px-3 py-2 border-b border-[hsl(220,14%,16%)] bg-[hsl(220,14%,8%)] overflow-x-auto">
          {tools.map(t => (
            <button key={t.type} onClick={() => setActiveTool(t.type)} title={t.label}
              className={`h-9 w-9 rounded-md flex items-center justify-center transition-all flex-shrink-0 ${
                activeTool === t.type ? "bg-orange-500/20 text-orange-400 border border-orange-500/40" : "text-white/50 hover:text-white/80 hover:bg-white/5 border border-transparent"
              }`}>
              {t.icon}
            </button>
          ))}

          <div className="w-px h-6 bg-white/10 mx-1 flex-shrink-0" />

          {/* Color picker */}
          <div className="relative flex-shrink-0">
            <button onClick={() => setShowColorPicker(!showColorPicker)}
              className="h-9 px-2 rounded-md flex items-center gap-1.5 text-white/50 hover:text-white/80 hover:bg-white/5 border border-transparent transition-all">
              <span className="w-4 h-4 rounded-full border border-white/20" style={{ backgroundColor: COLORS[activeColor] }} />
              <ChevronDown className="h-3 w-3" />
            </button>
            {showColorPicker && (
              <div className="absolute top-full left-0 mt-1 bg-[hsl(220,14%,12%)] border border-[hsl(220,14%,20%)] rounded-lg p-2 flex gap-1.5 z-50 shadow-xl">
                {(Object.keys(COLORS) as ColorKey[]).map(c => (
                  <button key={c} onClick={() => { setActiveColor(c); setShowColorPicker(false); }}
                    className={`w-7 h-7 rounded-full border-2 transition-all ${activeColor === c ? "border-white scale-110" : "border-transparent hover:border-white/30"}`}
                    style={{ backgroundColor: COLORS[c] }} />
                ))}
              </div>
            )}
          </div>

          {/* Stroke width */}
          <div className="relative flex-shrink-0">
            <button onClick={() => setShowWidthPicker(!showWidthPicker)}
              className="h-9 px-2 rounded-md flex items-center gap-1.5 text-white/50 hover:text-white/80 hover:bg-white/5 border border-transparent transition-all">
              <span className="w-5 bg-current rounded-full" style={{ height: strokeWidth }} />
              <ChevronDown className="h-3 w-3" />
            </button>
            {showWidthPicker && (
              <div className="absolute top-full left-0 mt-1 bg-[hsl(220,14%,12%)] border border-[hsl(220,14%,20%)] rounded-lg p-2 flex flex-col gap-2 z-50 shadow-xl">
                {STROKE_WIDTHS.map(w => (
                  <button key={w} onClick={() => { setStrokeWidth(w); setShowWidthPicker(false); }}
                    className={`w-16 h-8 rounded flex items-center justify-center transition-all ${strokeWidth === w ? "bg-orange-500/20" : "hover:bg-white/5"}`}>
                    <span className="w-8 bg-white/60 rounded-full" style={{ height: w }} />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="w-px h-6 bg-white/10 mx-1 flex-shrink-0" />

          <button onClick={undo} disabled={historyIndex <= 0} className="h-9 w-9 rounded-md flex items-center justify-center text-white/50 hover:text-white/80 hover:bg-white/5 disabled:opacity-20 transition-all flex-shrink-0" title="Undo">
            <Undo2 className="h-4 w-4" />
          </button>
          <button onClick={redo} disabled={historyIndex >= history.length - 1} className="h-9 w-9 rounded-md flex items-center justify-center text-white/50 hover:text-white/80 hover:bg-white/5 disabled:opacity-20 transition-all flex-shrink-0" title="Redo">
            <Redo2 className="h-4 w-4" />
          </button>

          <div className="w-px h-6 bg-white/10 mx-1 flex-shrink-0" />

          <button onClick={zoomOut} className="h-9 w-9 rounded-md flex items-center justify-center text-white/50 hover:text-white/80 hover:bg-white/5 transition-all flex-shrink-0" title="Zoom Out">
            <ZoomOut className="h-4 w-4" />
          </button>
          <span className="text-xs text-white/40 font-mono w-12 text-center flex-shrink-0">{Math.round(zoom * 100)}%</span>
          <button onClick={zoomIn} className="h-9 w-9 rounded-md flex items-center justify-center text-white/50 hover:text-white/80 hover:bg-white/5 transition-all flex-shrink-0" title="Zoom In">
            <ZoomIn className="h-4 w-4" />
          </button>
        </div>

        {/* Canvas + Notes Panel */}
        <div className="flex flex-1 overflow-hidden">
          <div ref={containerRef} className="relative bg-[hsl(220,14%,6%)] overflow-hidden flex-1">
            {!image && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
                {hasImages ? (
                  <>
                    <RotateCcw className="h-8 w-8 text-white/20 animate-spin" />
                    <p className="text-sm text-white/40">Loading image...</p>
                  </>
                ) : (
                  <>
                    <div className="w-20 h-20 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
                      <Camera className="h-10 w-10 text-white/20" />
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-semibold text-white/40">No setup images</p>
                      <p className="text-xs text-white/20 mt-1">Add photos from the Setup Sheet page first</p>
                    </div>
                    <button onClick={() => navigate(`/setup-sheet/${jobId}`)} className="forge-btn-primary flex items-center gap-2">
                      <ArrowRight className="h-4 w-4" /> Go to Setup Sheet
                    </button>
                  </>
                )}
              </div>
            )}

            {saveMutation.isError && (
              <div className="absolute top-3 right-3 z-40 bg-rose-500/20 border border-rose-500/40 rounded-lg px-3 py-2 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-rose-400" />
                <span className="text-xs text-rose-300">Save failed</span>
              </div>
            )}

            <canvas ref={canvasRef} className="absolute inset-0 w-full h-full cursor-crosshair touch-none"
              onMouseDown={activeTool === "eraser" ? eraseAt : handlePointerDown}
              onMouseMove={handlePointerMove} onMouseUp={handlePointerUp} onMouseLeave={handlePointerUp}
              onTouchStart={handlePointerDown} onTouchMove={handlePointerMove} onTouchEnd={handlePointerUp}
              style={{ cursor: activeTool === "select" ? "grab" : activeTool === "eraser" ? "not-allowed" : "crosshair" }}
            />

            {/* Callout input */}
            {calloutInput?.visible && (
              <div className="absolute z-50 flex flex-col gap-1" style={{ left: calloutInput.x, top: calloutInput.y }}>
                <div className="bg-[hsl(220,14%,10%)] border border-orange-500/40 rounded-lg shadow-xl p-2 flex flex-col gap-1.5 min-w-[220px]">
                  <p className="text-[10px] font-semibold text-orange-400 uppercase tracking-wider">Add Comment Callout</p>
                  <input type="text" value={calloutText} onChange={e => setCalloutText(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") saveCallout(); if (e.key === "Escape") setCalloutInput(null); }}
                    placeholder="e.g. Clock impeller boss for runout"
                    className="w-full h-8 px-2 rounded border border-[hsl(220,14%,22%)] bg-[hsl(220,14%,16%)] text-sm text-white placeholder:text-white/30 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-orange-500/40"
                    autoFocus />
                  <div className="flex gap-1">
                    <button onClick={saveCallout} className="flex-1 h-7 text-xs font-semibold bg-orange-500/20 hover:bg-orange-500/30 text-orange-400 rounded transition-all">Add</button>
                    <button onClick={() => setCalloutInput(null)} className="h-7 px-2 text-xs text-white/40 hover:text-white/60 transition-all">Cancel</button>
                  </div>
                </div>
              </div>
            )}

            {/* Text input */}
            {textInput?.visible && (
              <div className="absolute z-50" style={{ left: textInput.x, top: textInput.y }}>
                <div className="bg-[hsl(220,14%,10%)] border border-blue-500/40 rounded-lg shadow-xl p-2 flex flex-col gap-1.5 min-w-[180px]">
                  <p className="text-[10px] font-semibold text-blue-400 uppercase tracking-wider">Add Text</p>
                  <input type="text" value={textValue} onChange={e => setTextValue(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") saveText(); if (e.key === "Escape") setTextInput(null); }}
                    placeholder="Enter text..."
                    className="w-full h-8 px-2 rounded border border-[hsl(220,14%,22%)] bg-[hsl(220,14%,16%)] text-sm text-white placeholder:text-white/30 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500/40"
                    autoFocus />
                  <div className="flex gap-1">
                    <button onClick={saveText} className="flex-1 h-7 text-xs font-semibold bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded transition-all">Add</button>
                    <button onClick={() => setTextInput(null)} className="h-7 px-2 text-xs text-white/40 hover:text-white/60 transition-all">Cancel</button>
                  </div>
                </div>
              </div>
            )}

            {/* Tool indicator */}
            <div className="absolute bottom-3 left-3 bg-black/60 backdrop-blur-sm rounded-md px-2.5 py-1 flex items-center gap-2">
              <span className="text-[10px] text-white/40 uppercase tracking-wider">Tool:</span>
              <span className="text-xs font-semibold text-orange-400 capitalize">{activeTool === "callout" ? "Comment Callout" : activeTool}</span>
            </div>
          </div>

          {/* Notes Panel */}
          {showNotesPanel && (
            <div className="w-80 border-l border-[hsl(220,14%,16%)] bg-[hsl(220,14%,10%)] flex flex-col">
              <div className="px-4 py-3 border-b border-[hsl(220,14%,16%)] flex items-center justify-between">
                <h3 className="text-sm font-bold text-white/80 flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-orange-400" /> Setup Notes
                </h3>
                <button onClick={() => setShowNotesPanel(false)} className="h-7 w-7 rounded-lg hover:bg-white/5 flex items-center justify-center text-white/40 hover:text-white/60 transition-all">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="flex-1 p-4">
                <textarea value={setupNotes} onChange={e => setSetupNotes(e.target.value)}
                  placeholder="Add notes about this setup..."
                  className="w-full h-full resize-none rounded-lg border border-[hsl(220,14%,22%)] bg-[hsl(220,14%,14%)] text-sm text-white placeholder:text-white/30 p-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/40 focus-visible:border-orange-500/40" />
              </div>
              <div className="px-4 py-3 border-t border-[hsl(220,14%,16%)]">
                <button onClick={saveSetup} className="w-full h-10 rounded-lg bg-orange-500/20 hover:bg-orange-500/30 text-orange-400 text-sm font-semibold transition-all flex items-center justify-center gap-2">
                  <Save className="h-4 w-4" /> Save Notes
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
