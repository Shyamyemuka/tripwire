import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import "./globals.css";

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Tripwire — Real-Time AI Hallucination Detection",
  description:
    "Tripwire sits between a streaming LLM response and the user, verifying individual factual claims against source material in real time using sub-10ms retrieval.",
  icons: {
    icon: "/logo.png",
    shortcut: "/logo.png",
    apple: "/logo.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${manrope.variable} h-full antialiased dark`}
    >
      <body
        className="min-h-full flex flex-col bg-[#05070A] text-[#F5F7FA] font-sans overflow-x-hidden selection:bg-white/20 selection:text-white"
        suppressHydrationWarning
      >
        {children}
      </body>
    </html>
  );
}