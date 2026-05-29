import type { Metadata } from "next";
import { Hanken_Grotesk, Spectral } from "next/font/google";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

// Body / UI: a warm humanist grotesque — legible at the small sizes a
// data-dense genealogy app relies on.
const hankenGrotesk = Hanken_Grotesk({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

// Display / headings: a literary serif with the gravitas of a printed
// family record. Carries the archival, dignified tone of the project.
const spectral = Spectral({
  variable: "--font-display",
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Loyd Family History",
  description:
    "A comprehensive family history system for the Loyd family — explore the tree, search people, view timelines, and more.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${hankenGrotesk.variable} ${spectral.variable} font-sans text-base antialiased selection:bg-primary/20 selection:text-primary`}>
        <TooltipProvider delayDuration={300}>{children}</TooltipProvider>
      </body>
    </html>
  );
}
