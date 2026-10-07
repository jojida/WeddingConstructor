'use client';
import { planSections, isBrandFree } from '@/lib/plans';
import { TEMPLATE_DEFAULTS } from '@/lib/constants';
import dynamic from 'next/dynamic';
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

export default function TemplatePreview({ data, apiBase, fullPage, slug, editing }: Props) {
  // wcBrand — подпись «Создано на WeddingCraft» и водяной знак; их рисуют assets/signature.js и assets/brand.js внутри страницы шаблона
  data = { ...data, enabledSections: planSections(data.plan, data.enabledSections), customData: { ...data.customData, plan: data.plan, wcBrand: !isBrandFree(data.plan, data.status) } };
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
