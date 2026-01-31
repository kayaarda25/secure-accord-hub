import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Save, FileText, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

interface LetterheadData {
  id?: string;
  company_name: string;
  subtitle: string;
  address: string;
  logo_url: string;
  primary_color: string;
  show_logo: boolean;
  footer_text: string;
}

const defaultSettings: LetterheadData = {
  company_name: "MGI × AFRIKA",
  subtitle: "Government Cooperation Platform",
  address: "Zürich, Switzerland",
  logo_url: "",
  primary_color: "#c97c5d",
  show_logo: false,
  footer_text: "Confidential",
};

export function LetterheadSettings() {
  const [settings, setSettings] = useState<LetterheadData>(defaultSettings);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (user) {
      fetchSettings();
    }
  }, [user]);

  const fetchSettings = async () => {
    if (!user) return;

    setIsLoading(true);
    const { data, error } = await supabase
      .from("letterhead_settings")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (data) {
      setSettings({
        id: data.id,
        company_name: data.company_name,
        subtitle: data.subtitle || "",
        address: data.address || "",
        logo_url: data.logo_url || "",
        primary_color: data.primary_color || "#c97c5d",
        show_logo: data.show_logo || false,
        footer_text: data.footer_text || "Confidential",
      });
    } else if (!error || error.code === "PGRST116") {
      // No settings yet, use defaults
      setSettings(defaultSettings);
    }

    setIsLoading(false);
  };

  const handleSave = async () => {
    if (!user) return;

    setIsSaving(true);

    const payload = {
      user_id: user.id,
      company_name: settings.company_name,
      subtitle: settings.subtitle,
      address: settings.address,
      logo_url: settings.logo_url,
      primary_color: settings.primary_color,
      show_logo: settings.show_logo,
      footer_text: settings.footer_text,
    };

    let error;
    if (settings.id) {
      const result = await supabase
        .from("letterhead_settings")
        .update(payload)
        .eq("id", settings.id);
      error = result.error;
    } else {
      const result = await supabase
        .from("letterhead_settings")
        .insert(payload)
        .select()
        .single();
      error = result.error;
      if (result.data) {
        setSettings({ ...settings, id: result.data.id });
      }
    }

    if (error) {
      toast({
        title: "Fehler",
        description: "Einstellungen konnten nicht gespeichert werden",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Gespeichert",
        description: "Briefkopf-Einstellungen wurden aktualisiert",
      });
    }

    setIsSaving(false);
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    const fileExt = file.name.split(".").pop();
    const fileName = `${user.id}/letterhead-logo.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from("documents")
      .upload(fileName, file, { upsert: true });

    if (uploadError) {
      toast({
        title: "Fehler",
        description: "Logo konnte nicht hochgeladen werden",
        variant: "destructive",
      });
      return;
    }

    const { data: urlData } = supabase.storage
      .from("documents")
      .getPublicUrl(fileName);

    setSettings({ ...settings, logo_url: urlData.publicUrl, show_logo: true });
    toast({
      title: "Hochgeladen",
      description: "Logo wurde erfolgreich hochgeladen",
    });
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Laden...
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Briefkopf-Einstellungen
        </CardTitle>
        <CardDescription>
          Konfigurieren Sie den Briefkopf für generierte Dokumente (Word/PDF)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Preview */}
        <div className="border rounded-lg p-4 bg-muted/30">
          <p className="text-xs text-muted-foreground mb-2">Vorschau</p>
          <div className="bg-background border rounded p-4 text-right">
            {settings.show_logo && settings.logo_url && (
              <img 
                src={settings.logo_url} 
                alt="Logo" 
                className="h-10 ml-auto mb-2 object-contain"
              />
            )}
            <p 
              className="font-bold text-lg" 
              style={{ color: settings.primary_color }}
            >
              {settings.company_name}
            </p>
            <p className="text-sm text-muted-foreground italic">
              {settings.subtitle}
            </p>
            <p className="text-xs text-muted-foreground border-b pb-2" style={{ borderColor: settings.primary_color }}>
              {settings.address}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="company_name">Firmenname</Label>
            <Input
              id="company_name"
              value={settings.company_name}
              onChange={(e) => setSettings({ ...settings, company_name: e.target.value })}
              placeholder="MGI × AFRIKA"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="subtitle">Untertitel</Label>
            <Input
              id="subtitle"
              value={settings.subtitle}
              onChange={(e) => setSettings({ ...settings, subtitle: e.target.value })}
              placeholder="Government Cooperation Platform"
            />
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="address">Adresse</Label>
            <Textarea
              id="address"
              value={settings.address}
              onChange={(e) => setSettings({ ...settings, address: e.target.value })}
              placeholder="Zürich, Switzerland"
              className="min-h-[60px]"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="footer_text">Fußzeilen-Text</Label>
            <Input
              id="footer_text"
              value={settings.footer_text}
              onChange={(e) => setSettings({ ...settings, footer_text: e.target.value })}
              placeholder="Confidential"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="primary_color">Primärfarbe</Label>
            <div className="flex gap-2">
              <Input
                id="primary_color"
                type="color"
                value={settings.primary_color}
                onChange={(e) => setSettings({ ...settings, primary_color: e.target.value })}
                className="w-14 h-10 p-1 cursor-pointer"
              />
              <Input
                value={settings.primary_color}
                onChange={(e) => setSettings({ ...settings, primary_color: e.target.value })}
                placeholder="#c97c5d"
                className="flex-1"
              />
            </div>
          </div>
        </div>

        <div className="border-t pt-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>Logo anzeigen</Label>
              <p className="text-sm text-muted-foreground">
                Logo im Briefkopf anzeigen
              </p>
            </div>
            <Switch
              checked={settings.show_logo}
              onCheckedChange={(v) => setSettings({ ...settings, show_logo: v })}
            />
          </div>

          {settings.show_logo && (
            <div className="space-y-2">
              <Label>Logo hochladen</Label>
              <div className="flex items-center gap-4">
                {settings.logo_url && (
                  <img 
                    src={settings.logo_url} 
                    alt="Logo Preview" 
                    className="h-12 object-contain border rounded p-1"
                  />
                )}
                <label className="cursor-pointer">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleLogoUpload}
                    className="hidden"
                  />
                  <Button variant="outline" size="sm" asChild>
                    <span>
                      <Upload className="h-4 w-4 mr-2" />
                      Logo auswählen
                    </span>
                  </Button>
                </label>
              </div>
              <p className="text-xs text-muted-foreground">
                JPG, PNG oder SVG. Empfohlen: 200x60 Pixel
              </p>
            </div>
          )}
        </div>

        <Button onClick={handleSave} disabled={isSaving}>
          <Save className="h-4 w-4 mr-2" />
          {isSaving ? "Speichern..." : "Einstellungen speichern"}
        </Button>
      </CardContent>
    </Card>
  );
}
