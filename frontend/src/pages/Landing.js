import { Link } from "react-router-dom";
import { ArrowRight, Hexagon, Sparkles, Users, Award, BarChart3, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Landing() {
  return (
    <div className="min-h-screen bg-white">
      <header className="glass-nav sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2" data-testid="landing-logo">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-blue-600 to-blue-800 grid place-items-center text-white">
              <Hexagon className="h-5 w-5" />
            </div>
            <span className="font-display font-bold text-lg">Jugaad</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link to="/login" className="text-sm font-medium hover:text-blue-600" data-testid="nav-signin">
              Sign in
            </Link>
            <Button asChild data-testid="nav-get-started" className="bg-blue-600 hover:bg-blue-700">
              <Link to="/login?tab=org">Start free <ArrowRight className="h-4 w-4 ml-1" /></Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="bg-grid relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 pt-20 pb-24 relative">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-slate-200 bg-white text-xs font-medium text-slate-700">
            <Sparkles className="h-3 w-3 text-blue-600" /> Internal Contribution Economy · Built for enterprises
          </div>
          <h1 className="font-display mt-6 text-5xl sm:text-6xl lg:text-7xl font-bold leading-[0.95] tracking-tighter max-w-4xl">
            Your org's <span className="text-blue-600">hidden knowledge</span>,<br />
            finally compounding.
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-slate-600 leading-relaxed">
            Jugaad is an internal marketplace where employees post real problems —
            intros, vendors, hiring, research, market intel — and earn credits when they solve
            them for each other. Not a ticketing tool. A contribution economy.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Button asChild size="lg" data-testid="hero-cta" className="bg-blue-600 hover:bg-blue-700 h-12 px-6">
              <Link to="/login?tab=org">Spin up your org <ArrowRight className="h-4 w-4 ml-2" /></Link>
            </Button>
            <Button asChild size="lg" variant="outline" data-testid="hero-demo" className="h-12 px-6">
              <Link to="/login">Try the demo →</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-24 bg-slate-50 border-y border-slate-200">
        <div className="max-w-7xl mx-auto px-6">
          <div className="max-w-2xl">
            <div className="text-xs font-mono uppercase tracking-[0.3em] text-blue-600">How it works</div>
            <h2 className="font-display text-4xl font-bold mt-3 tracking-tight">
              Four moves. Compounding leverage.
            </h2>
          </div>
          <div className="mt-12 grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Feature i="01" icon={Zap} title="Post a request"
              desc="Need an intro to a Jio exec? A vendor for IoT sensors? Drop a bounty in credits and publish." />
            <Feature i="02" icon={Users} title="Get matched"
              desc="The right colleagues see the right asks. Claim, collaborate, or refer a teammate." />
            <Feature i="03" icon={Award} title="Submit proof"
              desc="Attach the intro email, the doc, the link. Creator reviews and approves." />
            <Feature i="04" icon={BarChart3} title="Earn & redeem"
              desc="Credits flow automatically. Redeem for cash, gift cards, leave, conference budgets, ESOPs." />
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h3 className="font-display text-4xl font-bold tracking-tight">
            Stop losing the smartest person you didn't know worked here.
          </h3>
          <p className="mt-4 text-slate-600 text-lg">
            Jugaad makes expertise discoverable, incentivised, and measurable.
          </p>
          <div className="mt-8">
            <Button asChild size="lg" data-testid="footer-cta" className="bg-blue-600 hover:bg-blue-700 h-12 px-6">
              <Link to="/login?tab=org">Get started — it's free <ArrowRight className="h-4 w-4 ml-2" /></Link>
            </Button>
          </div>
        </div>
      </section>

      <footer className="border-t border-slate-200 py-8 text-center text-sm text-slate-500">
        © {new Date().getFullYear()} Jugaad
      </footer>
    </div>
  );
}

const Feature = ({ i, icon: Icon, title, desc }) => (
  <div className="bg-white rounded-2xl border border-slate-200 p-6 card-hover">
    <div className="flex items-center justify-between">
      <span className="font-mono text-xs text-slate-400">{i}</span>
      <Icon className="h-5 w-5 text-blue-600" />
    </div>
    <h3 className="mt-6 font-display text-xl font-semibold tracking-tight">{title}</h3>
    <p className="mt-2 text-sm text-slate-600 leading-relaxed">{desc}</p>
  </div>
);
