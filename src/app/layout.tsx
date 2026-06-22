import type { Metadata } from "next";
import "./globals.css";

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
}

export const metadata: Metadata = {
  title: "Mars2050 - Колонизация Марса",
  description: "Браузерная онлайн стратегия по колонизации Марса",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ru"
      className="h-full antialiased font-sans"
    >
      <body className="min-h-[100dvh] flex flex-col bg-gray-900 text-white font-sans">
        {children}
      </body>
    </html>
  );
}
