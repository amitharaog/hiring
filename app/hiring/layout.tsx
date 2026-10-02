import type { Metadata } from "next";
import { Sidebar } from "@/components/hiring/Sidebar";

export const metadata: Metadata = {
  title: "Kargo hiring",
  description: "Ranked shortlist, interview briefs and draft emails for the PM and SPM roles.",
  robots: { index: false, follow: false },
};

export default function HiringLayout({ children }: LayoutProps<"/hiring">) {
  return (
    <div className="min-h-screen bg-[#f7f7fb] text-slate-900 md:flex">
      <Sidebar />
      <main className="min-w-0 flex-1 px-4 py-6 md:px-10 md:py-8">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
    </div>
  );
}
