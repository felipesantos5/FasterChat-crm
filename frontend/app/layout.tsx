import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/components/providers/auth-provider";
import { ProgressBarProvider } from "@/components/providers/progress-bar-provider";
import { Suspense } from "react";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "CRM IA - Customer Relationship Management",
  description: "Sistema CRM com Chatbot de Inteligência Artificial",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className={inter.className}>
        <AuthProvider>
          <Suspense fallback={null}>
            <ProgressBarProvider />
          </Suspense>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
