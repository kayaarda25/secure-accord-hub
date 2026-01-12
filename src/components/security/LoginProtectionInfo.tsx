import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Shield, AlertTriangle, CheckCircle } from "lucide-react";

interface LoginProtectionInfoProps {
  maxAttempts: number;
  lockoutMinutes: number;
}

export function LoginProtectionInfo({ maxAttempts, lockoutMinutes }: LoginProtectionInfoProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Login-Schutz
        </CardTitle>
        <CardDescription>
          Schutz vor unbefugten Zugriffsversuchen
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-start gap-3 p-3 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg">
          <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
          <div>
            <p className="font-medium text-green-800 dark:text-green-200">Aktiv</p>
            <p className="text-sm text-green-700 dark:text-green-300">
              Login-Schutz ist automatisch aktiviert
            </p>
          </div>
        </div>

        <div className="space-y-3 text-sm">
          <div className="flex items-center justify-between py-2 border-b">
            <span className="text-muted-foreground">Max. Fehlversuche</span>
            <span className="font-medium">{maxAttempts} Versuche</span>
          </div>
          <div className="flex items-center justify-between py-2 border-b">
            <span className="text-muted-foreground">Sperrzeit</span>
            <span className="font-medium">{lockoutMinutes} Minuten</span>
          </div>
        </div>

        <div className="flex items-start gap-2 p-3 bg-muted rounded-lg">
          <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5" />
          <p className="text-xs text-muted-foreground">
            Nach {maxAttempts} fehlgeschlagenen Anmeldeversuchen wird das Konto für {lockoutMinutes} Minuten gesperrt.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
