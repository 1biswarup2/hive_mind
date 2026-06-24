import { Link, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  LayoutDashboard, KanbanSquare, Trophy, Gift, User, Settings, LogOut,
  Bell, Plus, Search, Hexagon, Mail
} from "lucide-react";
import { useEffect, useState } from "react";
import api, { formatApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { initials, timeAgo } from "@/lib/utils";
import { toast } from "sonner";

const navItems = [
  { to: "/app", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/app/board", label: "Board", icon: KanbanSquare },
  { to: "/app/leaderboard", label: "Leaderboard", icon: Trophy },
  { to: "/app/rewards", label: "Rewards", icon: Gift },
];

export default function AppShell({ children }) {
  const { user, org, logout } = useAuth();
  const navigate = useNavigate();
  const [notifs, setNotifs] = useState([]);
  const [q, setQ] = useState("");
  const [resending, setResending] = useState(false);

  const resendVerification = async () => {
    setResending(true);
    try {
      await api.post("/auth/resend-verification");
      toast.success("Verification email sent. Check your inbox.");
    } catch (err) {
      toast.error(formatApiError(err.response?.data?.detail) || "Could not resend email");
    } finally {
      setResending(false);
    }
  };

  const loadNotifs = async () => {
    try {
      const { data } = await api.get("/notifications");
      setNotifs(data);
    } catch (_) {}
  };
  useEffect(() => {
    loadNotifs();
    const i = setInterval(loadNotifs, 30000);
    return () => clearInterval(i);
  }, []);

  const unread = notifs.filter((n) => !n.read).length;

  const onSearch = (e) => {
    if (e.key === "Enter" && q.trim()) {
      navigate(`/app/board?q=${encodeURIComponent(q.trim())}`);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {user && user.email_verified === false && (
        <div
          className="bg-amber-50 border-b border-amber-200 px-4 py-2.5 text-sm text-amber-900"
          data-testid="verify-email-banner"
        >
          <div className="max-w-[1400px] mx-auto flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 shrink-0" />
              <span>
                Verify <strong>{user.email}</strong> to claim tickets and redeem rewards.
              </span>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="border-amber-300 bg-white hover:bg-amber-100"
              onClick={resendVerification}
              disabled={resending}
              data-testid="resend-verification-btn"
            >
              {resending ? "Sending…" : "Resend email"}
            </Button>
          </div>
        </div>
      )}
      <header className="glass-nav sticky top-0 z-40">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 h-16 flex items-center gap-6">
          <Link to="/app" className="flex items-center gap-2 group" data-testid="brand-link">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-blue-600 to-blue-800 grid place-items-center text-white shadow-sm">
              <Hexagon className="h-5 w-5" />
            </div>
            <div className="font-display font-bold text-lg leading-none">
              Jugaad
              <div className="text-[10px] font-mono text-slate-500 tracking-widest mt-0.5">
                {org?.name?.toUpperCase()}
              </div>
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-1">
            {navItems.map((it) => (
              <NavLink
                key={it.to}
                to={it.to}
                end={it.end}
                data-testid={`nav-${it.label.toLowerCase()}`}
                className={({ isActive }) =>
                  `flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                    isActive ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-100"
                  }`
                }
              >
                <it.icon className="h-4 w-4" />
                {it.label}
              </NavLink>
            ))}
            {user?.role === "admin" && (
              <NavLink
                to="/app/admin"
                data-testid="nav-admin"
                className={({ isActive }) =>
                  `flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                    isActive ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-100"
                  }`
                }
              >
                <Settings className="h-4 w-4" />
                Admin
              </NavLink>
            )}
          </nav>

          <div className="flex-1 max-w-md ml-auto relative hidden md:block">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              data-testid="global-search-input"
              placeholder="Search requests, skills, people…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={onSearch}
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 bg-white text-sm focus-ring"
            />
          </div>

          {user?.role === "admin" && (
            <Button
              asChild
              size="sm"
              data-testid="header-create-request-btn"
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Link to="/app/requests/new">
                <Plus className="h-4 w-4 mr-1" /> New Request
              </Link>
            </Button>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                data-testid="notifications-trigger"
                className="relative h-9 w-9 rounded-lg border border-slate-200 grid place-items-center hover:bg-slate-100"
              >
                <Bell className="h-4 w-4" />
                {unread > 0 && (
                  <span className="absolute -top-1 -right-1 h-4 min-w-4 px-1 rounded-full bg-blue-600 text-white text-[10px] font-bold grid place-items-center">
                    {unread}
                  </span>
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80">
              <DropdownMenuLabel className="flex items-center justify-between">
                Notifications
                {unread > 0 && (
                  <button
                    data-testid="mark-all-read"
                    onClick={async () => {
                      await api.post("/notifications/read-all");
                      loadNotifs();
                    }}
                    className="text-xs text-blue-600 hover:underline"
                  >
                    Mark all read
                  </button>
                )}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {notifs.length === 0 ? (
                <div className="px-3 py-6 text-sm text-slate-500 text-center">No notifications yet</div>
              ) : (
                notifs.slice(0, 10).map((n) => (
                  <DropdownMenuItem
                    key={n.id}
                    onClick={() => n.link && navigate(n.link)}
                    className="flex flex-col items-start gap-0.5 cursor-pointer"
                  >
                    <div className="text-sm">{n.message}</div>
                    <div className="text-[11px] text-slate-500">{timeAgo(n.timestamp)}</div>
                  </DropdownMenuItem>
                ))
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                data-testid="user-menu-trigger"
                className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-lg hover:bg-slate-100"
              >
                <Avatar className="h-8 w-8">
                  <AvatarImage src={user?.avatar_url || ""} alt={user?.name} />
                  <AvatarFallback>{initials(user?.name || "?")}</AvatarFallback>
                </Avatar>
                <div className="hidden sm:block text-left leading-tight">
                  <div className="text-xs font-semibold">{user?.name}</div>
                  <div className="text-[10px] text-slate-500 uppercase tracking-wider">{user?.role}</div>
                </div>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <div className="text-sm">{user?.name}</div>
                <div className="text-xs text-slate-500">{user?.email}</div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate(`/app/profile/${user?.id}`)} data-testid="menu-profile">
                <User className="h-4 w-4 mr-2" /> Profile
              </DropdownMenuItem>
              {user?.role === "admin" && (
                <DropdownMenuItem onClick={() => navigate("/app/admin")} data-testid="menu-admin">
                  <Settings className="h-4 w-4 mr-2" /> Admin
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={async () => { await logout(); navigate("/login"); }}
                data-testid="menu-logout"
                className="text-red-600"
              >
                <LogOut className="h-4 w-4 mr-2" /> Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>
      <main className="max-w-[1400px] mx-auto px-4 sm:px-6 py-8">{children}</main>
    </div>
  );
}
