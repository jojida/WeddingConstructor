import { TEMPLATE_DEFAULTS, templateCustomDefaults } from './constants';
import type { InviteData } from '@/components/TemplatePreview';

type CardTemplate = { id: string; defaultCover?: string; defaultGallery?: string[]; sampleBride?: string; sampleGroom?: string };

/** Данные превью шаблона в карточках каталога и главной: образец (имена, время,
    расписание) плюс адрес, тексты и подписи самого шаблона (TEMPLATE_DEFAULTS) —
    как у демо и страницы шаблона. Иначе превью расходилось с шаблоном: у «Пудры»
    на обложке стоял общий адрес образца. */
export function templateCardData(
  sample: Omit<InviteData, 'templateId' | 'weddingDate'>,
  tpl: CardTemplate,
  weddingDate: string,
): InviteData {
  const defs = TEMPLATE_DEFAULTS[tpl.id] || {};
  return {
    ...sample,
    venue: defs.venue ?? sample.venue,
    venueAddress: defs.venueAddress ?? sample.venueAddress,
    inviteText: defs.inviteText ?? sample.inviteText,
    brideName: tpl.sampleBride || sample.brideName,
    groomName: tpl.sampleGroom || sample.groomName,
    templateId: tpl.id,
    weddingDate,
    coverPhoto: tpl.defaultCover ?? sample.coverPhoto,
    galleryPhotos: tpl.defaultGallery ?? sample.galleryPhotos,
    customData: templateCustomDefaults(tpl.id, weddingDate),
  };
}
