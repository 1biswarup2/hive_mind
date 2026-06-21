import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api, { formatApiError } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { CalendarIcon, ArrowLeft, Sparkles } from "lucide-react";
import { toast } from "sonner";

const DIFFICULTIES = [
  { value: "easy", label: "Easy", credits: 100 },
  { value: "medium", label: "Medium", credits: 300 },
  { value: "hard", label: "Hard", credits: 600 },
  { value: "expert", label: "Expert", credits: 1000 },
];

export default function NewRequest() {
  const navigate = useNavigate();
  const [categories, setCategories] = useState([]);
  const [depts, setDepts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    title: "", description: "", category: "", tags: "",
    difficulty: "medium", bounty_credits: 300, visibility: "org",
    department: "", due_date: null,
  });

  useEffect(() => {
    api.get("/org/categories").then((r) => setCategories(r.data));
    api.get("/org/departments").then((r) => setDepts(r.data));
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = {
        ...form,
        tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean),
        due_date: form.due_date ? form.due_date.toISOString() : null,
        bounty_credits: Number(form.bounty_credits),
      };
      const { data } = await api.post("/requests", payload);
      toast.success("Request published");
      navigate(`/app/requests/${data.id}`);
    } catch (err) {
      toast.error(formatApiError(err.response?.data?.detail) || err.message);
    } finally {
      setLoading(false);
    }
  };

  const setDifficulty = (v) => {
    const d = DIFFICULTIES.find((x) => x.value === v);
    setForm({ ...form, difficulty: v, bounty_credits: d?.credits ?? form.bounty_credits });
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <button onClick={() => navigate(-1)} className="text-sm text-slate-500 hover:text-slate-900 flex items-center gap-1" data-testid="back-btn">
        <ArrowLeft className="h-4 w-4" /> Back
      </button>
      <div>
        <div className="text-xs font-mono uppercase tracking-[0.3em] text-blue-600">New Request</div>
        <h1 className="font-display text-4xl font-bold tracking-tighter mt-2">What do you need?</h1>
        <p className="text-slate-600 mt-1">Write it like you'd ask a smart colleague over coffee. Be specific.</p>
      </div>

      <Card className="border-slate-200">
        <CardContent className="p-8">
          <form onSubmit={submit} className="space-y-5">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium uppercase tracking-wider">Title</Label>
              <Input
                required
                value={form.title}
                data-testid="new-title"
                placeholder="Need intro to a CTO at a Series B fintech in India"
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="h-12 text-base"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium uppercase tracking-wider">Description</Label>
              <Textarea
                required
                rows={5}
                value={form.description}
                data-testid="new-description"
                placeholder="Context, why you're asking, what good looks like…"
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium uppercase tracking-wider">Category</Label>
                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                  <SelectTrigger data-testid="new-category" required><SelectValue placeholder="Choose…" /></SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium uppercase tracking-wider">Department (optional)</Label>
                <Select value={form.department} onValueChange={(v) => setForm({ ...form, department: v })}>
                  <SelectTrigger data-testid="new-department"><SelectValue placeholder="Any" /></SelectTrigger>
                  <SelectContent>
                    {depts.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium uppercase tracking-wider">Tags (comma separated)</Label>
              <Input
                value={form.tags}
                data-testid="new-tags"
                placeholder="fintech, cto, networking"
                onChange={(e) => setForm({ ...form, tags: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium uppercase tracking-wider">Difficulty</Label>
                <Select value={form.difficulty} onValueChange={setDifficulty}>
                  <SelectTrigger data-testid="new-difficulty"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DIFFICULTIES.map((d) => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium uppercase tracking-wider">Bounty (credits)</Label>
                <Input
                  type="number" min="0" required
                  value={form.bounty_credits}
                  data-testid="new-bounty"
                  onChange={(e) => setForm({ ...form, bounty_credits: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium uppercase tracking-wider">Due date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" data-testid="new-duedate" className="w-full justify-start font-normal">
                      <CalendarIcon className="h-4 w-4 mr-2" />
                      {form.due_date ? format(form.due_date, "PPP") : "Optional"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={form.due_date}
                      onSelect={(d) => setForm({ ...form, due_date: d })}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 flex items-start gap-3">
              <Sparkles className="h-5 w-5 text-blue-600 mt-0.5" />
              <div className="text-sm text-blue-900">
                <div className="font-semibold">Pro tip</div>
                <p>The clearer your description, the faster you'll get matched. Mention the company, role, timeline.</p>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => navigate(-1)} data-testid="new-cancel">Cancel</Button>
              <Button type="submit" disabled={loading} data-testid="new-submit" className="bg-blue-600 hover:bg-blue-700">
                {loading ? "Publishing…" : "Publish request"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
