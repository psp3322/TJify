import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TJify · 내 플레이리스트 노래방 번호",
  description: "Spotify·YouTube에서 좋아요 누른 노래의 TJ·금영 노래방 번호를 한 번에 찾아 주는 웹앱",
  applicationName: "TJify",
  appleWebApp: { capable: true, title: "TJify", statusBarStyle: "black-translucent" },
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
