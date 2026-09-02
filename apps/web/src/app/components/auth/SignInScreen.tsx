import { useState } from "react";
import { Mail, Lock, Eye, EyeOff } from "lucide-react";
import { AuthCard } from "./AuthCard";
import { FormInput } from "./FormInput";
import { SignInSchema } from "../../data/onboarding";

export function SignInScreen({
  onSignIn,
  onSetup,
}: {
  onSignIn: (email: string) => void;
  onSetup: () => void;
}) {
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [show, setShow] = useState(false);
  const [err, setErr] = useState<string | undefined>();

  const submit = () => {
    const r = SignInSchema.safeParse({ email, password: pw, rememberMe: false });
    if (!r.success) {
      setErr(r.error.issues[0].message);
      return;
    }
    setErr(undefined);
    onSignIn(email);
  };

  return (
    <AuthCard>
      <div className="mb-2 flex flex-col items-center text-center">
        <p
          style={{
            fontFamily: "var(--font-body)",
            fontSize: "var(--type-label)",
            fontWeight: "var(--weight-bold)",
            letterSpacing: "var(--tracking-label)",
            textTransform: "uppercase",
            color: "var(--text-muted)",
          }}
        >
          WELCOME BACK
        </p>
        <h1
          className="mt-1"
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "var(--type-page-title)",
            fontWeight: "var(--weight-bold)",
            color: "var(--text-primary)",
            lineHeight: "var(--leading-snug)",
          }}
        >
          Check on your clutch.
        </h1>
        <p
          className="mt-1.5 max-w-[340px]"
          style={{
            fontFamily: "var(--font-body)",
            fontSize: "var(--type-body)",
            color: "var(--text-secondary)",
          }}
        >
          Sign in to monitor temperature, humidity and hatch progress across every chamber.
        </p>
      </div>
      <div className="mt-4 flex flex-col gap-4">
        <FormInput
          label="Email"
          id="signin-email"
          icon={Mail}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@brightwoodfarm.com"
          type="email"
          error={err}
        />
        <FormInput
          label="Password"
          id="signin-pw"
          icon={Lock}
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          placeholder="••••••••"
          type={show ? "text" : "password"}
          trailing={
            <button
              type="button"
              onClick={() => setShow(!show)}
              aria-label={show ? "Hide password" : "Show password"}
              className="cursor-pointer rounded-md p-1 text-muted transition-colors hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-primary)] focus-visible:ring-offset-1"
              style={{ color: "var(--text-muted)" }}
            >
              {show ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          }
        />
      </div>
      <div className="mt-3 flex items-center justify-between">
        <label className="flex cursor-pointer items-center gap-2 text-sm" style={{ fontFamily: "var(--font-body)", color: "var(--text-secondary)" }}>
          <input type="checkbox" className="cursor-pointer rounded border-[var(--border-default)]" /> Keep me signed in
        </label>
        <button
          type="button"
          onClick={() => alert("Coming soon")}
          aria-disabled="true"
          className="cursor-pointer text-sm font-semibold text-[var(--brand-primary)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-1"
        >
          Forgot password?
        </button>
      </div>
      <button
        type="button"
        onClick={submit}
        className="mt-6 flex h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-[var(--brand-primary)] font-semibold text-white hover:bg-[var(--brand-primary-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2"
      >
        Sign in →
      </button>
      <div className="my-4 flex items-center gap-3">
        <div className="h-px flex-1 bg-[var(--border-default)]" />
        <span style={{ fontFamily: "var(--font-body)", fontSize: "var(--type-caption)", color: "var(--text-muted)" }}>or</span>
        <div className="h-px flex-1 bg-[var(--border-default)]" />
      </div>
      <button
        type="button"
        onClick={onSetup}
        className="w-full cursor-pointer rounded-xl border border-[var(--border-default)] py-3 font-semibold text-[var(--brand-primary)] transition-colors hover:bg-[var(--surface-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2"
      >
        Set up your farm
      </button>
    </AuthCard>
  );
}
