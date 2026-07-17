import { useEffect, useRef } from "react";

interface Point { x: number; y: number; }
interface Gear { x: number; y: number; radius: number; teeth: number; speed: number; angle: number; color: string; }
interface Particle { x: number; y: number; vx: number; vy: number; life: number; maxLife: number; size: number; color: string; }
interface Line { x1: number; y1: number; x2: number; y2: number; alpha: number; speed: number; }

export default function ManufacturingBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let w = 0, h = 0;
    const resize = () => {
      const rect = canvas.parentElement?.getBoundingClientRect();
      w = rect?.width || window.innerWidth;
      h = rect?.height || window.innerHeight;
      canvas.width = w;
      canvas.height = h;
    };
    resize();
    window.addEventListener("resize", resize);

    // Gears
    const gears: Gear[] = [
      { x: 0.15, y: 0.25, radius: 60, teeth: 12, speed: 0.008, angle: 0, color: "rgba(249, 115, 22, 0.15)" },
      { x: 0.28, y: 0.18, radius: 40, teeth: 8, speed: -0.012, angle: 0, color: "rgba(59, 130, 246, 0.12)" },
      { x: 0.08, y: 0.55, radius: 50, teeth: 10, speed: 0.01, angle: 0, color: "rgba(34, 197, 94, 0.1)" },
      { x: 0.22, y: 0.65, radius: 35, teeth: 7, speed: -0.015, angle: 0, color: "rgba(249, 115, 22, 0.1)" },
      { x: 0.35, y: 0.45, radius: 45, teeth: 9, speed: 0.009, angle: 0, color: "rgba(59, 130, 246, 0.1)" },
      { x: 0.12, y: 0.82, radius: 55, teeth: 11, speed: -0.007, angle: 0, color: "rgba(234, 179, 8, 0.08)" },
      { x: 0.3, y: 0.85, radius: 30, teeth: 6, speed: 0.018, angle: 0, color: "rgba(249, 115, 22, 0.12)" },
    ];

    // Particles (sparks)
    const particles: Particle[] = [];
    const spawnParticle = () => {
      if (particles.length > 80) return;
      const angle = Math.random() * Math.PI * 2;
      const speed = 0.3 + Math.random() * 1.2;
      const colors = ["rgba(249, 115, 22, ", "rgba(255, 200, 50, ", "rgba(200, 200, 200, ", "rgba(59, 130, 246, "];
      particles.push({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0,
        maxLife: 60 + Math.random() * 120,
        size: 1 + Math.random() * 2.5,
        color: colors[Math.floor(Math.random() * colors.length)],
      });
    };

    // Measurement lines
    const lines: Line[] = [];
    for (let i = 0; i < 15; i++) {
      lines.push({
        x1: Math.random(), y1: Math.random(),
        x2: Math.random(), y2: Math.random(),
        alpha: 0.05 + Math.random() * 0.15,
        speed: 0.2 + Math.random() * 0.5,
      });
    }

    const drawGear = (g: Gear) => {
      const cx = g.x * w, cy = g.y * h;
      const innerR = g.radius * 0.7;
      const outerR = g.radius;
      const toothDepth = g.radius * 0.15;

      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(g.angle);

      // Draw teeth
      ctx.beginPath();
      for (let i = 0; i < g.teeth * 2; i++) {
        const angle = (i / (g.teeth * 2)) * Math.PI * 2;
        const nextAngle = ((i + 1) / (g.teeth * 2)) * Math.PI * 2;
        const r = i % 2 === 0 ? outerR : innerR;
        const nextR = i % 2 === 0 ? innerR : outerR;
        if (i === 0) ctx.moveTo(Math.cos(angle) * r, Math.sin(angle) * r);
        ctx.lineTo(Math.cos(angle + (nextAngle - angle) * 0.3) * (r + (nextR - r) * 0.3), Math.sin(angle + (nextAngle - angle) * 0.3) * (r + (nextR - r) * 0.3));
        ctx.lineTo(Math.cos(nextAngle) * nextR, Math.sin(nextAngle) * nextR);
      }
      ctx.closePath();
      ctx.fillStyle = g.color;
      ctx.fill();
      ctx.strokeStyle = g.color.replace(/[\d.]+\)$/, "0.3)");
      ctx.lineWidth = 1;
      ctx.stroke();

      // Inner circle
      ctx.beginPath();
      ctx.arc(0, 0, innerR * 0.4, 0, Math.PI * 2);
      ctx.strokeStyle = g.color.replace(/[\d.]+\)$/, "0.25)");
      ctx.lineWidth = 2;
      ctx.stroke();

      // Center hole
      ctx.beginPath();
      ctx.arc(0, 0, innerR * 0.15, 0, Math.PI * 2);
      ctx.fillStyle = g.color.replace(/[\d.]+\)$/, "0.2)");
      ctx.fill();

      // Spokes
      for (let i = 0; i < 4; i++) {
        const spokeAngle = (i / 4) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(Math.cos(spokeAngle) * innerR * 0.15, Math.sin(spokeAngle) * innerR * 0.15);
        ctx.lineTo(Math.cos(spokeAngle) * innerR * 0.75, Math.sin(spokeAngle) * innerR * 0.75);
        ctx.strokeStyle = g.color.replace(/[\d.]+\)$/, "0.2)");
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      ctx.restore();
    };

    const drawGrid = () => {
      const spacing = 50;
      ctx.strokeStyle = "rgba(100, 116, 139, 0.06)";
      ctx.lineWidth = 1;

      // Vertical lines
      for (let x = 0; x < w; x += spacing) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
      // Horizontal lines
      for (let y = 0; y < h; y += spacing) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }

      // Coordinate numbers
      ctx.font = "10px monospace";
      ctx.fillStyle = "rgba(100, 116, 139, 0.15)";
      for (let x = 0; x < w; x += spacing * 2) {
        for (let y = 0; y < h; y += spacing * 2) {
          ctx.fillText(`${x},${y}`, x + 2, y - 2);
        }
      }
    };

    const drawBlueprintLines = () => {
      const time = Date.now() * 0.001;
      lines.forEach((line) => {
        const x1 = line.x1 * w, y1 = line.y1 * h;
        const x2 = line.x2 * w, y2 = line.y2 * h;
        const pulse = Math.sin(time * line.speed) * 0.5 + 0.5;
        const alpha = line.alpha * pulse;

        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.strokeStyle = `rgba(59, 130, 246, ${alpha})`;
        ctx.lineWidth = 1;
        ctx.setLineDash([5, 5]);
        ctx.stroke();
        ctx.setLineDash([]);

        // Dimension arrows at ends
        const angle = Math.atan2(y2 - y1, x2 - x1);
        const arrowSize = 6;
        [0, 1].forEach((end) => {
          const ax = end === 0 ? x1 : x2;
          const ay = end === 0 ? y1 : y2;
          const dir = end === 0 ? angle + Math.PI : angle;
          ctx.beginPath();
          ctx.moveTo(ax, ay);
          ctx.lineTo(ax + Math.cos(dir - 0.4) * arrowSize, ay + Math.sin(dir - 0.4) * arrowSize);
          ctx.moveTo(ax, ay);
          ctx.lineTo(ax + Math.cos(dir + 0.4) * arrowSize, ay + Math.sin(dir + 0.4) * arrowSize);
          ctx.strokeStyle = `rgba(59, 130, 246, ${alpha * 0.6})`;
          ctx.stroke();
        });
      });
    };

    const animate = () => {
      ctx.clearRect(0, 0, w, h);

      // Background
      ctx.fillStyle = "hsl(220, 14%, 7%)";
      ctx.fillRect(0, 0, w, h);

      drawGrid();
      drawBlueprintLines();

      // Update and draw gears
      gears.forEach((g) => {
        g.angle += g.speed;
        drawGear(g);
      });

      // Spawn particles
      if (Math.random() < 0.3) spawnParticle();

      // Update and draw particles
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.life++;
        p.vy += 0.01; // slight gravity

        const progress = p.life / p.maxLife;
        const alpha = progress < 0.2 ? progress / 0.2 : 1 - ((progress - 0.2) / 0.8);

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (1 - progress * 0.5), 0, Math.PI * 2);
        ctx.fillStyle = `${p.color}${alpha * 0.8})`;
        ctx.fill();

        // Glow
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * 3, 0, Math.PI * 2);
        ctx.fillStyle = `${p.color}${alpha * 0.15})`;
        ctx.fill();

        if (p.life >= p.maxLife) particles.splice(i, 1);
      }

      // Draw floating manufacturing text labels
      ctx.font = "11px monospace";
      ctx.fillStyle = "rgba(100, 116, 139, 0.12)";
      const labels = [
        { text: "X: 245.00 Y: 120.50 Z: -15.25", x: 0.05, y: 0.12 },
        { text: "FEED: 1200mm/min", x: 0.05, y: 0.92 },
        { text: "RPM: 3500", x: 0.25, y: 0.92 },
        { text: "TOOL: T03 - 12mm END MILL", x: 0.05, y: 0.96 },
        { text: "G54 WCS ACTIVE", x: 0.25, y: 0.96 },
        { text: "M03 S3500", x: 0.05, y: 0.88 },
        { text: "G01 F1200", x: 0.25, y: 0.88 },
      ];
      labels.forEach((l) => ctx.fillText(l.text, l.x * w, l.y * h));

      animRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full"
      style={{ pointerEvents: "none" }}
    />
  );
}
