import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import api from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Filter, Plus, ArrowRight, Search } from "lucide-react";
import { initials, statusLabel, STATUSES, timeAgo } from "@/lib/utils";

const COLUMNS = STATUSES.filter((s) => s.key !== "rejected");

export default function Board() {
  const { user } = useAuth();
  const [requests, setRequests] = useState([]);
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState(params.get("q") || "");
  const [cat, setCat] = useState(params.get("category") || "all");
  const [categories, setCategories] = useState([]);

  const load = async () => {
    const p = {};
    if (q) p.q = q;
    if (cat !== "all") p.category = cat;
    const { data } = await api.get("/requests", { params: p });
    setRequests(data);
  };

  useEffect(() => {
    api.get("/org/categories").then((r) => setCategories(r.data));
  }, []);

  useEffect(() => {
    load();
  }, [q, cat]);

  const grouped = useMemo(() => {
    const m = Object.fromEntries(COLUMNS.map((c) => [c.key, []]));
    for (const r of requests) {
      if (m[r.status]) m[r.status].push(r);
    }
    return m;
  }, [requests]);

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <div className="text-xs font-mono uppercase tracking-[0.3em] text-blue-600">Request Board</div>
          <h1 className="font-display text-4xl font-bold tracking-tighter mt-2">Pipeline</h1>
          <p className="text-slate-600 mt-1">Every open ask in the organization, by stage.</p>
        </div>
        {user?.role === "admin" && (
          <Button asChild data-testid="board-create-btn" className="bg-blue-600 hover:bg-blue-700">
            <Link to="/app/requests/new"><Plus className="h-4 w-4 mr-1" /> New request</Link>
          </Button>
        )}
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[280px] max-w-md">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="Search title, description, tags…"
            data-testid="board-search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={cat} onValueChange={setCat}>
          <SelectTrigger data-testid="board-category-filter" className="w-56">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="All categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="font-mono text-xs text-slate-500 ml-auto">{requests.length} requests</div>
      </div>

      <div className="kanban-scroll flex gap-4 overflow-x-auto pb-4 -mx-2 px-2">
        {COLUMNS.map((col) => (
          <div
            key={col.key}
            className="flex-shrink-0 w-[320px]"
            data-testid={`column-${col.key}`}
          >
            <div className="flex items-center justify-between mb-3 px-1">
              <div className="flex items-center gap-2">
                <span className={`pill pill-${col.key}`}>{col.label}</span>
              </div>
              <span className="text-xs font-mono text-slate-500">{grouped[col.key]?.length || 0}</span>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 min-h-[60vh] space-y-3">
              {(grouped[col.key] || []).map((r) => (
                <KanbanCard key={r.id} r={r} />
              ))}
              {(grouped[col.key] || []).length === 0 && (
                <div className="text-xs text-slate-400 text-center py-6">No items</div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function KanbanCard({ r }) {
  return (
    <Link
      to={`/app/requests/${r.id}`}
      data-testid={`card-request-${r.id}`}
      className="block bg-white rounded-xl border border-slate-200 p-4 card-hover"
    >
      <div className="flex items-center justify-between mb-2">
        <Badge variant="outline" className="text-[10px]">{r.category}</Badge>
        <span className={`font-mono text-xs font-semibold diff-${r.difficulty}`}>{r.difficulty?.toUpperCase()}</span>
      </div>
      <div className="font-semibold text-sm leading-snug line-clamp-2">{r.title}</div>
      {r.tags?.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {r.tags.slice(0, 3).map((t) => (
            <span key={t} className="text-[10px] font-mono text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">#{t}</span>
          ))}
        </div>
      )}
      <div className="flex items-center justify-between mt-4">
        <div className="flex -space-x-2">
          {r.creator && (
            <Avatar className="h-6 w-6 border-2 border-white">
              <AvatarImage src={r.creator.avatar_url || ""} />
              <AvatarFallback className="text-[9px]">{initials(r.creator.name)}</AvatarFallback>
            </Avatar>
          )}
          {r.claimer && (
            <Avatar className="h-6 w-6 border-2 border-white">
              <AvatarImage src={r.claimer.avatar_url || ""} />
              <AvatarFallback className="text-[9px]">{initials(r.claimer.name)}</AvatarFallback>
            </Avatar>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs font-bold text-blue-600">{r.bounty_credits}c</span>
        </div>
      </div>
      <div className="text-[10px] text-slate-400 mt-2 font-mono">{timeAgo(r.created_at)}</div>
    </Link>
  );
}
