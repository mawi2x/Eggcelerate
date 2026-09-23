import { Eye, EyeOff, Feather, Lock, Mail, User } from "lucide-react";
import { useState } from "react";
import type { RegisterAccountInput } from "../../data/auth/api-auth-client";
import { CreateAccountSchema } from "../../data/onboarding";
import { AuthCard } from "./AuthCard";
import { FormInput } from "./FormInput";

export function CreateAccountScreen({
  onRegister,
  onHaveAccount,
}: {
  onRegister: (input: RegisterAccountInput) => Promise<void>;
  onHaveAccount: () => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [farmName, setFarmName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const submit = async () => {
    const parsed = CreateAccountSchema.safeParse({
      email,
      password,
      confirmPassword,
      displayName,
      farmName,
    });
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const field = String(issue.path[0] ?? "");
        if (field && !next[field]) next[field] = issue.message;
      }
      setFieldErrors(next);
      setError(null);
      return;
    }
    setFieldErrors({});
    setError(null);
    setBusy(true);
    try {
      await onRegister({
        email: parsed.data.email,
        password: parsed.data.password,
        displayName: parsed.data.displayName,
        farmName: parsed.data.farmName,
      });
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Your account could not be created. Try again.",
      );
    } finally {
      setBusy(false);
    }
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
          GET STARTED
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
          Create your farm account.
        </h1>
        <p
          className="mt-1.5 max-w-[var(--measure-auth)]"
          style={{
            fontFamily: "var(--font-body)",
            fontSize: "var(--type-body)",
            color: "var(--text-secondary)",
          }}
        >
          Your account starts with an empty farm. Add your own chamber and
          device ID after setup.
        </p>
        <p
          className="mt-2 max-w-[var(--measure-auth)]"
          style={{
            fontFamily: "var(--font-body)",
            fontSize: "var(--type-caption)",
            color: "var(--text-muted)",
          }}
        >
          Email verification and password recovery are not available yet. Use an
          address you can access.
        </p>
      </div>
      <div className="mt-4 flex flex-col gap-4">
        <FormInput
          label="Your name"
          id="register-name"
          icon={User}
          value={displayName}
          onChange={(event) => setDisplayName(event.target.value)}
          autoComplete="name"
          maxLength={35}
          error={fieldErrors.displayName}
        />
        <FormInput
          label="Farm name"
          id="register-farm"
          icon={Feather}
          value={farmName}
          onChange={(event) => setFarmName(event.target.value)}
          autoComplete="organization"
          maxLength={30}
          error={fieldErrors.farmName}
        />
        <FormInput
          label="Email"
          id="register-email"
          icon={Mail}
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@brightwoodfarm.com"
          error={fieldErrors.email}
        />
        <FormInput
          label="Password"
          id="register-password"
          icon={Lock}
          type={showPassword ? "text" : "password"}
          autoComplete="new-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          minLength={12}
          maxLength={128}
          error={fieldErrors.password}
          trailing={
            <button
              type="button"
              onClick={() => setShowPassword((shown) => !shown)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-md text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] md:h-8 md:w-8"
              style={{ color: "var(--text-muted)" }}
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          }
        />
        <FormInput
          label="Confirm password"
          id="register-confirm-password"
          icon={Lock}
          type={showPassword ? "text" : "password"}
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          error={fieldErrors.confirmPassword}
        />
      </div>
      {error && (
        <p className="mt-3 text-sm text-[var(--status-danger-fg)]" role="alert">
          {error}
        </p>
      )}
      <button
        type="button"
        disabled={busy}
        onClick={() => void submit()}
        className="mt-6 flex h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-[var(--brand-primary)] font-semibold text-[var(--on-brand)] hover:bg-[var(--brand-primary-hover)] disabled:cursor-wait disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2"
      >
        {busy ? "Creating account…" : "Create account"}
      </button>
      <button
        type="button"
        onClick={onHaveAccount}
        className="mt-3 w-full rounded-xl border border-[var(--border-default)] py-3 font-semibold text-[var(--brand-primary)] hover:bg-[var(--surface-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2"
      >
        I already have an account
      </button>
    </AuthCard>
  );
}
