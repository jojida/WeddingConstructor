import { Heart, Menu, X } from 'lucide-react';
import { useState } from 'react';

export function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-sm border-b border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-2">
            <Heart className="w-6 h-6 text-rose-500 fill-rose-500" />
            <span className="font-medium text-xl">InviteMe</span>
          </div>

          <nav className="hidden md:flex items-center gap-8">
            <a href="#templates" className="text-foreground/70 hover:text-foreground transition-colors">
              Шаблоны
            </a>
            <a href="#features" className="text-foreground/70 hover:text-foreground transition-colors">
              Возможности
            </a>
            <a href="#examples" className="text-foreground/70 hover:text-foreground transition-colors">
              Примеры
            </a>
            <a href="#pricing" className="text-foreground/70 hover:text-foreground transition-colors">
              Цены
            </a>
          </nav>

          <div className="hidden md:flex items-center gap-4">
            <button className="px-4 py-2 text-foreground/70 hover:text-foreground transition-colors">
              Войти
            </button>
            <button className="px-6 py-2 bg-rose-500 text-white rounded-lg hover:bg-rose-600 transition-colors">
              Создать приглашение
            </button>
          </div>

          <button
            className="md:hidden p-2"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
          >
            {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {isMenuOpen && (
        <div className="md:hidden border-t border-border bg-white">
          <nav className="flex flex-col px-4 py-4 gap-4">
            <a href="#templates" className="py-2 text-foreground/70 hover:text-foreground">
              Шаблоны
            </a>
            <a href="#features" className="py-2 text-foreground/70 hover:text-foreground">
              Возможности
            </a>
            <a href="#examples" className="py-2 text-foreground/70 hover:text-foreground">
              Примеры
            </a>
            <a href="#pricing" className="py-2 text-foreground/70 hover:text-foreground">
              Цены
            </a>
            <div className="flex flex-col gap-2 pt-2 border-t border-border">
              <button className="py-2 text-foreground/70 hover:text-foreground">
                Войти
              </button>
              <button className="px-6 py-2 bg-rose-500 text-white rounded-lg hover:bg-rose-600">
                Создать приглашение
              </button>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
