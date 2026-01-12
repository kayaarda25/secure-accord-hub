import { useState, useEffect } from "react";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Smartphone, Key, Monitor, Clock, MapPin, LogOut, AlertTriangle, CheckCircle, Lock, Shield, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";
import { de } from "date-fns/locale";
import { TwoFactorSetup } from "@/components/security/TwoFactorSetup";
import { DisableTwoFactor } from "@/components/security/DisableTwoFactor";

interface UserSession {
  id: string;
  device_info: string | null;
  ip_address: string | null;
  user_agent: string | null;
  last_active_at: string;
  created_at: string;
  is_active: boolean;
}

interface SecuritySettings {
  id: string;
  two_factor_enabled: boolean;
  session_timeout_minutes: number;
  allowed_ips: string[] | null;
}
export default function Security() {
  const [sessions, setSessions] = useState<UserSession[]>([]);
  const [settings, setSettings] = useState<SecuritySettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [show2FASetup, setShow2FASetup] = useState(false);
  const [show2FADisable, setShow2FADisable] = useState(false);
  const [hasMfaFactor, setHasMfaFactor] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();
  useEffect(() => {
    if (user) {
      fetchSecurityData();
      checkMfaFactors();
    }
  }, [user]);

  const fetchSecurityData = async () => {
    if (!user) return;
    setIsLoading(true);

    // Fetch sessions
    const { data: sessionsData } = await supabase
      .from("user_sessions")
      .select("*")
      .eq("user_id", user.id)
      .order("last_active_at", { ascending: false });
    
    if (sessionsData) {
      setSessions(sessionsData);
    }

    // Fetch or create security settings
    const { data: settingsData } = await supabase
      .from("security_settings")
      .select("*")
      .eq("user_id", user.id)
      .single();
    
    if (settingsData) {
      setSettings(settingsData);
    } else {
      // Create default settings
      const { data: newSettings } = await supabase
        .from("security_settings")
        .insert({
          user_id: user.id,
          two_factor_enabled: false,
          session_timeout_minutes: 60
        })
        .select()
        .single();
      
      if (newSettings) {
        setSettings(newSettings);
      }
    }
    setIsLoading(false);
  };

  const checkMfaFactors = async () => {
    try {
      const { data: factors } = await supabase.auth.mfa.listFactors();
      if (factors && factors.totp.length > 0) {
        setHasMfaFactor(true);
      } else {
        setHasMfaFactor(false);
      }
    } catch (err) {
      console.error("Error checking MFA factors:", err);
    }
  };

  const handle2FAToggle = () => {
    if (hasMfaFactor) {
      setShow2FADisable(true);
    } else {
      setShow2FASetup(true);
    }
  };

  const handle2FASetupSuccess = () => {
    setHasMfaFactor(true);
    setSettings(prev => prev ? { ...prev, two_factor_enabled: true } : null);
    toast({
      title: "2FA aktiviert",
      description: "Zwei-Faktor-Authentifizierung wurde erfolgreich aktiviert"
    });
  };

  const handle2FADisableSuccess = () => {
    setHasMfaFactor(false);
    setSettings(prev => prev ? { ...prev, two_factor_enabled: false } : null);
  };
  const handleUpdateTimeout = async (minutes: number) => {
    if (!settings || !user) return;
    const {
      error
    } = await supabase.from("security_settings").update({
      session_timeout_minutes: minutes
    }).eq("user_id", user.id);
    if (error) {
      toast({
        title: "Fehler",
        description: "Einstellung konnte nicht geändert werden",
        variant: "destructive"
      });
    } else {
      setSettings({
        ...settings,
        session_timeout_minutes: minutes
      });
      toast({
        title: "Gespeichert",
        description: "Session-Timeout wurde aktualisiert"
      });
    }
  };
  const handleTerminateSession = async (sessionId: string) => {
    const {
      error
    } = await supabase.from("user_sessions").update({
      is_active: false
    }).eq("id", sessionId);
    if (error) {
      toast({
        title: "Fehler",
        description: "Session konnte nicht beendet werden",
        variant: "destructive"
      });
    } else {
      setSessions(sessions.filter(s => s.id !== sessionId));
      toast({
        title: "Session beendet",
        description: "Die Session wurde erfolgreich beendet"
      });
    }
  };
  const handleTerminateAllSessions = async () => {
    if (!user) return;
    const {
      error
    } = await supabase.from("user_sessions").update({
      is_active: false
    }).eq("user_id", user.id);
    if (error) {
      toast({
        title: "Fehler",
        description: "Sessions konnten nicht beendet werden",
        variant: "destructive"
      });
    } else {
      setSessions([]);
      toast({
        title: "Alle Sessions beendet",
        description: "Alle anderen Sessions wurden beendet"
      });
    }
  };
  const handleChangePassword = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsChangingPassword(true);
    const formData = new FormData(e.currentTarget);
    const newPassword = formData.get("new_password") as string;
    const confirmPassword = formData.get("confirm_password") as string;
    if (newPassword !== confirmPassword) {
      toast({
        title: "Fehler",
        description: "Passwörter stimmen nicht überein",
        variant: "destructive"
      });
      setIsChangingPassword(false);
      return;
    }
    if (newPassword.length < 8) {
      toast({
        title: "Fehler",
        description: "Passwort muss mindestens 8 Zeichen lang sein",
        variant: "destructive"
      });
      setIsChangingPassword(false);
      return;
    }
    const {
      error
    } = await supabase.auth.updateUser({
      password: newPassword
    });
    if (error) {
      toast({
        title: "Fehler",
        description: error.message,
        variant: "destructive"
      });
    } else {
      toast({
        title: "Erfolg",
        description: "Passwort wurde erfolgreich geändert"
      });
      (e.target as HTMLFormElement).reset();
    }
    setIsChangingPassword(false);
  };
  const getDeviceIcon = (userAgent: string | null) => {
    if (!userAgent) return Monitor;
    if (userAgent.toLowerCase().includes("mobile")) return Smartphone;
    return Monitor;
  };
  return <Layout title="Sicherheit" subtitle="Sicherheitseinstellungen und Sessions verwalten">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Security Overview */}
        <div className="lg:col-span-2 space-y-6">
          {/* Two-Factor Authentication */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                
                <div>
                  <CardTitle>Zwei-Faktor-Authentifizierung</CardTitle>
                  <CardDescription>
                    Erhöhen Sie die Sicherheit Ihres Kontos mit 2FA
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {hasMfaFactor ? <ShieldCheck className="h-5 w-5 text-green-500" /> : <AlertTriangle className="h-5 w-5 text-amber-500" />}
                  <div>
                    <p className="font-medium">
                      {hasMfaFactor ? "Aktiviert" : "Nicht aktiviert"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {hasMfaFactor ? "Ihr Konto ist durch 2FA geschützt" : "Aktivieren Sie 2FA für zusätzliche Sicherheit"}
                    </p>
                  </div>
                </div>
                <Button 
                  variant={hasMfaFactor ? "outline" : "default"}
                  size="sm"
                  onClick={handle2FAToggle}
                >
                  {hasMfaFactor ? "Deaktivieren" : "Aktivieren"}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Active Sessions */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Aktive Sessions</CardTitle>
                  <CardDescription>
                    Geräte, die derzeit in Ihrem Konto angemeldet sind
                  </CardDescription>
                </div>
                {sessions.length > 1 && <Button variant="outline" size="sm" onClick={handleTerminateAllSessions}>
                    <LogOut className="h-4 w-4 mr-2" />
                    Alle beenden
                  </Button>}
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? <div className="text-center py-8 text-muted-foreground">Laden...</div> : sessions.length === 0 ? <div className="text-center py-8 text-muted-foreground">
                  <Monitor className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Keine aktiven Sessions gefunden</p>
                </div> : <div className="space-y-4">
                  {sessions.map(session => {
                const DeviceIcon = getDeviceIcon(session.user_agent);
                return <div key={session.id} className="flex items-center justify-between p-4 rounded-lg border">
                        <div className="flex items-center gap-4">
                          <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
                            <DeviceIcon className="h-5 w-5 text-muted-foreground" />
                          </div>
                          <div>
                            <p className="font-medium">
                              {session.device_info || "Unbekanntes Gerät"}
                            </p>
                            <div className="flex items-center gap-4 text-sm text-muted-foreground">
                              {session.ip_address && <span className="flex items-center gap-1">
                                  <MapPin className="h-3 w-3" />
                                  {session.ip_address}
                                </span>}
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {formatDistanceToNow(new Date(session.last_active_at), {
                            addSuffix: true,
                            locale: de
                          })}
                              </span>
                            </div>
                          </div>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => handleTerminateSession(session.id)}>
                          <LogOut className="h-4 w-4" />
                        </Button>
                      </div>;
              })}
                </div>}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar Settings */}
        <div className="space-y-6">
          {/* Change Password */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Key className="h-5 w-5" />
                Passwort ändern
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleChangePassword} className="space-y-4">
                <div>
                  <Label htmlFor="new_password">Neues Passwort</Label>
                  <Input id="new_password" name="new_password" type="password" required minLength={8} />
                </div>
                <div>
                  <Label htmlFor="confirm_password">Passwort bestätigen</Label>
                  <Input id="confirm_password" name="confirm_password" type="password" required />
                </div>
                <Button type="submit" className="w-full" disabled={isChangingPassword}>
                  {isChangingPassword ? "Ändern..." : "Passwort ändern"}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Session Timeout */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Session-Timeout
              </CardTitle>
              <CardDescription>
                Automatische Abmeldung bei Inaktivität
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[15, 30, 60, 120].map(minutes => <Button key={minutes} variant={settings?.session_timeout_minutes === minutes ? "default" : "outline"} className="w-full justify-start" onClick={() => handleUpdateTimeout(minutes)}>
                    {minutes} Minuten
                  </Button>)}
              </div>
            </CardContent>
          </Card>

          {/* Security Tips */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lock className="h-5 w-5" />
                Sicherheitstipps
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                  Verwenden Sie ein starkes, einzigartiges Passwort
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                  Aktivieren Sie die Zwei-Faktor-Authentifizierung
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                  Überprüfen Sie regelmäßig Ihre aktiven Sessions
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                  Melden Sie sich auf gemeinsam genutzten Geräten ab
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* 2FA Setup Dialog */}
      <TwoFactorSetup 
        open={show2FASetup} 
        onOpenChange={setShow2FASetup}
        onSuccess={handle2FASetupSuccess}
      />

      {/* 2FA Disable Dialog */}
      <DisableTwoFactor
        open={show2FADisable}
        onOpenChange={setShow2FADisable}
        onSuccess={handle2FADisableSuccess}
      />
    </Layout>;
}