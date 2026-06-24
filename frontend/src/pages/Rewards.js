import { useEffect, useState } from "react";
import api, { formatApiError } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Coins, Gift, History, Check, Banknote } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { formatDate } from "@/lib/utils";

export default function Rewards() {
  const { user, org, refresh } = useAuth();
  const [rewards, setRewards] = useState([]);
  const [redemptions, setRedemptions] = useState([]);
  const [confirm, setConfirm] = useState(null);
  const [cashCredits, setCashCredits] = useState(100);
  const [cashConfirm, setCashConfirm] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const [a, b] = await Promise.all([
      api.get("/rewards"), api.get("/redemptions"),
    ]);
    setRewards(a.data); setRedemptions(b.data);
  };
  useEffect(() => { load(); }, []);

  const balance = (user?.credits_earned || 0) - (user?.credits_redeemed || 0);
  const cashRate = org?.credit_value_inr || 5;
  const cashEnabled = org?.cash_redemption_enabled !== false;
  const cashInr = Number(cashCredits) * cashRate;

  const onRedeem = async () => {
    if (!confirm) return;
    setBusy(true);
    try {
      await api.post("/rewards/redeem", { reward_id: confirm.id });
      toast.success(`Redeemed: ${confirm.name}`);
      setConfirm(null);
      await Promise.all([load(), refresh()]);
    } catch (e) {
      const msg = formatApiError(e.response?.data?.detail) || e.message;
      toast.error(msg.includes("verify") ? `${msg} Check your inbox or use the banner to resend.` : msg);
    } finally { setBusy(false); }
  };

  const onRedeemCash = async () => {
    const credits = Number(cashCredits);
    if (credits < 100) return toast.error("Minimum 100 credits for cash payout");
    if (credits > balance) return toast.error("Insufficient credits");
    setBusy(true);
    try {
      await api.post("/rewards/redeem-cash", { credits });
      toast.success(`Cash payout requested — ₹${cashInr.toLocaleString("en-IN")} via Cashify`);
      setCashConfirm(false);
      await Promise.all([load(), refresh()]);
    } catch (e) {
      const msg = formatApiError(e.response?.data?.detail) || e.message;
      toast.error(msg.includes("verify") ? `${msg} Check your inbox or use the banner to resend.` : msg);
    } finally { setBusy(false); }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <div className="text-xs font-mono uppercase tracking-[0.3em] text-blue-600">Rewards</div>
          <h1 className="font-display text-4xl font-bold tracking-tighter mt-2">Spend your credits</h1>
          <p className="text-slate-600 mt-1">Pick a reward from the catalog or redeem credits as cash via Cashify.</p>
        </div>
        <Card className="border-slate-200 min-w-[260px]">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-blue-600 to-blue-800 grid place-items-center text-white">
                <Coins className="h-6 w-6" />
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-widest text-slate-500">Balance</div>
                <div className="font-display text-3xl font-bold tracking-tight" data-testid="balance-display">{balance} <span className="text-sm text-slate-500">credits</span></div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="catalog">
        <TabsList>
          <TabsTrigger value="catalog" data-testid="rewards-tab-catalog"><Gift className="h-4 w-4 mr-2" /> Catalog</TabsTrigger>
          <TabsTrigger value="history" data-testid="rewards-tab-history"><History className="h-4 w-4 mr-2" /> My redemptions</TabsTrigger>
        </TabsList>

        <TabsContent value="catalog" className="mt-6 space-y-6">
          {cashEnabled && (
            <Card className="border-emerald-200 bg-emerald-50/40" data-testid="cashify-card">
              <CardContent className="p-6">
                <div className="flex items-start gap-4 flex-wrap">
                  <div className="h-12 w-12 rounded-xl bg-emerald-600 grid place-items-center text-white shrink-0">
                    <Banknote className="h-6 w-6" />
                  </div>
                  <div className="flex-1 min-w-[200px]">
                    <h3 className="font-display text-xl font-semibold tracking-tight">Cashify — cash payout</h3>
                    <p className="text-sm text-slate-600 mt-1">
                      Convert credits to cash at <span className="font-mono font-semibold">₹{cashRate}/credit</span>.
                      Minimum 100 credits. Payout is processed by your admin.
                    </p>
                    <div className="flex flex-wrap items-end gap-3 mt-4">
                      <div className="space-y-1">
                        <label className="text-xs font-medium uppercase tracking-wider text-slate-600">Credits to redeem</label>
                        <input
                          type="number"
                          min={100}
                          max={balance}
                          value={cashCredits}
                          onChange={(e) => setCashCredits(e.target.value)}
                          data-testid="cashify-credits-input"
                          className="w-32 px-3 py-2 rounded-lg border border-slate-200 text-sm"
                        />
                      </div>
                      <div className="text-sm text-slate-600 pb-2">
                        = <span className="font-display text-2xl font-bold text-emerald-700">₹{cashInr.toLocaleString("en-IN")}</span>
                      </div>
                      <Button
                        onClick={() => setCashConfirm(true)}
                        disabled={balance < 100 || Number(cashCredits) < 100 || Number(cashCredits) > balance}
                        className="bg-emerald-600 hover:bg-emerald-700"
                        data-testid="cashify-redeem-btn"
                      >
                        Redeem as cash
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <div>
            <h3 className="font-display text-lg font-semibold mb-4">Reward catalog</h3>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {rewards.map((r) => {
              const affordable = balance >= r.credits;
              return (
                <Card key={r.id} className="border-slate-200 card-hover overflow-hidden" data-testid={`reward-${r.id}`}>
                  <div
                    className="h-32 bg-slate-100"
                    style={{ backgroundImage: r.image ? `url(${r.image})` : undefined, backgroundSize: "cover", backgroundPosition: "center" }}
                  />
                  <CardContent className="p-4">
                    <div className="font-semibold leading-snug">{r.name}</div>
                    <div className="flex items-center justify-between mt-3">
                      <span className="font-display text-xl font-bold tracking-tight text-blue-600">{r.credits}c</span>
                      <span className="text-xs text-slate-500 font-mono">{r.stock} left</span>
                    </div>
                    <Button
                      onClick={() => setConfirm(r)}
                      disabled={!affordable || r.stock <= 0}
                      data-testid={`redeem-${r.id}`}
                      className="w-full mt-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
                    >
                      {affordable ? "Redeem" : `Need ${r.credits - balance} more`}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="history" className="mt-6">
          <Card className="border-slate-200">
            <CardContent className="p-0">
              {redemptions.length === 0 ? (
                <div className="text-center py-12 text-slate-500 text-sm">No redemptions yet.</div>
              ) : (
                <div className="divide-y divide-slate-200">
                  {redemptions.map((r) => (
                    <div key={r.id} className="flex items-center justify-between p-4" data-testid={`redemption-${r.id}`}>
                      <div>
                        <div className="font-semibold">{r.reward_name}</div>
                        <div className="text-xs text-slate-500">
                          {formatDate(r.created_at)}
                          {r.cash_inr ? ` · ₹${r.cash_inr.toLocaleString("en-IN")}` : ""}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-mono font-bold">−{r.credits}c</div>
                        <div className="text-[10px] uppercase tracking-wider text-amber-700">{r.status}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm redemption</DialogTitle>
            <DialogDescription>
              Spend <span className="font-mono font-semibold">{confirm?.credits} credits</span> on <strong>{confirm?.name}</strong>?
              Your balance will drop to <span className="font-mono">{balance - (confirm?.credits || 0)}</span>.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirm(null)}>Cancel</Button>
            <Button onClick={onRedeem} disabled={busy} className="bg-blue-600 hover:bg-blue-700" data-testid="confirm-redeem">
              <Check className="h-4 w-4 mr-1" /> {busy ? "Processing…" : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={cashConfirm} onOpenChange={setCashConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Cashify payout</DialogTitle>
            <DialogDescription>
              Redeem <span className="font-mono font-semibold">{cashCredits} credits</span> for
              <span className="font-mono font-semibold"> ₹{cashInr.toLocaleString("en-IN")}</span> cash?
              Your balance will drop to <span className="font-mono">{balance - Number(cashCredits)}</span>.
              Admin will process the payout.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCashConfirm(false)}>Cancel</Button>
            <Button onClick={onRedeemCash} disabled={busy} className="bg-emerald-600 hover:bg-emerald-700" data-testid="confirm-cashify">
              <Check className="h-4 w-4 mr-1" /> {busy ? "Processing…" : "Confirm cash payout"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
