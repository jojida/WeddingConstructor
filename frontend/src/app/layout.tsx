import type { Metadata } from "next";
// Шрифты — локально из пакетов @fontsource (не тянутся с Google при сборке;
// иначе `next build` падает на VPS без доступа к Google Fonts). Имена семейств
// проброшены в CSS-переменные --font-* в globals.css. Подтягивают все субсеты,
// включая кириллицу, через unicode-range.
import "@fontsource-variable/playfair-display";
import "@fontsource-variable/plus-jakarta-sans";
import "@fontsource-variable/raleway";
import "@fontsource/great-vibes";
import "./globals.css";
import { Toaster } from "react-hot-toast";
import AuthProvider from "@/components/AuthProvider";
import AnimationObserver from "@/components/AnimationObserver";

export const metadata: Metadata = {
  title: "WeddingCraft — Цифровые свадебные приглашения",
  description: "Создайте изысканное цифровое приглашение на свадьбу. Выберите шаблон, персонализируйте и отправьте гостям одной ссылкой.",
  keywords: "свадьба, приглашение, цифровое, конструктор, онлайн, электронное",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <head>
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Marck+Script&display=swap" />
      </head>
      <body suppressHydrationWarning>
        <AuthProvider>
          {children}
        </AuthProvider>
        <AnimationObserver />
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: '#fff',
              color: '#0e1d26',
              border: '0.5px solid rgba(206, 197, 186, 0.5)',
              borderRadius: '12px',
              fontFamily: 'var(--font-inter)',
              boxShadow: '0 8px 32px rgba(14, 29, 38, 0.08)',
            },
          }}
        />
      </body>
    </html>
  );
}
