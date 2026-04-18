export type Locale = 'en' | 'zh';

export interface Translations {
  nav: Record<string, string>;
  status: Record<string, string>;
  actions: Record<string, string>;
  theme: Record<string, string>;
  connect: Record<string, string>;
  dashboard: Record<string, string>;
  sessions: Record<string, string>;
  sessionDetail: Record<string, string>;
  roles: Record<string, string>;
  skills: Record<string, string>;
  providers: Record<string, string>;
  workspaces: Record<string, string>;
  instances: Record<string, string>;
  settings: Record<string, string>;
  common: Record<string, string>;
}

import en from './en';
import zh from './zh';

const all: Record<Locale, Translations> = { en, zh };

export function getTranslations(locale: Locale): Translations {
  return all[locale] ?? all.en;
}

export function detectLocale(): Locale {
  const saved = localStorage.getItem('locale') as Locale | null;
  if (saved && all[saved]) return saved;
  const nav = navigator.language.slice(0, 2);
  return all[nav as Locale] ? (nav as Locale) : 'en';
}

export function saveLocale(locale: Locale): void {
  localStorage.setItem('locale', locale);
}
