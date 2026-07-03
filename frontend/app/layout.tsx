import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "KING2MO RAG",
  description: "Assistant Intelligent augmenté par vos documents locaux et le Web.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700;800&family=Roboto+Mono:wght@400;700&family=Outfit:wght@300;400;500;700;800;900&family=Inter:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <div className="scanlines"></div>
        {children}
      </body>
    </html>
  );
}
