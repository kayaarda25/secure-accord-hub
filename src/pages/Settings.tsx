import { useState, useEffect, useRef } from "react";
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
  Upload,
  Loader2,
  TrendingUp,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage, Language } from "@/contexts/LanguageContext";
import { useToast } from "@/hooks/use-toast";
import { SignaturePad } from "@/components/settings/SignaturePad";
import { LetterheadSettings } from "@/components/settings/LetterheadSettings";
import { CarrierRatesSettings } from "@/components/settings/CarrierRatesSettings";
import { useOrganizationPermissions } from "@/hooks/useOrganizationPermissions";

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
  const { user, profile, hasRole } = useAuth();
  const { toast } = useToast();
  const { permissions } = useOrganizationPermissions();
  const { language, setLanguage, t } = useLanguage();
  
  // Only MGI Media users with finance/admin/management roles can see Rates tab
  const canViewRates = permissions.isMgiMediaFinance;

  // Profile form state
  const [firstName, setFirstName] = useState(profile?.first_name || "");
  const [lastName, setLastName] = useState(profile?.last_name || "");
  const [phone, setPhone] = useState(profile?.phone || "");
  const [position, setPosition] = useState(profile?.position || "");
  const [department, setDepartment] = useState(profile?.department || "");
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url || "");
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (profile) {
      setFirstName(profile.first_name || "");
      setLastName(profile.last_name || "");
      setPhone(profile.phone || "");
      setPosition(profile.position || "");
      setDepartment(profile.department || "");
      setAvatarUrl(profile.avatar_url || "");
    }
  }, [profile]);

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast({ title: "Fehler", description: "Bitte wählen Sie eine Bilddatei", variant: "destructive" });
      return;
    }

    // Validate file size (max 1MB)
    if (file.size > 1024 * 1024) {
      toast({ title: "Fehler", description: "Die Datei darf maximal 1MB groß sein", variant: "destructive" });
      return;
    }

    setIsUploadingAvatar(true);

    try {
      // Create unique file path
      const fileExt = file.name.split(".").pop();
      const fileName = `${user.id}/avatar.${fileExt}`;

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from("avatars")
        .getPublicUrl(fileName);

      // Update profile with new avatar URL
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ avatar_url: publicUrl })
        .eq("user_id", user.id);

      if (updateError) throw updateError;

      setAvatarUrl(publicUrl);
      toast({ title: "Erfolg", description: "Profilbild wurde aktualisiert" });
    } catch (error) {
      console.error("Avatar upload error:", error);
      toast({ title: "Fehler", description: "Profilbild konnte nicht hochgeladen werden", variant: "destructive" });
    } finally {
      setIsUploadingAvatar(false);
    }
  };

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
    <Layout title={t("settings.title")} subtitle={t("settings.subtitle")}>
      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList className="flex-wrap">
          <TabsTrigger value="profile" className="flex items-center gap-2">
            <User className="h-4 w-4" />
            {t("settings.profile")}
          </TabsTrigger>
          <TabsTrigger value="signature" className="flex items-center gap-2">
            <PenTool className="h-4 w-4" />
            {t("settings.signature")}
          </TabsTrigger>
          <TabsTrigger value="letterhead" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            {t("settings.letterhead")}
          </TabsTrigger>
          {canViewRates && (
            <TabsTrigger value="rates" className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              {t("settings.rates")}
            </TabsTrigger>
          )}
          <TabsTrigger value="notifications" className="flex items-center gap-2">
            <Bell className="h-4 w-4" />
            {t("settings.notifications")}
          </TabsTrigger>
          <TabsTrigger value="appearance" className="flex items-center gap-2">
            <Palette className="h-4 w-4" />
            {t("settings.appearance")}
          </TabsTrigger>
          <TabsTrigger value="language" className="flex items-center gap-2">
            <Globe className="h-4 w-4" />
            {t("settings.language")}
          </TabsTrigger>
        </TabsList>

        {/* Profile Tab */}
        <TabsContent value="profile">
          <Card>
            <CardHeader>
              <CardTitle>{t("settings.profile.title")}</CardTitle>
              <CardDescription>
                {t("settings.profile.description")}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center gap-6">
                <Avatar className="h-20 w-20">
                  <AvatarImage src={avatarUrl} />
                  <AvatarFallback className="text-xl">{getInitials()}</AvatarFallback>
                </Avatar>
                <div>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleAvatarUpload}
                    accept="image/jpeg,image/png,image/gif"
                    className="hidden"
                  />
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploadingAvatar}
                  >
                    {isUploadingAvatar ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        {t("settings.profile.uploading")}
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4 mr-2" />
                        {t("settings.profile.changePhoto")}
                      </>
                    )}
                  </Button>
                  <p className="text-sm text-muted-foreground mt-1">
                    {t("settings.profile.photoHint")}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="firstName">{t("settings.profile.firstName")}</Label>
                  <Input
                    id="firstName"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="lastName">{t("settings.profile.lastName")}</Label>
                  <Input
                    id="lastName"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="email">{t("settings.profile.email")}</Label>
                  <Input id="email" value={profile?.email || ""} disabled />
                </div>
                <div>
                  <Label htmlFor="phone">{t("settings.profile.phone")}</Label>
                  <Input
                    id="phone"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="position">{t("settings.profile.position")}</Label>
                  <Input
                    id="position"
                    value={position}
                    onChange={(e) => setPosition(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="department">{t("settings.profile.department")}</Label>
                  <Input
                    id="department"
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                  />
                </div>
              </div>

              <Button onClick={handleSaveProfile} disabled={isSaving}>
                <Save className="h-4 w-4 mr-2" />
                {isSaving ? t("settings.profile.saving") : t("settings.profile.save")}
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

        {/* Rates Tab - MGI Media only */}
        {canViewRates && (
          <TabsContent value="rates">
            <CarrierRatesSettings />
          </TabsContent>
        )}

        {/* Notifications Tab */}
        <TabsContent value="notifications">
          <Card>
            <CardHeader>
              <CardTitle>{t("settings.notifications.title")}</CardTitle>
              <CardDescription>
                {t("settings.notifications.description")}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {isLoading ? (
                <div className="text-center py-8 text-muted-foreground">{t("settings.notifications.loading")}</div>
              ) : notificationPrefs && (
                <>
                  <div className="space-y-4">
                    <h4 className="font-medium">{t("settings.notifications.channels")}</h4>
                    <div className="flex items-center justify-between">
                      <div>
                        <Label>{t("settings.notifications.email")}</Label>
                        <p className="text-sm text-muted-foreground">
                          {t("settings.notifications.emailDesc")}
                        </p>
                      </div>
                      <Switch
                        checked={notificationPrefs.email_enabled}
                        onCheckedChange={(v) => handleToggleNotification("email_enabled", v)}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <Label>{t("settings.notifications.push")}</Label>
                        <p className="text-sm text-muted-foreground">
                          {t("settings.notifications.pushDesc")}
                        </p>
                      </div>
                      <Switch
                        checked={notificationPrefs.push_enabled}
                        onCheckedChange={(v) => handleToggleNotification("push_enabled", v)}
                      />
                    </div>
                  </div>

                  <div className="border-t pt-6 space-y-4">
                    <h4 className="font-medium">{t("settings.notifications.categories")}</h4>
                    <div className="flex items-center justify-between">
                      <Label>{t("settings.notifications.tasks")}</Label>
                      <Switch
                        checked={notificationPrefs.task_notifications}
                        onCheckedChange={(v) => handleToggleNotification("task_notifications", v)}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label>{t("settings.notifications.documents")}</Label>
                      <Switch
                        checked={notificationPrefs.document_notifications}
                        onCheckedChange={(v) => handleToggleNotification("document_notifications", v)}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label>{t("settings.notifications.expenses")}</Label>
                      <Switch
                        checked={notificationPrefs.expense_notifications}
                        onCheckedChange={(v) => handleToggleNotification("expense_notifications", v)}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label>{t("settings.notifications.calendar")}</Label>
                      <Switch
                        checked={notificationPrefs.calendar_notifications}
                        onCheckedChange={(v) => handleToggleNotification("calendar_notifications", v)}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label>{t("settings.notifications.approvals")}</Label>
                      <Switch
                        checked={notificationPrefs.approval_notifications}
                        onCheckedChange={(v) => handleToggleNotification("approval_notifications", v)}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label>{t("settings.notifications.budget")}</Label>
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
              <CardTitle>{t("settings.appearance.title")}</CardTitle>
              <CardDescription>
                {t("settings.appearance.description")}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <Label>{t("settings.appearance.colorScheme")}</Label>
                <div className="grid grid-cols-3 gap-4 mt-2">
                  <Button variant="outline" className="justify-start">
                    ☀️ {t("settings.appearance.light")}
                  </Button>
                  <Button variant="default" className="justify-start">
                    🌙 {t("settings.appearance.dark")}
                  </Button>
                  <Button variant="outline" className="justify-start">
                    💻 {t("settings.appearance.system")}
                  </Button>
                </div>
              </div>

              <div>
                <Label>{t("settings.appearance.accentColor")}</Label>
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
              <CardTitle>{t("settings.language.title")}</CardTitle>
              <CardDescription>
                {t("settings.language.description")}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <Label>{t("settings.language.language")}</Label>
                <Select value={language} onValueChange={(v) => setLanguage(v as Language)}>
                  <SelectTrigger className="w-full mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="de">🇩🇪 Deutsch</SelectItem>
                    <SelectItem value="en">🇬🇧 English</SelectItem>
                    <SelectItem value="fr">🇫🇷 Français</SelectItem>
                    <SelectItem value="pt">🇵🇹 Português</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>{t("settings.language.timezone")}</Label>
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
                <Label>{t("settings.language.dateFormat")}</Label>
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
