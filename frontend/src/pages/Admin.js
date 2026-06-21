import { useEffect, useState } from "react";
import api, { formatApiError } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Users, Tags, Settings as Sett, Activity, Plus } from "lucide-react";
import { initials, timeAgo } from "@/lib/utils";
import { toast } from "sonner";

const ROLES = ["admin", "manager", "reviewer", "employee"];

export default function Admin() {
  const { org, user } = useAuth();
  const [users, setUsers] = useState([]);
  const [cats, setCats] = useState([]);
  const [logs, setLogs] = useState([]);
  const [newCat, setNewCat] = useState("");
  const [orgForm, setOrgForm] = useState({ name: "", credit_value_inr: 5 });

  const load = async () => {
    const [a, b, c] = await Promise.all([
      api.get("/users"), api.get("/org/categories"), api.get("/audit-logs"),
    ]);
    setUsers(a.data); setCats(b.data); setLogs(c.data);
  };
  useEffect(() => { load(); }, []);
  useEffect(() => {
    if (org) setOrgForm({ name: org.name, credit_value_inr: org.credit_value_inr || 5 });
  }, [org]);

  if (user?.role !== "admin") return <div className="text-sm text-slate-500">Admin only.</div>;

  const changeRole = async (uid, role) => {
    try {
      await api.patch(`/users/${uid}/role`, { role });
      toast.success("Role updated");
      load();
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail) || e.message); }
  };

  const addCategory = async () => {
    if (!newCat.trim()) return;
    try {
      await api.post("/org/categories", { name: newCat.trim() });
      setNewCat(""); load();
      toast.success("Category added");
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail) || e.message); }
  };

  const saveOrg = async () => {
    try {
      await api.patch("/org", { name: orgForm.name, credit_value_inr: Number(orgForm.credit_value_inr) });
      toast.success("Organization updated");
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail) || e.message); }
  };

  return (
    <div className="space-y-8">
      <div>
        <div className="text-xs font-mono uppercase tracking-[0.3em] text-blue-600">Admin</div>
        <h1 className="font-display text-4xl font-bold tracking-tighter mt-2">Organization controls</h1>
        <p className="text-slate-600 mt-1">Manage users, categories, credit valuation, and audit history.</p>
      </div>

      <Tabs defaultValue="users">
        <TabsList>
          <TabsTrigger value="users" data-testid="admin-tab-users"><Users className="h-4 w-4 mr-1" /> Users</TabsTrigger>
          <TabsTrigger value="categories" data-testid="admin-tab-categories"><Tags className="h-4 w-4 mr-1" /> Categories</TabsTrigger>
          <TabsTrigger value="settings" data-testid="admin-tab-settings"><Sett className="h-4 w-4 mr-1" /> Settings</TabsTrigger>
          <TabsTrigger value="audit" data-testid="admin-tab-audit"><Activity className="h-4 w-4 mr-1" /> Audit log</TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="mt-6">
          <Card className="border-slate-200">
            <CardContent className="p-0">
              <div className="divide-y divide-slate-200">
                {users.map((u) => (
                  <div key={u.id} className="flex items-center gap-4 p-4" data-testid={`admin-user-${u.id}`}>
                    <Avatar className="h-9 w-9">
                      <AvatarImage src={u.avatar_url || ""} />
                      <AvatarFallback>{initials(u.name)}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold">{u.name}</div>
                      <div className="text-xs text-slate-500">{u.email} · {u.department}</div>
                    </div>
                    <div className="font-mono text-xs text-slate-500">{u.credits_earned}c earned</div>
                    <Select value={u.role} onValueChange={(v) => changeRole(u.id, v)}>
                      <SelectTrigger className="w-32" data-testid={`role-select-${u.id}`}><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {ROLES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="categories" className="mt-6">
          <Card className="border-slate-200">
            <CardContent className="p-6">
              <div className="flex gap-2 mb-4">
                <Input
                  placeholder="New category name"
                  value={newCat}
                  onChange={(e) => setNewCat(e.target.value)}
                  data-testid="new-category-input"
                />
                <Button onClick={addCategory} className="bg-blue-600 hover:bg-blue-700" data-testid="add-category-btn"><Plus className="h-4 w-4 mr-1" /> Add</Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {cats.map((c) => (
                  <Badge key={c} variant="outline" className="text-sm" data-testid={`category-${c}`}>{c}</Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="mt-6">
          <Card className="border-slate-200">
            <CardContent className="p-6 max-w-xl space-y-4">
              <Field label="Organization name">
                <Input value={orgForm.name} onChange={(e) => setOrgForm({ ...orgForm, name: e.target.value })} data-testid="settings-org-name" />
              </Field>
              <Field label="Credit valuation (₹ per credit)">
                <Input type="number" value={orgForm.credit_value_inr} onChange={(e) => setOrgForm({ ...orgForm, credit_value_inr: e.target.value })} data-testid="settings-credit-value" />
                <p className="text-xs text-slate-500 mt-1">1 credit = ₹{orgForm.credit_value_inr}. Used in reward valuation.</p>
              </Field>
              <Button onClick={saveOrg} className="bg-blue-600 hover:bg-blue-700" data-testid="settings-save">Save settings</Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="audit" className="mt-6">
          <Card className="border-slate-200">
            <CardContent className="p-0">
              <div className="divide-y divide-slate-200 max-h-[600px] overflow-y-auto">
                {logs.map((l) => (
                  <div key={l.id} className="flex items-center gap-3 p-3 text-sm" data-testid={`log-${l.id}`}>
                    <Avatar className="h-6 w-6">
                      <AvatarImage src={l.actor?.avatar_url || ""} />
                      <AvatarFallback className="text-[8px]">{initials(l.actor?.name || "?")}</AvatarFallback>
                    </Avatar>
                    <span className="font-medium">{l.actor?.name || "—"}</span>
                    <span className="text-slate-500">→</span>
                    <span className="font-mono text-xs bg-slate-100 px-2 py-0.5 rounded">{l.action}</span>
                    <span className="text-xs text-slate-400 ml-auto">{timeAgo(l.timestamp)}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
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
