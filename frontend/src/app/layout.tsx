import type { Metadata } from "next";
import { Playfair_Display, Plus_Jakarta_Sans, Cormorant_Garamond, Great_Vibes, Raleway } from "next/font/google";
import "./globals.css";
import { Toaster } from "react-hot-toast";
import AuthProvider from "@/components/AuthProvider";
import AnimationObserver from "@/components/AnimationObserver";

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "600", "700"],
});

const cormorant = Cormorant_Garamond({
  variable: "--font-cormorant",
  subsets: ["latin", "cyrillic"],
  weight: ["300", "400", "500", "600", "700"],
  style: ["normal", "italic"],
});

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

const greatVibes = Great_Vibes({
  variable: "--font-great-vibes",
  subsets: ["latin"],
  weight: ["400"],
});

const raleway = Raleway({
  variable: "--font-raleway",
  subsets: ["latin", "cyrillic"],
  weight: ["200", "300", "400"],
});

export const metadata: Metadata = {
  title: "Eloquence — Цифровые свадебные приглашения",
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
      <body className={`${playfair.variable} ${jakarta.variable} ${cormorant.variable} ${greatVibes.variable} ${raleway.variable}`} suppressHydrationWarning>
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
