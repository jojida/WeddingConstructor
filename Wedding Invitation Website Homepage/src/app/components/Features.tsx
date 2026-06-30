import { Wand2, Palette, Share2, Smartphone, Download, Heart } from 'lucide-react';

const features = [
  {
    icon: Wand2,
    title: 'Простой конструктор',
    description: 'Интуитивный редактор с перетаскиванием элементов. Создайте приглашение за 5 минут.',
  },
  {
    icon: Palette,
    title: 'Красивые шаблоны',
    description: 'Более 100 профессиональных дизайнов на любой стиль свадьбы.',
  },
  {
    icon: Smartphone,
    title: 'Адаптивный дизайн',
    description: 'Ваше приглашение отлично выглядит на любом устройстве.',
  },
  {
    icon: Share2,
    title: 'Легкая отправка',
    description: 'Делитесь через WhatsApp, email, соцсети одним кликом.',
  },
  {
    icon: Download,
    title: 'Экспорт в PDF',
    description: 'Скачайте готовое приглашение для печати в высоком качестве.',
  },
  {
    icon: Heart,
    title: 'RSVP система',
    description: 'Гости могут подтвердить присутствие прямо в приглашении.',
  },
];

export function Features() {
  return (
    <section id="features" className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl mb-4">
            Всё что нужно для создания
            <span className="block text-rose-500 mt-2">идеального приглашения</span>
          </h2>
          <p className="text-xl text-foreground/70 max-w-3xl mx-auto">
            Мы продумали каждую деталь, чтобы процесс создания был простым и приятным
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <div
              key={index}
              className="group p-8 rounded-2xl border-2 border-border hover:border-rose-200 hover:shadow-xl transition-all duration-300 bg-white"
            >
              <div className="w-14 h-14 bg-rose-100 rounded-xl flex items-center justify-center mb-6 group-hover:bg-rose-500 transition-colors">
                <feature.icon className="w-7 h-7 text-rose-500 group-hover:text-white transition-colors" />
              </div>
              <h3 className="text-xl mb-3">{feature.title}</h3>
              <p className="text-foreground/70 leading-relaxed">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
