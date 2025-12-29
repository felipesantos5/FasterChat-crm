import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/components/providers/auth-provider";
import { ProgressBarProvider } from "@/components/providers/progress-bar-provider";
import { SWRProvider } from "@/components/providers/swr-provider";
import { Toaster } from "sonner";
import { Suspense } from "react";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: {
    default: "FasterChat - CRM",
    template: "%s | FasterChat",
  },
  description: "Plataforma de CRM com Chatbot de Inteligencia Artificial para WhatsApp. Automatize atendimentos, gerencie clientes e aumente suas vendas com IA.",
  keywords: [
    "CRM",
    "WhatsApp",
    "Chatbot",
    "Inteligencia Artificial",
    "IA",
    "Atendimento automatico",
    "Gestao de clientes",
    "Automacao de vendas",
    "FasterChat",
    "CRM WhatsApp",
    "Bot WhatsApp",
  ],
  authors: [{ name: "FasterChat" }],
  creator: "FasterChat",
  publisher: "FasterChat",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  openGraph: {
    type: "website",
    locale: "pt_BR",
    url: "https://admin.fasterchat.com.br",
    siteName: "FasterChat",
    title: "FasterChat - CRM com Inteligencia Artificial",
    description: "Plataforma de CRM com Chatbot de Inteligencia Artificial para WhatsApp. Automatize atendimentos, gerencie clientes e aumente suas vendas.",
    images: [
      {
        url: "/logo.png",
        width: 512,
        height: 512,
        alt: "FasterChat logo"
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "FasterChat - CRM com Inteligencia Artificial",
    description: "Plataforma de CRM com Chatbot de IA para WhatsApp. Automatize atendimentos e aumente suas vendas.",
    images: ["/logo.png"],
  },
  icons: {
    icon: [
      { url: "/logo.png", sizes: "32x32", type: "image/png" },
      { url: "/logo.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [
      { url: "/logo.png", sizes: "180x180", type: "image/png" },
    ],
    shortcut: "/logo.png",
  },
  manifest: "/manifest.json",
  category: "technology",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#22C55E" },
    { media: "(prefers-color-scheme: dark)", color: "#16A34A" },
  ],
};

// JSON-LD structured data para SEO
const jsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "FasterChat",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  description: "Plataforma de CRM com Chatbot de Inteligencia Artificial para WhatsApp. Automatize atendimentos, gerencie clientes e aumente suas vendas.",
  url: "https://admin.fasterchat.com.br",
  author: {
    "@type": "Organization",
    name: "FasterChat",
  },
  offers: {
    "@type": "Offer",
    category: "SaaS",
  },
  featureList: [
    "CRM integrado com WhatsApp",
    "Chatbot com Inteligencia Artificial",
    "Automacao de atendimento",
    "Gestao de clientes",
    "Pipeline de vendas",
    "Campanhas de mensagens",
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className={inter.className}>
        <SWRProvider>
          <AuthProvider>
            <Suspense fallback={null}>
              <ProgressBarProvider />
            </Suspense>
            {children}
            <Toaster position="top-right" richColors closeButton />
          </AuthProvider>
        </SWRProvider>
      </body>
    </html>
  );
}
