import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Providers from "./providers";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "ClearHire — AI Hiring Intelligence",
  description: "Professional AI-powered freelancer hiring intelligence platform",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <body className="min-h-screen overflow-x-hidden antialiased">
        <div className="app-backdrop" aria-hidden="true" />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
