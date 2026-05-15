import { Link, useNavigate, useLocation } from "react-router-dom";
import { GraduationCap, LogOut, LayoutDashboard, BookOpen, UserCircle } from "lucide-react";
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
          </div>
        )}

        {/* Right: Auth actions */}
        <div className="flex items-center gap-2">
          {isAuthenticated ? (
            <>
              <Link
                to="/profile"
                className={cn(
                  "hidden sm:flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  isActive("/profile")
                    ? "bg-sky-500/15 text-sky-400"
                    : "text-slate-400 hover:bg-slate-800 hover:text-slate-100"
                )}
              >
                <UserCircle className="h-4 w-4" />
                {user?.username}
              </Link>
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
