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
import PromoFromUrl from "@/components/PromoFromUrl";
import { SITE_URL, TEMPLATES } from "@/lib/constants";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    // Начало заголовка — главный запрос («приглашение/приглашения на свадьбу»):
    // поисковики сильнее учитывают первые слова, а в выдаче их видно без обрезки
    default: "Приглашение на свадьбу онлайн — электронные приглашения | WeddingCraft",
    template: "%s — WeddingCraft",
  },
  description:
    `Электронное приглашение на свадьбу за один вечер: ${TEMPLATES.length} шаблонов, ваши имена, фото и музыка, ` +
    "анкета для гостей с ответами в Telegram. Посмотрите бесплатно — оплата только при публикации.",
  keywords: [
    "приглашение на свадьбу",
    "приглашения на свадьбу онлайн",
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
    title: "Приглашение на свадьбу онлайн — WeddingCraft",
    description:
      "Электронное приглашение на свадьбу: изящные шаблоны, ваши фото и музыка, анкета для гостей " +
      "с ответами в Telegram. Посмотрите бесплатно — оплата только при публикации.",
    images: [{ url: "/invite/calla/assets/couple-photo.jpg", width: 1200, height: 630, alt: "Пример свадебного сайта-приглашения WeddingCraft" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Приглашение на свадьбу онлайн — WeddingCraft",
    description: "Электронное приглашение на свадьбу: шаблоны, анкета для гостей, ответы в Telegram.",
    images: ["/invite/calla/assets/couple-photo.jpg"],
  },
  // Подтверждение прав в Google Search Console и Pinterest (бизнес-аккаунт) — теги должны
  // оставаться, иначе подтверждение снимут.
  verification: {
    google: "-xXdpwhsOmpHhRB8LkocSqM-cLraTtRemQvTTQlLmpg",
    other: { "p:domain_verify": "6669026571aa855f7db664555c544c3f" },
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
        <link rel="stylesheet" href="/invite/assets/fonts/google/758c70af13ec1d31ff6b.css" />
        {/* Caveat и Alice — карточка шаблона «Скетч» (те же шрифты, что и в самом шаблоне) */}
        <link rel="stylesheet" href="/invite/assets/fonts/google/c125798b2a99adcb4bf4.css" />
      </head>
      <body suppressHydrationWarning>
        <AuthProvider>
          {children}
        </AuthProvider>
        <AnimationObserver />
        <PromoFromUrl />
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
