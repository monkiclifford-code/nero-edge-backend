import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate, useParams } from "react-router";
import { trpc } from "@/providers/trpc";
import { getPendingAnnotationImages } from "@/lib/annotationTransfer";
import AppLayout from "@/components/layout/AppLayout";
import {
  MousePointer, Pencil, Circle, Square, ArrowRight, Type,
  Hash, Undo2, Redo2, Save, ZoomIn, ZoomOut,
  MessageSquare, Eraser, X, Minus, Camera, Upload,
  RotateCcw, ChevronDown, Check, ChevronLeft, ChevronRight,
  AlertTriangle, BookOpen, Move
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

interface EditorImage {
  id?: number;
  imageData: string;
  annotations: Annotation[];
  source: "localStorage" | "database" | "upload";
}

const COLORS: Record<ColorKey, string> = {
  red: "#ef4444", yellow: "#eab308", green: "#22c55e",
  blue: "#3b82f6", white: "#ffffff", black: "#111111",
};
const STROKE_WIDTHS = [2, 4, 6, 8];

let _idCounter = 0;
const uid = () => `a_${++_idCounter}_${Date.now().toString(36)}`;
const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
const midPoint = (a: Point, b: Point): Point => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
function arrowHeadPoly(tip: Point, tail: Point, size: number): Point[] {
  const angle = Math.atan2(tip.y - tail.y, tip.x - tail.x);
  const perp = angle + Math.PI / 2;
  const base = { x: tip.x - size * 2 * Math.cos(angle), y: tip.y - size * 2 * Math.sin(angle) };
  return [tip, { x: base.x + size * Math.cos(perp), y: base.y + size * Math.sin(perp) }, { x: base.x - size * Math.cos(perp), y: base.y - size * Math.sin(perp) }];
}

// ─── Distance from point to line segment ───
function distToSegment(p: Point, a: Point, b: Point): number {
  const l2 = dist(a, b) ** 2;
  if (l2 === 0) return dist(p, a);
  let t = ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / l2;
  t = Math.max(0, Math.min(1, t));
  return dist(p, { x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) });
}

// ─── Hit test: which annotation is under point ───
// Threshold is in image coordinates; we scale it by zoom to ensure
// comfortable touch targets on mobile (~30-45 screen pixels).
function hitTest(ann: Annotation, pt: Point, zoom: number): boolean {
  const threshold = 45 / zoom;
  switch (ann.type) {
    case "arrow":
    case "line":
      if (ann.points.length < 2) return false;
      return distToSegment(pt, ann.points[0], ann.points[ann.points.length - 1]) < threshold;
    case "draw":
      return ann.points.some(p => dist(p, pt) < threshold);
    case "circle":
      if (ann.points.length < 2) return false;
      const r = dist(ann.points[0], ann.points[ann.points.length - 1]);
      const d = dist(pt, ann.points[0]);
      return d < r + threshold && d > Math.max(0, r - threshold);
    case "rect":
      if (ann.points.length < 2) return false;
      const minX = Math.min(ann.points[0].x, ann.points[ann.points.length - 1].x);
      const maxX = Math.max(ann.points[0].x, ann.points[ann.points.length - 1].x);
      const minY = Math.min(ann.points[0].y, ann.points[ann.points.length - 1].y);
      const maxY = Math.max(ann.points[0].y, ann.points[ann.points.length - 1].y);
      return pt.x >= minX - threshold && pt.x <= maxX + threshold && pt.y >= minY - threshold && pt.y <= maxY + threshold;
    case "text":
    case "callout":
      if (ann.points.length < 1) return false;
      return dist(pt, ann.points[0]) < threshold * 2.5;
    case "marker":
      if (ann.points.length < 1) return false;
      return dist(pt, ann.points[0]) < 55 / zoom;
    default:
      return false;
  }
}

// ─── Read stored context ───
function getStoredContext(jobId: string): any {
  const raw = localStorage.getItem(`cnc_setup_context_${jobId}`);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

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

  // ─── tRPC ───
  const setupQuery = trpc.setupSheet.getByJobId.useQuery(
    { jobId: numericJobId },
    { enabled: !isNaN(numericJobId) && numericJobId > 0 }
  );
  const saveMutation = trpc.setupSheet.save.useMutation({
    onSuccess: (data) => {
      setSaved(true); setSavedMsg(data.message);
      setTimeout(() => { setSaved(false); setSavedMsg(""); }, 3000);
      setupQuery.refetch();
    },
    onError: (err) => {
      setErrorMsg("Save failed: " + err.message);
      setTimeout(() => setErrorMsg(""), 5000);
    },
  });
  const jobQuery = trpc.job.getById.useQuery(
    { id: numericJobId },
    { enabled: !isNaN(numericJobId) && numericJobId > 0 }
  );

  // ─── Images state ───
  const [images, setImages] = useState<EditorImage[]>([]);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [initialLoadDone, setInitialLoadDone] = useState(false);

  // ═══════════════════════════════════════════════════════════
  // STEP 1: Read pending image index from localStorage (lightweight)
  // Also read transferred images from in-memory store (avoids localStorage quota)
  // ═══════════════════════════════════════════════════════════
  useEffect(() => {
    if (initialLoadDone) return;
    try {
      const pendingIndex = localStorage.getItem(`cnc_setup_annotations_${jobId}_pending_index`);
      if (pendingIndex) {
        setCurrentImageIndex(parseInt(pendingIndex, 10) || 0);
        localStorage.removeItem(`cnc_setup_annotations_${jobId}_pending_index`);
        localStorage.removeItem(`cnc_setup_annotations_${jobId}_pending_image`);
      }
    } catch (e) {
      console.warn("localStorage cleanup error:", e);
    }
    // Read images passed from SetupSheet via in-memory transfer
    const transferred = getPendingAnnotationImages();
    if (transferred.images && transferred.images.length > 0) {
      setImages(transferred.images.map(img => ({
        id: (img as any).id,
        imageData: img.imageData,
        annotations: (img.annotations || []).map((a: any) => ({
          id: uid(), type: a.type as ToolType, color: a.color,
          points: typeof a.points === "string" ? JSON.parse(a.points) : (a.points || []),
          text: a.text || undefined, number: a.number || undefined,
          strokeWidth: a.strokeWidth || undefined,
        })),
        source: img.source || "upload",
      })));
      setCurrentImageIndex(transferred.index);
    }
    setInitialLoadDone(true);
  }, [jobId, initialLoadDone]);

  // ═══════════════════════════════════════════════════════════
  // STEP 2: Merge DB data when it loads
  // ═══════════════════════════════════════════════════════════
  useEffect(() => {
    if (!setupQuery.data?.images?.length) return;
    setImages(prev => {
      const dbImages: EditorImage[] = setupQuery.data.images.map((dbImg: any) => {
        const existing = prev.find(p => p.imageData === dbImg.imageData);
        if (existing) {
          const dbAnns: Annotation[] = (dbImg.annotations || []).map((a: any) => ({
            id: uid(), type: a.type as ToolType, color: a.color,
            points: typeof a.points === "string" ? JSON.parse(a.points) : a.points,
            text: a.text || undefined, number: a.number || undefined,
            strokeWidth: a.strokeWidth || undefined,
          }));
          return {
            ...existing,
            id: dbImg.id,
            source: "database" as const,
            annotations: existing.annotations.length > 0 ? existing.annotations : dbAnns,
          };
        }
        return {
          id: dbImg.id,
          imageData: dbImg.imageData,
          annotations: (dbImg.annotations || []).map((a: any) => ({
            id: uid(), type: a.type as ToolType, color: a.color,
            points: typeof a.points === "string" ? JSON.parse(a.points) : a.points,
            text: a.text || undefined, number: a.number || undefined,
            strokeWidth: a.strokeWidth || undefined,
          })),
          source: "database",
        };
      });
      const localOnly = prev.filter(p => p.source === "localStorage" || p.source === "upload");
      return [...dbImages, ...localOnly];
    });
  }, [setupQuery.data]);

  // ═══════════════════════════════════════════════════════════
  // STEP 3: Load current image onto canvas
  // ═══════════════════════════════════════════════════════════
  const currentImg = images[currentImageIndex];
  useEffect(() => {
    if (currentImg?.imageData) {
      const img = new Image();
      img.onload = () => setImage(img);
      img.src = currentImg.imageData;
    } else { setImage(null); }
    const anns = currentImg?.annotations || [];
    setAnnotations(anns);
    setHistory(anns.length > 0 ? [[...anns]] : []);
    setHistoryIndex(anns.length > 0 ? 0 : -1);
    setMarkerCount(1); setZoom(1); setPan({ x: 0, y: 0 });
    setSelectedId(null); // clear selection on image change
  }, [currentImageIndex, currentImg?.imageData]);

  // ─── Drawing state ───
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [history, setHistory] = useState<Annotation[][]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [activeTool, setActiveTool] = useState<ToolType>("draw");
  const [activeColor, setActiveColor] = useState<ColorKey>("red");
  const [strokeWidth, setStrokeWidth] = useState(3);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentPoints, setCurrentPoints] = useState<Point[]>([]);

  // ─── Select + Drag state ───
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isDraggingAnn, setIsDraggingAnn] = useState(false);
  const dragStartPt = useRef<Point>({ x: 0, y: 0 });
  const dragStartAnns = useRef<Annotation[]>([]);
  const dragCurrentAnns = useRef<Annotation[]>([]); // tracks latest during drag

  const [calloutInput, setCalloutInput] = useState<{ x: number; y: number; visible: boolean } | null>(null);
  const [calloutText, setCalloutText] = useState("");
  const [textInput, setTextInput] = useState<{ x: number; y: number; visible: boolean } | null>(null);
  const [textValue, setTextValue] = useState("");

  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState<Point>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef<Point>({ x: 0, y: 0 });
  const [markerCount, setMarkerCount] = useState(1);
  const [saved, setSaved] = useState(false);
  const [savedMsg, setSavedMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showWidthPicker, setShowWidthPicker] = useState(false);
  const [setupNotes, setSetupNotes] = useState("");
  const [showNotesPanel, setShowNotesPanel] = useState(false);

  // ─── Canvas drawing ───
  useEffect(() => {
    if (!image || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const container = containerRef.current;
    if (container) { canvas.width = container.clientWidth; canvas.height = container.clientHeight; }
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(pan.x, pan.y); ctx.scale(zoom, zoom);
    const imgX = (canvas.width / zoom - image.width) / 2;
    const imgY = (canvas.height / zoom - image.height) / 2;
    ctx.drawImage(image, imgX, imgY);
    annotations.forEach((ann) => drawAnnotation(ctx, ann, imgX, imgY, ann.id === selectedId, canvas.width, canvas.height));
    if (isDrawing && currentPoints.length > 0) {
      const tempAnn: Annotation = { id: "temp", type: activeTool, color: COLORS[activeColor], points: currentPoints, strokeWidth, text: activeTool === "callout" ? calloutText : undefined };
      drawAnnotation(ctx, tempAnn, imgX, imgY, false, canvas.width, canvas.height);
    }
    ctx.restore();
  }, [image, annotations, isDrawing, currentPoints, zoom, pan, activeColor, activeTool, strokeWidth, calloutText, selectedId]);

  const drawAnnotation = (ctx: CanvasRenderingContext2D, ann: Annotation, imgX: number, imgY: number, isSelected: boolean, canvasW: number, canvasH: number) => {
    ctx.strokeStyle = ann.color; ctx.fillStyle = ann.color;
    ctx.lineWidth = ann.strokeWidth || 3; ctx.lineCap = "round"; ctx.lineJoin = "round";
    const pts = ann.points.map(p => ({ x: p.x + imgX, y: p.y + imgY }));

    // Selection highlight
    if (isSelected) {
      ctx.save();
      ctx.strokeStyle = "#f5a623";
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      switch (ann.type) {
        case "arrow":
        case "line":
          if (pts.length >= 2) {
            ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y); ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y); ctx.stroke();
          }
          break;
        case "circle":
          if (pts.length >= 2) {
            const r = dist(pts[0], pts[pts.length - 1]);
            ctx.beginPath(); ctx.arc(pts[0].x, pts[0].y, r + 4, 0, Math.PI * 2); ctx.stroke();
          }
          break;
        case "rect":
          if (pts.length >= 2) {
            ctx.strokeRect(Math.min(pts[0].x, pts[pts.length - 1].x) - 4, Math.min(pts[0].y, pts[pts.length - 1].y) - 4, Math.abs(pts[pts.length - 1].x - pts[0].x) + 8, Math.abs(pts[pts.length - 1].y - pts[0].y) + 8);
          }
          break;
        case "text":
        case "callout":
        case "marker":
          if (pts.length >= 1) {
            ctx.beginPath(); ctx.arc(pts[0].x, pts[0].y, 22, 0, Math.PI * 2); ctx.stroke();
          }
          break;
        case "draw":
          if (pts.length > 0) {
            ctx.beginPath(); ctx.arc(pts[0].x, pts[0].y, 8, 0, Math.PI * 2); ctx.stroke();
            ctx.beginPath(); ctx.arc(pts[pts.length - 1].x, pts[pts.length - 1].y, 8, 0, Math.PI * 2); ctx.stroke();
          }
          break;
      }
      ctx.restore();
    }

    switch (ann.type) {
      case "draw": if (pts.length < 2) return; ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y); for (let i = 1; i < pts.length; i++) { const mid = midPoint(pts[i - 1], pts[i]); ctx.quadraticCurveTo(pts[i - 1].x, pts[i - 1].y, mid.x, mid.y); } ctx.stroke(); break;
      case "line": if (pts.length < 2) return; ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y); ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y); ctx.stroke(); break;
      case "arrow": if (pts.length < 2) return; ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y); ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y); ctx.stroke(); const hs = Math.max(8, (ann.strokeWidth || 3) * 3); const hd = arrowHeadPoly(pts[pts.length - 1], pts[0], hs); ctx.beginPath(); ctx.moveTo(hd[0].x, hd[0].y); ctx.lineTo(hd[1].x, hd[1].y); ctx.lineTo(hd[2].x, hd[2].y); ctx.closePath(); ctx.fill(); break;
      case "circle": if (pts.length < 2) return; const r = dist(pts[0], pts[pts.length - 1]); ctx.beginPath(); ctx.arc(pts[0].x, pts[0].y, r, 0, Math.PI * 2); ctx.stroke(); break;
      case "rect": if (pts.length < 2) return; ctx.strokeRect(Math.min(pts[0].x, pts[pts.length - 1].x), Math.min(pts[0].y, pts[pts.length - 1].y), Math.abs(pts[pts.length - 1].x - pts[0].x), Math.abs(pts[pts.length - 1].y - pts[0].y)); break;
      case "text": if (pts.length < 1 || !ann.text) return; ctx.font = `bold ${14 / zoom}px system-ui, sans-serif`; ctx.fillStyle = ann.color; ctx.fillText(ann.text, pts[0].x, pts[0].y); break;
      case "marker": if (pts.length < 1) return; const n = ann.number || 1; const mr = 14; ctx.beginPath(); ctx.arc(pts[0].x, pts[0].y, mr, 0, Math.PI * 2); ctx.fillStyle = ann.color; ctx.fill(); ctx.strokeStyle = "#fff"; ctx.lineWidth = 2; ctx.stroke(); ctx.fillStyle = "#fff"; ctx.font = `bold ${13 / zoom}px system-ui, sans-serif`; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(String(n), pts[0].x, pts[0].y); break;
      case "callout": if (pts.length < 1 || !ann.text) return; drawCallout(ctx, pts[0], ann.text, ann.color, canvasW, canvasH); break;
    }
  };

  // ─── Multi-line callout with text wrapping ───
  // NOTE: `point` is already in CANVAS coordinates (drawAnnotation adds imgOffset).
  // Do NOT add imgOffset again or the callout will render at the wrong position.
  const drawCallout = (ctx: CanvasRenderingContext2D, point: Point, text: string, color: string, canvasW: number, canvasH: number) => {
    const padding = 8, cr = 6, lineHeight = 18, maxWidth = 180;
    ctx.font = `bold ${13 / zoom}px system-ui, sans-serif`;

    // Wrap text into lines
    const words = text.split(/\s+/);
    const lines: string[] = [];
    let currentLine = "";
    for (const word of words) {
      const test = currentLine ? currentLine + " " + word : word;
      if (ctx.measureText(test).width > maxWidth && currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = test;
      }
    }
    if (currentLine) lines.push(currentLine);
    if (lines.length === 0) lines.push(text);

    const maxLineWidth = Math.max(...lines.map(l => ctx.measureText(l).width));
    const bw = Math.max(maxLineWidth + padding * 2, 80);
    const bh = Math.max(lines.length * lineHeight + padding * 2, 30);

    // Position callout box near the anchor point, but keep it on-screen
    let bx = point.x + 20, by = point.y - bh - 20;
    // Flip below anchor if it would go above the top
    if (by < 10) by = point.y + 20;
    // Keep within canvas right edge
    if (bx + bw > canvasW - 10) bx = Math.max(10, point.x - bw - 20);
    // Keep within canvas left edge
    if (bx < 10) bx = point.x + 20;

    // Leader line from anchor to box center
    ctx.beginPath(); ctx.moveTo(point.x, point.y); ctx.lineTo(bx + bw / 2, by + bh / 2);
    ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.stroke();
    ctx.beginPath(); ctx.arc(point.x, point.y, 4, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill();

    // Box
    ctx.fillStyle = "rgba(20,20,30,0.9)"; ctx.strokeStyle = color; ctx.lineWidth = 2;
    roundRect(ctx, bx, by, bw, bh, cr); ctx.fill(); ctx.stroke();

    // Text lines
    ctx.fillStyle = "#fff"; ctx.textAlign = "left"; ctx.textBaseline = "top";
    lines.forEach((line, i) => {
      ctx.fillText(line, bx + padding, by + padding + i * lineHeight);
    });
  };

  const roundRect = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
  };

  const getCanvasPoint = (e: React.MouseEvent | React.TouchEvent): Point | null => {
    const canvas = canvasRef.current; if (!canvas) return null;
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
  const toImageCoords = (pt: Point): Point => { const o = getImageOffset(); return { x: pt.x - o.x, y: pt.y - o.y }; };
  const fromImageCoords = (pt: Point): Point => { const o = getImageOffset(); return { x: pt.x + o.x, y: pt.y + o.y }; };

  // ─── Pointer handlers with SELECT + DRAG support ───
  // Helper: get clientX/Y from mouse or touch event
  const getClientXY = (e: React.MouseEvent | React.TouchEvent) => {
    if ("touches" in e) {
      const t = e.touches[0] || e.changedTouches[0];
      return { x: t.clientX, y: t.clientY };
    }
    return { x: e.clientX, y: e.clientY };
  };

  const handlePointerDown = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const pt = getCanvasPoint(e); if (!pt) return;

    // Eraser tool
    if (activeTool === "eraser") { eraseAt(e); return; }

    // Select tool: check if clicking on an annotation to drag it
    if (activeTool === "select") {
      const imgPt = toImageCoords(pt);
      // Search in reverse (topmost first)
      for (let i = annotations.length - 1; i >= 0; i--) {
        if (hitTest(annotations[i], imgPt, zoom)) {
          setSelectedId(annotations[i].id);
          setIsDraggingAnn(true);
          dragStartPt.current = imgPt;
          dragStartAnns.current = JSON.parse(JSON.stringify(annotations));
          dragCurrentAnns.current = JSON.parse(JSON.stringify(annotations));
          return;
        }
      }
      // Clicked empty space: deselect and start pan
      setSelectedId(null);
      setIsPanning(true);
      const c = getClientXY(e);
      panStart.current = { x: c.x - pan.x, y: c.y - pan.y };
      return;
    }

    // All other tools: start drawing
    setIsDrawing(true); setCurrentPoints([toImageCoords(pt)]);
  };

  const handlePointerMove = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const pt = getCanvasPoint(e); if (!pt) return;

    if (isPanning) {
      const c = getClientXY(e);
      setPan({ x: c.x - panStart.current.x, y: c.y - panStart.current.y });
      return;
    }

    if (isDraggingAnn && selectedId) {
      const imgPt = toImageCoords(pt);
      const dx = imgPt.x - dragStartPt.current.x;
      const dy = imgPt.y - dragStartPt.current.y;
      const newAnns = dragStartAnns.current.map(ann => {
        if (ann.id !== selectedId) return ann;
        return { ...ann, points: ann.points.map(p => ({ x: p.x + dx, y: p.y + dy })) };
      });
      setAnnotations(newAnns);
      dragCurrentAnns.current = newAnns;
      return;
    }

    if (!isDrawing) return;
    setCurrentPoints(prev => [...prev, toImageCoords(pt)]);
  };

  const handlePointerUp = () => {
    if (isPanning) { setIsPanning(false); return; }
    if (isDraggingAnn) {
      setIsDraggingAnn(false);
      const finalAnns = dragCurrentAnns.current.length > 0 ? dragCurrentAnns.current : annotations;
      pushHistory(finalAnns);
      setAnnotations(finalAnns);
      setImages(prev => prev.map((img, i) => i === currentImageIndex ? { ...img, annotations: finalAnns } : img));
      dragCurrentAnns.current = [];
      return;
    }
    if (!isDrawing) return;
    setIsDrawing(false);
    if (currentPoints.length === 0) return;

    if (activeTool === "callout") {
      const lp = currentPoints[currentPoints.length - 1]; const o = getImageOffset();
      setCalloutInput({ x: (lp.x + o.x) * zoom + pan.x, y: (lp.y + o.y) * zoom + pan.y - 40, visible: true });
      setCalloutText(""); setCurrentPoints([]); return;
    }
    if (activeTool === "text") {
      const lp = currentPoints[currentPoints.length - 1]; const o = getImageOffset();
      setTextInput({ x: (lp.x + o.x) * zoom + pan.x, y: (lp.y + o.y) * zoom + pan.y, visible: true });
      setTextValue(""); setCurrentPoints([]); return;
    }
    const newAnn: Annotation = { id: uid(), type: activeTool, color: COLORS[activeColor], points: [...currentPoints], strokeWidth, ...(activeTool === "marker" ? { number: markerCount } : {}) };
    if (activeTool === "marker") setMarkerCount(c => c + 1);
    const newAnns = [...annotations, newAnn];
    setAnnotations(newAnns); pushHistory(newAnns);
    setImages(prev => prev.map((img, i) => i === currentImageIndex ? { ...img, annotations: newAnns } : img));
    setCurrentPoints([]);
  };

  const pushHistory = (anns: Annotation[]) => {
    const nh = history.slice(0, historyIndex + 1);
    nh.push([...anns]);
    if (nh.length > 50) nh.shift();
    setHistory(nh); setHistoryIndex(nh.length - 1);
  };
  const undo = () => { if (historyIndex <= 0) return; const ni = historyIndex - 1; setHistoryIndex(ni); const anns = [...history[ni]]; setAnnotations(anns); setImages(prev => prev.map((img, i) => i === currentImageIndex ? { ...img, annotations: anns } : img)); setSelectedId(null); };
  const redo = () => { if (historyIndex >= history.length - 1) return; const ni = historyIndex + 1; setHistoryIndex(ni); const anns = [...history[ni]]; setAnnotations(anns); setImages(prev => prev.map((img, i) => i === currentImageIndex ? { ...img, annotations: anns } : img)); setSelectedId(null); };

  const saveCallout = () => {
    if (!calloutInput || !calloutText.trim()) { setCalloutInput(null); return; }
    const o = getImageOffset();
    const newAnn: Annotation = { id: uid(), type: "callout", color: COLORS[activeColor], points: [{ x: (calloutInput.x - pan.x) / zoom - o.x, y: (calloutInput.y - pan.y + 40) / zoom - o.y }], text: calloutText.trim(), strokeWidth };
    const newAnns = [...annotations, newAnn]; setAnnotations(newAnns); pushHistory(newAnns);
    setImages(prev => prev.map((img, i) => i === currentImageIndex ? { ...img, annotations: newAnns } : img));
    setCalloutInput(null); setCalloutText("");
  };
  const saveText = () => {
    if (!textInput || !textValue.trim()) { setTextInput(null); return; }
    const o = getImageOffset();
    const newAnn: Annotation = { id: uid(), type: "text", color: COLORS[activeColor], points: [{ x: (textInput.x - pan.x) / zoom - o.x, y: (textInput.y - pan.y) / zoom - o.y }], text: textValue.trim(), strokeWidth };
    const newAnns = [...annotations, newAnn]; setAnnotations(newAnns); pushHistory(newAnns);
    setImages(prev => prev.map((img, i) => i === currentImageIndex ? { ...img, annotations: newAnns } : img));
    setTextInput(null); setTextValue("");
  };

  // ═══════════════════════════════════════════════════════════
  // SAVE
  // ═══════════════════════════════════════════════════════════
  const saveSetup = () => {
    if (!operator || !jobQuery.data) {
      setErrorMsg("Missing operator or job data. Please go back and try again.");
      return;
    }
    const dbData = setupQuery.data;
    const ctx = getStoredContext(jobId || "");
    const workholding = dbData?.workholding?.length
      ? dbData.workholding.map((w: any) => ({ label: w.label, value: w.value || "", displayOrder: w.displayOrder || 0 }))
      : ctx?.workholding || [];
    const tools = dbData?.tools?.length
      ? dbData.tools.map((t: any) => ({ toolNumber: t.toolNumber, description: t.description || undefined, toolId: t.toolId || undefined, offset: t.offset || undefined, displayOrder: t.displayOrder || 0 }))
      : ctx?.tools || [];
    const programNotes = dbData?.programNotes || ctx?.programNotes || undefined;
    const generalNotes = setupNotes || dbData?.generalNotes || ctx?.generalNotes || undefined;
    saveMutation.mutate({
      jobId: numericJobId,
      partNumber: jobQuery.data.partNumber,
      revision: jobQuery.data.revision,
      materialNumber: jobQuery.data.materialNumber,
      operatorId: operator.id,
      operatorName: operator.name,
      programNotes,
      generalNotes,
      workholding,
      tools,
      images: images.map((img, i) => ({
        imageData: img.imageData,
        displayOrder: i,
        annotations: img.annotations.map(a => ({
          type: a.type,
          color: a.color,
          points: a.points.map(p => ({ x: Number(p.x), y: Number(p.y) })),
          text: a.text || undefined,
          number: a.number ?? null,
          strokeWidth: a.strokeWidth ?? null,
        })),
      })),
      changeSummary: dbData ? `Annotations updated (v${dbData.version + 1})` : `Initial setup with annotations`,
    });
  };

  // ─── Add new image ───
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setImages(prev => [...prev, { imageData: ev.target?.result as string, annotations: [], source: "upload" }]);
      setCurrentImageIndex(images.length);
    };
    reader.readAsDataURL(file);
  };

  // ─── Camera ───
  const [cameraActive, setCameraActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasCapRef = useRef<HTMLCanvasElement>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const [showCameraModal, setShowCameraModal] = useState(false);

  const startCamera = async () => {
    try { const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } }); cameraStreamRef.current = stream; setCameraActive(true); }
    catch { alert("Camera access denied. Try uploading instead."); }
  };
  useEffect(() => { if (cameraActive && videoRef.current && cameraStreamRef.current) { videoRef.current.srcObject = cameraStreamRef.current; videoRef.current.play().catch(() => {}); } }, [cameraActive]);
  const stopCamera = () => { if (cameraStreamRef.current) { cameraStreamRef.current.getTracks().forEach(t => t.stop()); cameraStreamRef.current = null; } if (videoRef.current) videoRef.current.srcObject = null; setCameraActive(false); };
  const capturePhoto = () => {
    if (!videoRef.current || !canvasCapRef.current) return;
    const v = videoRef.current, c = canvasCapRef.current;
    c.width = v.videoWidth; c.height = v.videoHeight;
    const ctx = c.getContext("2d"); if (!ctx) return;
    ctx.drawImage(v, 0, 0);
    const dataUrl = c.toDataURL("image/jpeg", 0.9);
    setImages(prev => [...prev, { imageData: dataUrl, annotations: [], source: "upload" }]);
    setCurrentImageIndex(images.length);
    stopCamera(); setShowCameraModal(false);
  };

  const zoomIn = () => setZoom(z => Math.min(z * 1.2, 5));
  const zoomOut = () => setZoom(z => Math.max(z / 1.2, 0.3));
  const resetView = () => { setZoom(1); setPan({ x: 0, y: 0 }); };

  const eraseAt = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    const pt = getCanvasPoint(e); if (!pt) return;
    const imgPt = toImageCoords(pt);
    const newAnns = annotations.filter(ann => !ann.points.some(p => dist(p, imgPt) < 20));
    if (newAnns.length < annotations.length) { setAnnotations(newAnns); pushHistory(newAnns); setImages(prev => prev.map((img, i) => i === currentImageIndex ? { ...img, annotations: newAnns } : img)); setSelectedId(null); }
  }, [annotations, zoom, pan, currentImageIndex]);

  const tools: { type: ToolType; icon: React.ReactNode; label: string }[] = [
    { type: "select", icon: <Move className="h-4 w-4" />, label: "Select/Move" },
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
      subtitle={images.length > 0 ? `Image ${currentImageIndex + 1} of ${images.length} | ${annotations.length} annotations` : "Upload an image to begin"}
      showBack
      onBack={() => navigate(`/setup-sheet/${jobId}`)}
      action={
        <div className="flex gap-2">
          {saved && (
            <span className="text-xs text-emerald-400 flex items-center gap-1 mr-2">
              <Check className="h-3.5 w-3.5" /> {savedMsg || "Saved"}
            </span>
          )}
          <button className="forge-btn-secondary flex items-center gap-2" onClick={resetView}>
            <RotateCcw className="h-4 w-4" /> Reset
          </button>
          <button className="forge-btn-secondary flex items-center gap-2" onClick={() => setShowNotesPanel(!showNotesPanel)}>
            <MessageSquare className="h-4 w-4" /> Notes
          </button>
          <button className="forge-btn-primary flex items-center gap-2" onClick={saveSetup} disabled={saveMutation.isPending || images.length === 0 || !operator}>
            {saveMutation.isPending ? <RotateCcw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saveMutation.isPending ? "Saving..." : "Save"}
          </button>
        </div>
      }
    >
      <div className="flex flex-col -m-5" style={{ height: 'calc(100vh - 56px)' }}>

        {/* Error message */}
        {errorMsg && (
          <div className="px-3 py-2 border-b border-rose-500/20 bg-rose-950/30 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-rose-400 flex-shrink-0" />
            <span className="text-xs text-rose-300">{errorMsg}</span>
            <button onClick={() => setErrorMsg("")} className="ml-auto text-white/30 hover:text-white/60"><X className="h-3.5 w-3.5" /></button>
          </div>
        )}

        {/* ═══ IMAGE NAVIGATION BAR ═══ */}
        {images.length > 0 && (
          <div className="flex items-center gap-2 px-3 py-1.5 border-b border-[hsl(220,14%,16%)] bg-[hsl(220,14%,8%)]">
            <button onClick={() => setCurrentImageIndex(i => Math.max(0, i - 1))} disabled={currentImageIndex === 0}
              className="h-7 w-7 rounded-md flex items-center justify-center text-white/50 hover:text-white/80 hover:bg-white/5 disabled:opacity-20 transition-all">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <div className="flex-1 flex gap-1 overflow-x-auto">
              {images.map((img, idx) => (
                <button key={idx} onClick={() => setCurrentImageIndex(idx)}
                  className={`h-10 w-10 rounded-md overflow-hidden border-2 transition-all flex-shrink-0 ${idx === currentImageIndex ? "border-orange-500" : "border-transparent hover:border-white/20"}`}>
                  <img src={img.imageData} alt={`#${idx + 1}`} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
            <button onClick={() => setCurrentImageIndex(i => Math.min(images.length - 1, i + 1))} disabled={currentImageIndex === images.length - 1}
              className="h-7 w-7 rounded-md flex items-center justify-center text-white/50 hover:text-white/80 hover:bg-white/5 disabled:opacity-20 transition-all">
              <ChevronRight className="h-4 w-4" />
            </button>
            <div className="w-px h-6 bg-white/10 mx-1" />
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
            <button onClick={() => fileInputRef.current?.click()} className="h-7 px-2 rounded-md text-xs text-white/50 hover:text-white/80 hover:bg-white/5 transition-all flex items-center gap-1">
              <Upload className="h-3.5 w-3.5" /> Upload
            </button>
            <button onClick={() => { setShowCameraModal(true); startCamera(); }} className="h-7 px-2 rounded-md text-xs text-white/50 hover:text-white/80 hover:bg-white/5 transition-all flex items-center gap-1">
              <Camera className="h-3.5 w-3.5" /> Camera
            </button>
          </div>
        )}

        {/* ═══ TOOLBAR ═══ */}
        <div className="flex flex-wrap items-center gap-1 px-3 py-2 border-b border-[hsl(220,14%,16%)] bg-[hsl(220,14%,10%)] flex-shrink-0">
          {tools.map(t => (
            <button key={t.type} onClick={() => { setActiveTool(t.type); if (t.type !== "select") setSelectedId(null); }} title={t.label}
              className={`h-8 w-8 sm:h-9 sm:w-9 rounded-md flex items-center justify-center transition-all flex-shrink-0 ${activeTool === t.type ? "bg-orange-500/25 text-orange-400 border border-orange-500/50 shadow-sm shadow-orange-500/10" : "text-white/60 hover:text-white/90 hover:bg-white/10 border border-transparent"}`}>
              {t.icon}
            </button>
          ))}
          <div className="w-px h-5 sm:h-6 bg-white/10 mx-1 flex-shrink-0" />
          {/* Color picker */}
          <div className="relative flex-shrink-0">
            <button onClick={() => { setShowColorPicker(!showColorPicker); setShowWidthPicker(false); }}
              className="h-8 sm:h-9 px-2 rounded-md flex items-center gap-1.5 text-white/50 hover:text-white/80 hover:bg-white/5 border border-transparent transition-all">
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
          {/* Width picker */}
          <div className="relative flex-shrink-0">
            <button onClick={() => { setShowWidthPicker(!showWidthPicker); setShowColorPicker(false); }}
              className="h-8 sm:h-9 px-2 rounded-md flex items-center gap-1.5 text-white/50 hover:text-white/80 hover:bg-white/5 border border-transparent transition-all">
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
          <div className="w-px h-5 sm:h-6 bg-white/10 mx-1 flex-shrink-0" />
          {/* Undo / Redo */}
          <button onClick={undo} disabled={historyIndex <= 0} className="h-8 w-8 sm:h-9 sm:w-9 rounded-md flex items-center justify-center text-white/50 hover:text-white/80 hover:bg-white/5 disabled:opacity-20 transition-all flex-shrink-0" title="Undo">
            <Undo2 className="h-4 w-4" />
          </button>
          <button onClick={redo} disabled={historyIndex >= history.length - 1} className="h-8 w-8 sm:h-9 sm:w-9 rounded-md flex items-center justify-center text-white/50 hover:text-white/80 hover:bg-white/5 disabled:opacity-20 transition-all flex-shrink-0" title="Redo">
            <Redo2 className="h-4 w-4" />
          </button>
          <div className="w-px h-5 sm:h-6 bg-white/10 mx-1 flex-shrink-0" />
          {/* Zoom */}
          <button onClick={zoomOut} className="h-8 w-8 sm:h-9 sm:w-9 rounded-md flex items-center justify-center text-white/50 hover:text-white/80 hover:bg-white/5 transition-all flex-shrink-0" title="Zoom Out">
            <ZoomOut className="h-4 w-4" />
          </button>
          <span className="text-xs text-white/40 font-mono w-10 sm:w-12 text-center flex-shrink-0">{Math.round(zoom * 100)}%</span>
          <button onClick={zoomIn} className="h-8 w-8 sm:h-9 sm:w-9 rounded-md flex items-center justify-center text-white/50 hover:text-white/80 hover:bg-white/5 transition-all flex-shrink-0" title="Zoom In">
            <ZoomIn className="h-4 w-4" />
          </button>
        </div>

        {/* ═══ CANVAS + NOTES PANEL ═══ */}
        <div className="flex flex-1 overflow-hidden">
          <div ref={containerRef} className="relative bg-[hsl(220,14%,6%)] overflow-hidden flex-1">

            {/* Empty state */}
            {!image && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
                <div className="w-20 h-20 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
                  <BookOpen className="h-10 w-10 text-white/20" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-semibold text-white/40">No image loaded</p>
                  <p className="text-xs text-white/20 mt-1">Upload or take a photo to start annotating</p>
                </div>
                <div className="flex gap-3">
                  <button onClick={() => fileInputRef.current?.click()} className="forge-btn-primary flex items-center gap-2">
                    <Upload className="h-4 w-4" /> Upload Image
                  </button>
                  <button onClick={() => { setShowCameraModal(true); startCamera(); }} className="forge-btn-secondary flex items-center gap-2">
                    <Camera className="h-4 w-4" /> Take Photo
                  </button>
                </div>
              </div>
            )}

            <canvas ref={canvasRef} className="absolute inset-0 w-full h-full cursor-crosshair touch-none"
              onMouseDown={activeTool === "eraser" ? eraseAt : handlePointerDown}
              onMouseMove={handlePointerMove} onMouseUp={handlePointerUp} onMouseLeave={handlePointerUp}
              onTouchStart={handlePointerDown} onTouchMove={handlePointerMove} onTouchEnd={handlePointerUp}
              style={{ cursor: activeTool === "select" ? (isDraggingAnn ? "grabbing" : "grab") : activeTool === "eraser" ? "not-allowed" : "crosshair" }}
            />

            {/* ═══ CALLOUT INPUT (multi-line textarea) ═══ */}
            {calloutInput?.visible && (
              <div className="absolute z-50 flex flex-col gap-1" style={{ left: calloutInput.x, top: calloutInput.y }}>
                <div className="bg-[hsl(220,14%,10%)] border border-orange-500/40 rounded-lg shadow-xl p-2 flex flex-col gap-1.5 min-w-[240px]">
                  <p className="text-[10px] font-semibold text-orange-400 uppercase tracking-wider">Add Callout</p>
                  <textarea
                    value={calloutText}
                    onChange={e => setCalloutText(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter" && e.ctrlKey) saveCallout(); if (e.key === "Escape") setCalloutInput(null); }}
                    placeholder="Type callout text...&#10;Ctrl+Enter to add"
                    rows={3}
                    className="w-full px-2 py-1.5 rounded border border-[hsl(220,14%,22%)] bg-[hsl(220,14%,16%)] text-sm text-white placeholder:text-white/30 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-orange-500/40 resize-none"
                    autoFocus
                  />
                  <div className="flex gap-1">
                    <button onClick={saveCallout} className="flex-1 h-7 text-xs font-semibold bg-orange-500/20 hover:bg-orange-500/30 text-orange-400 rounded transition-all">Add (Ctrl+Enter)</button>
                    <button onClick={() => setCalloutInput(null)} className="h-7 px-2 text-xs text-white/40 hover:text-white/60 transition-all">Cancel</button>
                  </div>
                </div>
              </div>
            )}

            {/* ═══ TEXT INPUT ═══ */}
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

            {/* Bottom tool indicator */}
            <div className="absolute bottom-3 left-3 bg-black/60 backdrop-blur-sm rounded-md px-2.5 py-1 flex items-center gap-2">
              <span className="text-[10px] text-white/40 uppercase tracking-wider">Tool:</span>
              <span className="text-xs font-semibold text-orange-400 capitalize">
                {activeTool === "select" ? (selectedId ? "Move" : "Select") : activeTool === "callout" ? "Callout" : activeTool}
              </span>
              {selectedId && <span className="text-[10px] text-white/30">| Drag to move</span>}
            </div>

            {/* Selection help tooltip */}
            {activeTool === "select" && !selectedId && annotations.length > 0 && (
              <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-black/60 backdrop-blur-sm rounded-md px-3 py-1">
                <span className="text-[10px] text-white/50">Tap an annotation to select, then drag to move</span>
              </div>
            )}
          </div>

          {showNotesPanel && (
            <div className="w-80 border-l border-[hsl(220,14%,16%)] bg-[hsl(220,14%,10%)] flex flex-col">
              <div className="px-4 py-3 border-b border-[hsl(220,14%,16%)] flex items-center justify-between">
                <h3 className="text-sm font-bold text-white/80 flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-orange-400" /> Notes
                </h3>
                <button onClick={() => setShowNotesPanel(false)} className="h-7 w-7 rounded-lg hover:bg-white/5 flex items-center justify-center text-white/40 hover:text-white/60 transition-all">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="flex-1 p-4">
                <textarea value={setupNotes} onChange={e => setSetupNotes(e.target.value)}
                  placeholder="Add setup notes..."
                  className="w-full h-full resize-none rounded-lg border border-[hsl(220,14%,22%)] bg-[hsl(220,14%,14%)] text-sm text-white placeholder:text-white/30 p-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/40" />
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

      {/* Camera Modal */}
      {showCameraModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm" onClick={() => { stopCamera(); setShowCameraModal(false); }}>
          <div className="bg-[hsl(220,14%,10%)] border border-[hsl(220,14%,20%)] rounded-xl shadow-2xl max-w-2xl w-full mx-4 overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-[hsl(220,14%,16%)]">
              <h3 className="text-sm font-semibold text-white/80">Take Photo</h3>
              <button onClick={() => { stopCamera(); setShowCameraModal(false); }} className="h-8 w-8 rounded-lg flex items-center justify-center text-white/40 hover:text-white/80 hover:bg-white/5 transition-all">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="relative bg-black">
              <video ref={videoRef} className="w-full aspect-video object-cover" autoPlay playsInline muted />
              <canvas ref={canvasCapRef} className="hidden" />
            </div>
            <div className="px-4 py-3 flex justify-center">
              <button onClick={capturePhoto} className="h-14 w-14 rounded-full bg-orange-500 hover:bg-orange-400 flex items-center justify-center shadow-lg transition-all">
                <div className="h-10 w-10 rounded-full border-2 border-white" />
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
