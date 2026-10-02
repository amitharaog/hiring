"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { call } from "./api";

type Config = { testMode: boolean; testTarget: string | null; sendingConfigured: boolean };

const NAV = [
  { href: "/hiring", label: "Candidates", icon: "M16 11a4 4 0 10-8 0 4 4 0 008 0zM4 20a8 8 0 0116 0" },
  { href: "/hiring/upload", label: "Upload CVs", icon: "M12 16V4m0 0l-4 4m4-4l4 4M4 20h16" },
  { href: "/hiring/audit", label: "Audit log", icon: "M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" },
];

export function Sidebar() {
  const path = usePathname();
  const [cfg, setCfg] = useState<Config | null>(null);
  useEffect(() => {
    void call<Config>("/api/hiring/config").then(setCfg).catch(() => {});
  }, []);
  const active = (href: string) => (href === "/hiring" ? path === "/hiring" || path.startsWith("/hiring/candidate") : path.startsWith(href));

  return (
    <aside className="flex shrink-0 flex-col border-b border-slate-200 bg-white md:sticky md:top-0 md:h-screen md:w-64 md:border-b-0 md:border-r">
      <div className="flex items-center gap-3 px-5 py-5">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 text-white shadow-sm">
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="5" r="2" />
            <path d="M12 7v14M8 12h8M5 15a7 7 0 0014 0" />
          </svg>
        </span>
        <span className="leading-tight">
          <span className="block text-lg font-bold">Kargo</span>
          <span className="block text-xs text-slate-500">Hiring</span>
        </span>
      </div>

      <nav className="flex gap-1 px-3 pb-3 md:flex-1 md:flex-col md:pb-0">
        <p className="hidden px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-widest text-slate-400 md:block">Workspace</p>
        {NAV.map((n) => (
          <Link
            key={n.href}
            href={n.href}
            className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium ${
              active(n.href) ? "bg-violet-50 text-violet-700" : "text-slate-600 hover:bg-slate-50"
            }`}
          >
            <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d={n.icon} />
            </svg>
            {n.label}
          </Link>
        ))}
      </nav>

      {cfg && (
        <div className="m-3 hidden rounded-xl border border-slate-200 bg-slate-50 p-3 md:block">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <span className={`h-2 w-2 rounded-full ${!cfg.sendingConfigured ? "bg-slate-400" : cfg.testMode ? "bg-orange-500" : "bg-emerald-500"}`} />
            {!cfg.sendingConfigured ? "Sending off" : cfg.testMode ? "Test mode" : "Live mode"}
          </p>
          <p className="mt-0.5 text-xs text-slate-500">
            {!cfg.sendingConfigured
              ? "Add RESEND_API_KEY to enable sending"
              : cfg.testMode
                ? `Emails go to your test inbox (${cfg.testTarget})`
                : "Emails go to the candidates"}
          </p>
        </div>
      )}
    </aside>
  );
}
