import { useEffect, useState } from "react";
import api, { formatApiError } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Coins, Gift, History, Check } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { formatDate } from "@/lib/utils";

export default function Rewards() {
  const { user, refresh } = useAuth();
  const [rewards, setRewards] = useState([]);
  const [redemptions, setRedemptions] = useState([]);
  const [confirm, setConfirm] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const [a, b] = await Promise.all([
      api.get("/rewards"), api.get("/redemptions"),
    ]);
    setRewards(a.data); setRedemptions(b.data);
  };
  useEffect(() => { load(); }, []);

  const balance = (user?.credits_earned || 0) - (user?.credits_redeemed || 0);

  const onRedeem = async () => {
    if (!confirm) return;
    setBusy(true);
    try {
      await api.post("/rewards/redeem", { reward_id: confirm.id });
      toast.success(`Redeemed: ${confirm.name}`);
      setConfirm(null);
      await Promise.all([load(), refresh()]);
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail) || e.message);
    } finally { setBusy(false); }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <div className="text-xs font-mono uppercase tracking-[0.3em] text-blue-600">Rewards</div>
          <h1 className="font-display text-4xl font-bold tracking-tighter mt-2">Spend your credits</h1>
          <p className="text-slate-600 mt-1">Choose your reward. Subject to your admin's approval.</p>
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

        <TabsContent value="catalog" className="mt-6">
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
                        <div className="text-xs text-slate-500">{formatDate(r.created_at)}</div>
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
    </div>
  );
}
