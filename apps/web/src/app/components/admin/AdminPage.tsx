import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Eye,
  EyeOff,
  Feather,
  Lock,
  LogOut,
  Mail,
  ShieldCheck,
  User,
  UserPlus,
  Users,
} from "lucide-react";
import { type FormEvent, useRef, useState } from "react";
import logoApp from "../../../imports/logo-app.webp";
import { adminClient } from "../../data/auth/admin-client";
import { CreateAccountSchema } from "../../data/onboarding";
import { useAuth } from "../../providers/auth-context";
import { AuthCard } from "../auth/AuthCard";
import { FormInput } from "../auth/FormInput";
import { SignInScreen } from "../auth/SignInScreen";
import { SuspenseFallback } from "../SuspenseFallback";
import { Button } from "../ui/button";
import { Typography } from "../ui/typography";

function message(error: unknown) {
  return error instanceof Error
    ? error.message
    : "The request could not be completed.";
}

export function AdminPage() {
  const auth = useAuth();
  const [signOutError, setSignOutError] = useState("");
  const access = useQuery({
    queryKey: ["platform-admin-access", auth.user?.id],
    queryFn: adminClient.session,
    enabled: auth.mode === "api" && auth.isAuthenticated,
    retry: false,
  });
  const signOut = async () => {
    try {
      setSignOutError("");
      await auth.signOut();
    } catch (error) {
      setSignOutError(message(error));
    }
  };
  if (auth.mode !== "api")
    return (
      <AuthCard>
        <Typography as="h1" variant="pageTitle">
          Connect the account server
        </Typography>
        <p className="mt-3 text-[var(--text-secondary)]">
          Open the local API-backed website to manage real users.
        </p>
      </AuthCard>
    );
  if (auth.isLoading)
    return <SuspenseFallback label="Checking administrator session…" />;
  if (!auth.isAuthenticated)
    return (
      <SignInScreen
        heading="Administrator sign in"
        onSignIn={auth.signIn}
        onSetup={() => {}}
        canRegister={false}
        authError={auth.error}
      />
    );
  if (access.isPending)
    return <SuspenseFallback label="Checking administrator access…" />;
  if (access.isError)
    return (
      <AuthCard>
        <Typography as="h1" variant="pageTitle">
          Administrator access
        </Typography>
        <p role="alert" className="mt-3 text-[var(--text-secondary)]">
          {message(access.error)}
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button
            className="rounded-xl text-(length:--type-button-label) font-semibold"
            onClick={() => void access.refetch()}
          >
            Try again
          </Button>
          <Button
            variant="outline"
            className="rounded-xl text-(length:--type-button-label) font-semibold"
            onClick={() => void signOut()}
          >
            Sign out
          </Button>
        </div>
        {signOutError && (
          <p role="alert" className="mt-3 text-[var(--status-danger-fg)]">
            {signOutError}
          </p>
        )}
      </AuthCard>
    );
  return (
    <div
      className="min-h-dvh bg-[var(--surface-app)] text-[var(--text-primary)] lg:flex lg:h-dvh lg:overflow-hidden"
      style={{
        fontFamily: "var(--font-body)",
        fontSize: "var(--type-body)",
        lineHeight: "var(--leading-normal)",
      }}
    >
      <aside className="flex shrink-0 flex-col border-b border-[var(--border-subtle)] bg-[var(--surface-card)] px-3 py-6 lg:h-full lg:min-h-0 lg:w-64 lg:overflow-y-auto lg:border-r lg:border-b-0">
        <a
          href="/admin"
          className="flex items-center gap-2.5 px-1 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
        >
          <img
            src={logoApp}
            alt=""
            className="h-[var(--control-size-sm)] w-[var(--control-size-sm)] shrink-0"
          />
          <Typography as="span" variant="headingMedium">
            Eggcelerate
          </Typography>
        </a>
        <p className="mt-2 pl-11 text-(length:--type-label) font-semibold uppercase tracking-[var(--tracking-label)] text-[var(--text-muted)]">
          Administration
        </p>
        <nav aria-label="Administration" className="mt-6">
          <a
            href="/admin"
            aria-current="page"
            className="flex h-[var(--control-size-nav)] items-center gap-3 rounded-xl border border-[var(--global-nav-selected-bg)] bg-[var(--global-nav-selected-bg)] px-3 text-(length:--type-body) font-semibold text-[var(--global-nav-selected-fg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
          >
            <Users size={20} aria-hidden="true" />
            Users
          </a>
        </nav>
        <div className="mt-5 border-t border-[var(--border-subtle)] px-1 pt-4 lg:mt-auto">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <ShieldCheck size={18} aria-hidden="true" />
            Administrator
          </p>
          <p className="mt-1 break-all text-(length:--type-body) text-[var(--text-secondary)]">
            {auth.user?.email}
          </p>
          <Button
            variant="outline"
            className="mt-4 w-full rounded-xl text-(length:--type-button-label) font-semibold"
            onClick={() => void signOut()}
          >
            <LogOut size={16} aria-hidden="true" />
            Sign out
          </Button>
          {signOutError && (
            <p
              role="alert"
              className="mt-3 text-sm text-[var(--status-danger-fg)]"
            >
              {signOutError}
            </p>
          )}
        </div>
      </aside>
      <main className="mx-auto min-w-0 w-full max-w-6xl px-3 py-6 sm:px-4 md:px-6 lg:h-full lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:overscroll-y-contain lg:scroll-py-6 lg:[scrollbar-gutter:stable] lg:px-8">
        <header className="mb-5">
          <Typography variant="label" className="text-[var(--text-muted)]">
            Account management
          </Typography>
          <Typography as="h1" variant="pageTitle" className="mt-1">
            Users
          </Typography>
          <Typography
            variant="body"
            className="mt-1 text-[var(--text-secondary)]"
          >
            Create an account so a farm owner can sign in to Eggcelerate.
          </Typography>
        </header>
        <UserManagement />
      </main>
    </div>
  );
}

function UserManagement() {
  const queryClient = useQueryClient();
  const [offset, setOffset] = useState(0);
  const list = useQuery({
    queryKey: ["platform-admin-users", offset],
    queryFn: () => adminClient.users(offset),
    retry: false,
  });
  const emptyForm = {
    displayName: "",
    farmName: "",
    email: "",
    password: "",
    confirmPassword: "",
  };
  const [form, setForm] = useState(emptyForm);
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const formRef = useRef<HTMLFormElement>(null);
  const setField = (name: keyof typeof form, value: string) => {
    setForm((previous) => ({ ...previous, [name]: value }));
    setSuccess("");
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setSuccess("");
    setError("");
    const parsed = CreateAccountSchema.safeParse(form);
    if (!parsed.success) {
      const errors: Record<string, string> = {};
      for (const issue of parsed.error.issues)
        errors[String(issue.path[0])] ??= issue.message;
      setFieldErrors(errors);
      const first = Object.keys(errors)[0];
      formRef.current
        ?.querySelector<HTMLInputElement>(`#admin-${first}`)
        ?.focus();
      return;
    }
    setFieldErrors({});
    setBusy(true);
    try {
      const created = await adminClient.createUser(parsed.data);
      setForm(emptyForm);
      setVisible(false);
      setSuccess(
        `Account created for ${created.email}. The owner can now sign in.`,
      );
      setOffset(0);
      void queryClient.invalidateQueries({
        queryKey: ["platform-admin-users"],
      });
    } catch (cause) {
      setError(message(cause));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="grid min-w-0 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
      <section
        aria-labelledby="user-list-heading"
        className="min-w-0 rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--surface-card)]"
      >
        <div className="flex items-center justify-between gap-3 border-b border-[var(--border-subtle)] p-6">
          <div>
            <Typography as="h2" id="user-list-heading" variant="headingMedium">
              All users
            </Typography>
            <p className="mt-1 text-(length:--type-body) text-[var(--text-secondary)]">
              {list.data
                ? `${list.data.total} registered ${list.data.total === 1 ? "account" : "accounts"}`
                : "Registered accounts and their farms"}
            </p>
          </div>
          <Button
            variant="outline"
            className="rounded-xl text-(length:--type-button-label) font-semibold"
            disabled={list.isFetching}
            onClick={() => void list.refetch()}
          >
            {list.isFetching ? "Loading…" : "Refresh"}
          </Button>
        </div>
        {list.isPending && (
          <p role="status" className="p-6 text-[var(--text-secondary)]">
            Loading users…
          </p>
        )}
        {list.isError && (
          <p role="alert" className="p-6 text-[var(--status-danger-fg)]">
            {message(list.error)}
          </p>
        )}
        {list.data?.users.length === 0 && (
          <p className="p-6 text-[var(--text-secondary)]">
            No users on this page.
          </p>
        )}
        {list.data && list.data.users.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-(length:--type-body)">
              <caption className="sr-only">
                Registered Eggcelerate users
              </caption>
              <thead className="bg-[var(--surface-subtle)] text-[var(--text-secondary)]">
                <tr>
                  <th scope="col" className="px-6 py-4 font-semibold">
                    User
                  </th>
                  <th scope="col" className="px-4 py-4 font-semibold">
                    Farm
                  </th>
                  <th scope="col" className="px-4 py-4 font-semibold">
                    Access
                  </th>
                </tr>
              </thead>
              <tbody>
                {list.data.users.map((user) => (
                  <tr
                    key={user.id}
                    className="border-t border-[var(--border-subtle)]"
                  >
                    <td className="px-6 py-5">
                      <p className="font-semibold">{user.display_name}</p>
                      <p className="mt-1 break-all text-[var(--text-secondary)]">
                        {user.email}
                      </p>
                    </td>
                    <td className="break-words px-4 py-5">{user.farm_name}</td>
                    <td className="px-4 py-5">
                      <span className="inline-flex rounded-full bg-[var(--surface-subtle)] px-3 py-1 text-xs font-semibold">
                        {user.disabled
                          ? "Disabled"
                          : user.administrator
                            ? "Administrator"
                            : "Farm owner"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {list.data && list.data.total > 20 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border-subtle)] p-5">
            <p className="text-(length:--type-body) text-[var(--text-secondary)]">
              {offset + 1} to {Math.min(offset + 20, list.data.total)} of{" "}
              {list.data.total}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="rounded-xl text-(length:--type-button-label) font-semibold"
                disabled={offset === 0 || list.isFetching}
                onClick={() => setOffset((value) => Math.max(0, value - 20))}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="rounded-xl text-(length:--type-button-label) font-semibold"
                disabled={offset + 20 >= list.data.total || list.isFetching}
                onClick={() => setOffset((value) => value + 20)}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </section>
      <section
        aria-labelledby="create-user-heading"
        className="min-w-0 rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--surface-card)] p-6"
      >
        <div className="mb-5 flex items-start gap-3">
          <div className="rounded-xl bg-[var(--surface-subtle)] p-2 text-[var(--brand-primary)]">
            <UserPlus size={20} aria-hidden="true" />
          </div>
          <div>
            <Typography
              as="h2"
              id="create-user-heading"
              variant="headingMedium"
            >
              Create user
            </Typography>
            <p className="mt-1 text-(length:--type-body) text-[var(--text-secondary)]">
              Each owner starts with an empty farm.
            </p>
          </div>
        </div>
        <form
          ref={formRef}
          onSubmit={(event) => void submit(event)}
          noValidate
          className="space-y-4"
        >
          <fieldset disabled={busy} className="min-w-0 space-y-4">
            <FormInput
              id="admin-displayName"
              label="Full name"
              icon={User}
              autoComplete="name"
              maxLength={35}
              value={form.displayName}
              onChange={(event) => setField("displayName", event.target.value)}
              error={fieldErrors.displayName}
            />
            <FormInput
              id="admin-farmName"
              label="Farm name"
              icon={Feather}
              autoComplete="organization"
              maxLength={30}
              value={form.farmName}
              onChange={(event) => setField("farmName", event.target.value)}
              error={fieldErrors.farmName}
            />
            <FormInput
              id="admin-email"
              label="Email"
              icon={Mail}
              type="email"
              autoComplete="off"
              maxLength={254}
              value={form.email}
              onChange={(event) => setField("email", event.target.value)}
              error={fieldErrors.email}
            />
            <FormInput
              id="admin-password"
              label="Password"
              icon={Lock}
              type={visible ? "text" : "password"}
              autoComplete="new-password"
              minLength={12}
              maxLength={128}
              value={form.password}
              onChange={(event) => setField("password", event.target.value)}
              error={fieldErrors.password}
              trailing={
                <button
                  type="button"
                  aria-label={visible ? "Hide password" : "Show password"}
                  aria-pressed={visible}
                  onClick={() => setVisible((value) => !value)}
                  className="flex h-[var(--control-size-icon)] w-[var(--control-size-icon)] items-center justify-center rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
                >
                  {visible ? (
                    <EyeOff size={18} aria-hidden="true" />
                  ) : (
                    <Eye size={18} aria-hidden="true" />
                  )}
                </button>
              }
            />
            <p className="text-(length:--type-caption) text-[var(--text-secondary)]">
              Use 12 to 128 characters. Share the password with the owner.
            </p>
            <FormInput
              id="admin-confirmPassword"
              label="Confirm password"
              icon={Lock}
              type={visible ? "text" : "password"}
              autoComplete="new-password"
              maxLength={128}
              value={form.confirmPassword}
              onChange={(event) =>
                setField("confirmPassword", event.target.value)
              }
              error={fieldErrors.confirmPassword}
            />
          </fieldset>
          {error && (
            <p role="alert" className="text-sm text-[var(--status-danger-fg)]">
              {error}
            </p>
          )}
          {Object.keys(fieldErrors).length > 0 && (
            <p role="alert" className="text-sm text-[var(--status-danger-fg)]">
              Check the highlighted fields.
            </p>
          )}
          {success && (
            <p role="status" className="text-sm text-[var(--text-primary)]">
              {success}
            </p>
          )}
          <Button
            type="submit"
            className="w-full rounded-xl text-(length:--type-button-label) font-semibold"
            disabled={busy}
          >
            <UserPlus size={18} aria-hidden="true" />
            {busy ? "Creating user…" : "Create user"}
          </Button>
        </form>
      </section>
    </div>
  );
}
