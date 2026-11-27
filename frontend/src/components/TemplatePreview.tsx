'use client';
import { planSections, isBrandFree, hasWatermark } from '@/lib/plans';
import { TEMPLATE_DEFAULTS } from '@/lib/constants';
import dynamic from 'next/dynamic';
import { Fragment } from 'react';
import { isStudioTemplate } from '@/lib/studioTemplates';

// Keep server rendering; only the selected design needs client JavaScript.
const SimpleTemplate = dynamic(() => import('./SimpleTemplate'));
const VadimDaryaTemplate = dynamic(() => import('./VadimDaryaTemplate'));
const MediterraneanTemplate = dynamic(() => import('./MediterraneanTemplate'));
const FloralTemplate = dynamic(() => import('./FloralTemplate'));
const GardenArchTemplate = dynamic(() => import('./GardenArchTemplate'));
const SketchTemplate = dynamic(() => import('./SketchTemplate'));
const CallaTemplate = dynamic(() => import('./CallaTemplate'));
const IvoryTemplate = dynamic(() => import('./IvoryTemplate'));
const GardenEveningTemplate = dynamic(() => import('./GardenEveningTemplate'));
const ForestTemplate = dynamic(() => import('./ForestTemplate'));
const AngelsTemplate = dynamic(() => import('./AngelsTemplate'));
const TendernessTemplate = dynamic(() => import('./TendernessTemplate'));
const PowderTemplate = dynamic(() => import('./PowderTemplate'));
const StrawberryTemplate = dynamic(() => import('./StrawberryTemplate'));
const PhotoboothTemplate = dynamic(() => import('./PhotoboothTemplate'));
const TurquoiseTemplate = dynamic(() => import('./TurquoiseTemplate'));
const VelvetTemplate = dynamic(() => import('./VelvetTemplate'));
const VitrageTemplate = dynamic(() => import('./VitrageTemplate'));
const StudioTemplate = dynamic(() => import('./StudioTemplate'));

export interface ScheduleItem { time: string; title: string; icon: string; }

export interface InviteData {
  templateId: string;
  plan?: string;
  /** draft | paid | published — вместе с тарифом решает, показывать ли бренд WeddingCraft */
  status?: string;
  groomName: string;
  brideName: string;
  weddingDate: string;
  weddingTime: string;
  venue: string;
  venueAddress: string;
  story: string;
  inviteText: string;
  dressCode: string;
  dressCodeColors: string[];
  dressCodePhoto: string;
  coverPhoto: string;
  coverVideo?: string;
  galleryPhotos: string[];
  /** Фоновая мелодия (кнопка включения появляется в углу приглашения). */
  musicUrl?: string;
  mapLink: string;
  schedule: ScheduleItem[];
  slug?: string;
  enabledSections?: Record<string, boolean>;
  /* Поля, специфичные для конкретного шаблона (тексты, доп.фото, опции).
     Ключ = id поля из схемы TEMPLATE_FIELDS. Дизайн не меняют. */
  customData?: Record<string, unknown>;
}

interface Props {
  data: InviteData;
  apiBase: string;
  fullPage?: boolean;
  slug?: string;
  editing?: boolean;
}

/* Заставку страница шаблона узнаёт из адреса до своей отрисовки (lib/intro-choice.ts),
   поэтому другая заставка — это новая страница: обёртка строится заново (ключ),
   iframe грузится с новым адресом. Цвет печати меняется на лету, без перезагрузки. */
export default function TemplatePreview(props: Props) {
  const style = props.data.customData?.introStyle;
  return <Fragment key={typeof style === 'string' ? style : ''}><TemplateFrame {...props} /></Fragment>;
}

function TemplateFrame({ data, apiBase, fullPage, slug, editing }: Props) {
  // wcBrand — подпись «Создано на WeddingCraft» (assets/signature.js), wcWatermark — водяной знак (assets/brand.js); оба рисуются внутри страницы шаблона
  data = { ...data, enabledSections: planSections(data.plan, data.enabledSections), customData: { ...data.customData, plan: data.plan, wcBrand: !isBrandFree(data.plan, data.status), wcWatermark: hasWatermark(data.status) } };
  // «Программа дня» не должна оказаться пустой ни у гостей, ни в превью:
  // пустые/битые данные (старые записи в БД) подменяем дефолтами дизайна.
  if (!Array.isArray(data.schedule) || data.schedule.length === 0) {
    const defSchedule = TEMPLATE_DEFAULTS[data.templateId]?.schedule;
    if (defSchedule?.length) data = { ...data, schedule: defSchedule };
  }
  // Шаблоны, собранные в «Верстаке», обслуживает одна общая обёртка:
  // отдельный компонент на каждый новый шаблон писать не нужно.
  if (isStudioTemplate(data.templateId)) {
    return <StudioTemplate data={data} apiBase={apiBase} fullPage={fullPage} slug={slug} editing={editing} />;
  }
  if (data.templateId === 'sketch') {
    return <SketchTemplate data={data} apiBase={apiBase} fullPage={fullPage} slug={slug} editing={editing} />;
  }
  if (data.templateId === 'calla') {
    return <CallaTemplate data={data} apiBase={apiBase} fullPage={fullPage} slug={slug} editing={editing} />;
  }
  if (data.templateId === 'vitrage') {
    return <VitrageTemplate data={data} apiBase={apiBase} fullPage={fullPage} slug={slug} editing={editing} />;
  }
  if (data.templateId === 'tenderness') {
    return <TendernessTemplate data={data} apiBase={apiBase} fullPage={fullPage} slug={slug} editing={editing} />;
  }
  if (data.templateId === 'powder') {
    return <PowderTemplate data={data} apiBase={apiBase} fullPage={fullPage} slug={slug} editing={editing} />;
  }
  if (data.templateId === 'turquoise') {
    return <TurquoiseTemplate data={data} apiBase={apiBase} fullPage={fullPage} slug={slug} editing={editing} />;
  }
  if (data.templateId === 'photobooth') {
    return <PhotoboothTemplate data={data} apiBase={apiBase} fullPage={fullPage} slug={slug} editing={editing} />;
  }
  if (data.templateId === 'strawberry') {
    return <StrawberryTemplate data={data} apiBase={apiBase} fullPage={fullPage} slug={slug} editing={editing} />;
  }
  if (data.templateId === 'velvet') {
    return <VelvetTemplate data={data} apiBase={apiBase} fullPage={fullPage} slug={slug} editing={editing} />;
  }
  if (data.templateId === 'angels') {
    return <AngelsTemplate data={data} apiBase={apiBase} fullPage={fullPage} slug={slug} editing={editing} />;
  }
  if (data.templateId === 'forest') {
    return <ForestTemplate data={data} apiBase={apiBase} fullPage={fullPage} slug={slug} editing={editing} />;
  }
  if (data.templateId === 'garden-evening') {
    return <GardenEveningTemplate data={data} apiBase={apiBase} fullPage={fullPage} slug={slug} editing={editing} />;
  }
  if (data.templateId === 'ivory') {
    return <IvoryTemplate data={data} apiBase={apiBase} fullPage={fullPage} slug={slug} editing={editing} />;
  }
  if (data.templateId === 'floral') {
    return <FloralTemplate data={data} apiBase={apiBase} fullPage={fullPage} slug={slug} editing={editing} />;
  }
  if (data.templateId === 'garden-arch') {
    return <GardenArchTemplate data={data} apiBase={apiBase} fullPage={fullPage} slug={slug} editing={editing} />;
  }
  if (data.templateId === 'mediterranean') {
    return <MediterraneanTemplate data={data} apiBase={apiBase} fullPage={fullPage} slug={slug} editing={editing} />;
  }
  if (data.templateId === 'vadimdarya') {
    return <VadimDaryaTemplate data={data} apiBase={apiBase} fullPage={fullPage} slug={slug} editing={editing} />;
  }
  return (
    <SimpleTemplate data={data} apiBase={apiBase} />
  );
}
