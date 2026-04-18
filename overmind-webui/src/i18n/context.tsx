import { createContext, useContext, createSignal, createEffect, type JSX } from 'solid-js';
import { detectLocale, saveLocale, getTranslations, type Locale, type Translations } from './index';

const I18nContext = createContext<{
  locale: () => Locale;
  t: () => Translations;
  setLocale: (locale: Locale) => void;
}>();

export function I18nProvider(props: { children: JSX.Element }) {
  const [locale, setLocaleSignal] = createSignal<Locale>(detectLocale());
  const [t, setT] = createSignal<Translations>(getTranslations(locale()));

  createEffect(() => {
    const currentLocale = locale();
    saveLocale(currentLocale);
    setT(getTranslations(currentLocale));
  });

  const setLocale = (newLocale: Locale) => {
    setLocaleSignal(newLocale);
  };

  return (
    <I18nContext.Provider value={{ locale, t, setLocale }}>
      {props.children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) throw new Error('useI18n must be used within an I18nProvider');
  return context;
}
