import { Sparkles, ArrowRight } from 'lucide-react';

export function Hero() {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden bg-gradient-to-br from-rose-50 via-pink-50 to-white">
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-20 left-10 w-72 h-72 bg-rose-300 rounded-full blur-3xl"></div>
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-pink-300 rounded-full blur-3xl"></div>
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-32">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div className="text-center lg:text-left">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-rose-100 rounded-full mb-6">
              <Sparkles className="w-4 h-4 text-rose-600" />
              <span className="text-sm text-rose-700">Создайте идеальное приглашение</span>
            </div>

            <h1 className="text-5xl md:text-6xl lg:text-7xl mb-6">
              Ваша свадьба начинается с
              <span className="block text-rose-500 mt-2">прекрасного приглашения</span>
            </h1>

            <p className="text-xl text-foreground/70 mb-8 max-w-2xl">
              Создавайте элегантные электронные приглашения на свадьбу за минуты.
              Без дизайнера. Без сложностей. Только красота и удобство.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
              <button className="px-8 py-4 bg-rose-500 text-white rounded-lg hover:bg-rose-600 transition-all hover:scale-105 flex items-center justify-center gap-2 shadow-lg shadow-rose-500/30">
                Начать бесплатно
                <ArrowRight className="w-5 h-5" />
              </button>
              <button className="px-8 py-4 bg-white border-2 border-rose-200 text-foreground rounded-lg hover:border-rose-300 transition-all">
                Посмотреть примеры
              </button>
            </div>

            <div className="mt-12 flex items-center gap-8 justify-center lg:justify-start text-sm">
              <div>
                <div className="text-2xl mb-1">10,000+</div>
                <div className="text-foreground/60">Созданных приглашений</div>
              </div>
              <div className="w-px h-12 bg-border"></div>
              <div>
                <div className="text-2xl mb-1">5,000+</div>
                <div className="text-foreground/60">Счастливых пар</div>
              </div>
              <div className="w-px h-12 bg-border"></div>
              <div>
                <div className="text-2xl mb-1">4.9★</div>
                <div className="text-foreground/60">Рейтинг</div>
              </div>
            </div>
          </div>

          <div className="relative">
            <div className="absolute -inset-4 bg-gradient-to-br from-rose-200 to-pink-200 rounded-3xl blur-2xl opacity-30"></div>
            <div className="relative rounded-2xl overflow-hidden shadow-2xl">
              <img
                src="https://images.unsplash.com/photo-1632610992723-82d7c212f6d7?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx3ZWRkaW5nJTIwaW52aXRhdGlvbiUyMGVsZWdhbnR8ZW58MXx8fHwxNzc5OTA5OTI4fDA&ixlib=rb-4.1.0&q=80&w=1080"
                alt="Elegant wedding invitation"
                className="w-full h-[600px] object-cover"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
