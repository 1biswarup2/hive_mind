import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Trophy, Medal, Award } from "lucide-react";
import { initials } from "@/lib/utils";

export default function Leaderboard() {
  const [scope, setScope] = useState("global");
  const [period, setPeriod] = useState("all");
  const [items, setItems] = useState([]);

  useEffect(() => {
    api.get("/leaderboard", { params: { scope, period } }).then((r) => setItems(r.data));
  }, [scope, period]);

  const top3 = items.slice(0, 3);
  const rest = items.slice(3);

  return (
    <div className="space-y-8">
      <div>
        <div className="text-xs font-mono uppercase tracking-[0.3em] text-blue-600">Leaderboard</div>
        <h1 className="font-display text-4xl font-bold tracking-tighter mt-2">Top of the hive</h1>
        <p className="text-slate-600 mt-1">Contribution beats consumption. Here's who's lifting the org.</p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs value={scope} onValueChange={setScope}>
          <TabsList>
            <TabsTrigger value="global" data-testid="lb-global">Global</TabsTrigger>
            <TabsTrigger value="department" data-testid="lb-department">My department</TabsTrigger>
          </TabsList>
        </Tabs>
        <Tabs value={period} onValueChange={setPeriod}>
          <TabsList>
            <TabsTrigger value="all" data-testid="lb-all-time">All time</TabsTrigger>
            <TabsTrigger value="monthly" data-testid="lb-monthly">Monthly</TabsTrigger>
            <TabsTrigger value="quarterly" data-testid="lb-quarterly">Quarterly</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Podium */}
      {top3.length > 0 && (
        <div className="grid sm:grid-cols-3 gap-4">
          {top3.map((u, i) => (
            <PodiumCard key={u.id} u={u} rank={i + 1} period={period} />
          ))}
        </div>
      )}

      {/* Rest of list */}
      <Card className="border-slate-200">
        <CardContent className="p-0">
          {rest.length === 0 && top3.length === 0 ? (
            <div className="text-center py-12 text-slate-500 text-sm">No contributors yet.</div>
          ) : (
            <div className="divide-y divide-slate-200">
              {rest.map((u, i) => (
                <Link
                  key={u.id}
                  to={`/app/profile/${u.id}`}
                  data-testid={`lb-row-${u.id}`}
                  className="flex items-center gap-4 p-4 hover:bg-slate-50 transition"
                >
                  <div className="w-8 text-center font-mono text-sm text-slate-500">{i + 4}</div>
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={u.avatar_url || ""} />
                    <AvatarFallback>{initials(u.name)}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold">{u.name}</div>
                    <div className="text-xs text-slate-500">{u.department} · {u.designation || "—"}</div>
                  </div>
                  <div className="hidden sm:flex items-center gap-2">
                    {u.badges?.slice(0, 3).map((b, ix) => (
                      <span key={ix} className={`pill tier-${b.tier} text-[10px]`}>{b.name}</span>
                    ))}
                  </div>
                  <div className="text-right">
                    <div className="font-mono font-bold text-lg">
                      {period === "monthly" || period === "quarterly" ? u.period_credits : u.reputation_score}
                    </div>
                    <div className="text-[10px] text-slate-500 uppercase tracking-wider">
                      {period === "monthly" || period === "quarterly" ? "credits" : "rep"}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function PodiumCard({ u, rank, period }) {
  const RankIcon = rank === 1 ? Trophy : rank === 2 ? Medal : Award;
  const colors = ["tier-gold", "tier-silver", "tier-bronze"];
  return (
    <Link to={`/app/profile/${u.id}`} data-testid={`lb-podium-${rank}`}>
      <Card className="border-slate-200 card-hover relative overflow-hidden">
        <div className={`absolute top-0 left-0 right-0 h-1 ${rank === 1 ? "bg-amber-400" : rank === 2 ? "bg-slate-400" : "bg-orange-500"}`} />
        <CardContent className="p-6 text-center">
          <div className={`inline-flex h-12 w-12 rounded-full grid place-items-center mb-4 ${colors[rank - 1]}`}>
            <RankIcon className="h-6 w-6" />
          </div>
          <div className="font-mono text-xs text-slate-500 uppercase tracking-widest">Rank #{rank}</div>
          <Avatar className="h-16 w-16 mx-auto mt-3">
            <AvatarImage src={u.avatar_url || ""} />
            <AvatarFallback>{initials(u.name)}</AvatarFallback>
          </Avatar>
          <div className="font-display text-xl font-bold tracking-tight mt-3">{u.name}</div>
          <div className="text-xs text-slate-500">{u.department}</div>
          <div className="mt-4 font-display text-3xl font-bold tracking-tighter text-blue-600">
            {period === "monthly" || period === "quarterly" ? u.period_credits : u.reputation_score}
          </div>
          <div className="text-[10px] uppercase tracking-wider text-slate-500">
            {period === "monthly" || period === "quarterly" ? "credits earned" : "reputation"}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
