import { Layout, Edit3, Send } from 'lucide-react';

const steps = [
  {
    icon: Layout,
    number: '01',
    title: 'Выберите шаблон',
    description: 'Просмотрите нашу коллекцию красивых дизайнов и выберите тот, который вам нравится',
  },
  {
    icon: Edit3,
    number: '02',
    title: 'Настройте детали',
    description: 'Добавьте свои имена, дату, место, фото и персонализируйте цвета и шрифты',
  },
  {
    icon: Send,
    number: '03',
    title: 'Отправьте гостям',
    description: 'Поделитесь приглашением через WhatsApp, email или соцсети одним кликом',
  },
];

export function HowItWorks() {
  return (
    <section className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl mb-4">
            Как это работает
          </h2>
          <p className="text-xl text-foreground/70">
            Три простых шага до идеального приглашения
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-12 relative">
          <div className="hidden md:block absolute top-1/4 left-0 right-0 h-0.5 bg-gradient-to-r from-rose-200 via-rose-300 to-rose-200"></div>

          {steps.map((step, index) => (
            <div key={index} className="relative">
              <div className="flex flex-col items-center text-center">
                <div className="relative mb-6">
                  <div className="w-24 h-24 bg-gradient-to-br from-rose-500 to-pink-500 rounded-full flex items-center justify-center shadow-xl relative z-10">
                    <step.icon className="w-10 h-10 text-white" />
                  </div>
                  <div className="absolute -top-2 -right-2 w-12 h-12 bg-white rounded-full flex items-center justify-center border-4 border-rose-100 z-20">
                    <span className="text-rose-500 font-bold">{step.number}</span>
                  </div>
                </div>
                <h3 className="text-2xl mb-4">{step.title}</h3>
                <p className="text-foreground/70 leading-relaxed max-w-sm">
                  {step.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
