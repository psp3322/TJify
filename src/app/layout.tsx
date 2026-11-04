import type { Metadata, Viewport } from "next";
import { SITE_DESCRIPTION, SITE_NAME, SITE_TAGLINE } from "@/lib/site";
import "./globals.css";

export const metadata: Metadata = {
  title: `${SITE_NAME} · 내 플레이리스트 노래방 번호 찾기`,
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  openGraph: {
    title: `${SITE_NAME} · 내 플레이리스트 노래방 번호 찾기`,
    description: SITE_TAGLINE,
    type: "website",
    locale: "ko_KR",
  },
};

export const viewport: Viewport = {
  themeColor: "#0b0b12",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
