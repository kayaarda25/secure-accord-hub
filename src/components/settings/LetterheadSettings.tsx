import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Save, FileText, Upload, Plus, Trash2, Copy, Star } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

interface LetterheadData {
  id?: string;
  preset_name: string;
  is_default: boolean;
  company_name: string;
  subtitle: string;
  address: string;
  logo_url: string;
  primary_color: string;
  show_logo: boolean;
  footer_text: string;
}

const defaultSettings: LetterheadData = {
  preset_name: "Standard",
  is_default: true,
  company_name: "MGI × AFRIKA",
  subtitle: "Government Cooperation Platform",
  address: "Zürich, Switzerland",
  logo_url: "",
  primary_color: "#c97c5d",
  show_logo: false,
  footer_text: "Confidential",
};

export function LetterheadSettings() {
  const [presets, setPresets] = useState<LetterheadData[]>([]);
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null);
  const [settings, setSettings] = useState<LetterheadData>(defaultSettings);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [newPresetName, setNewPresetName] = useState("");
  const [deletePresetId, setDeletePresetId] = useState<string | null>(null);
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (user) {
      fetchPresets();
    }
  }, [user]);

  const fetchPresets = async () => {
    if (!user) return;

    setIsLoading(true);
    const { data, error } = await supabase
      .from("letterhead_settings")
      .select("*")
      .eq("user_id", user.id)
      .order("preset_name");

    if (data && data.length > 0) {
      const mappedPresets = data.map((p) => ({
        id: p.id,
        preset_name: p.preset_name || "Standard",
        is_default: p.is_default || false,
        company_name: p.company_name,
        subtitle: p.subtitle || "",
        address: p.address || "",
        logo_url: p.logo_url || "",
        primary_color: p.primary_color || "#c97c5d",
        show_logo: p.show_logo || false,
        footer_text: p.footer_text || "Confidential",
      }));
      setPresets(mappedPresets);
      
      // Select default preset or first one
      const defaultPreset = mappedPresets.find(p => p.is_default) || mappedPresets[0];
      setSelectedPresetId(defaultPreset.id || null);
      setSettings(defaultPreset);
    } else {
      setPresets([]);
      setSettings(defaultSettings);
    }

    setIsLoading(false);
  };

  const handlePresetChange = (presetId: string) => {
    const preset = presets.find(p => p.id === presetId);
    if (preset) {
      setSelectedPresetId(presetId);
      setSettings(preset);
    }
  };

  const handleSave = async () => {
    if (!user) return;

    setIsSaving(true);

    const payload = {
      user_id: user.id,
      preset_name: settings.preset_name,
      is_default: settings.is_default,
      company_name: settings.company_name,
      subtitle: settings.subtitle,
      address: settings.address,
      logo_url: settings.logo_url,
      primary_color: settings.primary_color,
      show_logo: settings.show_logo,
      footer_text: settings.footer_text,
    };

    let error;
    
    // If setting as default, unset other defaults first
    if (settings.is_default) {
      await supabase
        .from("letterhead_settings")
        .update({ is_default: false })
        .eq("user_id", user.id)
        .neq("id", settings.id || "");
    }

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
        setSelectedPresetId(result.data.id);
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
        description: "Briefkopf-Preset wurde aktualisiert",
      });
      fetchPresets();
    }

    setIsSaving(false);
  };

  const handleCreatePreset = async () => {
    if (!user || !newPresetName.trim()) return;

    const payload = {
      user_id: user.id,
      preset_name: newPresetName.trim(),
      is_default: presets.length === 0,
      company_name: defaultSettings.company_name,
      subtitle: defaultSettings.subtitle,
      address: defaultSettings.address,
      logo_url: "",
      primary_color: defaultSettings.primary_color,
      show_logo: false,
      footer_text: defaultSettings.footer_text,
    };

    const { data, error } = await supabase
      .from("letterhead_settings")
      .insert(payload)
      .select()
      .single();

    if (error) {
      toast({
        title: "Fehler",
        description: error.code === "23505" 
          ? "Ein Preset mit diesem Namen existiert bereits" 
          : "Preset konnte nicht erstellt werden",
        variant: "destructive",
      });
    } else if (data) {
      toast({
        title: "Erstellt",
        description: `Preset "${newPresetName}" wurde erstellt`,
      });
      setNewPresetName("");
      setShowNewDialog(false);
      await fetchPresets();
      setSelectedPresetId(data.id);
      setSettings({
        ...payload,
        id: data.id,
      });
    }
  };

  const handleDuplicatePreset = async () => {
    if (!user || !settings.id) return;

    const newName = `${settings.preset_name} (Kopie)`;
    const payload = {
      user_id: user.id,
      preset_name: newName,
      is_default: false,
      company_name: settings.company_name,
      subtitle: settings.subtitle,
      address: settings.address,
      logo_url: settings.logo_url,
      primary_color: settings.primary_color,
      show_logo: settings.show_logo,
      footer_text: settings.footer_text,
    };

    const { data, error } = await supabase
      .from("letterhead_settings")
      .insert(payload)
      .select()
      .single();

    if (error) {
      toast({
        title: "Fehler",
        description: "Preset konnte nicht dupliziert werden",
        variant: "destructive",
      });
    } else if (data) {
      toast({
        title: "Dupliziert",
        description: `Preset "${newName}" wurde erstellt`,
      });
      await fetchPresets();
      setSelectedPresetId(data.id);
      setSettings({ ...payload, id: data.id });
    }
  };

  const handleDeletePreset = async () => {
    if (!deletePresetId) return;

    const { error } = await supabase
      .from("letterhead_settings")
      .delete()
      .eq("id", deletePresetId);

    if (error) {
      toast({
        title: "Fehler",
        description: "Preset konnte nicht gelöscht werden",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Gelöscht",
        description: "Preset wurde entfernt",
      });
      setDeletePresetId(null);
      await fetchPresets();
    }
  };

  const handleSetDefault = async () => {
    if (!user || !settings.id) return;

    // Unset all defaults first
    await supabase
      .from("letterhead_settings")
      .update({ is_default: false })
      .eq("user_id", user.id);

    // Set this one as default
    const { error } = await supabase
      .from("letterhead_settings")
      .update({ is_default: true })
      .eq("id", settings.id);

    if (!error) {
      setSettings({ ...settings, is_default: true });
      toast({
        title: "Standard gesetzt",
        description: `"${settings.preset_name}" ist jetzt das Standard-Preset`,
      });
      fetchPresets();
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    const fileExt = file.name.split(".").pop();
    const fileName = `${user.id}/letterhead-logo-${Date.now()}.${fileExt}`;

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
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Briefkopf-Einstellungen
          </CardTitle>
          <CardDescription>
            Verwalten Sie mehrere Briefkopf-Presets für Ihre Dokumente
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Preset Selection */}
          <div className="flex items-end gap-2">
            <div className="flex-1 space-y-2">
              <Label>Preset auswählen</Label>
              <Select 
                value={selectedPresetId || ""} 
                onValueChange={handlePresetChange}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Preset wählen..." />
                </SelectTrigger>
                <SelectContent>
                  {presets.map((preset) => (
                    <SelectItem key={preset.id} value={preset.id || ""}>
                      <span className="flex items-center gap-2">
                        {preset.preset_name}
                        {preset.is_default && (
                          <Star className="h-3 w-3 fill-primary text-primary" />
                        )}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button variant="outline" size="icon" onClick={() => setShowNewDialog(true)}>
              <Plus className="h-4 w-4" />
            </Button>
            {settings.id && (
              <>
                <Button 
                  variant="outline" 
                  size="icon" 
                  onClick={handleDuplicatePreset}
                  title="Preset duplizieren"
                >
                  <Copy className="h-4 w-4" />
                </Button>
                {!settings.is_default && (
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleSetDefault}
                    title="Als Standard setzen"
                  >
                    <Star className="h-4 w-4" />
                  </Button>
                )}
                {presets.length > 1 && (
                  <Button 
                    variant="outline" 
                    size="icon"
                    onClick={() => setDeletePresetId(settings.id || null)}
                    className="text-destructive hover:text-destructive"
                    title="Preset löschen"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </>
            )}
          </div>

          {/* Preset Name */}
          {settings.id && (
            <div className="space-y-2">
              <Label htmlFor="preset_name">Preset-Name</Label>
              <Input
                id="preset_name"
                value={settings.preset_name}
                onChange={(e) => setSettings({ ...settings, preset_name: e.target.value })}
                placeholder="z.B. Offiziell, Intern, Partner..."
              />
            </div>
          )}

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
            {isSaving ? "Speichern..." : "Preset speichern"}
          </Button>
        </CardContent>
      </Card>

      {/* New Preset Dialog */}
      <Dialog open={showNewDialog} onOpenChange={setShowNewDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Neues Briefkopf-Preset erstellen</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="new_preset_name">Preset-Name</Label>
              <Input
                id="new_preset_name"
                value={newPresetName}
                onChange={(e) => setNewPresetName(e.target.value)}
                placeholder="z.B. Offiziell, Partner, Intern..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewDialog(false)}>
              Abbrechen
            </Button>
            <Button onClick={handleCreatePreset} disabled={!newPresetName.trim()}>
              Erstellen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deletePresetId} onOpenChange={() => setDeletePresetId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Preset löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Sind Sie sicher, dass Sie dieses Briefkopf-Preset löschen möchten? 
              Diese Aktion kann nicht rückgängig gemacht werden.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeletePreset} className="bg-destructive text-destructive-foreground">
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
