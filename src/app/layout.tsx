import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "NexaFlow - Automate workflows without the chaos",
  description: "NexaFlow connects your tools, orchestrates your pipelines, and gives your team superpowers.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" className={cn("font-sans antialiased h-full", inter.variable)}>
      <body className="min-h-screen h-full bg-background text-foreground">
        {children}
      </body>
    </html>
  );
}
