import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import api, { formatApiError } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  ArrowLeft, Calendar, Coins, Flag, User, Tag, Paperclip, Send,
  Check, X, MessageSquare, Building2,
} from "lucide-react";
import { initials, statusLabel, timeAgo, formatDate } from "@/lib/utils";
import { toast } from "sonner";

export default function RequestDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [r, setR] = useState(null);
  const [solText, setSolText] = useState("");
  const [solLinks, setSolLinks] = useState("");
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewTarget, setReviewTarget] = useState(null);
  const [reviewFeedback, setReviewFeedback] = useState("");

  const load = () => api.get(`/requests/${id}`).then((res) => setR(res.data));
  useEffect(() => { load(); }, [id]);

  if (!r) return <div className="font-mono text-sm text-slate-500">Loading…</div>;

  const isCreator = user?.id === r.creator_id;
  const isClaimer = user?.id === r.claimed_by;
  const canClaim = !r.claimed_by && !isCreator && r.status === "open";
  const canSubmit = isClaimer && ["claimed", "in_progress", "under_review"].includes(r.status);
  const canReview = (isCreator || ["admin", "reviewer", "manager"].includes(user?.role)) && r.solutions?.some((s) => s.status === "pending");

  const onClaim = async () => {
    try {
      await api.post(`/requests/${id}/claim`);
      toast.success("Request claimed");
      load();
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail) || e.message); }
  };

  const onUnclaim = async () => {
    try { await api.post(`/requests/${id}/unclaim`); toast.success("Released"); load(); }
    catch (e) { toast.error(formatApiError(e.response?.data?.detail) || e.message); }
  };

  const onUpload = async (e) => {
    const list = Array.from(e.target.files || []);
    if (!list.length) return;
    setUploading(true);
    try {
      const uploaded = [];
      for (const f of list) {
        const fd = new FormData();
        fd.append("file", f);
        const { data } = await api.post("/files/upload", fd, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        uploaded.push(data);
      }
      setFiles((prev) => [...prev, ...uploaded]);
      toast.success(`${uploaded.length} file(s) attached`);
    } catch (err) {
      toast.error(formatApiError(err.response?.data?.detail) || err.message);
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const onSubmitSolution = async () => {
    if (!solText.trim()) return toast.error("Add a note describing your solution");
    setSubmitting(true);
    try {
      await api.post(`/requests/${id}/solutions`, {
        submission_text: solText,
        links: solLinks.split(",").map((s) => s.trim()).filter(Boolean),
        file_ids: files.map((f) => f.id),
      });
      toast.success("Solution submitted");
      setSolText(""); setSolLinks(""); setFiles([]);
      load();
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail) || e.message); }
    finally { setSubmitting(false); }
  };

  const onReview = async (action) => {
    if (!reviewTarget) return;
    try {
      await api.post(`/solutions/${reviewTarget.id}/review`, {
        action, feedback: reviewFeedback,
      });
      toast.success(
        action === "approve" ? "Approved — credits transferred" :
        action === "reject" ? "Rejected" : "Changes requested"
      );
      setReviewOpen(false); setReviewFeedback(""); setReviewTarget(null);
      load();
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail) || e.message); }
  };

  return (
    <div className="space-y-6">
      <button onClick={() => navigate(-1)} className="text-sm text-slate-500 hover:text-slate-900 flex items-center gap-1" data-testid="detail-back">
        <ArrowLeft className="h-4 w-4" /> Back to board
      </button>

      <div className="grid lg:grid-cols-[1fr_320px] gap-8">
        {/* Main */}
        <div className="space-y-6">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline">{r.category}</Badge>
              <span className={`pill pill-${r.status}`}>{statusLabel(r.status)}</span>
              <span className={`font-mono text-xs font-semibold diff-${r.difficulty}`}>· {r.difficulty?.toUpperCase()}</span>
            </div>
            <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tighter mt-3" data-testid="request-title">{r.title}</h1>
            <p className="mt-4 text-slate-700 whitespace-pre-wrap leading-relaxed">{r.description}</p>
            {r.tags?.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-4">
                {r.tags.map((t) => (
                  <span key={t} className="text-xs font-mono text-slate-600 bg-slate-100 border border-slate-200 px-2 py-1 rounded">#{t}</span>
                ))}
              </div>
            )}
          </div>

          {/* Submit solution */}
          {canSubmit && (
            <Card className="border-blue-200 bg-blue-50/30">
              <CardContent className="p-6">
                <h3 className="font-display text-xl font-semibold tracking-tight mb-1">Submit your solution</h3>
                <p className="text-sm text-slate-600 mb-4">Share proof — links, notes, attachments. The creator will review.</p>
                <div className="space-y-3">
                  <Textarea
                    rows={5}
                    placeholder="What did you do? Who did you connect them with? Add context."
                    value={solText}
                    onChange={(e) => setSolText(e.target.value)}
                    data-testid="solution-text"
                  />
                  <Input
                    placeholder="Links (comma separated)"
                    value={solLinks}
                    onChange={(e) => setSolLinks(e.target.value)}
                    data-testid="solution-links"
                  />
                  <div>
                    <label className="inline-flex items-center gap-2 text-sm text-slate-700 cursor-pointer hover:text-blue-600">
                      <Paperclip className="h-4 w-4" />
                      <span>{uploading ? "Uploading…" : "Attach files"}</span>
                      <input type="file" multiple onChange={onUpload} className="hidden" data-testid="solution-files" />
                    </label>
                    {files.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {files.map((f) => (
                          <span key={f.id} className="text-xs bg-white border border-slate-200 rounded px-2 py-1 font-mono">{f.filename}</span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex justify-end">
                    <Button onClick={onSubmitSolution} disabled={submitting} className="bg-blue-600 hover:bg-blue-700" data-testid="submit-solution-btn">
                      <Send className="h-4 w-4 mr-2" />
                      {submitting ? "Submitting…" : "Submit for review"}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Solutions list */}
          <div>
            <h3 className="font-display text-xl font-semibold tracking-tight mb-3 flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-blue-600" />
              Submissions <span className="text-slate-400 font-mono text-sm">{r.solutions?.length || 0}</span>
            </h3>
            <div className="space-y-3">
              {(r.solutions || []).map((s) => (
                <Card key={s.id} className="border-slate-200" data-testid={`solution-${s.id}`}>
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={s.contributor?.avatar_url || ""} />
                          <AvatarFallback>{initials(s.contributor?.name || "?")}</AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="text-sm font-semibold">{s.contributor?.name}</div>
                          <div className="text-xs text-slate-500">{s.contributor?.designation} · {timeAgo(s.submitted_at)}</div>
                        </div>
                      </div>
                      <Badge variant={s.status === "approved" ? "default" : s.status === "rejected" ? "destructive" : "outline"} className="text-[10px]">
                        {s.status.replace("_", " ")}
                      </Badge>
                    </div>
                    <p className="text-sm text-slate-700 whitespace-pre-wrap">{s.submission_text}</p>
                    {s.links?.length > 0 && (
                      <div className="mt-3 space-y-1">
                        {s.links.map((l, i) => (
                          <a key={i} href={l} target="_blank" rel="noreferrer" className="block text-xs text-blue-600 hover:underline truncate">↗ {l}</a>
                        ))}
                      </div>
                    )}
                    {s.file_ids?.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-3">
                        {s.file_ids.map((fid) => (
                          <a key={fid} href={`${process.env.REACT_APP_BACKEND_URL}/api/files/${fid}/download`} target="_blank" rel="noreferrer" className="text-xs bg-slate-100 border border-slate-200 rounded px-2 py-1 hover:bg-slate-200">
                            <Paperclip className="h-3 w-3 inline mr-1" /> Attachment
                          </a>
                        ))}
                      </div>
                    )}
                    {s.feedback && (
                      <div className="mt-3 p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-700">
                        <span className="font-semibold">Reviewer feedback:</span> {s.feedback}
                      </div>
                    )}
                    {s.status === "pending" && (isCreator || ["admin", "reviewer", "manager"].includes(user?.role)) && (
                      <div className="flex gap-2 mt-4 pt-3 border-t border-slate-200">
                        <Button size="sm" onClick={() => { setReviewTarget(s); setReviewOpen(true); }} data-testid={`review-${s.id}`} className="bg-emerald-600 hover:bg-emerald-700">
                          <Check className="h-4 w-4 mr-1" /> Review
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
              {(!r.solutions || r.solutions.length === 0) && (
                <div className="text-sm text-slate-500 text-center py-8 border-2 border-dashed border-slate-200 rounded-xl">
                  No submissions yet.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <aside className="space-y-4 lg:sticky lg:top-24 self-start">
          <Card className="border-slate-200">
            <CardContent className="p-5 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono uppercase tracking-widest text-slate-500">Bounty</span>
                <Coins className="h-4 w-4 text-amber-500" />
              </div>
              <div className="font-display text-4xl font-bold tracking-tighter text-blue-600">
                {r.bounty_credits}<span className="text-base text-slate-500 ml-1">credits</span>
              </div>

              <div className="space-y-3 pt-3 border-t border-slate-200">
                <Detail icon={User} label="Creator">
                  <Link to={`/app/profile/${r.creator?.id}`} className="hover:text-blue-600 inline-flex items-center gap-2">
                    <Avatar className="h-5 w-5"><AvatarImage src={r.creator?.avatar_url || ""} /><AvatarFallback className="text-[8px]">{initials(r.creator?.name || "?")}</AvatarFallback></Avatar>
                    {r.creator?.name}
                  </Link>
                </Detail>
                <Detail icon={User} label="Claimed by">
                  {r.claimer ? (
                    <Link to={`/app/profile/${r.claimer.id}`} className="hover:text-blue-600 inline-flex items-center gap-2">
                      <Avatar className="h-5 w-5"><AvatarImage src={r.claimer.avatar_url || ""} /><AvatarFallback className="text-[8px]">{initials(r.claimer.name)}</AvatarFallback></Avatar>
                      {r.claimer.name}
                    </Link>
                  ) : <span className="text-slate-400">—</span>}
                </Detail>
                <Detail icon={Building2} label="Department">{r.department || "—"}</Detail>
                <Detail icon={Flag} label="Difficulty"><span className={`diff-${r.difficulty} font-semibold uppercase font-mono text-xs`}>{r.difficulty}</span></Detail>
                <Detail icon={Calendar} label="Created">{formatDate(r.created_at)}</Detail>
                {r.due_date && <Detail icon={Calendar} label="Due">{formatDate(r.due_date)}</Detail>}
                <Detail icon={Tag} label="Category">{r.category}</Detail>
              </div>

              <div className="pt-3 border-t border-slate-200 space-y-2">
                {canClaim && (
                  <Button onClick={onClaim} className="w-full bg-blue-600 hover:bg-blue-700" data-testid="claim-btn">
                    Claim this request
                  </Button>
                )}
                {isClaimer && r.status !== "completed" && (
                  <Button onClick={onUnclaim} variant="outline" className="w-full" data-testid="unclaim-btn">
                    Release claim
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </aside>
      </div>

      {/* Review dialog */}
      <Dialog open={reviewOpen} onOpenChange={setReviewOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Review submission</DialogTitle>
            <DialogDescription>
              Approving will award <span className="font-mono font-semibold">{r.bounty_credits} credits</span> to {reviewTarget?.contributor?.name}.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            rows={4}
            placeholder="Optional feedback for the contributor…"
            value={reviewFeedback}
            onChange={(e) => setReviewFeedback(e.target.value)}
            data-testid="review-feedback"
          />
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => onReview("request_changes")} data-testid="review-request-changes">Request changes</Button>
            <Button variant="destructive" onClick={() => onReview("reject")} data-testid="review-reject">
              <X className="h-4 w-4 mr-1" /> Reject
            </Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={() => onReview("approve")} data-testid="review-approve">
              <Check className="h-4 w-4 mr-1" /> Approve & pay
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

const Detail = ({ icon: Icon, label, children }) => (
  <div className="flex items-start gap-3 text-sm">
    <Icon className="h-4 w-4 text-slate-400 mt-0.5" />
    <div className="flex-1 flex justify-between gap-2">
      <span className="text-slate-500">{label}</span>
      <span className="font-medium text-slate-900 text-right">{children}</span>
    </div>
  </div>
);
