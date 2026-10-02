import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Kargo hiring",
  description: "Ranked shortlist, interview briefs and draft emails for the PM and SPM roles.",
  robots: { index: false, follow: false },
};

export default function HiringLayout({ children }: LayoutProps<"/hiring">) {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <nav className="mx-auto flex max-w-6xl items-center gap-6 px-4 py-3 text-sm">
          <span className="font-bold">Kargo hiring</span>
          <Link href="/hiring" className="text-slate-600 hover:text-slate-900">Dashboard</Link>
          <Link href="/hiring/upload" className="text-slate-600 hover:text-slate-900">Upload CVs</Link>
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}
