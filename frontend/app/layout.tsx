import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { Providers } from "@/components/providers";
import { CookieConsentBanner } from "@/components/layout/CookieConsentBanner";

// Self-hosted (latin, variable weight) so dev/build don't depend on reaching
// fonts.gstatic.com, which next/font/google fetches at compile time.
const jakarta = localFont({
  src: "./fonts/PlusJakartaSans-Variable.woff2",
  variable: "--font-jakarta",
  weight: "200 800",
  display: "swap",
});

// Condensed display face for headings (SIL OFL, see fonts/Anton-OFL.txt).
const anton = localFont({
  src: "./fonts/Anton-Regular.woff2",
  variable: "--font-anton",
  weight: "400",
  display: "swap",
});

const jetbrainsMono = localFont({
  src: "./fonts/JetBrainsMono-Variable.woff2",
  variable: "--font-jetbrains",
  weight: "100 800",
  display: "swap",
});

export const metadata: Metadata = {
  title: "ClearHire — find the right people, build the right team",
  description:
    "Describe a project in plain language. ClearHire extracts the requirements, ranks freelancers with evidence, assembles teams within budget, and flags risky profiles for review.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${jakarta.variable} ${anton.variable} ${jetbrainsMono.variable} h-full`} suppressHydrationWarning>
      <body className="min-h-full bg-shell text-fg flex flex-col">
        <Providers>{children}</Providers>
        <CookieConsentBanner />
      </body>
    </html>
  );
}
