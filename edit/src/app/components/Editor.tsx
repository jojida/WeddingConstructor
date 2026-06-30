import { useState } from 'react';
import { ArrowLeft, Download, Share2, Eye, Settings, Type, Image as ImageIcon, Palette, Save } from 'lucide-react';

interface InvitationData {
  groomName: string;
  brideName: string;
  date: string;
  time: string;
  venue: string;
  address: string;
  message: string;
  primaryColor: string;
  secondaryColor: string;
  fontStyle: string;
}

export function Editor() {
  const [invitationData, setInvitationData] = useState<InvitationData>({
    groomName: 'Александр',
    brideName: 'Екатерина',
    date: '15 июня 2026',
    time: '16:00',
    venue: 'Усадьба "Романтика"',
    address: 'Московская область, д. Красное',
    message: 'Приглашаем вас разделить с нами радость этого особенного дня',
    primaryColor: '#f43f5e',
    secondaryColor: '#fda4af',
    fontStyle: 'elegant',
  });

  const [activeTab, setActiveTab] = useState<'content' | 'design' | 'settings'>('content');
  const [showPreview, setShowPreview] = useState(false);

  const updateField = (field: keyof InvitationData, value: string) => {
    setInvitationData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-border sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <button className="flex items-center gap-2 text-foreground/70 hover:text-foreground transition-colors">
                <ArrowLeft className="w-5 h-5" />
                <span>Назад</span>
              </button>
              <div className="w-px h-6 bg-border"></div>
              <h1 className="text-lg">Редактор приглашения</h1>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowPreview(!showPreview)}
                className="px-4 py-2 flex items-center gap-2 text-foreground/70 hover:text-foreground transition-colors"
              >
                <Eye className="w-4 h-4" />
                <span className="hidden sm:inline">Предпросмотр</span>
              </button>
              <button className="px-4 py-2 flex items-center gap-2 text-foreground/70 hover:text-foreground transition-colors">
                <Save className="w-4 h-4" />
                <span className="hidden sm:inline">Сохранить</span>
              </button>
              <button className="px-4 py-2 flex items-center gap-2 bg-rose-500 text-white rounded-lg hover:bg-rose-600 transition-colors">
                <Share2 className="w-4 h-4" />
                <span className="hidden sm:inline">Опубликовать</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid lg:grid-cols-2 gap-8">
          {/* Editor Panel */}
          <div className="space-y-6">
            {/* Tabs */}
            <div className="bg-white rounded-xl border border-border overflow-hidden">
              <div className="flex border-b border-border">
                <button
                  onClick={() => setActiveTab('content')}
                  className={`flex-1 px-6 py-4 flex items-center justify-center gap-2 transition-colors ${
                    activeTab === 'content'
                      ? 'bg-rose-50 text-rose-600 border-b-2 border-rose-500'
                      : 'text-foreground/70 hover:bg-gray-50'
                  }`}
                >
                  <Type className="w-4 h-4" />
                  <span>Содержание</span>
                </button>
                <button
                  onClick={() => setActiveTab('design')}
                  className={`flex-1 px-6 py-4 flex items-center justify-center gap-2 transition-colors ${
                    activeTab === 'design'
                      ? 'bg-rose-50 text-rose-600 border-b-2 border-rose-500'
                      : 'text-foreground/70 hover:bg-gray-50'
                  }`}
                >
                  <Palette className="w-4 h-4" />
                  <span>Дизайн</span>
                </button>
                <button
                  onClick={() => setActiveTab('settings')}
                  className={`flex-1 px-6 py-4 flex items-center justify-center gap-2 transition-colors ${
                    activeTab === 'settings'
                      ? 'bg-rose-50 text-rose-600 border-b-2 border-rose-500'
                      : 'text-foreground/70 hover:bg-gray-50'
                  }`}
                >
                  <Settings className="w-4 h-4" />
                  <span>Настройки</span>
                </button>
              </div>

              <div className="p-6">
                {/* Content Tab */}
                {activeTab === 'content' && (
                  <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm mb-2">Имя жениха</label>
                        <input
                          type="text"
                          value={invitationData.groomName}
                          onChange={(e) => updateField('groomName', e.target.value)}
                          className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm mb-2">Имя невесты</label>
                        <input
                          type="text"
                          value={invitationData.brideName}
                          onChange={(e) => updateField('brideName', e.target.value)}
                          className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm mb-2">Дата</label>
                        <input
                          type="text"
                          value={invitationData.date}
                          onChange={(e) => updateField('date', e.target.value)}
                          className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm mb-2">Время</label>
                        <input
                          type="text"
                          value={invitationData.time}
                          onChange={(e) => updateField('time', e.target.value)}
                          className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm mb-2">Место проведения</label>
                      <input
                        type="text"
                        value={invitationData.venue}
                        onChange={(e) => updateField('venue', e.target.value)}
                        className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm mb-2">Адрес</label>
                      <input
                        type="text"
                        value={invitationData.address}
                        onChange={(e) => updateField('address', e.target.value)}
                        className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm mb-2">Приветственное сообщение</label>
                      <textarea
                        value={invitationData.message}
                        onChange={(e) => updateField('message', e.target.value)}
                        rows={4}
                        className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500 resize-none"
                      />
                    </div>
                  </div>
                )}

                {/* Design Tab */}
                {activeTab === 'design' && (
                  <div className="space-y-6">
                    <div>
                      <label className="block text-sm mb-2">Основной цвет</label>
                      <div className="flex gap-3">
                        <input
                          type="color"
                          value={invitationData.primaryColor}
                          onChange={(e) => updateField('primaryColor', e.target.value)}
                          className="w-16 h-12 rounded-lg border border-border cursor-pointer"
                        />
                        <input
                          type="text"
                          value={invitationData.primaryColor}
                          onChange={(e) => updateField('primaryColor', e.target.value)}
                          className="flex-1 px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm mb-2">Дополнительный цвет</label>
                      <div className="flex gap-3">
                        <input
                          type="color"
                          value={invitationData.secondaryColor}
                          onChange={(e) => updateField('secondaryColor', e.target.value)}
                          className="w-16 h-12 rounded-lg border border-border cursor-pointer"
                        />
                        <input
                          type="text"
                          value={invitationData.secondaryColor}
                          onChange={(e) => updateField('secondaryColor', e.target.value)}
                          className="flex-1 px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm mb-2">Стиль шрифта</label>
                      <select
                        value={invitationData.fontStyle}
                        onChange={(e) => updateField('fontStyle', e.target.value)}
                        className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500"
                      >
                        <option value="elegant">Элегантный</option>
                        <option value="modern">Современный</option>
                        <option value="classic">Классический</option>
                        <option value="romantic">Романтический</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm mb-2">Фоновое изображение</label>
                      <div className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-rose-300 transition-colors cursor-pointer">
                        <ImageIcon className="w-12 h-12 mx-auto text-foreground/40 mb-3" />
                        <p className="text-sm text-foreground/70 mb-1">Нажмите для загрузки</p>
                        <p className="text-xs text-foreground/50">PNG, JPG до 5MB</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Settings Tab */}
                {activeTab === 'settings' && (
                  <div className="space-y-6">
                    <div>
                      <label className="flex items-center gap-3">
                        <input type="checkbox" className="w-4 h-4 text-rose-500 rounded" defaultChecked />
                        <span className="text-sm">Включить RSVP форму</span>
                      </label>
                      <p className="text-xs text-foreground/60 mt-2 ml-7">
                        Гости смогут подтвердить присутствие прямо в приглашении
                      </p>
                    </div>

                    <div>
                      <label className="flex items-center gap-3">
                        <input type="checkbox" className="w-4 h-4 text-rose-500 rounded" />
                        <span className="text-sm">Добавить карту проезда</span>
                      </label>
                      <p className="text-xs text-foreground/60 mt-2 ml-7">
                        Показать интерактивную карту с местом проведения
                      </p>
                    </div>

                    <div>
                      <label className="flex items-center gap-3">
                        <input type="checkbox" className="w-4 h-4 text-rose-500 rounded" defaultChecked />
                        <span className="text-sm">Обратный отсчет</span>
                      </label>
                      <p className="text-xs text-foreground/60 mt-2 ml-7">
                        Отображать таймер до дня свадьбы
                      </p>
                    </div>

                    <div>
                      <label className="flex items-center gap-3">
                        <input type="checkbox" className="w-4 h-4 text-rose-500 rounded" />
                        <span className="text-sm">Фотогалерея</span>
                      </label>
                      <p className="text-xs text-foreground/60 mt-2 ml-7">
                        Добавить раздел с вашими фотографиями
                      </p>
                    </div>

                    <div className="pt-4 border-t border-border">
                      <label className="block text-sm mb-2">Язык приглашения</label>
                      <select className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500">
                        <option>Русский</option>
                        <option>English</option>
                        <option>Español</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Preview Panel */}
          <div className="lg:sticky lg:top-24 h-fit">
            <div className="bg-white rounded-xl border border-border overflow-hidden shadow-lg">
              <div className="bg-gray-100 px-4 py-3 border-b border-border flex items-center justify-between">
                <span className="text-sm text-foreground/70">Предпросмотр</span>
                <div className="flex gap-2">
                  <button className="px-3 py-1 text-xs bg-white rounded border border-border hover:bg-gray-50">
                    Мобильный
                  </button>
                  <button className="px-3 py-1 text-xs bg-rose-500 text-white rounded">
                    Десктоп
                  </button>
                </div>
              </div>

              {/* Invitation Preview */}
              <div className="p-8 bg-gradient-to-br from-rose-50 via-pink-50 to-white min-h-[600px]">
                <div className="max-w-md mx-auto bg-white rounded-2xl shadow-2xl overflow-hidden">
                  <div
                    className="h-3"
                    style={{ backgroundColor: invitationData.primaryColor }}
                  ></div>

                  <div className="p-8 text-center">
                    <div className="mb-6">
                      <svg className="w-16 h-16 mx-auto" style={{ color: invitationData.primaryColor }} fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" />
                      </svg>
                    </div>

                    <p className="text-sm text-foreground/60 mb-4">Приглашаем на свадьбу</p>

                    <h2 className="text-3xl mb-2" style={{ color: invitationData.primaryColor }}>
                      {invitationData.groomName}
                    </h2>
                    <p className="text-xl text-foreground/60 mb-2">&</p>
                    <h2 className="text-3xl mb-6" style={{ color: invitationData.primaryColor }}>
                      {invitationData.brideName}
                    </h2>

                    <div className="w-16 h-px bg-border mx-auto mb-6"></div>

                    <p className="text-foreground/70 mb-8 leading-relaxed">
                      {invitationData.message}
                    </p>

                    <div className="bg-gray-50 rounded-xl p-6 mb-6">
                      <div className="flex items-center justify-center gap-2 mb-3">
                        <svg className="w-5 h-5" style={{ color: invitationData.primaryColor }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <span className="font-medium">{invitationData.date}</span>
                      </div>
                      <div className="flex items-center justify-center gap-2 mb-4">
                        <svg className="w-5 h-5" style={{ color: invitationData.primaryColor }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span className="font-medium">{invitationData.time}</span>
                      </div>
                      <div className="border-t border-border pt-4">
                        <p className="font-medium mb-1">{invitationData.venue}</p>
                        <p className="text-sm text-foreground/60">{invitationData.address}</p>
                      </div>
                    </div>

                    <button
                      className="w-full py-3 text-white rounded-lg transition-colors"
                      style={{ backgroundColor: invitationData.primaryColor }}
                    >
                      Подтвердить присутствие
                    </button>
                  </div>

                  <div
                    className="h-3"
                    style={{ backgroundColor: invitationData.primaryColor }}
                  ></div>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="mt-4 flex gap-3">
              <button className="flex-1 px-4 py-3 bg-white border border-border rounded-lg hover:bg-gray-50 transition-colors flex items-center justify-center gap-2">
                <Download className="w-4 h-4" />
                <span className="text-sm">Скачать PDF</span>
              </button>
              <button className="flex-1 px-4 py-3 bg-white border border-border rounded-lg hover:bg-gray-50 transition-colors flex items-center justify-center gap-2">
                <Share2 className="w-4 h-4" />
                <span className="text-sm">Поделиться</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
