import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans_Arabic, Inter, Manrope } from "next/font/google";
import { localeBootScript } from "@/i18n/config";
import { Providers } from "./providers";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const manrope = Manrope({ subsets: ["latin"], variable: "--font-manrope", display: "swap" });
const plexArabic = IBM_Plex_Sans_Arabic({
  subsets: ["arabic"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-plex-arabic",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "Batch Payouts · Apexaora", template: "%s · Apexaora Batch Payouts" },
  description: "One-click batch crypto payouts with maker / checker / executor controls.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#0c0c1b",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      dir="ltr"
      suppressHydrationWarning
      className={`${inter.variable} ${manrope.variable} ${plexArabic.variable} h-full`}
    >
      <head>
        {/* Applies saved lang/dir before paint (keeps the prerendered shell static). */}
        <script dangerouslySetInnerHTML={{ __html: localeBootScript }} />
      </head>
      <body className="min-h-full">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
