import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Space_Grotesk, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const grotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-sans",
  weight: ["400", "500", "600", "700"],
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  weight: ["400", "600"],
});

export const metadata: Metadata = {
  title: "Reddit Story – KI Story Video Studio",
  description:
    "Erstelle automatisch virale Reddit-Story-Videos mit KI, TTS, Untertiteln und plane sie direkt über Buffer.",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#07070a",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="de" data-theme="black" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem('rs-theme')||'black';document.documentElement.dataset.theme=t;}catch(e){}`,
          }}
        />
      </head>
      <body className={`${grotesk.variable} ${mono.variable} font-[var(--font-sans)] antialiased`}>
        {children}
      </body>
    </html>
  );
}
