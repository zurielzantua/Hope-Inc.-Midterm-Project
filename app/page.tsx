"use client";

import { useState, type FormEvent } from "react";

const modules = [
  {
    name: "Product Management System",
    description: "Track inventory, pricing, product lifecycle, and supplier performance in one place.",
    icon: "PR",
  },
  {
    name: "Human Resource Management System",
    description: "Manage recruitment, payroll, attendance, learning and people performance at scale.",
    icon: "HR",
  },
  {
    name: "Sales Management System",
    description: "Handle pipelines, quotations, revenue forecasting, and field sales execution.",
    icon: "SA",
  },
  {
    name: "Customer Management System",
    description: "Centralize customers, support requests, lifecycle journeys, and retention insights.",
    icon: "CX",
  },
];

const quickStats = [
  { label: "Active users", value: "24k+" },
  { label: "Monthly revenue", value: "$1.8M" },
  { label: "Operational uptime", value: "99.9%" },
  { label: "Response time", value: "< 2 min" },
];

const featureHighlights = [
  "Unified operations dashboard",
  "Role-based access and secure data access",
  "Real-time inventory and sales visibility",
  "Smart reporting for leadership teams",
];

type AuthView = "login" | "register" | "reset";
type RegistrationStatus = "idle" | "invalid" | "submitting" | "success" | "duplicate" | "rate-limited" | "unavailable" | "error";
type RegistrationFields = "firstName" | "lastName" | "email";
type RegistrationPayload = Record<RegistrationFields, string>;
type RegistrationFieldErrors = Partial<Record<RegistrationFields, string>>;

const registrationMessages: Record<Exclude<RegistrationStatus, "idle">, string> = {
  invalid: "Enter your first name, last name, and a valid email.",
  submitting: "Submitting registration…",
  success: "Registration submitted. An admin must approve your account before you can sign in.",
  duplicate: "Registration could not be completed for these details.",
  "rate-limited": "Too many registration attempts. Please try again later.",
  unavailable: "Registration is temporarily unavailable. Please try again later.",
  error: "Registration could not be completed. Please contact an administrator.",
};

type RegistrationFormProps = {
  status?: RegistrationStatus;
  fieldErrors?: RegistrationFieldErrors;
  onRegister?: (payload: RegistrationPayload) => void | Promise<void>;
  onEdit?: () => void;
  onSignIn?: () => void;
};

function RegistrationForm({
  status = "idle",
  fieldErrors = {},
  onRegister,
  onEdit,
  onSignIn,
}: RegistrationFormProps) {
  const isSubmitting = status === "submitting";
  const isSuccess = status === "success";
  const isError = ["invalid", "duplicate", "rate-limited", "unavailable", "error"].includes(status);
  const feedbackClass = isSuccess
    ? "border-success/45 bg-success/15 text-white"
    : isError
      ? "border-error/45 bg-error/10 text-white"
      : "border-teal/45 bg-teal/10 text-white";

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!onRegister || isSubmitting || isSuccess) return;

    const formData = new FormData(event.currentTarget);
    onRegister({
      firstName: String(formData.get("firstName") ?? ""),
      lastName: String(formData.get("lastName") ?? ""),
      email: String(formData.get("email") ?? ""),
    });
  }

  function renderFieldError(field: RegistrationFields) {
    const message = fieldErrors[field];
    return message ? (
      <p id={`register-${field}-error`} className="mt-1.5 text-xs text-error" role="alert">
        {message}
      </p>
    ) : null;
  }

  return (
    <div>
      <h2 className="font-display text-lg font-semibold text-white">Create your account</h2>
      <p className="mt-1 text-sm text-white/65">New accounts start as User and need admin approval.</p>

      {status !== "idle" && (
        <div
          className={`mt-4 rounded-sm border px-3 py-2.5 text-sm leading-5 ${feedbackClass}`}
          role={isError ? "alert" : "status"}
          aria-live={isError ? "assertive" : "polite"}
        >
          {registrationMessages[status]}
        </div>
      )}

      {!isSuccess && (
        <form className="mt-4 space-y-4" onSubmit={handleSubmit} aria-busy={isSubmitting}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="field-label" htmlFor="register-first-name">First Name</label>
              <input
                className="form-input"
                id="register-first-name"
                name="firstName"
                type="text"
                autoComplete="given-name"
                maxLength={100}
                required
                disabled={isSubmitting}
                onChange={onEdit}
                aria-invalid={Boolean(fieldErrors.firstName)}
                aria-describedby={fieldErrors.firstName ? "register-firstName-error" : undefined}
              />
              {renderFieldError("firstName")}
            </div>
            <div>
              <label className="field-label" htmlFor="register-last-name">Last Name</label>
              <input
                className="form-input"
                id="register-last-name"
                name="lastName"
                type="text"
                autoComplete="family-name"
                maxLength={100}
                required
                disabled={isSubmitting}
                onChange={onEdit}
                aria-invalid={Boolean(fieldErrors.lastName)}
                aria-describedby={fieldErrors.lastName ? "register-lastName-error" : undefined}
              />
              {renderFieldError("lastName")}
            </div>
          </div>

          <div>
            <label className="field-label" htmlFor="register-email">Email Address</label>
            <input
              className="form-input"
              id="register-email"
              name="email"
              type="email"
              autoComplete="email"
              maxLength={320}
              required
              disabled={isSubmitting}
              onChange={onEdit}
              aria-invalid={Boolean(fieldErrors.email)}
              aria-describedby={fieldErrors.email ? "register-email-error" : undefined}
            />
            {renderFieldError("email")}
          </div>

          <button className="button-primary w-full" type="submit" disabled={isSubmitting}>
            {isSubmitting && (
              <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white motion-reduce:animate-none" aria-hidden="true" />
            )}
            {isSubmitting ? "Registering…" : "Register"}
          </button>
        </form>
      )}

      <p className="mt-4 text-center text-sm text-white/65">
        Already have an account?{" "}
        <a
          className="font-semibold text-bronze underline-offset-4 hover:underline focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal/60"
          href="#access-panel"
          onClick={onSignIn}
        >
          Sign In
        </a>
      </p>
    </div>
  );
}

export default function HomePage() {
  const [activeTab, setActiveTab] = useState<AuthView>("login");
  const [registrationStatus, setRegistrationStatus] = useState<RegistrationStatus>("idle");
  const [registrationFieldErrors, setRegistrationFieldErrors] = useState<RegistrationFieldErrors>({});

  async function handleRegister(payload: RegistrationPayload) {
    setRegistrationStatus("submitting");
    setRegistrationFieldErrors({});

    try {
      const response = await fetch("/api/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (response.status === 201) {
        const result: unknown = await response.json().catch(() => null);
        if (result && typeof result === "object" && "status" in result && result.status === "pending") {
          setRegistrationStatus("success");
        } else {
          setRegistrationStatus("error");
        }
        return;
      }

      switch (response.status) {
        case 400:
          setRegistrationStatus("invalid");
          return;
        case 409:
          setRegistrationStatus("duplicate");
          return;
        case 429:
          setRegistrationStatus("rate-limited");
          return;
        case 503:
          setRegistrationStatus("unavailable");
          return;
        default:
          setRegistrationStatus("error");
      }
    } catch {
      setRegistrationStatus("unavailable");
    }
  }

  function resetRegistrationFeedback() {
    setRegistrationStatus("idle");
    setRegistrationFieldErrors({});
  }

  const tabs: { id: AuthView; label: string }[] = [
    { id: "login", label: "Login" },
    { id: "register", label: "Register" },
    { id: "reset", label: "Reset Password" },
  ];

  return (
    <main className="app-shell min-h-screen">
      <header className="mx-auto max-w-7xl px-4 pb-8 pt-5 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md border border-teal/50 bg-teal/15 text-lg font-bold text-white shadow-[0_0_18px_rgba(11,110,117,0.28)]">
              H
            </div>
            <div>
              <p className="text-base font-bold text-white">Hope, Inc.</p>
              <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-white/55">ERP System</p>
            </div>
          </div>

          <nav className="order-3 flex w-full items-center gap-5 overflow-x-auto font-mono text-xs font-medium uppercase tracking-wide text-white/65 sm:order-none sm:w-auto sm:gap-6">
            <a href="#solutions" className="whitespace-nowrap transition-colors hover:text-bronze focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal/60">Solutions</a>
            <a href="#modules" className="whitespace-nowrap transition-colors hover:text-bronze focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal/60">Modules</a>
            <a href="#security" className="whitespace-nowrap transition-colors hover:text-bronze focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal/60">Security</a>
            <a href="#contact" className="whitespace-nowrap transition-colors hover:text-bronze focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal/60">Contact</a>
          </nav>

          <button className="button-secondary min-h-10 border-white/20 bg-white/5 px-3 text-white hover:bg-white/10">
            Book Demo
          </button>
        </div>
      </header>

      <section className="mx-auto grid max-w-7xl gap-10 px-4 pb-16 sm:px-6 lg:grid-cols-[1.2fr_0.8fr] lg:px-8">
        <div className="pt-4 lg:pt-12">
          <div className="mb-5 inline-flex items-center gap-2 font-mono text-xs font-semibold uppercase tracking-[0.14em] text-bronze">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-teal shadow-[0_0_10px_rgba(11,110,117,0.9)]" aria-hidden="true" />
            Transform operations
          </div>

          <h1 className="neon-heading font-display max-w-xl text-4xl font-bold leading-tight text-white sm:text-5xl lg:text-[3.5rem]">
            The smarter ERP for growing teams.
          </h1>

          <p className="mt-5 max-w-xl text-base leading-7 text-white/70 sm:text-lg">
            Hope, Inc. unifies product operations, human resources, sales performance, and customer experience into one modern platform built for scale.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-4">
            <button className="button-primary px-5">
              Start free trial
            </button>
            <button className="button-secondary border-white/20 bg-white/5 px-5 text-white hover:bg-white/10">
              Watch overview
            </button>
          </div>

          <div className="mt-10 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {quickStats.map((stat) => (
              <div key={stat.label} className="neon-panel relative overflow-hidden rounded-md border border-teal/30 bg-[#0d2630]/85 p-4">
                <span className="absolute right-3 top-3 h-1.5 w-1.5 rounded-full bg-success shadow-[0_0_8px_rgba(35,120,86,0.8)]" aria-hidden="true" />
                <div className="neon-value font-mono text-2xl font-bold text-white">{stat.value}</div>
                <div className="mt-1 font-mono text-[10px] uppercase tracking-wide text-white/55">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>

        <div id="access-panel" className="lg:pt-8">
          <div className="overflow-hidden rounded-md border border-teal/40 bg-[#0b2029]/95 shadow-[0_0_36px_rgba(11,110,117,0.18)]">
            <div className="border-b border-white/10 bg-white/[0.03] p-4 sm:p-5">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-error" />
                  <span className="h-2.5 w-2.5 rounded-full bg-warning" />
                  <span className="h-2.5 w-2.5 rounded-full bg-success" />
                </div>
                <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-bronze">Secure access</span>
              </div>

              <div>
                <div className="grid grid-cols-3 gap-1 rounded-sm border border-white/10 bg-black/20 p-1">
                  {tabs.map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveTab(tab.id)}
                      className={`min-h-11 min-w-0 rounded-md px-1.5 py-2 text-center text-xs font-semibold leading-4 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal/35 focus-visible:ring-offset-1 sm:px-3 sm:text-sm sm:leading-5 ${
                        activeTab === tab.id
                          ? "bg-teal text-white shadow-[0_0_14px_rgba(11,110,117,0.4)]"
                          : "text-white/60 hover:bg-white/5 hover:text-white"
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                <div className="mt-5 space-y-4">
                  {activeTab === "login" && (
                    <>
                      <div>
                        <label className="field-label">
                          Email address
                        </label>
                        <input
                          type="email"
                          defaultValue="admin@hopeinc.com"
                          className="form-input"
                        />
                      </div>

                      <div>
                        <label className="field-label">
                          Password
                        </label>
                        <input
                          type="password"
                          defaultValue="********"
                          className="form-input"
                        />
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-white/65">
                        <label className="flex items-center gap-2">
                          <input type="checkbox" defaultChecked className="h-4 w-4 rounded border-line text-teal focus:ring-teal" />
                          Keep me signed in
                        </label>
                        <button type="button" className="font-semibold text-bronze underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal/60">
                          Forgot password?
                        </button>
                      </div>

                      <button className="button-primary w-full">
                        Login to Dashboard
                      </button>
                    </>
                  )}

                  {activeTab === "register" && (
                    <RegistrationForm
                      status={registrationStatus}
                      fieldErrors={registrationFieldErrors}
                      onRegister={handleRegister}
                      onEdit={resetRegistrationFeedback}
                      onSignIn={() => {
                        resetRegistrationFeedback();
                        setActiveTab("login");
                      }}
                    />
                  )}

                  {activeTab === "reset" && (
                    <>
                      <div>
                        <label className="field-label">
                          Email address
                        </label>
                        <input type="email" className="form-input" defaultValue="user@hopeinc.com" />
                      </div>

                      <p className="text-sm leading-6 text-muted">
                        Enter your work email and we’ll send instructions to reset your password securely.
                      </p>

                      <button className="button-primary w-full">
                        Send reset link
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="modules" className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="mb-8 flex items-end justify-between gap-4 border-b border-white/10 pb-4">
          <div>
            <p className="flex items-center gap-2 font-mono text-xs font-semibold uppercase tracking-[0.14em] text-bronze"><span className="h-px w-5 bg-bronze" aria-hidden="true" />Core modules</p>
            <h2 className="font-display mt-2 text-2xl font-bold text-white sm:text-3xl">Everything your teams need to run smarter.</h2>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
          {modules.map((module) => (
            <article key={module.name} className="neon-panel group relative overflow-hidden rounded-md border border-white/10 bg-[#0d2630]/90 p-5 transition-all hover:-translate-y-1 hover:border-teal/50 hover:shadow-[0_0_26px_rgba(11,110,117,0.2)]">
              <span className="absolute right-0 top-0 h-px w-16 bg-gradient-to-l from-bronze to-transparent" aria-hidden="true" />
              <div className="inline-flex h-10 w-10 items-center justify-center rounded-sm border border-teal/30 bg-teal/10 font-mono text-xs font-bold tracking-wide text-white">
                {module.icon}
              </div>
              <h3 className="font-display mt-4 text-base font-semibold leading-6 text-white">{module.name}</h3>
              <p className="mt-2 text-sm leading-6 text-white/65">{module.description}</p>
              <button className="mt-4 font-mono text-xs font-semibold uppercase tracking-wide text-bronze underline-offset-4 hover:text-white hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal/60">Explore module <span aria-hidden="true">→</span></button>
            </article>
          ))}
        </div>
      </section>

      <section id="security" className="border-y border-white/10 bg-[#081a22] text-white">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
          <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
            <div>
              <p className="flex items-center gap-2 font-mono text-xs font-semibold uppercase tracking-[0.14em] text-bronze"><span className="h-px w-5 bg-bronze" aria-hidden="true" />Why teams choose Hope</p>
              <h2 className="font-display mt-3 text-2xl font-bold sm:text-3xl">Built for secure growth, insight, and accountability.</h2>
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                {featureHighlights.map((item) => (
                  <div key={item} className="flex items-center gap-3 border-t border-white/10 py-3 text-sm text-white/75">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-sm border border-success/50 bg-success/20 font-mono text-xs text-white">✓</span>
                    {item}
                  </div>
                ))}
              </div>
            </div>

            <div className="border-l-2 border-bronze/70 pl-5 sm:pl-6">
              <div className="border-y border-white/15 py-4">
                <p className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-bronze">Executive overview</p>
                <div className="mt-4 flex items-end justify-between">
                  <div>
                    <div className="text-3xl font-bold text-white">86%</div>
                    <div className="text-sm text-white/70">Faster team reporting</div>
                  </div>
                  <div className="rounded-sm border border-success/50 bg-success/20 px-2 py-1 font-mono text-xs font-semibold text-white">+18.4%</div>
                </div>

                <div className="mt-6 space-y-3">
                  {[75, 58, 90, 76].map((value, index) => (
                    <div key={value}>
                      <div className="mb-1 flex justify-between font-mono text-[10px] uppercase tracking-wide text-white/55">
                        <span>{["Product", "HR", "Sales", "Support"][index]}</span>
                        <span>{value}%</span>
                      </div>
                      <div className="h-2 rounded-full bg-white/15">
                        <div className="h-2 rounded-full bg-white/85" style={{ width: `${value}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <footer id="contact" className="border-t border-white/10 bg-black/20">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 py-7 text-sm text-white/55 sm:px-6 lg:flex-row lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-sm border border-teal/40 bg-teal/15 font-mono text-sm font-bold text-white">
              H
            </div>
            <span className="font-semibold text-white">Hope, Inc. ERP</span>
          </div>
          <div>© 2026 Hope, Inc. All rights reserved.</div>
        </div>
      </footer>
    </main>
  );
}
