import type { Metadata } from "next";
import { Sora, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import { ThemeContextProvider } from "./ThemeContextHelper";
import { CookieConsentBanner } from "@/components/layout/CookieConsentBanner";

const sora = Sora({
  variable: "--font-sora",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "ClearHire — AI Freelance Matchmaking & Trust Verification",
  description: "Verify credentials, solve team allocation constraints, and monitor account risks in real-time.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${sora.variable} ${jetbrainsMono.variable} h-full antialiased dark`}
    >
      <body className="min-h-full bg-background text-foreground flex flex-col transition-colors duration-300">
        <ThemeContextProvider>
          <Providers>{children}</Providers>
          <CookieConsentBanner />
        </ThemeContextProvider>
      </body>
    </html>
  );
}


