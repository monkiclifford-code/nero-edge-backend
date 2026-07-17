export const NCR_CLASSIFICATIONS = [
  { value: "foundry", label: "Foundry NCR" },
  { value: "machining", label: "Machining NCR" },
  { value: "tooling", label: "Tooling NCR" },
  { value: "supplier", label: "Supplier NCR" },
] as const;

export const FOUNDRY_DEFECT_TYPES = [
  { value: "blow_hole", label: "Blow Hole", color: "#ef4444" },
  { value: "porosity", label: "Porosity", color: "#f97316" },
  { value: "corrosion", label: "Corrosion", color: "#eab308" },
  { value: "crack", label: "Crack", color: "#dc2626" },
  { value: "sand_inclusion", label: "Sand Inclusion", color: "#a855f7" },
  { value: "shrinkage", label: "Shrinkage", color: "#06b6d4" },
  { value: "surface_defect", label: "Surface Defect", color: "#84cc16" },
  { value: "hard_spot", label: "Hard Spot", color: "#6366f1" },
  { value: "misrun", label: "Misrun", color: "#ec4899" },
  { value: "dimensional_shift", label: "Dimensional Shift", color: "#14b8a6" },
  { value: "other", label: "Other", color: "#6b7280" },
] as const;

export const SEVERITY_LEVELS = [
  { value: "critical", label: "Critical", color: "#dc2626" },
  { value: "major", label: "Major", color: "#f97316" },
  { value: "minor", label: "Minor", color: "#eab308" },
  { value: "observation", label: "Observation", color: "#6b7280" },
] as const;

export const NCR_STATUSES = [
  { value: "open", label: "Open", color: "#ef4444" },
  { value: "in_progress", label: "In Progress", color: "#f97316" },
  { value: "resolved", label: "Resolved", color: "#22c55e" },
  { value: "closed", label: "Closed", color: "#6b7280" },
] as const;

export type DefectType = (typeof FOUNDRY_DEFECT_TYPES)[number]["value"];
export type NcrClassification = (typeof NCR_CLASSIFICATIONS)[number]["value"];
export type SeverityLevel = (typeof SEVERITY_LEVELS)[number]["value"];
export type NcrStatus = (typeof NCR_STATUSES)[number]["value"];

export function getDefectLabel(type: string): string {
  return FOUNDRY_DEFECT_TYPES.find((d) => d.value === type)?.label ?? type;
}

export function getDefectColor(type: string): string {
  return FOUNDRY_DEFECT_TYPES.find((d) => d.value === type)?.color ?? "#6b7280";
}

export function getSeverityLabel(level: string): string {
  return SEVERITY_LEVELS.find((s) => s.value === level)?.label ?? level;
}

export function getSeverityColor(level: string): string {
  return SEVERITY_LEVELS.find((s) => s.value === level)?.color ?? "#6b7280";
}

export function getStatusLabel(status: string): string {
  return NCR_STATUSES.find((s) => s.value === status)?.label ?? status;
}

export function getStatusColor(status: string): string {
  return NCR_STATUSES.find((s) => s.value === status)?.color ?? "#6b7280";
}
