import { Brain, AlertTriangle, CheckCircle2 } from "lucide-react";

interface ConfidenceBadgeProps {
  confidence: number;
  showLabel?: boolean;
  size?: "sm" | "md" | "lg";
}

export default function ConfidenceBadge({ confidence, showLabel = true, size = "md" }: ConfidenceBadgeProps) {
  const getColor = () => {
    if (confidence >= 80) return { bg: "bg-emerald-500/15", border: "border-emerald-500/20", text: "text-emerald-400", icon: CheckCircle2 };
    if (confidence >= 60) return { bg: "bg-amber-500/15", border: "border-amber-500/20", text: "text-amber-400", icon: AlertTriangle };
    return { bg: "bg-rose-500/15", border: "border-rose-500/20", text: "text-rose-400", icon: AlertTriangle };
  };

  const colors = getColor();
  const Icon = colors.icon;

  const sizeClasses = {
    sm: "text-[10px] px-1.5 py-0.5 gap-0.5",
    md: "text-xs px-2.5 py-1 gap-1",
    lg: "text-sm px-3 py-1.5 gap-1.5",
  };

  const iconSizes = { sm: "h-3 w-3", md: "h-3.5 w-3.5", lg: "h-4 w-4" };

  return (
    <span className={`inline-flex items-center rounded-full ${colors.bg} border ${colors.border} ${colors.text} font-bold ${sizeClasses[size]}`}>
      <Brain className={`${iconSizes[size]} flex-shrink-0`} />
      {showLabel && <span>AI</span>}
      <span>{confidence}%</span>
    </span>
  );
}
