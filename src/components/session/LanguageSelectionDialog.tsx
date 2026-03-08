import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useLanguage, Language } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { Globe, Check } from "lucide-react";

const LANGUAGES: { code: Language; name: string; flag: string }[] = [
  { code: "de", name: "Deutsch", flag: "🇩🇪" },
  { code: "en", name: "English", flag: "🇬🇧" },
  { code: "fr", name: "Français", flag: "🇫🇷" },
  { code: "pt", name: "Português", flag: "🇵🇹" },
];

export function LanguageSelectionDialog() {
  const { user } = useAuth();
  const { language, setLanguage } = useLanguage();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Language>(language);

  useEffect(() => {
    if (!user) return;
    
    const KEY = "mgi-language-selected";
    const hasSelected = localStorage.getItem(KEY);
    
    if (!hasSelected) {
      setOpen(true);
    }
  }, [user]);

  const handleConfirm = () => {
    setLanguage(selected);
    localStorage.setItem("mgi-language-selected", "true");
    setOpen(false);
  };

  if (!user) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleConfirm(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Sprache wählen / Select Language
          </DialogTitle>
          <DialogDescription>
            Wählen Sie Ihre bevorzugte Sprache. Sie können diese jederzeit in den Einstellungen ändern.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3 py-4">
          {LANGUAGES.map((lang) => (
            <button
              key={lang.code}
              onClick={() => setSelected(lang.code)}
              className={`flex items-center gap-3 p-4 rounded-lg border-2 transition-all text-left ${
                selected === lang.code
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-muted-foreground/30"
              }`}
            >
              <span className="text-2xl">{lang.flag}</span>
              <div className="flex-1">
                <p className="font-medium text-sm">{lang.name}</p>
              </div>
              {selected === lang.code && (
                <Check className="h-4 w-4 text-primary flex-shrink-0" />
              )}
            </button>
          ))}
        </div>

        <Button onClick={handleConfirm} className="w-full">
          {selected === "de" ? "Bestätigen" : selected === "fr" ? "Confirmer" : selected === "pt" ? "Confirmar" : "Confirm"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
