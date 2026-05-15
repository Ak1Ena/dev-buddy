import { Routes, Route, Navigate } from "react-router-dom";
import { useAuthStore } from "@/store/auth";
import Navbar from "@/components/layout/Navbar";
import Landing from "@/pages/Landing";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import Assessment from "@/pages/Assessment";
import Dashboard from "@/pages/Dashboard";
import SpaceDetail from "@/pages/SpaceDetail";
import Learn from "@/pages/Learn";
import Workshop from "@/pages/Workshop";

function RequireAuth({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <div className="min-h-screen bg-slate-900">
      <Navbar />
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/assessment" element={<RequireAuth><Assessment /></RequireAuth>} />
        <Route path="/dashboard" element={<RequireAuth><Dashboard /></RequireAuth>} />
        <Route path="/space/:spaceId" element={<RequireAuth><SpaceDetail /></RequireAuth>} />
        <Route path="/learn/:lessonId" element={<RequireAuth><Learn /></RequireAuth>} />
        <Route path="/learn/:lessonId/workshop" element={<RequireAuth><Workshop /></RequireAuth>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}
