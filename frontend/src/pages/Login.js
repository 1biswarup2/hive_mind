import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Hexagon, ArrowRight, AlertCircle } from "lucide-react";
import { formatApiError } from "@/lib/api";
import { toast } from "sonner";

const SHOW_DEMO = process.env.REACT_APP_SHOW_DEMO_HINTS === "true";

export default function Login() {
  const navigate = useNavigate();
  const { login, register, registerOrg } = useAuth();
  const [tab, setTab] = useState("login");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [li, setLi] = useState({ email: "", password: "" });
  const [re, setRe] = useState({ org_domain: "", name: "", email: "", password: "", department: "Engineering" });
  // org register
  const [ro, setRo] = useState({ org_name: "", org_domain: "", admin_name: "", admin_email: "", admin_password: "" });

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (tab === "login") {
        await login(li.email, li.password);
      } else if (tab === "employee") {
        await register(re);
        toast.success("Account created. Check your email to verify your address.");
      } else {
        await registerOrg(ro);
        toast.success("Organization created. Check your email to verify your address.");
      }
      navigate("/app");
    } catch (err) {
      setError(formatApiError(err.response?.data?.detail) || err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* Left — form */}
      <div className="flex flex-col px-6 sm:px-12 py-10 bg-white">
        <Link to="/" className="flex items-center gap-2 self-start" data-testid="logo-link">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-blue-600 to-blue-800 grid place-items-center text-white">
            <Hexagon className="h-5 w-5" />
          </div>
          <span className="font-display font-bold text-lg">Jugaad</span>
        </Link>

        <div className="flex-1 grid place-items-center">
          <div className="w-full max-w-md">
            <h1 className="font-display text-4xl font-bold tracking-tight">
              Welcome to the <span className="text-blue-600">hive</span>.
            </h1>
            <p className="mt-3 text-slate-600">
              Sign in to post problems, claim bounties, and grow your reputation inside your organization.
            </p>

            <Tabs value={tab} onValueChange={setTab} className="mt-8">
              <TabsList className="grid grid-cols-3 w-full">
                <TabsTrigger value="login" data-testid="tab-login">Sign in</TabsTrigger>
                <TabsTrigger value="employee" data-testid="tab-employee">Join org</TabsTrigger>
                <TabsTrigger value="org" data-testid="tab-org">New org</TabsTrigger>
              </TabsList>

              <form onSubmit={submit} className="mt-6 space-y-4">
                {error && (
                  <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm" data-testid="auth-error">
                    <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                <TabsContent value="login" className="space-y-4 mt-0">
                  <Field label="Email" htmlFor="email">
                    <Input id="email" type="email" required value={li.email}
                           data-testid="login-email-input"
                           onChange={(e) => setLi({ ...li, email: e.target.value })} />
                  </Field>
                  <Field label="Password" htmlFor="password">
                    <Input id="password" type="password" required value={li.password}
                           data-testid="login-password-input"
                           onChange={(e) => setLi({ ...li, password: e.target.value })} />
                  </Field>
                  {SHOW_DEMO && (
                    <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 text-xs text-slate-600 font-mono">
                      <div className="font-semibold text-slate-800 mb-1">Demo accounts</div>
                      admin@acme.com / Admin@123<br />
                      priya@acme.com / Priya@123
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="employee" className="space-y-4 mt-0">
                  <Field label="Organization domain" htmlFor="org_domain">
                    <Input id="org_domain" required value={re.org_domain}
                           placeholder="acme.com" data-testid="register-org-domain"
                           onChange={(e) => setRe({ ...re, org_domain: e.target.value })} />
                  </Field>
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Full name">
                      <Input required value={re.name} data-testid="register-name"
                             onChange={(e) => setRe({ ...re, name: e.target.value })} />
                    </Field>
                    <Field label="Department">
                      <Input value={re.department} data-testid="register-department"
                             onChange={(e) => setRe({ ...re, department: e.target.value })} />
                    </Field>
                  </div>
                  <Field label="Work email">
                    <Input type="email" required value={re.email} data-testid="register-email"
                           onChange={(e) => setRe({ ...re, email: e.target.value })} />
                  </Field>
                  <Field label="Password">
                    <Input type="password" required value={re.password} data-testid="register-password"
                           onChange={(e) => setRe({ ...re, password: e.target.value })} />
                  </Field>
                </TabsContent>

                <TabsContent value="org" className="space-y-4 mt-0">
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Organization name">
                      <Input required value={ro.org_name} data-testid="org-name-input"
                             onChange={(e) => setRo({ ...ro, org_name: e.target.value })} />
                    </Field>
                    <Field label="Domain">
                      <Input required value={ro.org_domain} placeholder="company.com"
                             data-testid="org-domain-input"
                             onChange={(e) => setRo({ ...ro, org_domain: e.target.value })} />
                    </Field>
                  </div>
                  <Field label="Your name">
                    <Input required value={ro.admin_name} data-testid="org-admin-name"
                           onChange={(e) => setRo({ ...ro, admin_name: e.target.value })} />
                  </Field>
                  <Field label="Your email">
                    <Input type="email" required value={ro.admin_email} data-testid="org-admin-email"
                           onChange={(e) => setRo({ ...ro, admin_email: e.target.value })} />
                  </Field>
                  <Field label="Password">
                    <Input type="password" required value={ro.admin_password} data-testid="org-admin-password"
                           onChange={(e) => setRo({ ...ro, admin_password: e.target.value })} />
                  </Field>
                </TabsContent>

                <Button
                  type="submit"
                  disabled={loading}
                  data-testid="auth-submit-btn"
                  className="w-full bg-blue-600 hover:bg-blue-700 h-11"
                >
                  {loading ? "Please wait…" : tab === "login" ? "Sign in" : "Create account"}
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </form>
            </Tabs>
          </div>
        </div>

        <div className="text-xs text-slate-500 self-start">
          © {new Date().getFullYear()} Jugaad · Internal Contribution Economy
        </div>
      </div>

      {/* Right — hero */}
      <div
        className="hidden lg:block relative overflow-hidden bg-slate-900"
        style={{
          backgroundImage:
            "url('https://images.pexels.com/photos/3137072/pexels-photo-3137072.jpeg')",
          backgroundSize: "cover", backgroundPosition: "center",
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-tr from-slate-950/90 via-slate-900/60 to-slate-900/20" />
        <div className="relative h-full flex flex-col justify-end p-12 text-white">
          <div className="font-mono text-xs uppercase tracking-[0.3em] text-blue-300 mb-4">
            Operating system for organizational knowledge
          </div>
          <h2 className="font-display text-4xl xl:text-5xl leading-[1.05] font-bold tracking-tighter max-w-md">
            Turn quiet expertise into measurable impact.
          </h2>
          <p className="mt-4 text-slate-300 max-w-md">
            Post a request. Get matched. Earn credits. Redeem rewards.
            Jugaad unlocks the smartest person you didn't know worked here.
          </p>
          <div className="mt-8 grid grid-cols-3 gap-6 max-w-md">
            <Stat k="2.4k" v="Requests solved" />
            <Stat k="98%" v="Approval rate" />
            <Stat k="13h" v="Avg resolution" />
          </div>
        </div>
      </div>
    </div>
  );
}

const Field = ({ label, htmlFor, children }) => (
  <div className="space-y-1.5">
    <Label htmlFor={htmlFor} className="text-xs font-medium text-slate-700 uppercase tracking-wider">{label}</Label>
    {children}
  </div>
);

const Stat = ({ k, v }) => (
  <div>
    <div className="font-display text-3xl font-bold">{k}</div>
    <div className="text-xs uppercase tracking-wider text-slate-400 mt-1">{v}</div>
  </div>
);
