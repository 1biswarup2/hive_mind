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
import { Users, Tags, Settings as Sett, Activity, Plus, Gift, Receipt, Upload, Trash2, CheckCircle, XCircle, AlertCircle } from "lucide-react";
import { initials, timeAgo } from "@/lib/utils";
import { toast } from "sonner";

const ROLES = ["admin", "manager", "reviewer", "employee"];

function nameFromEmail(email) {
  const local = email.split("@")[0] || "";
  return local
    .split(/[._\-+]/)
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
    .join(" ");
}

function newImportRow() {
  return { id: Math.random().toString(36).slice(2), email: "", department: "" };
}

export default function Admin() {
  const { org, user } = useAuth();
  const [users, setUsers] = useState([]);
  const [cats, setCats] = useState([]);
  const [logs, setLogs] = useState([]);
  const [newCat, setNewCat] = useState("");
  const [orgForm, setOrgForm] = useState({ name: "", credit_value_inr: 5, cash_redemption_enabled: true });
  const [rewards, setRewards] = useState([]);
  const [rewardForm, setRewardForm] = useState({ name: "", credits: 100, image: "", stock: 50 });
  const [redemptions, setRedemptions] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [newDept, setNewDept] = useState("");

  // Bulk import state
  const [importRows, setImportRows] = useState([newImportRow()]);
  const [bulkDept, setBulkDept] = useState("");
  const [csvText, setCsvText] = useState("");
  const [importResult, setImportResult] = useState(null);
  const [importing, setImporting] = useState(false);

  const load = async () => {
    const [a, b, c, d, e, f] = await Promise.all([
      api.get("/users"), api.get("/org/categories"), api.get("/audit-logs"),
      api.get("/rewards/admin"), api.get("/redemptions/admin"), api.get("/org/departments"),
    ]);
    setUsers(a.data); setCats(b.data); setLogs(c.data); setRewards(d.data);
    setRedemptions(e.data); setDepartments(f.data);
  };
  useEffect(() => { load(); }, []);
  useEffect(() => {
    if (org) setOrgForm({
      name: org.name,
      credit_value_inr: org.credit_value_inr || 5,
      cash_redemption_enabled: org.cash_redemption_enabled !== false,
    });
  }, [org]);

  if (user?.role !== "admin") return <div className="text-sm text-slate-500">Admin only.</div>;

  const changeRole = async (uid, role) => {
    if (uid === user.id) return toast.error("You cannot change your own role");
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
      await api.patch("/org", {
        name: orgForm.name,
        credit_value_inr: Number(orgForm.credit_value_inr),
        cash_redemption_enabled: orgForm.cash_redemption_enabled,
      });
      toast.success("Organization updated");
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail) || e.message); }
  };

  const addReward = async () => {
    if (!rewardForm.name.trim()) return toast.error("Reward name is required");
    try {
      await api.post("/rewards", {
        name: rewardForm.name.trim(),
        credits: Number(rewardForm.credits),
        image: rewardForm.image.trim() || null,
        stock: Number(rewardForm.stock),
        reward_type: "catalog",
      });
      setRewardForm({ name: "", credits: 100, image: "", stock: 50 });
      load();
      toast.success("Reward added to catalog");
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail) || e.message); }
  };

  const setRedemptionStatus = async (id, status) => {
    try {
      await api.patch(`/redemptions/${id}/status`, { status });
      load();
      toast.success(
        status === "fulfilled" ? "Redemption marked fulfilled"
          : status === "rejected" ? "Redemption rejected — credits refunded"
          : "Redemption reopened"
      );
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail) || e.message); }
  };

  const toggleReward = async (reward) => {
    try {
      await api.patch(`/rewards/${reward.id}`, { active: !reward.active });
      load();
      toast.success(reward.active ? "Reward deactivated" : "Reward activated");
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail) || e.message); }
  };

  const deleteReward = async (reward) => {
    if (!window.confirm(`Delete "${reward.name}"? This cannot be undone.`)) return;
    try {
      await api.delete(`/rewards/${reward.id}`);
      load();
      toast.success("Reward deleted");
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail) || e.message); }
  };

  const addDepartment = async () => {
    if (!newDept.trim()) return;
    try {
      const res = await api.post("/org/departments", { name: newDept.trim() });
      setDepartments(res.data);
      setNewDept("");
      toast.success("Department added");
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail) || e.message); }
  };

  const updateRow = (id, field, value) => {
    setImportRows((rows) => rows.map((r) => r.id === id ? { ...r, [field]: value } : r));
  };
  const addRow = () => setImportRows((rows) => [...rows, newImportRow()]);
  const removeRow = (id) => setImportRows((rows) => rows.filter((r) => r.id !== id));

  const parseCsv = () => {
    const lines = csvText.trim().split("\n").filter(Boolean);
    const parsed = [];
    for (const line of lines) {
      const [emailRaw, deptRaw] = line.split(",").map((s) => s.trim());
      if (emailRaw && emailRaw.includes("@")) {
        parsed.push({ id: Math.random().toString(36).slice(2), email: emailRaw.toLowerCase(), department: deptRaw || "" });
      }
    }
    if (parsed.length === 0) return toast.error("No valid emails found in CSV");
    setImportRows(parsed);
    setCsvText("");
    toast.success(`Parsed ${parsed.length} rows`);
  };

  const runImport = async () => {
    const employees = importRows
      .filter((r) => r.email.trim())
      .map((r) => ({ email: r.email.trim().toLowerCase(), department: r.department.trim() || undefined }));
    if (employees.length === 0) return toast.error("Add at least one email to import");
    setImporting(true);
    setImportResult(null);
    try {
      const res = await api.post("/users/bulk-import", {
        employees,
        bulk_department: bulkDept || undefined,
      });
      setImportResult(res.data);
      if (res.data.summary.created > 0) {
        toast.success(`${res.data.summary.created} employee(s) imported successfully`);
        load();
        setImportRows([newImportRow()]);
        setBulkDept("");
      } else {
        toast.warning("No new employees were created");
      }
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail) || e.message);
    } finally {
      setImporting(false);
    }
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
          <TabsTrigger value="import" data-testid="admin-tab-import"><Upload className="h-4 w-4 mr-1" /> Import</TabsTrigger>
          <TabsTrigger value="categories" data-testid="admin-tab-categories"><Tags className="h-4 w-4 mr-1" /> Categories</TabsTrigger>
          <TabsTrigger value="rewards" data-testid="admin-tab-rewards"><Gift className="h-4 w-4 mr-1" /> Rewards</TabsTrigger>
          <TabsTrigger value="redemptions" data-testid="admin-tab-redemptions"><Receipt className="h-4 w-4 mr-1" /> Redeem activity</TabsTrigger>
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
                      <div className="font-semibold">{u.name}{u.id === user.id && <span className="ml-1 text-xs font-normal text-slate-400">(you)</span>}</div>
                      <div className="text-xs text-slate-500">{u.email} · {u.department}</div>
                    </div>
                    <div className="font-mono text-xs text-slate-500">{u.credits_earned}c earned</div>
                    <Select value={u.role} onValueChange={(v) => changeRole(u.id, v)} disabled={u.id === user.id}>
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

        <TabsContent value="import" className="mt-6 space-y-6">
          {/* Domain notice */}
          {org && (
            <div className="flex items-start gap-2 text-sm bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-blue-800">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>Only emails with domain <strong>@{org.domain}</strong> can be imported.</span>
            </div>
          )}

          {/* CSV paste */}
          <Card className="border-slate-200">
            <CardContent className="p-6">
              <h3 className="font-display text-base font-semibold mb-1">Paste CSV</h3>
              <p className="text-xs text-slate-500 mb-3">
                One entry per line: <code className="bg-slate-100 px-1 rounded">email,department</code> — department is optional.
              </p>
              <textarea
                className="w-full h-28 text-sm font-mono border border-slate-200 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                placeholder={"john.doe@acme.com,Engineering\njane.smith@acme.com,Sales\nbob@acme.com"}
                value={csvText}
                onChange={(e) => setCsvText(e.target.value)}
                data-testid="import-csv-textarea"
              />
              <Button
                size="sm"
                variant="outline"
                className="mt-2"
                onClick={parseCsv}
                disabled={!csvText.trim()}
                data-testid="import-parse-csv-btn"
              >
                Parse CSV into rows
              </Button>
            </CardContent>
          </Card>

          {/* Bulk department */}
          <Card className="border-slate-200">
            <CardContent className="p-6 space-y-4">
              <h3 className="font-display text-base font-semibold">Bulk settings</h3>
              <Field label="Apply department to all rows (unless overridden per row)">
                <Select value={bulkDept} onValueChange={setBulkDept}>
                  <SelectTrigger data-testid="import-bulk-dept">
                    <SelectValue placeholder="— pick department —" />
                  </SelectTrigger>
                  <SelectContent>
                    {departments.map((d) => (
                      <SelectItem key={d} value={d}>{d}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </CardContent>
          </Card>

          {/* Row table */}
          <Card className="border-slate-200">
            <CardContent className="p-6">
              <h3 className="font-display text-base font-semibold mb-4">Employee rows</h3>
              <div className="space-y-2">
                <div className="grid grid-cols-[1fr_180px_120px_32px] gap-2 text-xs font-medium uppercase tracking-wider text-slate-500 px-1">
                  <span>Email</span>
                  <span>Department (optional)</span>
                  <span>Name preview</span>
                  <span />
                </div>
                {importRows.map((row) => (
                  <div key={row.id} className="grid grid-cols-[1fr_180px_120px_32px] gap-2 items-center">
                    <Input
                      type="email"
                      placeholder={org ? `name@${org.domain}` : "name@company.com"}
                      value={row.email}
                      onChange={(e) => updateRow(row.id, "email", e.target.value)}
                      className="text-sm"
                      data-testid={`import-row-email-${row.id}`}
                    />
                    <Select
                      value={row.department || "__bulk__"}
                      onValueChange={(v) => updateRow(row.id, "department", v === "__bulk__" ? "" : v)}
                    >
                      <SelectTrigger className="text-sm" data-testid={`import-row-dept-${row.id}`}>
                        <SelectValue placeholder={bulkDept || "— bulk —"} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__bulk__">— use bulk —</SelectItem>
                        {departments.map((d) => (
                          <SelectItem key={d} value={d}>{d}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <span className="text-xs text-slate-500 truncate">
                      {row.email.includes("@") ? nameFromEmail(row.email) : "—"}
                    </span>
                    <button
                      className="text-slate-400 hover:text-red-500 transition-colors"
                      onClick={() => removeRow(row.id)}
                      title="Remove row"
                      data-testid={`import-row-remove-${row.id}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
              <Button size="sm" variant="outline" onClick={addRow} className="mt-3" data-testid="import-add-row-btn">
                <Plus className="h-4 w-4 mr-1" /> Add row
              </Button>
            </CardContent>
          </Card>

          {/* Import button */}
          <div className="flex gap-3 items-center">
            <Button
              className="bg-blue-600 hover:bg-blue-700"
              onClick={runImport}
              disabled={importing}
              data-testid="import-submit-btn"
            >
              <Upload className="h-4 w-4 mr-2" />
              {importing ? "Importing…" : `Import ${importRows.filter((r) => r.email.trim()).length} employee(s)`}
            </Button>
            <p className="text-xs text-slate-500">
              Each employee will receive an invite email with a temporary password.
            </p>
          </div>

          {/* Results */}
          {importResult && (
            <Card className="border-slate-200">
              <CardContent className="p-6 space-y-4">
                <h3 className="font-display text-base font-semibold">Import results</h3>
                <div className="flex gap-4 text-sm">
                  <span className="flex items-center gap-1 text-green-700 font-medium">
                    <CheckCircle className="h-4 w-4" /> {importResult.summary.created} created
                  </span>
                  <span className="flex items-center gap-1 text-amber-600 font-medium">
                    <AlertCircle className="h-4 w-4" /> {importResult.summary.skipped} skipped
                  </span>
                  <span className="flex items-center gap-1 text-red-600 font-medium">
                    <XCircle className="h-4 w-4" /> {importResult.summary.errors} errors
                  </span>
                </div>
                {importResult.created.length > 0 && (
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wider text-slate-500 mb-2">Created</p>
                    <div className="space-y-1">
                      {importResult.created.map((r) => (
                        <div key={r.email} className="flex items-center gap-3 text-sm">
                          <CheckCircle className="h-3.5 w-3.5 text-green-600 shrink-0" />
                          <span className="font-medium">{r.name}</span>
                          <span className="text-slate-500">{r.email}</span>
                          <Badge variant="outline" className="text-xs">{r.department}</Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {importResult.skipped.length > 0 && (
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wider text-slate-500 mb-2">Skipped (already exists)</p>
                    <div className="space-y-1">
                      {importResult.skipped.map((r) => (
                        <div key={r.email} className="flex items-center gap-3 text-sm text-amber-700">
                          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                          <span>{r.email}</span>
                          <span className="text-xs text-slate-400">{r.reason}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {importResult.errors.length > 0 && (
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wider text-slate-500 mb-2">Errors</p>
                    <div className="space-y-1">
                      {importResult.errors.map((r) => (
                        <div key={r.email} className="flex items-center gap-3 text-sm text-red-700">
                          <XCircle className="h-3.5 w-3.5 shrink-0" />
                          <span>{r.email}</span>
                          <span className="text-xs text-slate-400">{r.reason}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="categories" className="mt-6 space-y-6">
          <Card className="border-slate-200">
            <CardContent className="p-6">
              <h3 className="font-display text-base font-semibold mb-3">Request categories</h3>
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
          <Card className="border-slate-200">
            <CardContent className="p-6">
              <h3 className="font-display text-base font-semibold mb-3">Departments</h3>
              <div className="flex gap-2 mb-4">
                <Input
                  placeholder="New department name"
                  value={newDept}
                  onChange={(e) => setNewDept(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addDepartment()}
                  data-testid="new-department-input"
                />
                <Button onClick={addDepartment} className="bg-blue-600 hover:bg-blue-700" data-testid="add-department-btn"><Plus className="h-4 w-4 mr-1" /> Add</Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {departments.map((d) => (
                  <Badge key={d} variant="outline" className="text-sm" data-testid={`department-${d}`}>{d}</Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="rewards" className="mt-6 space-y-6">
          <Card className="border-slate-200">
            <CardContent className="p-6">
              <h3 className="font-display text-lg font-semibold mb-4">Add reward to catalog</h3>
              <div className="grid sm:grid-cols-2 gap-4">
                <Field label="Reward name">
                  <Input value={rewardForm.name} onChange={(e) => setRewardForm({ ...rewardForm, name: e.target.value })}
                         placeholder="Amazon Gift Card ₹500" data-testid="admin-reward-name" />
                </Field>
                <Field label="Credits required">
                  <Input type="number" min={1} value={rewardForm.credits}
                         onChange={(e) => setRewardForm({ ...rewardForm, credits: e.target.value })}
                         data-testid="admin-reward-credits" />
                </Field>
                <Field label="Stock">
                  <Input type="number" min={0} value={rewardForm.stock}
                         onChange={(e) => setRewardForm({ ...rewardForm, stock: e.target.value })}
                         data-testid="admin-reward-stock" />
                </Field>
                <Field label="Image URL (optional)">
                  <Input value={rewardForm.image} onChange={(e) => setRewardForm({ ...rewardForm, image: e.target.value })}
                         placeholder="https://..." data-testid="admin-reward-image" />
                </Field>
              </div>
              <Button onClick={addReward} className="mt-4 bg-blue-600 hover:bg-blue-700" data-testid="admin-add-reward-btn">
                <Plus className="h-4 w-4 mr-1" /> Add reward
              </Button>
            </CardContent>
          </Card>

          <Card className="border-slate-200">
            <CardContent className="p-0">
              <div className="divide-y divide-slate-200">
                {rewards.filter((r) => r.reward_type !== "cash").map((r) => (
                  <div key={r.id} className="flex items-center gap-4 p-4" data-testid={`admin-reward-${r.id}`}>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold">{r.name}</div>
                      <div className="text-xs text-slate-500">{r.credits}c · {r.stock} in stock</div>
                    </div>
                    <Badge variant={r.active ? "default" : "outline"}>{r.active ? "Active" : "Inactive"}</Badge>
                    <Button size="sm" variant="outline" onClick={() => toggleReward(r)} data-testid={`toggle-reward-${r.id}`}>
                      {r.active ? "Deactivate" : "Activate"}
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => deleteReward(r)} data-testid={`delete-reward-${r.id}`}>
                      Delete
                    </Button>
                  </div>
                ))}
                {rewards.filter((r) => r.reward_type !== "cash").length === 0 && (
                  <div className="p-8 text-center text-sm text-slate-500">No rewards yet. Add one above.</div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="redemptions" className="mt-6">
          <Card className="border-slate-200">
            <CardContent className="p-0">
              <div className="divide-y divide-slate-200 max-h-[600px] overflow-y-auto">
                {redemptions.map((r) => (
                  <div key={r.id} className="flex items-center gap-4 p-4" data-testid={`admin-redemption-${r.id}`}>
                    <Avatar className="h-9 w-9">
                      <AvatarImage src={r.employee?.avatar_url || ""} />
                      <AvatarFallback>{initials(r.employee?.name || "?")}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold truncate">{r.employee?.name || "—"}</div>
                      <div className="text-xs text-slate-500 truncate">
                        {r.employee?.department || "—"} · {timeAgo(r.created_at)}
                      </div>
                    </div>
                    <div className="min-w-0 hidden sm:block">
                      <div className="text-sm truncate">{r.reward_name}</div>
                      <div className="text-xs text-slate-500">
                        {r.credits}c{r.redemption_type === "cash" && r.cash_inr ? ` · ₹${r.cash_inr.toLocaleString()}` : ""}
                      </div>
                    </div>
                    <Badge variant="outline" className="capitalize">{r.redemption_type}</Badge>
                    <Badge
                      variant={r.status === "fulfilled" ? "default" : r.status === "rejected" ? "destructive" : "outline"}
                      className="capitalize"
                    >
                      {r.status}
                    </Badge>
                    <Select value={r.status} onValueChange={(v) => setRedemptionStatus(r.id, v)}>
                      <SelectTrigger className="w-32" data-testid={`redemption-status-${r.id}`}><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">pending</SelectItem>
                        <SelectItem value="fulfilled">fulfilled</SelectItem>
                        <SelectItem value="rejected">rejected</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                ))}
                {redemptions.length === 0 && (
                  <div className="p-8 text-center text-sm text-slate-500">No redemptions yet.</div>
                )}
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
                <p className="text-xs text-slate-500 mt-1">1 credit = ₹{orgForm.credit_value_inr}. Used for Cashify cash payouts.</p>
              </Field>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={orgForm.cash_redemption_enabled}
                  onChange={(e) => setOrgForm({ ...orgForm, cash_redemption_enabled: e.target.checked })}
                  data-testid="settings-cashify-enabled"
                  className="h-4 w-4 rounded border-slate-300"
                />
                <span className="text-sm">Allow employees to redeem credits as cash (Cashify)</span>
              </label>
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
