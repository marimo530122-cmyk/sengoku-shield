import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SENGOKU-SHIELD",
  description: "迷惑電話・詐欺電話 対応AIシステム",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ja" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-[#0a0c0f] text-[#e4e7ec]">{children}</body>
    </html>
  );
}
