import { Heart, Instagram, Facebook, Twitter } from 'lucide-react';

export function Footer() {
  return (
    <footer className="bg-gradient-to-br from-rose-900 to-pink-900 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid md:grid-cols-4 gap-12 mb-12">
          <div className="md:col-span-2">
            <div className="flex items-center gap-2 mb-4">
              <Heart className="w-6 h-6 fill-white" />
              <span className="text-xl">InviteMe</span>
            </div>
            <p className="text-white/80 mb-6 max-w-md">
              Создавайте незабываемые приглашения на свадьбу, которые покорят сердца ваших гостей
            </p>
            <div className="flex gap-4">
              <a href="#" className="w-10 h-10 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center transition-colors">
                <Instagram className="w-5 h-5" />
              </a>
              <a href="#" className="w-10 h-10 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center transition-colors">
                <Facebook className="w-5 h-5" />
              </a>
              <a href="#" className="w-10 h-10 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center transition-colors">
                <Twitter className="w-5 h-5" />
              </a>
            </div>
          </div>

          <div>
            <h4 className="mb-4">Продукт</h4>
            <ul className="space-y-3">
              <li><a href="#" className="text-white/80 hover:text-white transition-colors">Шаблоны</a></li>
              <li><a href="#" className="text-white/80 hover:text-white transition-colors">Возможности</a></li>
              <li><a href="#" className="text-white/80 hover:text-white transition-colors">Цены</a></li>
              <li><a href="#" className="text-white/80 hover:text-white transition-colors">Примеры</a></li>
            </ul>
          </div>

          <div>
            <h4 className="mb-4">Компания</h4>
            <ul className="space-y-3">
              <li><a href="#" className="text-white/80 hover:text-white transition-colors">О нас</a></li>
              <li><a href="#" className="text-white/80 hover:text-white transition-colors">Блог</a></li>
              <li><a href="#" className="text-white/80 hover:text-white transition-colors">Контакты</a></li>
              <li><a href="#" className="text-white/80 hover:text-white transition-colors">Помощь</a></li>
            </ul>
          </div>
        </div>

        <div className="border-t border-white/20 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-white/60 text-sm">
            © 2026 InviteMe. Все права защищены.
          </p>
          <div className="flex gap-6 text-sm">
            <a href="#" className="text-white/60 hover:text-white transition-colors">Политика конфиденциальности</a>
            <a href="#" className="text-white/60 hover:text-white transition-colors">Условия использования</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
