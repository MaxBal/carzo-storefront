import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin", "cyrillic"],
  weight: ["200", "300", "400"],
});

export const metadata: Metadata = {
  title: "Carzo Головна",
  description: "Преміальні автоаксесуари Carzo, виготовлені в Україні.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="uk">
      <body className={`${inter.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
