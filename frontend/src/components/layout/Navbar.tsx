import { Link, useNavigate, useLocation } from "react-router-dom";
import { GraduationCap, LogOut, LayoutDashboard, BookOpen, Settings } from "lucide-react";
import { useAuthStore } from "@/store/auth";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function Navbar() {
  const { user, isAuthenticated, clearAuth } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    clearAuth();
    navigate("/");
  };

  const isActive = (path: string) =>
    location.pathname === path || location.pathname.startsWith(path + "/");

  return (
    <nav className="sticky top-0 z-50 border-b border-slate-700/50 bg-slate-900/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Left: Brand */}
        <Link to="/" className="flex items-center gap-2 group">
          <GraduationCap className="h-7 w-7 text-sky-500 transition-transform duration-200 group-hover:rotate-12" />
          <span className="text-xl font-bold text-sky-500 tracking-tight">
            devBuddy
          </span>
        </Link>

        {/* Center: Nav links (authenticated only) */}
        {isAuthenticated && (
          <div className="hidden sm:flex items-center gap-1">
            <Link
              to="/dashboard"
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isActive("/dashboard")
                  ? "bg-sky-500/15 text-sky-400"
                  : "text-slate-400 hover:bg-slate-800 hover:text-slate-100"
              )}
            >
              <LayoutDashboard className="h-4 w-4" />
              Dashboard
            </Link>
            <Link
              to="/learn"
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isActive("/learn")
                  ? "bg-sky-500/15 text-sky-400"
                  : "text-slate-400 hover:bg-slate-800 hover:text-slate-100"
              )}
            >
              <BookOpen className="h-4 w-4" />
              Learn
            </Link>
            <Link
              to="/settings"
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isActive("/settings")
                  ? "bg-sky-500/15 text-sky-400"
                  : "text-slate-400 hover:bg-slate-800 hover:text-slate-100"
              )}
            >
              <Settings className="h-4 w-4" />
              Settings
            </Link>
          </div>
        )}

        {/* Right: Auth actions */}
        <div className="flex items-center gap-2">
          {isAuthenticated ? (
            <>
              {/* The center links are hidden below sm, so phones get Settings as an icon here. */}
              <Link
                to="/settings"
                aria-label="Settings"
                className={cn(
                  "flex h-11 w-11 items-center justify-center rounded-lg transition-colors sm:hidden",
                  isActive("/settings") ? "bg-sky-500/15 text-sky-400" : "text-slate-400 hover:bg-slate-800"
                )}
              >
                <Settings className="h-5 w-5" />
              </Link>
              <span className="hidden sm:block text-sm text-slate-400">
                Hi,{" "}
                <span className="font-medium text-slate-200">
                  {user?.username}
                </span>
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLogout}
                className="gap-1.5"
              >
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:block">Logout</span>
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate("/login")}
              >
                Login
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={() => navigate("/register")}
              >
                Register
              </Button>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
