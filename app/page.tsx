"use client";

import { useState } from "react";

const modules = [
  {
    name: "Product Management System",
    description: "Track inventory, pricing, product lifecycle, and supplier performance in one place.",
    accent: "bg-pink-500/10 text-pink-700 ring-pink-500/20",
    icon: "📦",
  },
  {
    name: "Human Resource Management System",
    description: "Manage recruitment, payroll, attendance, learning and people performance at scale.",
    accent: "bg-rose-500/10 text-rose-700 ring-rose-500/20",
    icon: "👥",
  },
  {
    name: "Sales Management System",
    description: "Handle pipelines, quotations, revenue forecasting, and field sales execution.",
    accent: "bg-fuchsia-500/10 text-fuchsia-700 ring-fuchsia-500/20",
    icon: "💼",
  },
  {
    name: "Customer Management System",
    description: "Centralize customers, support requests, lifecycle journeys, and retention insights.",
    accent: "bg-pink-600/10 text-pink-800 ring-pink-600/20",
    icon: "🤝",
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

export default function HomePage() {
  const [activeTab, setActiveTab] = useState<AuthView>("login");

  const tabs: { id: AuthView; label: string }[] = [
    { id: "login", label: "Login" },
    { id: "register", label: "Register" },
    { id: "reset", label: "Reset Password" },
  ];

  return (
    <main className="min-h-screen text-slate-900">
      <header className="mx-auto max-w-7xl px-4 pb-10 pt-6 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between rounded-full border border-pink-200/80 bg-white/80 px-4 py-3 shadow-sm backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-pink-500 to-fuchsia-600 text-lg font-bold text-white">
              H
            </div>
            <div>
              <p className="text-lg font-bold tracking-tight text-slate-900">Hope, Inc.</p>
              <p className="text-[10px] uppercase tracking-[0.22em] text-slate-500">ERP System</p>
            </div>
          </div>

          <nav className="hidden items-center gap-8 text-sm font-medium text-slate-600 md:flex">
            <a href="#solutions" className="transition hover:text-slate-900">Solutions</a>
            <a href="#modules" className="transition hover:text-slate-900">Modules</a>
            <a href="#security" className="transition hover:text-slate-900">Security</a>
            <a href="#contact" className="transition hover:text-slate-900">Contact</a>
          </nav>

          <button className="rounded-full border border-pink-300 bg-pink-100 px-4 py-2 text-sm font-semibold text-pink-800 transition hover:border-pink-500 hover:bg-pink-200">
            Book Demo
          </button>
        </div>
      </header>

      <section className="mx-auto grid max-w-7xl gap-10 px-4 pb-16 sm:px-6 lg:grid-cols-[1.2fr_0.8fr] lg:px-8">
        <div className="pt-6 lg:pt-14">
          <div className="mb-6 inline-flex items-center rounded-full border border-pink-300 bg-pink-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-pink-800">
            Transform operations
          </div>

          <h1 className="max-w-xl text-4xl font-black tracking-tight text-slate-950 sm:text-5xl lg:text-6xl">
            The smarter ERP for growing teams.
          </h1>

          <p className="mt-6 max-w-xl text-lg leading-8 text-slate-600">
            Hope, Inc. unifies product operations, human resources, sales performance, and customer experience into one modern platform built for scale.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-4">
            <button className="rounded-full bg-gradient-to-r from-pink-600 to-fuchsia-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-pink-600/25 transition hover:brightness-110">
              Start free trial
            </button>
            <button className="rounded-full border border-pink-200 bg-white px-6 py-3 text-sm font-semibold text-slate-700 transition hover:border-pink-300 hover:bg-pink-50">
              Watch overview
            </button>
          </div>

          <div className="mt-10 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {quickStats.map((stat) => (
              <div key={stat.label} className="rounded-2xl border border-pink-100 bg-white p-4 shadow-sm">
                <div className="text-2xl font-black text-slate-950">{stat.value}</div>
                <div className="mt-1 text-sm text-slate-500">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="lg:pt-8">
          <div className="overflow-hidden rounded-[28px] border border-pink-200 bg-white p-2 shadow-soft">
            <div className="rounded-[22px] bg-pink-50/60 p-4">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex gap-2">
                  <span className="h-3 w-3 rounded-full bg-red-400" />
                  <span className="h-3 w-3 rounded-full bg-yellow-400" />
                  <span className="h-3 w-3 rounded-full bg-pink-500" />
                </div>
                <span className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">Secure access</span>
              </div>

              <div className="rounded-2xl border border-pink-100 bg-white p-3 shadow-sm">
                <div className="flex rounded-xl bg-pink-50 p-1">
                  {tabs.map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveTab(tab.id)}
                      className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition ${
                        activeTab === tab.id
                          ? "bg-white text-pink-700 shadow-sm"
                          : "text-slate-500 hover:text-slate-800"
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
                        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                          Email address
                        </label>
                        <input
                          type="email"
                          defaultValue="admin@hopeinc.com"
                          className="w-full rounded-xl border border-pink-100 bg-pink-50/60 px-3 py-2.5 text-sm outline-none transition focus:border-pink-500 focus:bg-white"
                        />
                      </div>

                      <div>
                        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                          Password
                        </label>
                        <input
                          type="password"
                          defaultValue="********"
                          className="w-full rounded-xl border border-pink-100 bg-pink-50/60 px-3 py-2.5 text-sm outline-none transition focus:border-pink-500 focus:bg-white"
                        />
                      </div>

                      <div className="flex items-center justify-between text-xs text-slate-500">
                        <label className="flex items-center gap-2">
                          <input type="checkbox" defaultChecked className="h-4 w-4 rounded border-slate-300 text-pink-600 focus:ring-pink-500" />
                          Keep me signed in
                        </label>
                        <button type="button" className="font-semibold text-pink-700 hover:text-pink-900">
                          Forgot password?
                        </button>
                      </div>

                      <button className="w-full rounded-xl bg-gradient-to-r from-pink-600 to-fuchsia-600 px-4 py-3 text-sm font-semibold text-white transition hover:brightness-110">
                        Login to Dashboard
                      </button>
                    </>
                  )}

                  {activeTab === "register" && (
                    <>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                            First name
                          </label>
                          <input className="w-full rounded-xl border border-pink-100 bg-pink-50/60 px-3 py-2.5 text-sm outline-none transition focus:border-pink-500 focus:bg-white" defaultValue="Aisha" />
                        </div>
                        <div>
                          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                            Last name
                          </label>
                          <input className="w-full rounded-xl border border-pink-100 bg-pink-50/60 px-3 py-2.5 text-sm outline-none transition focus:border-pink-500 focus:bg-white" defaultValue="Bello" />
                        </div>
                      </div>

                      <div>
                        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                          Work email
                        </label>
                        <input type="email" className="w-full rounded-xl border border-pink-100 bg-pink-50/60 px-3 py-2.5 text-sm outline-none transition focus:border-pink-500 focus:bg-white" defaultValue="aisha@hopeinc.com" />
                      </div>

                      <div>
                        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                          Role
                        </label>
                        <select className="w-full rounded-xl border border-pink-100 bg-pink-50/60 px-3 py-2.5 text-sm outline-none transition focus:border-pink-500 focus:bg-white">
                          <option>Superadmin</option>
                          <option>Admin</option>
                          <option>User</option>
                        </select>
                      </div>

                      <button className="w-full rounded-xl bg-gradient-to-r from-pink-600 to-fuchsia-600 px-4 py-3 text-sm font-semibold text-white transition hover:brightness-110">
                        Create account
                      </button>
                    </>
                  )}

                  {activeTab === "reset" && (
                    <>
                      <div>
                        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                          Email address
                        </label>
                        <input type="email" className="w-full rounded-xl border border-pink-100 bg-pink-50/60 px-3 py-2.5 text-sm outline-none transition focus:border-pink-500 focus:bg-white" defaultValue="user@hopeinc.com" />
                      </div>

                      <p className="text-sm leading-6 text-slate-500">
                        Enter your work email and we’ll send instructions to reset your password securely.
                      </p>

                      <button className="w-full rounded-xl bg-gradient-to-r from-pink-600 to-fuchsia-600 px-4 py-3 text-sm font-semibold text-white transition hover:brightness-110">
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
        <div className="mb-8 flex items-end justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-pink-700">Core modules</p>
            <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-950">Everything your teams need to run smarter.</h2>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
          {modules.map((module) => (
            <article key={module.name} className="rounded-3xl border border-pink-100 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-md">
              <div className={`inline-flex h-12 w-12 items-center justify-center rounded-2xl text-2xl ring-1 ${module.accent}`}>
                {module.icon}
              </div>
              <h3 className="mt-4 text-xl font-bold text-slate-900">{module.name}</h3>
              <p className="mt-3 text-sm leading-6 text-slate-600">{module.description}</p>
              <button className="mt-5 text-sm font-semibold text-pink-700 hover:text-pink-900">Explore module →</button>
            </article>
          ))}
        </div>
      </section>

      <section id="security" className="mx-auto max-w-7xl px-4 pb-20 sm:px-6 lg:px-8">
        <div className="rounded-[32px] bg-slate-950 p-8 text-white shadow-soft lg:p-10">
          <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-pink-300">Why teams choose Hope</p>
              <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">Built for secure growth, insight, and accountability.</h2>
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                {featureHighlights.map((item) => (
                  <div key={item} className="flex items-center gap-3 rounded-2xl border border-slate-800 bg-slate-900/60 p-3 text-sm text-slate-200">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-pink-500/15 text-pink-300">✓</span>
                    {item}
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[28px] border border-pink-900/40 bg-gradient-to-br from-pink-500/15 to-fuchsia-500/5 p-5">
              <div className="rounded-2xl border border-slate-700 bg-slate-900/60 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Executive overview</p>
                <div className="mt-4 flex items-end justify-between">
                  <div>
                    <div className="text-3xl font-black text-white">86%</div>
                    <div className="text-sm text-slate-300">Faster team reporting</div>
                  </div>
                  <div className="rounded-full bg-pink-500/15 px-2 py-1 text-xs font-semibold text-pink-300">+18.4%</div>
                </div>

                <div className="mt-6 space-y-3">
                  {[75, 58, 90, 76].map((value, index) => (
                    <div key={value}>
                      <div className="mb-1 flex justify-between text-xs text-slate-400">
                        <span>{["Product", "HR", "Sales", "Support"][index]}</span>
                        <span>{value}%</span>
                      </div>
                      <div className="h-2.5 rounded-full bg-slate-800">
                        <div className="h-2.5 rounded-full bg-gradient-to-r from-pink-400 to-fuchsia-400" style={{ width: `${value}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <footer id="contact" className="border-t border-slate-200 bg-white/60">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 py-8 text-sm text-slate-600 sm:px-6 lg:flex-row lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-pink-500 to-fuchsia-600 text-sm font-bold text-white">
              H
            </div>
            <span className="font-semibold text-slate-800">Hope, Inc. ERP</span>
          </div>
          <div>© 2026 Hope, Inc. All rights reserved.</div>
        </div>
      </footer>
    </main>
  );
}
