import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Smartphone, Monitor, Tablet, Clock, MapPin, LogOut, CheckCircle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { de } from "date-fns/locale";

interface UserSession {
  id: string;
  device_info: string | null;
  ip_address: string | null;
  user_agent: string | null;
  last_active_at: string;
  created_at: string;
  is_active: boolean;
  is_current?: boolean;
}

interface ActiveSessionsProps {
  sessions: UserSession[];
  isLoading: boolean;
  onTerminateSession: (sessionId: string) => void;
  onTerminateAllSessions: () => void;
}

export function ActiveSessions({ 
  sessions, 
  isLoading, 
  onTerminateSession, 
  onTerminateAllSessions 
}: ActiveSessionsProps) {
  const getDeviceIcon = (userAgent: string | null) => {
    if (!userAgent) return Monitor;
    const ua = userAgent.toLowerCase();
    if (ua.includes("mobile") || ua.includes("android") || ua.includes("iphone")) return Smartphone;
    if (ua.includes("tablet") || ua.includes("ipad")) return Tablet;
    return Monitor;
  };

  const getDeviceName = (userAgent: string | null, deviceInfo: string | null) => {
    if (deviceInfo) return deviceInfo;
    if (!userAgent) return "Unbekanntes Gerät";
    
    const ua = userAgent.toLowerCase();
    if (ua.includes("chrome")) return "Chrome Browser";
    if (ua.includes("firefox")) return "Firefox Browser";
    if (ua.includes("safari") && !ua.includes("chrome")) return "Safari Browser";
    if (ua.includes("edge")) return "Edge Browser";
    
    return "Web Browser";
  };

  const getOSName = (userAgent: string | null) => {
    if (!userAgent) return null;
    const ua = userAgent.toLowerCase();
    
    if (ua.includes("windows")) return "Windows";
    if (ua.includes("mac os") || ua.includes("macos")) return "macOS";
    if (ua.includes("linux")) return "Linux";
    if (ua.includes("android")) return "Android";
    if (ua.includes("iphone") || ua.includes("ipad")) return "iOS";
    
    return null;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Aktive Sessions</CardTitle>
            <CardDescription>
              Geräte, die derzeit in Ihrem Konto angemeldet sind
            </CardDescription>
          </div>
          {sessions.length > 1 && (
            <Button variant="outline" size="sm" onClick={onTerminateAllSessions}>
              <LogOut className="h-4 w-4 mr-2" />
              Alle beenden
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Laden...</div>
        ) : sessions.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Monitor className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Keine aktiven Sessions gefunden</p>
          </div>
        ) : (
          <div className="space-y-4">
            {sessions.map((session) => {
              const DeviceIcon = getDeviceIcon(session.user_agent);
              const deviceName = getDeviceName(session.user_agent, session.device_info);
              const osName = getOSName(session.user_agent);
              const isCurrent = session.is_current;

              return (
                <div 
                  key={session.id} 
                  className={`flex items-center justify-between p-4 rounded-lg border ${
                    isCurrent ? 'border-primary bg-primary/5' : ''
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${
                      isCurrent ? 'bg-primary/10' : 'bg-muted'
                    }`}>
                      <DeviceIcon className={`h-5 w-5 ${
                        isCurrent ? 'text-primary' : 'text-muted-foreground'
                      }`} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{deviceName}</p>
                        {isCurrent && (
                          <Badge variant="default" className="text-xs">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Diese Session
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        {osName && <span>{osName}</span>}
                        {session.ip_address && (
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {session.ip_address}
                          </span>
                        )}
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
                  {!isCurrent && (
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => onTerminateSession(session.id)}
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    >
                      <LogOut className="h-4 w-4 mr-2" />
                      Beenden
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
