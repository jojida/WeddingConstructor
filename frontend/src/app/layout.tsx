import type { Metadata } from "next";
// Шрифты — локально из пакетов @fontsource (не тянутся с Google при сборке;
// иначе `next build` падает на VPS без доступа к Google Fonts). Имена семейств
// проброшены в CSS-переменные --font-* в globals.css. Подтягивают все субсеты,
// включая кириллицу, через unicode-range.
import "@fontsource-variable/playfair-display";
import "@fontsource-variable/plus-jakarta-sans";
import "@fontsource-variable/raleway";
import "@fontsource/great-vibes";
// Шрифты карточек-превью шаблонов (чтобы миниатюра совпадала с самим
// приглашением): Cormorant Garamond — «Цветущая арка»/«Флоральный»,
// Montserrat — дата, Pinyon Script — амперсанд «Каллы». Локально, incl. кириллица.
import "@fontsource/cormorant-garamond/400.css";
import "@fontsource/cormorant-garamond/600.css";
import "@fontsource/cormorant-garamond/400-italic.css";
import "@fontsource/cormorant-garamond/600-italic.css";
import "@fontsource/montserrat/400.css";
import "@fontsource/pinyon-script/400.css";
import "./globals.css";
import { Toaster } from "react-hot-toast";
import AuthProvider from "@/components/AuthProvider";
import AnimationObserver from "@/components/AnimationObserver";
import { SITE_URL } from "@/lib/constants";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Сайт-приглашение на свадьбу с RSVP-анкетой — WeddingCraft",
    template: "%s — WeddingCraft",
  },
  description:
    "Создайте электронное свадебное приглашение за 5 минут: изящные шаблоны, RSVP-анкета, " +
    "уведомления об ответах гостей в Telegram и на Email, персональные ссылки и свой домен.",
  keywords: [
    "сайт-приглашение на свадьбу",
    "электронное приглашение на свадьбу",
    "свадебное приглашение онлайн",
    "пригласительные на свадьбу",
    "RSVP анкета для гостей",
    "конструктор свадебных приглашений",
  ],
  applicationName: "WeddingCraft",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: "WeddingCraft",
    locale: "ru_RU",
    url: "/",
    title: "Сайт-приглашение на свадьбу с RSVP-анкетой — WeddingCraft",
    description:
      "Электронные свадебные приглашения: изящные шаблоны, RSVP-анкета, уведомления в Telegram, " +
      "персональные ссылки для гостей и свой домен.",
    images: [{ url: "/invite/calla/assets/couple-photo.jpg", width: 1200, height: 630, alt: "Пример свадебного сайта-приглашения WeddingCraft" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Сайт-приглашение на свадьбу с RSVP-анкетой — WeddingCraft",
    description: "Электронные свадебные приглашения: шаблоны, RSVP-анкета, уведомления в Telegram.",
    images: ["/invite/calla/assets/couple-photo.jpg"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large" },
  },
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
