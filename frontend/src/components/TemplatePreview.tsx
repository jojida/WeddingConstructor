'use client';
import { TEMPLATE_DEFAULTS } from '@/lib/constants';
import SimpleTemplate from './SimpleTemplate';
import VadimDaryaTemplate from './VadimDaryaTemplate';
import MediterraneanTemplate from './MediterraneanTemplate';
import FloralTemplate from './FloralTemplate';
import GardenArchTemplate from './GardenArchTemplate';
import SketchTemplate from './SketchTemplate';
import CallaTemplate from './CallaTemplate';

export interface ScheduleItem { time: string; title: string; icon: string; }

export interface InviteData {
  templateId: string;
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
  // «Программа дня» не должна оказаться пустой ни у гостей, ни в превью:
  // пустые/битые данные (старые записи в БД) подменяем дефолтами дизайна.
  if (!Array.isArray(data.schedule) || data.schedule.length === 0) {
    const defSchedule = TEMPLATE_DEFAULTS[data.templateId]?.schedule;
    if (defSchedule?.length) data = { ...data, schedule: defSchedule };
  }
  if (data.templateId === 'sketch') {
    return <SketchTemplate data={data} apiBase={apiBase} fullPage={fullPage} slug={slug} editing={editing} />;
  }
  if (data.templateId === 'calla') {
    return <CallaTemplate data={data} apiBase={apiBase} fullPage={fullPage} slug={slug} editing={editing} />;
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
    return <VadimDaryaTemplate data={data} apiBase={apiBase} fullPage={fullPage} slug={slug} />;
  }
  return (
    <SimpleTemplate data={data} apiBase={apiBase} />
  );
}
