import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router";
import { useTheme } from "@/hooks/useTheme";
import {
  LayoutDashboard,
  ClipboardList,
  PlusCircle,
  BarChart3,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Menu,
  Factory,
  AlertTriangle,
  Image,
  Sparkles,
  Flame,
  Sun,
  Moon,
} from "lucide-react";

interface AppLayoutProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  showBack?: boolean;
  onBack?: () => void;
  action?: React.ReactNode;
}

const navItems = [
  { path: "/job-entry", label: "Jobs", icon: ClipboardList },
  { path: "/dashboard", label: "Dashboard", icon: BarChart3 },
];

export default function AppLayout({
  children,
  title,
  subtitle,
  showBack,
  onBack,
  action,
}: AppLayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [operator, setOperator] = useState<{ name: string; operatorId: string } | null>(null);
  const [mounted, setMounted] = useState(false);
  const { theme, toggleTheme } = useTheme();

  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem("cnc_operator");
    if (saved) {
      try {
        setOperator(JSON.parse(saved));
      } catch {
        setOperator(null);
      }
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("cnc_operator");
    localStorage.removeItem("cnc_demo_mode");
    navigate("/");
  };

  const isActive = (path: string) => location.pathname.startsWith(path);

  if (!mounted) return null;

  return (
    <div className={`min-h-screen flex transition-colors duration-300 ${
      theme === "light" 
        ? "bg-[hsl(220,14%,96%)] text-[hsl(220,14%,15%)]" 
        : "bg-[hsl(220,14%,7%)] text-white"
    }`}>
      {/* === SIDEBAR === */}
      <aside
        className={`flex-shrink-0 h-screen sticky top-0 left-0 z-40 flex flex-col border-r transition-all duration-300 ${
          collapsed ? "w-[60px]" : "w-[220px]"
        } ${
          theme === "light"
            ? "border-[hsl(220,13%,85%)] bg-white"
            : "border-[hsl(220,14%,16%)] bg-[hsl(220,14%,9%)]"
        }`}
      >
        {/* Logo area */}
        <div className={`flex items-center gap-3 px-4 h-14 border-b flex-shrink-0 ${
          theme === "light" ? "border-[hsl(220,13%,88%)]" : "border-[hsl(220,14%,16%)]"
        }`}>
          <img
            src="/forgeraceiq-logo.png"
            alt="ForgeTraceIQ"
            className="h-7 w-auto flex-shrink-0"
          />
          {!collapsed && (
            <span className={`text-xs font-bold tracking-wider truncate ${
              theme === "light" ? "text-[hsl(220,14%,25%)]" : "text-white/80"
            }`}>
              ForgeTraceIQ
            </span>
          )}
        </div>

        {/* Nav items */}
        <nav className="flex-1 py-3 px-2 space-y-1 overflow-y-auto">
          <button
            onClick={() => navigate("/job-entry")}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-all ${
              isActive("/job-entry") || isActive("/setup-sheet") || isActive("/inspection") || isActive("/ncr") || isActive("/job-completion") || isActive("/setup-images")
                ? "bg-[hsl(24,95%,53%)]/15 text-[hsl(24,95%,55%)]"
                : theme === "light"
                  ? "text-[hsl(220,14%,45%)] hover:bg-black/5 hover:text-[hsl(220,14%,20%)]"
                  : "text-white/50 hover:bg-white/5 hover:text-white/80"
            }`}
          >
            <ClipboardList className="h-4.5 w-4.5 flex-shrink-0" />
            {!collapsed && <span>Jobs</span>}
          </button>

          <button
            onClick={() => navigate("/dashboard")}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-all ${
              isActive("/dashboard")
                ? "bg-[hsl(24,95%,53%)]/15 text-[hsl(24,95%,55%)]"
                : theme === "light"
                  ? "text-[hsl(220,14%,45%)] hover:bg-black/5 hover:text-[hsl(220,14%,20%)]"
                  : "text-white/50 hover:bg-white/5 hover:text-white/80"
            }`}
          >
            <BarChart3 className="h-4.5 w-4.5 flex-shrink-0" />
            {!collapsed && <span>Dashboard</span>}
          </button>

          {/* Phase 7 — Foundry Section */}
          {!collapsed && (
            <div className="mt-4 mb-1 px-3">
              <p className={`text-[9px] uppercase tracking-[0.15em] font-bold ${
                theme === "light" ? "text-[hsl(220,14%,55%)]" : "text-white/20"
              }`}>Foundry AI</p>
            </div>
          )}
          {collapsed && <div className={`mt-3 border-t mx-2 ${
            theme === "light" ? "border-[hsl(220,13%,88%)]" : "border-[hsl(220,14%,16%)]"
          }`} />}

          <button
            onClick={() => navigate("/foundry-dashboard")}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-all ${
              isActive("/foundry-dashboard")
                ? "bg-[hsl(24,95%,53%)]/15 text-[hsl(24,95%,55%)]"
                : theme === "light"
                  ? "text-[hsl(220,14%,45%)] hover:bg-black/5 hover:text-[hsl(220,14%,20%)]"
                  : "text-white/50 hover:bg-white/5 hover:text-white/80"
            }`}
          >
            <Flame className="h-4.5 w-4.5 flex-shrink-0" />
            {!collapsed && <span>Foundry Center</span>}
          </button>

          <button
            onClick={() => navigate("/foundry-ncr")}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-all ${
              isActive("/foundry-ncr")
                ? "bg-[hsl(24,95%,53%)]/15 text-[hsl(24,95%,55%)]"
                : theme === "light"
                  ? "text-[hsl(220,14%,45%)] hover:bg-black/5 hover:text-[hsl(220,14%,20%)]"
                  : "text-white/50 hover:bg-white/5 hover:text-white/80"
            }`}
          >
            <AlertTriangle className="h-4.5 w-4.5 flex-shrink-0" />
            {!collapsed && <span>Foundry NCR</span>}
          </button>

          <button
            onClick={() => navigate("/visual-history")}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-all ${
              isActive("/visual-history")
                ? "bg-[hsl(24,95%,53%)]/15 text-[hsl(24,95%,55%)]"
                : theme === "light"
                  ? "text-[hsl(220,14%,45%)] hover:bg-black/5 hover:text-[hsl(220,14%,20%)]"
                  : "text-white/50 hover:bg-white/5 hover:text-white/80"
            }`}
          >
            <Image className="h-4.5 w-4.5 flex-shrink-0" />
            {!collapsed && <span>Visual History</span>}
          </button>
        </nav>

        {/* Bottom: operator + theme toggle + logout */}
        <div className={`flex-shrink-0 border-t p-2 ${
          theme === "light" ? "border-[hsl(220,13%,88%)]" : "border-[hsl(220,14%,16%)]"
        }`}>
          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-all ${
              theme === "light"
                ? "text-[hsl(220,14%,45%)] hover:bg-black/5 hover:text-[hsl(220,14%,20%)]"
                : "text-white/40 hover:bg-white/5 hover:text-white/70"
            }`}
            title={theme === "light" ? "Switch to Dark Mode" : "Switch to Light Mode"}
          >
            {theme === "light" ? <Moon className="h-4.5 w-4.5 flex-shrink-0" /> : <Sun className="h-4.5 w-4.5 flex-shrink-0" />}
            {!collapsed && <span>{theme === "light" ? "Dark Mode" : "Light Mode"}</span>}
          </button>

          {!collapsed && operator && (
            <div className="px-2 py-2 mb-1">
              <p className={`text-[11px] font-semibold truncate ${
                theme === "light" ? "text-[hsl(220,14%,35%)]" : "text-white/70"
              }`}>{operator.name}</p>
              <p className={`text-[10px] truncate ${
                theme === "light" ? "text-[hsl(220,14%,55%)]" : "text-white/30"
              }`}>{operator.operatorId}</p>
            </div>
          )}
          <button
            onClick={handleLogout}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-all ${
              theme === "light"
                ? "text-[hsl(220,14%,45%)] hover:bg-rose-500/10 hover:text-rose-500"
                : "text-white/40 hover:bg-rose-500/10 hover:text-rose-400"
            }`}
          >
            <LogOut className="h-4.5 w-4.5 flex-shrink-0" />
            {!collapsed && <span>Logout</span>}
          </button>
          <button
            onClick={() => setCollapsed(!collapsed)}
            className={`w-full flex items-center justify-center py-2 mt-1 transition-all ${
              theme === "light" ? "text-[hsl(220,14%,55%)] hover:text-[hsl(220,14%,30%)]" : "text-white/20 hover:text-white/50"
            }`}
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        </div>
      </aside>

      {/* === MAIN CONTENT AREA === */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top header bar */}
        <header className={`h-14 flex-shrink-0 border-b flex items-center justify-between px-5 sticky top-0 z-30 transition-colors duration-300 ${
          theme === "light"
            ? "border-[hsl(220,13%,88%)] bg-white"
            : "border-[hsl(220,14%,16%)] bg-[hsl(220,14%,9%)]"
        }`}>
          <div className="flex items-center gap-3">
            {showBack && (
              <button
                onClick={onBack}
                className={`flex items-center gap-1.5 text-sm transition-all ${
                  theme === "light" ? "text-[hsl(220,14%,45%)] hover:text-[hsl(220,14%,20%)]" : "text-white/50 hover:text-white/80"
                }`}
              >
                <ChevronLeft className="h-4 w-4" />
                Back
              </button>
            )}
            {title && (
              <div className="flex flex-col">
                <h1 className={`text-sm font-bold tracking-wide ${
                  theme === "light" ? "text-[hsl(220,14%,20%)]" : "text-white/90"
                }`}>{title}</h1>
                {subtitle && (
                  <p className={`text-[10px] font-medium ${
                    theme === "light" ? "text-[hsl(220,14%,50%)]" : "text-white/40"
                  }`}>{subtitle}</p>
                )}
              </div>
            )}
          </div>
          {action && <div>{action}</div>}
        </header>

        {/* Scrollable content */}
        <main className="flex-1 overflow-y-auto p-5 forge-scroll">
          {children}
        </main>
      </div>
    </div>
  );
}
