import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Hexagon, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import api, { formatApiError } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";

export default function VerifyEmail() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { refresh, user } = useAuth();
  const [status, setStatus] = useState("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const token = params.get("token");
    if (!token) {
      setStatus("error");
      setMessage("Missing verification token.");
      return;
    }
    api.post("/auth/verify-email", { token })
      .then(async () => {
        setStatus("success");
        setMessage("Your email is verified. You now have full access.");
        if (user) await refresh();
      })
      .catch((err) => {
        setStatus("error");
        setMessage(
          formatApiError(err.response?.data?.detail) || "This verification link is invalid or has expired."
        );
      });
  }, [params, user, refresh]);

  return (
    <div className="min-h-screen grid place-items-center bg-slate-50 px-4">
      <div className="w-full max-w-md text-center space-y-6">
        <Link to="/" className="inline-flex items-center gap-2">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-600 to-blue-800 grid place-items-center text-white">
            <Hexagon className="h-5 w-5" />
          </div>
          <span className="font-display font-bold text-lg">Jugaad</span>
        </Link>

        <div className="bg-white border border-slate-200 rounded-2xl p-8 shadow-sm">
          {status === "loading" && (
            <>
              <Loader2 className="h-10 w-10 text-blue-600 animate-spin mx-auto" />
              <p className="mt-4 text-slate-600">Verifying your email…</p>
            </>
          )}
          {status === "success" && (
            <>
              <CheckCircle2 className="h-12 w-12 text-emerald-600 mx-auto" data-testid="verify-success" />
              <h1 className="font-display text-2xl font-bold mt-4">Email verified</h1>
              <p className="text-slate-600 mt-2">{message}</p>
              <Button
                className="mt-6 bg-blue-600 hover:bg-blue-700 w-full"
                onClick={() => navigate(user ? "/app" : "/login")}
                data-testid="verify-continue"
              >
                {user ? "Go to dashboard" : "Sign in"}
              </Button>
            </>
          )}
          {status === "error" && (
            <>
              <XCircle className="h-12 w-12 text-red-500 mx-auto" data-testid="verify-error" />
              <h1 className="font-display text-2xl font-bold mt-4">Verification failed</h1>
              <p className="text-slate-600 mt-2">{message}</p>
              <div className="flex flex-col gap-2 mt-6">
                <Button asChild variant="outline">
                  <Link to="/login">Back to sign in</Link>
                </Button>
                {user && (
                  <Button asChild className="bg-blue-600 hover:bg-blue-700">
                    <Link to="/app">Open app to resend email</Link>
                  </Button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
