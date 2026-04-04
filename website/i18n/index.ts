import en from "./en.json";
import he from "./he.json";
import ar from "./ar.json";

export type Lang = "en" | "ar" | "he";
export const SUPPORTED_LANGS: Lang[] = ["en", "ar", "he"];
export type TranslationKey = keyof typeof en;

const translations: Record<Lang, Record<string, string>> = { en, he, ar };

export function t(lang: Lang, key: string): string {
  return translations[lang]?.[key] ?? translations.en[key] ?? key;
}
