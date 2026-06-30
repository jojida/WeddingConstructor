
const examples = [
  {
    image: 'https://images.unsplash.com/photo-1741893043659-ca8b82a8b637?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHw1fHx3ZWRkaW5nJTIwaW52aXRhdGlvbiUyMGVsZWdhbnR8ZW58MXx8fHwxNzc5OTA5OTI4fDA&ixlib=rb-4.1.0&q=80&w=1080',
    title: 'Классический',
    style: 'Элегантная классика',
  },
  {
    image: 'https://images.unsplash.com/photo-1732649124686-3bab54f79aa3?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHw0fHx3ZWRkaW5nJTIwaW52aXRhdGlvbiUyMGVsZWdhbnR8ZW58MXx8fHwxNzc5OTA5OTI4fDA&ixlib=rb-4.1.0&q=80&w=1080',
    title: 'Современный',
    style: 'Минимализм и стиль',
  },
  {
    image: 'https://images.unsplash.com/photo-1721176487015-5408ae0e9bc2?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwyfHx3ZWRkaW5nJTIwaW52aXRhdGlvbiUyMGVsZWdhbnR8ZW58MXx8fHwxNzc5OTA5OTI4fDA&ixlib=rb-4.1.0&q=80&w=1080',
    title: 'Романтичный',
    style: 'Нежность и любовь',
  },
];

export function Examples() {
  return (
    <section id="examples" className="py-24 bg-gradient-to-br from-rose-50 to-pink-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl mb-4">
            Вдохновитесь примерами
          </h2>
          <p className="text-xl text-foreground/70 max-w-3xl mx-auto">
            От классики до современности — найдите стиль, который отражает вашу историю любви
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {examples.map((example, index) => (
            <div
              key={index}
              className="group relative overflow-hidden rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 cursor-pointer"
            >
              <div className="aspect-[3/4] relative overflow-hidden">
                <img
                  src={example.image}
                  alt={example.title}
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              </div>
              <div className="absolute bottom-0 left-0 right-0 p-6 text-white transform translate-y-2 group-hover:translate-y-0 transition-transform">
                <h3 className="text-2xl mb-1">{example.title}</h3>
                <p className="text-white/80">{example.style}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="text-center mt-12">
          <button className="px-8 py-4 bg-rose-500 text-white rounded-lg hover:bg-rose-600 transition-all hover:scale-105 shadow-lg">
            Посмотреть все шаблоны
          </button>
        </div>
      </div>
    </section>
  );
}
