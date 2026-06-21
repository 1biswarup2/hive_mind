import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { Toaster } from "@/components/ui/sonner";
import ProtectedRoute from "@/components/ProtectedRoute";
import AppShell from "@/components/AppShell";
import Landing from "@/pages/Landing";
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import Board from "@/pages/Board";
import NewRequest from "@/pages/NewRequest";
import RequestDetail from "@/pages/RequestDetail";
import Leaderboard from "@/pages/Leaderboard";
import Rewards from "@/pages/Rewards";
import Profile from "@/pages/Profile";
import Admin from "@/pages/Admin";
import "@/App.css";

function RedirectIfAuth({ children }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to="/app" replace />;
  return children;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<RedirectIfAuth><Login /></RedirectIfAuth>} />
          <Route
            path="/app/*"
            element={
              <ProtectedRoute>
                <AppShell>
                  <Routes>
                    <Route index element={<Dashboard />} />
                    <Route path="board" element={<Board />} />
                    <Route path="requests/new" element={<NewRequest />} />
                    <Route path="requests/:id" element={<RequestDetail />} />
                    <Route path="leaderboard" element={<Leaderboard />} />
                    <Route path="rewards" element={<Rewards />} />
                    <Route path="profile/:id" element={<Profile />} />
                    <Route path="admin" element={<Admin />} />
                    <Route path="*" element={<Navigate to="/app" replace />} />
                  </Routes>
                </AppShell>
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <Toaster position="top-right" richColors />
      </BrowserRouter>
    </AuthProvider>
  );
}
