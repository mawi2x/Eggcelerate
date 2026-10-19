import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Eye,
  EyeOff,
  Feather,
  Lock,
  LogOut,
  Mail,
  Pencil,
  Trash2,
  ShieldCheck,
  User,
  UserPlus,
  Users,
} from "lucide-react";
import { type FormEvent, useRef, useState } from "react";
import logoApp from "../../../imports/logo-app.webp";
import {
  demoAdminClient,
  DEMO_ADMIN_EMAIL,
  DEMO_ADMIN_PASSWORD,
  savedDemoSession,
} from "../../data/auth/demo-accounts";
import { adminClient, type AdminUser } from "../../data/auth/admin-client";
import { CreateAccountSchema, EditAccountSchema } from "../../data/onboarding";
import { useAuth } from "../../providers/auth-context";
import { AuthCard } from "../auth/AuthCard";
import { FormInput } from "../auth/FormInput";
import { SignInScreen } from "../auth/SignInScreen";
import { SuspenseFallback } from "../SuspenseFallback";
import { Button } from "../ui/button";
import { PaginationBar } from "../ui/pagination-bar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "../ui/dialog";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";
import { Typography } from "../ui/typography";

function message(error: unknown) {
  return error instanceof Error
    ? error.message
    : "The request could not be completed.";
}

export function AdminPage() {
  const auth = useAuth();
  const client = auth.mode === "mock" ? demoAdminClient : adminClient;
  const [signOutError, setSignOutError] = useState("");
  const access = useQuery({
    queryKey: ["platform-admin-access", auth.mode, auth.user?.id],
    queryFn: client.session,
    enabled: auth.isAuthenticated,
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
  if (auth.isLoading)
    return <SuspenseFallback label="Checking administrator session…" />;
  if (
    !auth.isAuthenticated ||
    (auth.mode === "mock" && auth.user?.id !== "demo-admin")
  )
    return (
      <>
        <SignInScreen
          heading="Administrator sign in"
          accountHelp=""
          onSignIn={async (email, password, rememberMe) => {
            await auth.signIn(email, password, rememberMe);
            if (auth.mode === "mock" && !savedDemoSession()?.administrator)
              throw new Error(
                "Use the demo administrator account to open this page.",
              );
            if (auth.mode === "mock") window.location.replace("/admin");
          }}
          onSetup={() => {}}
          canRegister={false}
          authError={auth.error}
        />
        {auth.mode === "mock" && (
          <p className="mx-auto max-w-lg px-5 pb-6 text-center text-sm text-[var(--text-secondary)]">
            Demo admin: <strong>{DEMO_ADMIN_EMAIL}</strong>
            <br />
            Password: <strong>{DEMO_ADMIN_PASSWORD}</strong>
          </p>
        )}
      </>
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
        <UserManagement client={client} demo={auth.mode === "mock"} />
      </main>
    </div>
  );
}

function UserManagement({
  client,
  demo,
}: {
  client: typeof adminClient;
  demo: boolean;
}) {
  const queryClient = useQueryClient();
  const [offset, setOffset] = useState(0);
  const list = useQuery({
    queryKey: ["platform-admin-users", demo, offset],
    queryFn: () => client.users(offset),
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
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<AdminUser | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminUser | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const openForm = (user: AdminUser | null = null) => {
    setEditing(user);
    setForm(
      user
        ? {
            ...emptyForm,
            email: user.email,
            displayName: user.display_name,
            farmName: user.farm_name,
          }
        : emptyForm,
    );
    setVisible(false);
    setError("");
    setSuccess("");
    setFieldErrors({});
    setFormOpen(true);
  };
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
    const parsed = (
      editing ? EditAccountSchema : CreateAccountSchema
    ).safeParse(form);
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
      const created = editing
        ? await client.updateUser(editing.id, {
            ...parsed.data,
            password: parsed.data.password || undefined,
          })
        : await client.createUser(parsed.data);
      setForm(emptyForm);
      setVisible(false);
      setSuccess(
        editing
          ? `Account updated for ${created.email}.`
          : `Account created for ${created.email}. The owner can now sign in.`,
      );
      setFormOpen(false);
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
  const removeUser = async () => {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    setDeleteError("");
    try {
      await client.deleteUser(deleteTarget.id);
      setSuccess(`Account deleted for ${deleteTarget.email}.`);
      setDeleteTarget(null);
      if (list.data?.users.length === 1 && offset > 0)
        setOffset(Math.max(0, offset - 20));
      await queryClient.invalidateQueries({
        queryKey: ["platform-admin-users"],
      });
    } catch (cause) {
      const errorMessage = message(cause);
      if (errorMessage === "This user no longer exists.") {
        setDeleteTarget(null);
        setDeleteError("");
        if (list.data?.users.length === 1 && offset > 0)
          setOffset(Math.max(0, offset - 20));
        await queryClient.invalidateQueries({
          queryKey: ["platform-admin-users"],
        });
        setSuccess(
          "That account was already removed. The user list is refreshed.",
        );
      } else {
        setDeleteError(errorMessage);
      }
    } finally {
      setDeleting(false);
    }
  };
  return (
    <div className="min-w-0 space-y-4">
      {success && (
        <p
          role="status"
          className="rounded-xl border border-[var(--border-default)] bg-[var(--surface-card)] p-4"
        >
          {success}
        </p>
      )}
      <section
        aria-labelledby="user-list-heading"
        className="min-w-0 rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--surface-card)]"
      >
        <div className="flex flex-col gap-4 border-b border-[var(--border-subtle)] p-4 sm:flex-row sm:items-center sm:justify-between sm:p-6">
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
          <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto">
            <Button
              size="toolbar"
              className="w-full rounded-xl sm:w-auto"
              onClick={() => openForm()}
            >
              <UserPlus size={18} aria-hidden="true" />
              Create user
            </Button>
            <Button
              size="toolbar"
              variant="outline"
              className="w-full rounded-xl sm:w-auto"
              disabled={list.isFetching}
              onClick={() => void list.refetch()}
            >
              {list.isFetching ? "Loading…" : "Refresh"}
            </Button>
          </div>
        </div>
        {list.data && list.data.total > 20 && (
          <PaginationBar
            className="border-b border-t-0 px-4 py-3 sm:px-6"
            page={Math.floor(offset / 20) + 1}
            pageSize={20}
            totalItems={list.data.total}
            itemLabel="accounts"
            onPageChange={(page) => setOffset((page - 1) * 20)}
          />
        )}
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
          <Table className="min-w-[52rem] text-left text-(length:--type-body)">
            <TableCaption className="sr-only">
              Registered Eggcelerate users
            </TableCaption>
            <TableHeader className="bg-[var(--surface-subtle)] text-[var(--text-muted)]">
              <TableRow className="hover:bg-transparent">
                <TableHead scope="col" className="px-6">
                  User
                </TableHead>
                <TableHead scope="col" className="px-4">
                  Farm
                </TableHead>
                <TableHead scope="col" className="px-4">
                  Access
                </TableHead>
                <TableHead scope="col" className="px-4 text-right">
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.data.users.map((user) => (
                <TableRow
                  key={user.id}
                  className="border-[var(--border-subtle)] hover:bg-[var(--surface-subtle)]"
                >
                  <TableCell className="whitespace-normal px-6 py-4">
                    <p className="font-semibold">{user.display_name}</p>
                    <p className="mt-1 break-all text-[var(--text-secondary)]">
                      {user.email}
                    </p>
                  </TableCell>
                  <TableCell className="whitespace-normal break-words px-4 py-4">
                    {user.farm_name}
                  </TableCell>
                  <TableCell className="px-4 py-4">
                    <span className="inline-flex rounded-full bg-[var(--surface-subtle)] px-3 py-1 text-xs font-semibold">
                      {user.disabled
                        ? "Disabled"
                        : user.administrator
                          ? "Administrator"
                          : "Farm owner"}
                    </span>
                  </TableCell>
                  <TableCell className="px-4 py-4">
                    {!user.administrator && (
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          className="rounded-xl"
                          onClick={() => openForm(user)}
                          aria-label={`Edit ${user.display_name}`}
                        >
                          <Pencil size={16} aria-hidden="true" />
                          Edit
                        </Button>
                        <Button
                          variant="outline"
                          className="rounded-xl text-[var(--status-danger-fg)]"
                          onClick={() => {
                            setDeleteError("");
                            setSuccess("");
                            setDeleteTarget(user);
                          }}
                          aria-label={`Delete ${user.display_name}`}
                        >
                          <Trash2 size={16} aria-hidden="true" />
                          Delete
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>
      <Dialog
        open={formOpen}
        onOpenChange={(open) => {
          if (!busy) setFormOpen(open);
        }}
      >
        <DialogContent hideClose={busy}>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit user" : "Create user"}</DialogTitle>
            <DialogDescription>
              {editing
                ? "Update this owner's account and farm details."
                : "Each owner starts with an empty farm."}
            </DialogDescription>
          </DialogHeader>
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
                onChange={(event) =>
                  setField("displayName", event.target.value)
                }
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
                label={editing ? "New password (optional)" : "Password"}
                icon={Lock}
                type={visible ? "text" : "password"}
                autoComplete="new-password"
                minLength={editing ? undefined : 12}
                maxLength={128}
                value={form.password}
                characterCount={form.password.length}
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
              <p
                role="alert"
                className="text-sm text-[var(--status-danger-fg)]"
              >
                {error}
              </p>
            )}
            {Object.keys(fieldErrors).length > 0 && (
              <p
                role="alert"
                className="text-sm text-[var(--status-danger-fg)]"
              >
                Check the highlighted fields.
              </p>
            )}
            {success && (
              <p role="status" className="text-sm text-[var(--text-primary)]">
                {success}
              </p>
            )}
            <div className="flex justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => setFormOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="rounded-xl text-(length:--type-button-label) font-semibold"
                disabled={busy}
              >
                {editing ? (
                  <Pencil size={18} aria-hidden="true" />
                ) : (
                  <UserPlus size={18} aria-hidden="true" />
                )}
                {busy ? "Saving…" : editing ? "Save changes" : "Create user"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open && !deleting) setDeleteTarget(null);
        }}
      >
        <DialogContent hideClose={deleting}>
          <DialogHeader>
            <DialogTitle>Delete user?</DialogTitle>
            <DialogDescription>
              Delete the account for {deleteTarget?.display_name} (
              {deleteTarget?.email})? They will no longer be able to sign in.
              This cannot be undone. Existing farm records are retained.
            </DialogDescription>
          </DialogHeader>
          {deleteError && (
            <p role="alert" className="text-sm text-[var(--status-danger-fg)]">
              {deleteError}
            </p>
          )}
          <div className="flex justify-end gap-3">
            <Button
              variant="outline"
              disabled={deleting}
              onClick={() => setDeleteTarget(null)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={deleting}
              onClick={() => void removeUser()}
            >
              {deleting ? "Deleting…" : "Delete user"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
