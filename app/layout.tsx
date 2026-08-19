import type { Metadata } from "next";
import { IBM_Plex_Sans_Arabic, Inter, Montserrat } from "next/font/google";
import { ConvexClientProvider } from "@/components/providers/convex-provider";
import { PwaProvider } from "@/components/pwa/pwa-provider";
import { ToasterProvider } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { STORE_LOGO_PATH, STORE_NAME } from "@/lib/brand/constants";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
  weight: ["400", "500", "600", "700"],
});

/** Heavy geometric wordmark — matches Jamaa Market logo typography */
const montserrat = Montserrat({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-montserrat",
  weight: ["800", "900"],
});

/** Clear Arabic UI font (Inter has no Arabic glyphs). */
const ibmPlexArabic = IBM_Plex_Sans_Arabic({
  subsets: ["arabic"],
  display: "swap",
  variable: "--font-arabic",
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: {
    default: STORE_NAME,
    template: `%s | ${STORE_NAME}`,
  },
  description: `Administration supermarché ${STORE_NAME}`,
  applicationName: STORE_NAME,
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: STORE_NAME,
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: STORE_LOGO_PATH,
    apple: STORE_LOGO_PATH,
  },
};

export const viewport = {
  themeColor: "#7a1518",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover" as const,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      className={`${inter.variable} ${montserrat.variable} ${ibmPlexArabic.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body
        className="flex min-h-full flex-col font-sans"
        suppressHydrationWarning
      >
        <ConvexClientProvider>
          <PwaProvider>
            <ToasterProvider>
              <TooltipProvider>{children}</TooltipProvider>
            </ToasterProvider>
          </PwaProvider>
        </ConvexClientProvider>
      </body>
    </html>
  );
}
