import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";

export type Language = "de" | "en" | "fr" | "pt";

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

// Translation files
const translations: Record<Language, Record<string, string>> = {
  de: {
    // Navigation
    "nav.dashboard": "Dashboard",
    "nav.finances": "Finanzen",
    "nav.overview": "Übersicht",
    "nav.opex": "OPEX",
    "nav.receiptScanner": "Belege scannen",
    "nav.invoices": "Rechnungen",
    "nav.declarations": "Deklarationen",
    "nav.budget": "Budget",
    "nav.reports": "Berichte",
    "nav.documents": "Dokumente",
    "nav.explorer": "Explorer",
    "nav.signatures": "Signaturen",
    "nav.protocols": "Protokolle",
    "nav.collaboration": "Zusammenarbeit",
    "nav.communication": "Kommunikation",
    "nav.calendar": "Kalender",
    "nav.tasks": "Aufgaben",
    "nav.hr": "HR",
    "nav.employees": "Mitarbeiter",
    "nav.vacations": "Ferienmanagement",
    "nav.payroll": "Lohnbuchhaltung",
    "nav.socialInsurance": "Sozialversicherungen",
    "nav.partners": "Partner",
    "nav.authorities": "Behörden",
    "nav.users": "Benutzer",
    "nav.security": "Sicherheit",
    "nav.settings": "Einstellungen",
    "nav.signOut": "Abmelden",
    
    // Settings page
    "settings.title": "Einstellungen",
    "settings.subtitle": "Profil und Präferenzen verwalten",
    "settings.profile": "Profil",
    "settings.signature": "Signatur",
    "settings.letterhead": "Briefkopf",
    "settings.rates": "Rates",
    "settings.notifications": "Benachrichtigungen",
    "settings.appearance": "Darstellung",
    "settings.language": "Sprache",
    
    // Profile tab
    "settings.profile.title": "Profil bearbeiten",
    "settings.profile.description": "Aktualisieren Sie Ihre persönlichen Informationen",
    "settings.profile.changePhoto": "Foto ändern",
    "settings.profile.uploading": "Hochladen...",
    "settings.profile.photoHint": "JPG, GIF oder PNG. Max 1MB.",
    "settings.profile.firstName": "Vorname",
    "settings.profile.lastName": "Nachname",
    "settings.profile.email": "E-Mail",
    "settings.profile.phone": "Telefon",
    "settings.profile.position": "Position",
    "settings.profile.department": "Abteilung",
    "settings.profile.save": "Speichern",
    "settings.profile.saving": "Speichern...",
    
    // Notifications tab
    "settings.notifications.title": "Benachrichtigungseinstellungen",
    "settings.notifications.description": "Wählen Sie, welche Benachrichtigungen Sie erhalten möchten",
    "settings.notifications.loading": "Laden...",
    "settings.notifications.channels": "Kanäle",
    "settings.notifications.email": "E-Mail-Benachrichtigungen",
    "settings.notifications.emailDesc": "Benachrichtigungen per E-Mail erhalten",
    "settings.notifications.push": "Push-Benachrichtigungen",
    "settings.notifications.pushDesc": "Browser-Benachrichtigungen erhalten",
    "settings.notifications.categories": "Kategorien",
    "settings.notifications.tasks": "Aufgaben",
    "settings.notifications.documents": "Dokumente",
    "settings.notifications.expenses": "Ausgaben & OPEX",
    "settings.notifications.calendar": "Kalender",
    "settings.notifications.approvals": "Genehmigungen",
    "settings.notifications.budget": "Budget",
    
    // Appearance tab
    "settings.appearance.title": "Darstellung",
    "settings.appearance.description": "Passen Sie das Aussehen der Anwendung an",
    "settings.appearance.colorScheme": "Farbschema",
    "settings.appearance.light": "Hell",
    "settings.appearance.dark": "Dunkel",
    "settings.appearance.system": "System",
    "settings.appearance.accentColor": "Akzentfarbe",
    
    // Language tab
    "settings.language.title": "Sprache & Region",
    "settings.language.description": "Sprache und regionale Einstellungen anpassen",
    "settings.language.language": "Sprache",
    "settings.language.timezone": "Zeitzone",
    "settings.language.dateFormat": "Datumsformat",
    
    // Common
    "common.save": "Speichern",
    "common.cancel": "Abbrechen",
    "common.delete": "Löschen",
    "common.edit": "Bearbeiten",
    "common.create": "Erstellen",
    "common.search": "Suchen",
    "common.filter": "Filtern",
    "common.loading": "Laden...",
    "common.error": "Fehler",
    "common.success": "Erfolg",
  },
  en: {
    // Navigation
    "nav.dashboard": "Dashboard",
    "nav.finances": "Finances",
    "nav.overview": "Overview",
    "nav.opex": "OPEX",
    "nav.receiptScanner": "Receipt Scanner",
    "nav.invoices": "Invoices",
    "nav.declarations": "Declarations",
    "nav.budget": "Budget",
    "nav.reports": "Reports",
    "nav.documents": "Documents",
    "nav.explorer": "Explorer",
    "nav.signatures": "Signatures",
    "nav.protocols": "Protocols",
    "nav.collaboration": "Collaboration",
    "nav.communication": "Communication",
    "nav.calendar": "Calendar",
    "nav.tasks": "Tasks",
    "nav.hr": "HR",
    "nav.employees": "Employees",
    "nav.vacations": "Vacation Management",
    "nav.payroll": "Payroll",
    "nav.socialInsurance": "Social Insurance",
    "nav.partners": "Partners",
    "nav.authorities": "Authorities",
    "nav.users": "Users",
    "nav.security": "Security",
    "nav.settings": "Settings",
    "nav.signOut": "Sign Out",
    
    // Settings page
    "settings.title": "Settings",
    "settings.subtitle": "Manage profile and preferences",
    "settings.profile": "Profile",
    "settings.signature": "Signature",
    "settings.letterhead": "Letterhead",
    "settings.rates": "Rates",
    "settings.notifications": "Notifications",
    "settings.appearance": "Appearance",
    "settings.language": "Language",
    
    // Profile tab
    "settings.profile.title": "Edit Profile",
    "settings.profile.description": "Update your personal information",
    "settings.profile.changePhoto": "Change Photo",
    "settings.profile.uploading": "Uploading...",
    "settings.profile.photoHint": "JPG, GIF or PNG. Max 1MB.",
    "settings.profile.firstName": "First Name",
    "settings.profile.lastName": "Last Name",
    "settings.profile.email": "Email",
    "settings.profile.phone": "Phone",
    "settings.profile.position": "Position",
    "settings.profile.department": "Department",
    "settings.profile.save": "Save",
    "settings.profile.saving": "Saving...",
    
    // Notifications tab
    "settings.notifications.title": "Notification Settings",
    "settings.notifications.description": "Choose which notifications you want to receive",
    "settings.notifications.loading": "Loading...",
    "settings.notifications.channels": "Channels",
    "settings.notifications.email": "Email Notifications",
    "settings.notifications.emailDesc": "Receive notifications via email",
    "settings.notifications.push": "Push Notifications",
    "settings.notifications.pushDesc": "Receive browser notifications",
    "settings.notifications.categories": "Categories",
    "settings.notifications.tasks": "Tasks",
    "settings.notifications.documents": "Documents",
    "settings.notifications.expenses": "Expenses & OPEX",
    "settings.notifications.calendar": "Calendar",
    "settings.notifications.approvals": "Approvals",
    "settings.notifications.budget": "Budget",
    
    // Appearance tab
    "settings.appearance.title": "Appearance",
    "settings.appearance.description": "Customize the look of the application",
    "settings.appearance.colorScheme": "Color Scheme",
    "settings.appearance.light": "Light",
    "settings.appearance.dark": "Dark",
    "settings.appearance.system": "System",
    "settings.appearance.accentColor": "Accent Color",
    
    // Language tab
    "settings.language.title": "Language & Region",
    "settings.language.description": "Customize language and regional settings",
    "settings.language.language": "Language",
    "settings.language.timezone": "Timezone",
    "settings.language.dateFormat": "Date Format",
    
    // Common
    "common.save": "Save",
    "common.cancel": "Cancel",
    "common.delete": "Delete",
    "common.edit": "Edit",
    "common.create": "Create",
    "common.search": "Search",
    "common.filter": "Filter",
    "common.loading": "Loading...",
    "common.error": "Error",
    "common.success": "Success",
  },
  fr: {
    // Navigation
    "nav.dashboard": "Tableau de bord",
    "nav.finances": "Finances",
    "nav.overview": "Aperçu",
    "nav.opex": "OPEX",
    "nav.receiptScanner": "Scanner de reçus",
    "nav.invoices": "Factures",
    "nav.declarations": "Déclarations",
    "nav.budget": "Budget",
    "nav.reports": "Rapports",
    "nav.documents": "Documents",
    "nav.explorer": "Explorateur",
    "nav.signatures": "Signatures",
    "nav.protocols": "Protocoles",
    "nav.collaboration": "Collaboration",
    "nav.communication": "Communication",
    "nav.calendar": "Calendrier",
    "nav.tasks": "Tâches",
    "nav.hr": "RH",
    "nav.employees": "Employés",
    "nav.vacations": "Gestion des congés",
    "nav.payroll": "Paie",
    "nav.socialInsurance": "Assurances sociales",
    "nav.partners": "Partenaires",
    "nav.authorities": "Autorités",
    "nav.users": "Utilisateurs",
    "nav.security": "Sécurité",
    "nav.settings": "Paramètres",
    "nav.signOut": "Déconnexion",
    
    // Settings page
    "settings.title": "Paramètres",
    "settings.subtitle": "Gérer le profil et les préférences",
    "settings.profile": "Profil",
    "settings.signature": "Signature",
    "settings.letterhead": "En-tête",
    "settings.rates": "Tarifs",
    "settings.notifications": "Notifications",
    "settings.appearance": "Apparence",
    "settings.language": "Langue",
    
    // Profile tab
    "settings.profile.title": "Modifier le profil",
    "settings.profile.description": "Mettez à jour vos informations personnelles",
    "settings.profile.changePhoto": "Changer la photo",
    "settings.profile.uploading": "Téléchargement...",
    "settings.profile.photoHint": "JPG, GIF ou PNG. Max 1Mo.",
    "settings.profile.firstName": "Prénom",
    "settings.profile.lastName": "Nom",
    "settings.profile.email": "E-mail",
    "settings.profile.phone": "Téléphone",
    "settings.profile.position": "Poste",
    "settings.profile.department": "Département",
    "settings.profile.save": "Enregistrer",
    "settings.profile.saving": "Enregistrement...",
    
    // Notifications tab
    "settings.notifications.title": "Paramètres de notification",
    "settings.notifications.description": "Choisissez les notifications que vous souhaitez recevoir",
    "settings.notifications.loading": "Chargement...",
    "settings.notifications.channels": "Canaux",
    "settings.notifications.email": "Notifications par e-mail",
    "settings.notifications.emailDesc": "Recevoir des notifications par e-mail",
    "settings.notifications.push": "Notifications push",
    "settings.notifications.pushDesc": "Recevoir des notifications du navigateur",
    "settings.notifications.categories": "Catégories",
    "settings.notifications.tasks": "Tâches",
    "settings.notifications.documents": "Documents",
    "settings.notifications.expenses": "Dépenses & OPEX",
    "settings.notifications.calendar": "Calendrier",
    "settings.notifications.approvals": "Approbations",
    "settings.notifications.budget": "Budget",
    
    // Appearance tab
    "settings.appearance.title": "Apparence",
    "settings.appearance.description": "Personnalisez l'apparence de l'application",
    "settings.appearance.colorScheme": "Schéma de couleurs",
    "settings.appearance.light": "Clair",
    "settings.appearance.dark": "Sombre",
    "settings.appearance.system": "Système",
    "settings.appearance.accentColor": "Couleur d'accent",
    
    // Language tab
    "settings.language.title": "Langue & Région",
    "settings.language.description": "Personnalisez les paramètres de langue et de région",
    "settings.language.language": "Langue",
    "settings.language.timezone": "Fuseau horaire",
    "settings.language.dateFormat": "Format de date",
    
    // Common
    "common.save": "Enregistrer",
    "common.cancel": "Annuler",
    "common.delete": "Supprimer",
    "common.edit": "Modifier",
    "common.create": "Créer",
    "common.search": "Rechercher",
    "common.filter": "Filtrer",
    "common.loading": "Chargement...",
    "common.error": "Erreur",
    "common.success": "Succès",
  },
  pt: {
    // Navigation
    "nav.dashboard": "Painel",
    "nav.finances": "Finanças",
    "nav.overview": "Visão geral",
    "nav.opex": "OPEX",
    "nav.receiptScanner": "Scanner de recibos",
    "nav.invoices": "Faturas",
    "nav.declarations": "Declarações",
    "nav.budget": "Orçamento",
    "nav.reports": "Relatórios",
    "nav.documents": "Documentos",
    "nav.explorer": "Explorador",
    "nav.signatures": "Assinaturas",
    "nav.protocols": "Protocolos",
    "nav.collaboration": "Colaboração",
    "nav.communication": "Comunicação",
    "nav.calendar": "Calendário",
    "nav.tasks": "Tarefas",
    "nav.hr": "RH",
    "nav.employees": "Funcionários",
    "nav.vacations": "Gestão de férias",
    "nav.payroll": "Folha de pagamento",
    "nav.socialInsurance": "Segurança social",
    "nav.partners": "Parceiros",
    "nav.authorities": "Autoridades",
    "nav.users": "Utilizadores",
    "nav.security": "Segurança",
    "nav.settings": "Configurações",
    "nav.signOut": "Terminar sessão",
    
    // Settings page
    "settings.title": "Configurações",
    "settings.subtitle": "Gerir perfil e preferências",
    "settings.profile": "Perfil",
    "settings.signature": "Assinatura",
    "settings.letterhead": "Papel timbrado",
    "settings.rates": "Tarifas",
    "settings.notifications": "Notificações",
    "settings.appearance": "Aparência",
    "settings.language": "Idioma",
    
    // Profile tab
    "settings.profile.title": "Editar perfil",
    "settings.profile.description": "Atualize as suas informações pessoais",
    "settings.profile.changePhoto": "Alterar foto",
    "settings.profile.uploading": "A carregar...",
    "settings.profile.photoHint": "JPG, GIF ou PNG. Máx 1MB.",
    "settings.profile.firstName": "Primeiro nome",
    "settings.profile.lastName": "Apelido",
    "settings.profile.email": "E-mail",
    "settings.profile.phone": "Telefone",
    "settings.profile.position": "Cargo",
    "settings.profile.department": "Departamento",
    "settings.profile.save": "Guardar",
    "settings.profile.saving": "A guardar...",
    
    // Notifications tab
    "settings.notifications.title": "Definições de notificação",
    "settings.notifications.description": "Escolha quais notificações pretende receber",
    "settings.notifications.loading": "A carregar...",
    "settings.notifications.channels": "Canais",
    "settings.notifications.email": "Notificações por e-mail",
    "settings.notifications.emailDesc": "Receber notificações por e-mail",
    "settings.notifications.push": "Notificações push",
    "settings.notifications.pushDesc": "Receber notificações do navegador",
    "settings.notifications.categories": "Categorias",
    "settings.notifications.tasks": "Tarefas",
    "settings.notifications.documents": "Documentos",
    "settings.notifications.expenses": "Despesas & OPEX",
    "settings.notifications.calendar": "Calendário",
    "settings.notifications.approvals": "Aprovações",
    "settings.notifications.budget": "Orçamento",
    
    // Appearance tab
    "settings.appearance.title": "Aparência",
    "settings.appearance.description": "Personalize a aparência da aplicação",
    "settings.appearance.colorScheme": "Esquema de cores",
    "settings.appearance.light": "Claro",
    "settings.appearance.dark": "Escuro",
    "settings.appearance.system": "Sistema",
    "settings.appearance.accentColor": "Cor de destaque",
    
    // Language tab
    "settings.language.title": "Idioma & Região",
    "settings.language.description": "Personalize as definições de idioma e região",
    "settings.language.language": "Idioma",
    "settings.language.timezone": "Fuso horário",
    "settings.language.dateFormat": "Formato de data",
    
    // Common
    "common.save": "Guardar",
    "common.cancel": "Cancelar",
    "common.delete": "Eliminar",
    "common.edit": "Editar",
    "common.create": "Criar",
    "common.search": "Pesquisar",
    "common.filter": "Filtrar",
    "common.loading": "A carregar...",
    "common.error": "Erro",
    "common.success": "Sucesso",
  },
};

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
