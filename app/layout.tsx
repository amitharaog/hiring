import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Kargo hiring",
  description: "Ranked shortlist, interview briefs and draft emails for the PM and SPM roles.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body className="min-h-screen font-sans antialiased">{children}</body>
    </html>
  );
}
