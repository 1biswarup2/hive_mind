import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  TrendingUp, Coins, Trophy, Target, ArrowRight, Sparkles, CircleCheck, Hourglass,
} from "lucide-react";
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip, BarChart, Bar, CartesianGrid } from "recharts";
import { timeAgo, statusLabel } from "@/lib/utils";

export default function Dashboard() {
  const { user, org } = useAuth();
  const [stats, setStats] = useState(null);
  const [requests, setRequests] = useState([]);

  useEffect(() => {
    api.get("/dashboard/stats").then((r) => setStats(r.data));
    api.get("/requests").then((r) => setRequests(r.data.slice(0, 8)));
  }, []);

  if (!stats) return <div className="text-slate-500 font-mono text-sm">Loading…</div>;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-end justify-between flex-wrap gap-4 rise">
        <div>
          <div className="text-xs font-mono uppercase tracking-[0.3em] text-blue-600">Welcome back</div>
          <h1 className="font-display text-4xl sm:text-5xl font-bold tracking-tighter mt-2">
            Hello, {user?.name?.split(" ")[0]}.
          </h1>
          <p className="text-slate-600 mt-2">
            {stats.open_requests} open requests in <span className="font-semibold text-slate-900">{org?.name}</span>.
            Your balance is <span className="font-mono font-semibold">{stats.my_balance}</span> credits.
          </p>
        </div>
        <Button asChild data-testid="dashboard-create-btn" className="bg-blue-600 hover:bg-blue-700">
          <Link to="/app/requests/new">Post a request <ArrowRight className="h-4 w-4 ml-1" /></Link>
        </Button>
      </div>

      {/* KPI Bento */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 rise rise-1">
        <Kpi icon={Coins} color="from-blue-600 to-blue-700" label="Credit balance" value={stats.my_balance} sub={`${stats.my_credits_earned} earned`} testid="kpi-balance" />
        <Kpi icon={Trophy} color="from-amber-500 to-amber-600" label="Reputation" value={stats.my_reputation} sub="Across all activity" testid="kpi-reputation" />
        <Kpi icon={CircleCheck} color="from-emerald-500 to-emerald-600" label="You solved" value={stats.my_solved} sub="Completed requests" testid="kpi-solved" />
        <Kpi icon={Hourglass} color="from-slate-700 to-slate-900" label="You posted" value={stats.my_open} sub="Total requests created" testid="kpi-posted" />
      </div>

      {/* Org overview row */}
      <div className="grid lg:grid-cols-3 gap-6 rise rise-2">
        <Card className="lg:col-span-2 border-slate-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="text-xs font-mono uppercase tracking-widest text-slate-500">Org activity · 14d</div>
                <h3 className="font-display text-2xl font-semibold tracking-tight mt-1">Requests created vs solved</h3>
              </div>
              <div className="flex gap-3 text-xs">
                <Legend dot="#2563eb" label="Created" />
                <Legend dot="#10b981" label="Solved" />
              </div>
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={stats.activity}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="date" tickLine={false} axisLine={false} fontSize={11} stroke="#94a3b8" />
                  <YAxis tickLine={false} axisLine={false} fontSize={11} stroke="#94a3b8" />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e2e8f0" }} />
                  <Line type="monotone" dataKey="created" stroke="#2563eb" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="solved" stroke="#10b981" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardContent className="p-6">
            <div className="text-xs font-mono uppercase tracking-widest text-slate-500">Org pulse</div>
            <h3 className="font-display text-2xl font-semibold tracking-tight mt-1">{stats.total_requests} requests</h3>
            <div className="mt-6 space-y-4">
              <Row label="Open" value={stats.open_requests} accent="bg-blue-500" />
              <Row label="In motion" value={stats.in_progress} accent="bg-violet-500" />
              <Row label="Completed" value={stats.completed} accent="bg-emerald-500" />
              <Row label="Credits awarded" value={stats.credits_awarded} accent="bg-amber-500" />
              <div className="pt-3 border-t border-slate-200">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-600">Participation</span>
                  <span className="font-mono text-sm font-semibold">{stats.participation_rate}%</span>
                </div>
                <div className="text-xs text-slate-500 mt-1">{stats.active_contributors} of {stats.total_users} active in last 30 days</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Categories + Recent */}
      <div className="grid lg:grid-cols-3 gap-6 rise rise-3">
        <Card className="lg:col-span-1 border-slate-200">
          <CardContent className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="h-4 w-4 text-blue-600" />
              <h3 className="font-display text-lg font-semibold tracking-tight">Top categories</h3>
            </div>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.categories.slice(0, 6)} layout="vertical">
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="name" tickLine={false} axisLine={false} fontSize={11} width={120} />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                  <Bar dataKey="count" fill="#2563eb" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2 border-slate-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display text-lg font-semibold tracking-tight">Latest requests</h3>
              <Link to="/app/board" className="text-xs text-blue-600 hover:underline" data-testid="dashboard-view-all">View all →</Link>
            </div>
            <div className="divide-y divide-slate-200">
              {requests.map((r) => (
                <Link
                  key={r.id}
                  to={`/app/requests/${r.id}`}
                  data-testid={`dashboard-request-${r.id}`}
                  className="flex items-center gap-4 py-3 group"
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate group-hover:text-blue-600 transition-colors">{r.title}</div>
                    <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-2">
                      <span>{r.category}</span> · <span>{timeAgo(r.created_at)}</span>
                    </div>
                  </div>
                  <Badge variant="outline" className="font-mono">{r.bounty_credits}c</Badge>
                  <span className={`pill pill-${r.status}`}>{statusLabel(r.status)}</span>
                </Link>
              ))}
              {requests.length === 0 && (
                <div className="text-center py-8 text-slate-500 text-sm">No requests yet. Create your first one!</div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

const Kpi = ({ icon: Icon, color, label, value, sub, testid }) => (
  <Card className="border-slate-200 card-hover" data-testid={testid}>
    <CardContent className="p-5">
      <div className="flex items-center justify-between">
        <div className={`h-10 w-10 rounded-xl bg-gradient-to-br ${color} grid place-items-center text-white shadow`}>
          <Icon className="h-5 w-5" />
        </div>
        <TrendingUp className="h-4 w-4 text-slate-300" />
      </div>
      <div className="mt-4 font-display text-3xl font-bold tracking-tight">{value}</div>
      <div className="text-xs uppercase tracking-wider text-slate-500 mt-1">{label}</div>
      <div className="text-xs text-slate-400 mt-1">{sub}</div>
    </CardContent>
  </Card>
);

const Row = ({ label, value, accent }) => (
  <div className="flex items-center gap-3">
    <span className={`h-2 w-2 rounded-full ${accent}`} />
    <span className="text-sm flex-1">{label}</span>
    <span className="font-mono font-semibold">{value}</span>
  </div>
);

const Legend = ({ dot, label }) => (
  <span className="flex items-center gap-1.5 text-slate-600">
    <span className="h-2 w-2 rounded-full" style={{ background: dot }} /> {label}
  </span>
);
