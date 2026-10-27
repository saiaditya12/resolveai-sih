"use client";
import Link from "next/link";
import { workspaceHome } from "@/lib/authorization";
import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import { hasSupabaseConfiguration } from "@/lib/supabase/config";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
type FormErrors = Partial<
  Record<"name" | "email" | "password" | "confirm", string>
>;
export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const register = mode === "register";
  const router = useRouter();
  const [errors, setErrors] = useState<FormErrors>({});
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const forgot = useRef<HTMLDialogElement>(null);
  const persistent = hasSupabaseConfiguration();
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const next: FormErrors = {};
    if (register && String(data.get("name") ?? "").trim().length < 2)
      next.name = "Enter at least two characters for your name.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(data.get("email") ?? "")))
      next.email = "Enter a valid email address.";
    const password = String(data.get("password") ?? "");
    if (password.length < 8)
      next.password = "Use at least 8 characters for the password.";
    if (register && data.get("confirm") !== password)
      next.confirm = "The passwords do not match.";
    setErrors(next);
    if (Object.keys(next).length) {
      (
        form.elements.namedItem(Object.keys(next)[0]) as HTMLInputElement
      )?.focus();
      return;
    }
    setBusy(true);
    setMessage("");
    if (!persistent) {
      form.reset();
      router.push("/student/dashboard");
      return;
    }
    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      setMessage("Authentication is not configured. Please contact the administrator.");
      setBusy(false);
      return;
    }
    const email = String(data.get("email") ?? "").trim();
    try {
      if (register) {
        const result = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { display_name: String(data.get("name") ?? "").trim() },
          },
        });
        if (result.error) throw result.error;
        if (!result.data.session) {
          form.reset();
          setMessage("Check your email to confirm your account, then sign in.");
          setBusy(false);
          return;
        }
      } else {
        const result = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (result.error) throw result.error;
      }
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();
      if (userError || !user)
        throw new Error("Your session could not be verified.");
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();
      if (
        profileError ||
        !profile ||
        !["student", "officer", "admin"].includes(profile.role)
      )
        throw new Error("Your account role could not be verified.");
      form.reset();
      router.replace(
        workspaceHome(profile.role),
      );
      router.refresh();
    } catch {
      setMessage(
        register
          ? "We couldn't create your account. Check your details and try again."
          : "We couldn't sign you in. Check your email and password.",
      );
      setBusy(false);
    }
  }
  return (
    <>
      <span className="demo-badge">
        {persistent
          ? "ACCOUNT ACCESS"
          : "WORKSPACE ACCESS"}
      </span>
      <h2>{register ? "Make room for your voice." : "Welcome back."}</h2>
      <p className="auth-intro">
        {register
          ? persistent
            ? "Create a student account with email and password."
            : "Account services are unavailable here. Continue to the student workspace without an account."
          : persistent
            ? "Sign in to your account to continue."
            : "Open the student workspace to explore its features."}
      </p>
      <p className="auth-demo-note">
        {persistent
          ? "Your account keeps your complaints and responses together."
          : "Account services are unavailable here. Nothing you enter is stored or sent."}
      </p>
      <form noValidate onSubmit={submit} className="auth-form">
        {register && (
          <div className="field">
            <label htmlFor="name">Full name</label>
            <input
              id="name"
              name="name"
              autoComplete="name"
              placeholder="Your full name"
              aria-invalid={!!errors.name}
              aria-describedby={errors.name ? "name-error" : undefined}
            />
            {errors.name && (
              <p className="field-error" id="name-error">
                {errors.name}
              </p>
            )}
          </div>
        )}
        <div className="field">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="student@example.com"
            aria-invalid={!!errors.email}
            aria-describedby={errors.email ? "email-error" : undefined}
          />
          {errors.email && (
            <p className="field-error" id="email-error">
              {errors.email}
            </p>
          )}
        </div>
        <div className="field">
          <label htmlFor="password">Password</label>
          <div className="password-field">
            <input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete={register ? "new-password" : "current-password"}
              placeholder="At least 8 characters"
              aria-invalid={!!errors.password}
              aria-describedby={
                errors.password ? "password-error" : "password-hint"
              }
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              aria-pressed={showPassword}
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>
          <p className="field-hint" id="password-hint">
             {persistent ? "Use at least 8 characters." : "Authentication is unavailable in this workspace. Do not enter an existing password."}
          </p>
          {errors.password && (
            <p className="field-error" id="password-error">
              {errors.password}
            </p>
          )}
        </div>
        {register && (
          <div className="field">
            <label htmlFor="confirm">Confirm password</label>
            <input
              id="confirm"
              name="confirm"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              aria-invalid={!!errors.confirm}
              aria-describedby={errors.confirm ? "confirm-error" : undefined}
            />
            {errors.confirm && (
              <p className="field-error" id="confirm-error">
                {errors.confirm}
              </p>
            )}
          </div>
        )}
        {!register && (
          <button
            type="button"
            className="forgot-link"
            onClick={() => forgot.current?.showModal()}
          >
            Forgot password?
          </button>
        )}
        <div aria-live="polite" className="sr-only">
          {Object.keys(errors).length
            ? "Please correct the highlighted fields."
            : ""}
        </div>
        <button
          className="button primary auth-submit"
          disabled={busy}
          type="submit"
        >
          {busy
            ? "Opening workspace…"
            : register
              ? "Create account"
              : "Sign in"}{" "}
          <span aria-hidden="true">↗</span>
        </button>
      </form>
      {message && <p role="alert" className="field-error">{message}</p>}
      <p className="auth-switch">
        {register ? "Already have an account?" : "New here?"}{" "}
        <Link href={register ? "/login" : "/register"}>
          {register ? "Sign in" : "Register"} ↗
        </Link>
      </p>
      {!register && !persistent && (
        <p className="auth-switch">
          <Link href="/officer/dashboard">Open officer workspace ↗</Link>
          <br />
          <small>Account services unavailable</small>
        </p>
      )}
      <p className="auth-fixed-profile">
        {persistent
          ? "Your permissions come from your trusted account profile."
          : "This workspace has no authenticated account."}
      </p>
      <dialog
        ref={forgot}
        className="preview-dialog"
        aria-label="Password help"
      >
        <p className="eyebrow">ACCOUNT SUPPORT</p>
        <h2>Need help signing in?</h2>
        <p>
          Password recovery is not available from this form. Contact your account administrator for help. No reset email has been sent.
        </p>
        <button
          className="button primary"
          onClick={() => forgot.current?.close()}
        >
          Back to sign in
        </button>
      </dialog>
    </>
  );
}
