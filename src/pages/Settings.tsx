import { useState, useEffect } from "react";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  User,
  Bell,
  Palette,
  Globe,
  Save,
  PenTool,
  FileText,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { SignaturePad } from "@/components/settings/SignaturePad";
import { LetterheadSettings } from "@/components/settings/LetterheadSettings";

interface NotificationPreferences {
  id: string;
  email_enabled: boolean;
  push_enabled: boolean;
  task_notifications: boolean;
  document_notifications: boolean;
  expense_notifications: boolean;
  calendar_notifications: boolean;
  approval_notifications: boolean;
  budget_notifications: boolean;
}

export default function Settings() {
  const [notificationPrefs, setNotificationPrefs] = useState<NotificationPreferences | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const { user, profile } = useAuth();
  const { toast } = useToast();

  // Profile form state
  const [firstName, setFirstName] = useState(profile?.first_name || "");
  const [lastName, setLastName] = useState(profile?.last_name || "");
  const [phone, setPhone] = useState(profile?.phone || "");
  const [position, setPosition] = useState(profile?.position || "");
  const [department, setDepartment] = useState(profile?.department || "");

  useEffect(() => {
    if (profile) {
      setFirstName(profile.first_name || "");
      setLastName(profile.last_name || "");
      setPhone(profile.phone || "");
      setPosition(profile.position || "");
      setDepartment(profile.department || "");
    }
  }, [profile]);

  useEffect(() => {
    if (user) {
      fetchNotificationPreferences();
    }
  }, [user]);

  const fetchNotificationPreferences = async () => {
    if (!user) return;
    
    setIsLoading(true);

    const { data, error } = await supabase
      .from("notification_preferences")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (data) {
      setNotificationPrefs(data);
    } else if (!error || error.code === "PGRST116") {
      // Create default preferences
      const { data: newPrefs } = await supabase
        .from("notification_preferences")
        .insert({
          user_id: user.id,
          email_enabled: true,
          push_enabled: true,
          task_notifications: true,
          document_notifications: true,
          expense_notifications: true,
          calendar_notifications: true,
          approval_notifications: true,
          budget_notifications: true,
        })
        .select()
        .single();

      if (newPrefs) {
        setNotificationPrefs(newPrefs);
      }
    }

    setIsLoading(false);
  };

  const handleSaveProfile = async () => {
    if (!user) return;
    
    setIsSaving(true);

    const { error } = await supabase
      .from("profiles")
      .update({
        first_name: firstName,
        last_name: lastName,
        phone,
        position,
        department,
      })
      .eq("user_id", user.id);

    if (error) {
      toast({ title: "Fehler", description: "Profil konnte nicht gespeichert werden", variant: "destructive" });
    } else {
      toast({ title: "Gespeichert", description: "Profil wurde aktualisiert" });
    }

    setIsSaving(false);
  };

  const handleToggleNotification = async (key: keyof NotificationPreferences, value: boolean) => {
    if (!notificationPrefs || !user) return;

    const { error } = await supabase
      .from("notification_preferences")
      .update({ [key]: value })
      .eq("user_id", user.id);

    if (error) {
      toast({ title: "Fehler", description: "Einstellung konnte nicht gespeichert werden", variant: "destructive" });
    } else {
      setNotificationPrefs({ ...notificationPrefs, [key]: value });
    }
  };

  const getInitials = () => {
    return `${firstName?.[0] || ""}${lastName?.[0] || ""}`.toUpperCase() || "U";
  };

  return (
    <Layout title="Einstellungen" subtitle="Profil und Präferenzen verwalten">
      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList className="flex-wrap">
          <TabsTrigger value="profile" className="flex items-center gap-2">
            <User className="h-4 w-4" />
            Profil
          </TabsTrigger>
          <TabsTrigger value="signature" className="flex items-center gap-2">
            <PenTool className="h-4 w-4" />
            Signatur
          </TabsTrigger>
          <TabsTrigger value="letterhead" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Briefkopf
          </TabsTrigger>
          <TabsTrigger value="notifications" className="flex items-center gap-2">
            <Bell className="h-4 w-4" />
            Benachrichtigungen
          </TabsTrigger>
          <TabsTrigger value="appearance" className="flex items-center gap-2">
            <Palette className="h-4 w-4" />
            Darstellung
          </TabsTrigger>
          <TabsTrigger value="language" className="flex items-center gap-2">
            <Globe className="h-4 w-4" />
            Sprache
          </TabsTrigger>
        </TabsList>

        {/* Profile Tab */}
        <TabsContent value="profile">
          <Card>
            <CardHeader>
              <CardTitle>Profil bearbeiten</CardTitle>
              <CardDescription>
                Aktualisieren Sie Ihre persönlichen Informationen
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center gap-6">
                <Avatar className="h-20 w-20">
                  <AvatarImage src={profile?.avatar_url || ""} />
                  <AvatarFallback className="text-xl">{getInitials()}</AvatarFallback>
                </Avatar>
                <div>
                  <Button variant="outline" size="sm">
                    Foto ändern
                  </Button>
                  <p className="text-sm text-muted-foreground mt-1">
                    JPG, GIF oder PNG. Max 1MB.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="firstName">Vorname</Label>
                  <Input
                    id="firstName"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="lastName">Nachname</Label>
                  <Input
                    id="lastName"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="email">E-Mail</Label>
                  <Input id="email" value={profile?.email || ""} disabled />
                </div>
                <div>
                  <Label htmlFor="phone">Telefon</Label>
                  <Input
                    id="phone"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="position">Position</Label>
                  <Input
                    id="position"
                    value={position}
                    onChange={(e) => setPosition(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="department">Abteilung</Label>
                  <Input
                    id="department"
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                  />
                </div>
              </div>

              <Button onClick={handleSaveProfile} disabled={isSaving}>
                <Save className="h-4 w-4 mr-2" />
                {isSaving ? "Speichern..." : "Speichern"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="signature">
          <SignaturePad />
        </TabsContent>

        {/* Letterhead Tab */}
        <TabsContent value="letterhead">
          <LetterheadSettings />
        </TabsContent>

        {/* Notifications Tab */}
        <TabsContent value="notifications">
          <Card>
            <CardHeader>
              <CardTitle>Benachrichtigungseinstellungen</CardTitle>
              <CardDescription>
                Wählen Sie, welche Benachrichtigungen Sie erhalten möchten
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {isLoading ? (
                <div className="text-center py-8 text-muted-foreground">Laden...</div>
              ) : notificationPrefs && (
                <>
                  <div className="space-y-4">
                    <h4 className="font-medium">Kanäle</h4>
                    <div className="flex items-center justify-between">
                      <div>
                        <Label>E-Mail-Benachrichtigungen</Label>
                        <p className="text-sm text-muted-foreground">
                          Benachrichtigungen per E-Mail erhalten
                        </p>
                      </div>
                      <Switch
                        checked={notificationPrefs.email_enabled}
                        onCheckedChange={(v) => handleToggleNotification("email_enabled", v)}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <Label>Push-Benachrichtigungen</Label>
                        <p className="text-sm text-muted-foreground">
                          Browser-Benachrichtigungen erhalten
                        </p>
                      </div>
                      <Switch
                        checked={notificationPrefs.push_enabled}
                        onCheckedChange={(v) => handleToggleNotification("push_enabled", v)}
                      />
                    </div>
                  </div>

                  <div className="border-t pt-6 space-y-4">
                    <h4 className="font-medium">Kategorien</h4>
                    <div className="flex items-center justify-between">
                      <Label>Aufgaben</Label>
                      <Switch
                        checked={notificationPrefs.task_notifications}
                        onCheckedChange={(v) => handleToggleNotification("task_notifications", v)}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label>Dokumente</Label>
                      <Switch
                        checked={notificationPrefs.document_notifications}
                        onCheckedChange={(v) => handleToggleNotification("document_notifications", v)}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label>Ausgaben & OPEX</Label>
                      <Switch
                        checked={notificationPrefs.expense_notifications}
                        onCheckedChange={(v) => handleToggleNotification("expense_notifications", v)}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label>Kalender</Label>
                      <Switch
                        checked={notificationPrefs.calendar_notifications}
                        onCheckedChange={(v) => handleToggleNotification("calendar_notifications", v)}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label>Genehmigungen</Label>
                      <Switch
                        checked={notificationPrefs.approval_notifications}
                        onCheckedChange={(v) => handleToggleNotification("approval_notifications", v)}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label>Budget</Label>
                      <Switch
                        checked={notificationPrefs.budget_notifications}
                        onCheckedChange={(v) => handleToggleNotification("budget_notifications", v)}
                      />
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Appearance Tab */}
        <TabsContent value="appearance">
          <Card>
            <CardHeader>
              <CardTitle>Darstellung</CardTitle>
              <CardDescription>
                Passen Sie das Aussehen der Anwendung an
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <Label>Farbschema</Label>
                <div className="grid grid-cols-3 gap-4 mt-2">
                  <Button variant="outline" className="justify-start">
                    ☀️ Hell
                  </Button>
                  <Button variant="default" className="justify-start">
                    🌙 Dunkel
                  </Button>
                  <Button variant="outline" className="justify-start">
                    💻 System
                  </Button>
                </div>
              </div>

              <div>
                <Label>Akzentfarbe</Label>
                <div className="flex gap-2 mt-2">
                  <button className="h-8 w-8 rounded-full bg-amber-500 ring-2 ring-offset-2 ring-amber-500" />
                  <button className="h-8 w-8 rounded-full bg-blue-500" />
                  <button className="h-8 w-8 rounded-full bg-green-500" />
                  <button className="h-8 w-8 rounded-full bg-purple-500" />
                  <button className="h-8 w-8 rounded-full bg-red-500" />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Language Tab */}
        <TabsContent value="language">
          <Card>
            <CardHeader>
              <CardTitle>Sprache & Region</CardTitle>
              <CardDescription>
                Sprache und regionale Einstellungen anpassen
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <Label>Sprache</Label>
                <Select defaultValue="de">
                  <SelectTrigger className="w-full mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="de">🇩🇪 Deutsch</SelectItem>
                    <SelectItem value="en">🇬🇧 English</SelectItem>
                    <SelectItem value="fr">🇫🇷 Français</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Zeitzone</Label>
                <Select defaultValue="europe-zurich">
                  <SelectTrigger className="w-full mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="europe-zurich">Europe/Zurich (GMT+1)</SelectItem>
                    <SelectItem value="europe-berlin">Europe/Berlin (GMT+1)</SelectItem>
                    <SelectItem value="europe-london">Europe/London (GMT+0)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Datumsformat</Label>
                <Select defaultValue="dd-mm-yyyy">
                  <SelectTrigger className="w-full mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="dd-mm-yyyy">DD.MM.YYYY</SelectItem>
                    <SelectItem value="mm-dd-yyyy">MM/DD/YYYY</SelectItem>
                    <SelectItem value="yyyy-mm-dd">YYYY-MM-DD</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </Layout>
  );
}
