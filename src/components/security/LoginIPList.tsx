import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Globe, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { de } from "date-fns/locale";

interface LoginAttempt {
  id: string;
  email: string;
  ip_address: string | null;
  user_agent: string | null;
  success: boolean;
  attempted_at: string;
}

export function LoginIPList() {
  const [attempts, setAttempts] = useState<LoginAttempt[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchAttempts = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.rpc("get_login_attempts_for_admin");
      if (error) {
        console.error("Error fetching login attempts:", error);
        return;
      }
      setAttempts((data as LoginAttempt[]) || []);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAttempts();
  }, []);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Globe className="h-5 w-5" />
            <div>
              <CardTitle>Login-IP-Adressen</CardTitle>
              <CardDescription>
                Alle IP-Adressen, von denen Login-Versuche stattgefunden haben
              </CardDescription>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={fetchAttempts} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 mr-1 ${isLoading ? "animate-spin" : ""}`} />
            Aktualisieren
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Lade Login-Daten...</p>
        ) : attempts.length === 0 ? (
          <p className="text-sm text-muted-foreground">Keine Login-Versuche vorhanden.</p>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>IP-Adresse</TableHead>
                  <TableHead>E-Mail</TableHead>
                  <TableHead>Zeitpunkt</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {attempts.map((attempt) => (
                  <TableRow key={attempt.id}>
                    <TableCell className="font-mono text-sm">
                      {attempt.ip_address || "Unbekannt"}
                    </TableCell>
                    <TableCell className="text-sm">{attempt.email}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(attempt.attempted_at), "dd.MM.yyyy HH:mm", { locale: de })}
                    </TableCell>
                    <TableCell>
                      <Badge variant={attempt.success ? "default" : "destructive"}>
                        {attempt.success ? "Erfolgreich" : "Fehlgeschlagen"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
