import type { Metadata } from "next";
import { Public_Sans, Spectral } from "next/font/google";
import Sidebar from "./components/Sidebar";
import "./globals.css";

// Public Sans for UI/body/data; Spectral for display headings + verbatim source
// text. Self-hosted by next/font (no external request).
const publicSans = Public_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-public-sans",
  display: "swap",
});
const spectral = Spectral({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-spectral",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Contract Clearinghouse",
  description: "AI-assisted contract comparison for school districts",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${publicSans.variable} ${spectral.variable}`}>
        <Sidebar />
        {/* The scroll container Review measures against (#main-scroll). */}
        <main
          id="main-scroll"
          className="ml-[248px] h-screen overflow-y-auto"
        >
          <div className="mx-auto max-w-[1200px] px-9 py-9">{children}</div>
        </main>
      </body>
    </html>
  );
}
