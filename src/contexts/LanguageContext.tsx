import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { de } from "@/translations/de";
import { en } from "@/translations/en";
import { fr } from "@/translations/fr";
import { pt } from "@/translations/pt";

export type Language = "de" | "en" | "fr" | "pt";

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const translations: Record<Language, Record<string, string>> = { de, en, fr, pt };

interface LanguageProviderProps {
  children: ReactNode;
}

export function LanguageProvider({ children }: LanguageProviderProps) {
  const [language, setLanguageState] = useState<Language>(() => {
    try {
      const saved = localStorage.getItem("app_language");
      if (saved && ["de", "en", "fr", "pt"].includes(saved)) {
        return saved as Language;
      }
    } catch {
      // ignore
    }
    return "de";
  });

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    try {
      localStorage.setItem("app_language", lang);
    } catch {
      // ignore
    }
    document.documentElement.lang = lang;
  };

  useEffect(() => {
    document.documentElement.lang = language;
  }, []);

  const t = (key: string): string => {
    return translations[language][key] || translations.de[key] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
}
