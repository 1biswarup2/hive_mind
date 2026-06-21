import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import api, { formatApiError } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Trophy, Coins, Star, Sparkles, Edit3, Save, X } from "lucide-react";
import { initials, statusLabel, timeAgo } from "@/lib/utils";
import { toast } from "sonner";

export default function Profile() {
  const { id: idParam } = useParams();
  const { user: me, refresh } = useAuth();
  const id = idParam === "me" ? me?.id : idParam;
  const [u, setU] = useState(null);
  const [myReqs, setMyReqs] = useState([]);
  const [mySolved, setMySolved] = useState([]);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({});

  const isMe = me?.id === id;

  const load = async () => {
    if (!id) return;
    const { data } = await api.get(`/users/${id}`);
    setU(data);
    setForm({
      name: data.name,
      department: data.department || "",
      designation: data.designation || "",
      avatar_url: data.avatar_url || "",
      skills: (data.skills || []).join(", "),
      expertise_tags: (data.expertise_tags || []).join(", "),
    });
    const [a, b] = await Promise.all([
      api.get(`/requests?creator_id=${id}`),
      api.get(`/requests?claimed_by=${id}&status=completed`),
    ]);
    setMyReqs(a.data); setMySolved(b.data);
  };
  useEffect(() => { load(); }, [id]); // eslint-disable-line

  const save = async () => {
    try {
      await api.patch("/users/me", {
        ...form,
        skills: form.skills.split(",").map((s) => s.trim()).filter(Boolean),
        expertise_tags: form.expertise_tags.split(",").map((s) => s.trim()).filter(Boolean),
      });
      toast.success("Profile updated");
      setEditing(false);
      await Promise.all([load(), refresh()]);
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail) || e.message); }
  };

  if (!u) return <div className="text-slate-500 font-mono text-sm">Loading…</div>;

  return (
    <div className="space-y-8">
      {/* Header */}
      <Card className="border-slate-200 overflow-hidden">
        <div className="h-28 bg-gradient-to-r from-slate-900 via-slate-800 to-blue-900 bg-grid-strong" />
        <CardContent className="p-6 pt-0 -mt-12 relative">
          <div className="flex items-end justify-between flex-wrap gap-4">
            <div className="flex items-end gap-4">
              <Avatar className="h-24 w-24 border-4 border-white shadow-md">
                <AvatarImage src={u.avatar_url || ""} />
                <AvatarFallback className="text-2xl">{initials(u.name)}</AvatarFallback>
              </Avatar>
              <div className="pb-2">
                <div className="font-display text-3xl font-bold tracking-tighter">{u.name}</div>
                <div className="text-sm text-slate-600">{u.designation || "—"} · {u.department}</div>
                <Badge variant="outline" className="mt-2 text-[10px] uppercase">{u.role}</Badge>
              </div>
            </div>
            {isMe && !editing && (
              <Button onClick={() => setEditing(true)} variant="outline" data-testid="edit-profile-btn">
                <Edit3 className="h-4 w-4 mr-2" /> Edit profile
              </Button>
            )}
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 mt-6">
            <Stat icon={Trophy} label="Reputation" value={u.reputation_score} color="text-amber-600" />
            <Stat icon={Coins} label="Credits earned" value={u.credits_earned} color="text-blue-600" />
            <Stat icon={Star} label="Balance" value={u.credits_balance} color="text-emerald-600" />
          </div>

          {editing && (
            <div className="mt-6 space-y-4 p-4 bg-slate-50 rounded-xl border border-slate-200">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Name"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} data-testid="edit-name" /></Field>
                <Field label="Department"><Input value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} data-testid="edit-department" /></Field>
                <Field label="Designation"><Input value={form.designation} onChange={(e) => setForm({ ...form, designation: e.target.value })} data-testid="edit-designation" /></Field>
                <Field label="Avatar URL"><Input value={form.avatar_url} onChange={(e) => setForm({ ...form, avatar_url: e.target.value })} data-testid="edit-avatar" /></Field>
              </div>
              <Field label="Skills (comma separated)"><Input value={form.skills} onChange={(e) => setForm({ ...form, skills: e.target.value })} data-testid="edit-skills" /></Field>
              <Field label="Expertise tags"><Input value={form.expertise_tags} onChange={(e) => setForm({ ...form, expertise_tags: e.target.value })} data-testid="edit-expertise" /></Field>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setEditing(false)} data-testid="edit-cancel"><X className="h-4 w-4 mr-1" /> Cancel</Button>
                <Button onClick={save} className="bg-blue-600 hover:bg-blue-700" data-testid="edit-save"><Save className="h-4 w-4 mr-1" /> Save</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Badges */}
      <Card className="border-slate-200">
        <CardContent className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="h-4 w-4 text-amber-500" />
            <h3 className="font-display text-xl font-semibold tracking-tight">Badges</h3>
          </div>
          {u.badges?.length === 0 ? (
            <div className="text-sm text-slate-500">No badges yet — solve requests to earn your first one.</div>
          ) : (
            <div className="flex flex-wrap gap-3">
              {u.badges.map((b, i) => (
                <div key={i} className={`pill tier-${b.tier} px-3 py-1.5 text-xs font-semibold`} data-testid={`badge-${b.key}-${b.tier}`}>
                  {b.name} · {b.tier.toUpperCase()}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Skills */}
      {(u.skills?.length || u.expertise_tags?.length) > 0 && (
        <Card className="border-slate-200">
          <CardContent className="p-6">
            <h3 className="font-display text-xl font-semibold tracking-tight mb-4">Skills & expertise</h3>
            <div className="flex flex-wrap gap-2">
              {u.skills?.map((s) => <span key={s} className="text-xs font-mono bg-slate-100 border border-slate-200 px-2 py-1 rounded">{s}</span>)}
              {u.expertise_tags?.map((s) => <span key={s} className="text-xs font-mono bg-blue-50 border border-blue-200 text-blue-700 px-2 py-1 rounded">{s}</span>)}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Activity */}
      <Tabs defaultValue="solved">
        <TabsList>
          <TabsTrigger value="solved" data-testid="profile-tab-solved">Solved ({mySolved.length})</TabsTrigger>
          <TabsTrigger value="created" data-testid="profile-tab-created">Created ({myReqs.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="solved" className="mt-4">
          <RequestList items={mySolved} />
        </TabsContent>
        <TabsContent value="created" className="mt-4">
          <RequestList items={myReqs} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

const Field = ({ label, children }) => (
  <div className="space-y-1.5">
    <Label className="text-xs font-medium uppercase tracking-wider">{label}</Label>
    {children}
  </div>
);

const Stat = ({ icon: Icon, label, value, color }) => (
  <div className="p-4 rounded-xl border border-slate-200 bg-white">
    <div className="flex items-center gap-2">
      <Icon className={`h-4 w-4 ${color}`} />
      <span className="text-xs uppercase tracking-widest text-slate-500">{label}</span>
    </div>
    <div className="font-display text-2xl font-bold tracking-tight mt-1">{value}</div>
  </div>
);

function RequestList({ items }) {
  if (items.length === 0) return <div className="text-sm text-slate-500 text-center py-8 border-2 border-dashed border-slate-200 rounded-xl">Nothing here yet.</div>;
  return (
    <Card className="border-slate-200">
      <CardContent className="p-0">
        <div className="divide-y divide-slate-200">
          {items.map((r) => (
            <Link key={r.id} to={`/app/requests/${r.id}`} className="flex items-center gap-3 p-4 hover:bg-slate-50" data-testid={`profile-req-${r.id}`}>
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{r.title}</div>
                <div className="text-xs text-slate-500 mt-0.5">{r.category} · {timeAgo(r.created_at)}</div>
              </div>
              <Badge variant="outline" className="font-mono">{r.bounty_credits}c</Badge>
              <span className={`pill pill-${r.status}`}>{statusLabel(r.status)}</span>
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
