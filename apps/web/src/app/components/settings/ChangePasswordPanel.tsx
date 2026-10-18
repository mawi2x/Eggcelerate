import { Eye, EyeOff } from "lucide-react";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { FormInput } from "../auth/FormInput";
import { Button } from "../ui/button";
import { BORDER, GroupLabel, MUTED, RUST } from "./tokens";

export function ChangePasswordPanel({ onChangePassword }: {
  onChangePassword: (currentPassword: string, newPassword: string) => Promise<void>;
}) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const errorSummary = useRef<HTMLParagraphElement>(null);
  const submitting = useRef(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  useEffect(() => { if (error) errorSummary.current?.focus(); }, [error]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting.current) return;
    setError(null);
    if (!current || [...next].length < 12 || [...next].length > 128) {
      setError("Enter your current password and a new password of 12–128 characters.");
      return;
    }
    if (next !== confirmation) {
      setError("New passwords do not match. Enter the same new password twice.");
      return;
    }
    if (current === next) {
      setError("Choose a new password different from your current password.");
      return;
    }
    submitting.current = true;
    setBusy(true);
    try {
      await onChangePassword(current, next);
      if (mounted.current) {
        setCurrent(""); setNext(""); setConfirmation("");
      }
      toast.success("Password changed. Sign in again with your new password.");
    } catch (cause) {
      if (mounted.current) setError(cause instanceof Error ? cause.message : "Could not change your password. Try again.");
    } finally {
      submitting.current = false;
      if (mounted.current) setBusy(false);
    }
  };

  return (
    <section className="mt-7 border-t pt-7" style={{ borderColor: BORDER }} aria-labelledby="change-password-title">
      <GroupLabel id="change-password-title">Change password</GroupLabel>
      <p id="change-password-help" className="mt-2 text-sm" style={{ color: MUTED }}>
        Use 12–128 characters. Changing your password signs you out on all devices.
        This action saves separately from other settings.
      </p>
      <form className="mt-4 max-w-xl space-y-4" onSubmit={(event) => void submit(event)} aria-describedby="change-password-help" aria-busy={busy}>
        <fieldset disabled={busy} className="space-y-4">
          <FormInput id="current-password" name="current-password" label="Current password" type={visible ? "text" : "password"} autoComplete="current-password" required maxLength={128} value={current} onChange={(event) => setCurrent(event.target.value)} />
          <FormInput id="new-password" name="new-password" label="New password" type={visible ? "text" : "password"} autoComplete="new-password" required maxLength={128} value={next} onChange={(event) => setNext(event.target.value)} />
          <FormInput id="confirm-new-password" name="confirm-new-password" label="Confirm new password" type={visible ? "text" : "password"} autoComplete="new-password" required maxLength={128} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} />
          <Button type="button" variant="ghost" className="min-h-11 rounded-xl" aria-pressed={visible} onClick={() => setVisible((value) => !value)}>
            {visible ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
            {visible ? "Hide passwords" : "Show passwords"}
          </Button>
        </fieldset>
        {error && <p ref={errorSummary} role="alert" tabIndex={-1} className="rounded-xl p-3 text-sm" style={{ color: "var(--status-danger-fg)", backgroundColor: "var(--status-danger-bg)" }}>{error}</p>}
        <Button type="submit" disabled={busy} className="min-h-11 rounded-xl" style={{ backgroundColor: RUST, color: "var(--on-brand)" }}>
          {busy ? "Changing password…" : "Change password"}
        </Button>
      </form>
    </section>
  );
}
