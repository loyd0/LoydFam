import type { Metadata, Viewport } from "next";
import { Hanken_Grotesk, Barlow } from "next/font/google";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

// Body / UI: a warm humanist grotesque — legible at the small sizes a
// data-dense genealogy app relies on.
const hankenGrotesk = Hanken_Grotesk({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

// A clear sans-serif heading face, paired with the readable body font.
const barlow = Barlow({
  variable: "--font-display",
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
  display: "swap",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
  themeColor: "#f7f5ef",
};

export const metadata: Metadata = {
  title: "Loyd Family History",
  robots: { index: false, follow: false },
  description:
    "A comprehensive family history system for the Loyd family — explore the tree, search people, view timelines, and more.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body className={`${hankenGrotesk.variable} ${barlow.variable} font-sans text-base antialiased selection:bg-primary/20 selection:text-primary`}>
        <TooltipProvider delayDuration={300}>{children}</TooltipProvider>
      </body>
    </html>
  );
}
