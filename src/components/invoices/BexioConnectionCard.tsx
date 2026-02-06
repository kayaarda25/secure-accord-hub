import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link2, Link2Off, Loader2, ExternalLink } from "lucide-react";
import { useBexio } from "@/hooks/useBexio";

export function BexioConnectionCard() {
  const { isConnected, isLoading, connect, disconnect } = useBexio();

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <span className="font-bold text-[#1a3c50] dark:text-[#4db8c7] text-xl tracking-tight" style={{ fontFamily: 'system-ui, sans-serif' }}>bexio</span>
              Integration
            </CardTitle>
            <CardDescription>
              Verbinden Sie Bexio für automatische Buchhaltung
            </CardDescription>
          </div>
          {isLoading ? (
            <Badge variant="secondary" className="flex items-center gap-1">
              <Loader2 className="h-3 w-3 animate-spin" />
              Prüfe...
            </Badge>
          ) : isConnected ? (
            <Badge variant="default" className="flex items-center gap-1 bg-success">
              <Link2 className="h-3 w-3" />
              Verbunden
            </Badge>
          ) : (
            <Badge variant="secondary" className="flex items-center gap-1">
              <Link2Off className="h-3 w-3" />
              Nicht verbunden
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {isConnected ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Rechnungen werden automatisch nach Freigabe in Bexio als Kreditorenbeleg erfasst.
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={disconnect}>
                <Link2Off className="mr-2 h-4 w-4" />
                Trennen
              </Button>
              <Button variant="ghost" size="sm" asChild>
                <a href="https://office.bexio.com" target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Bexio öffnen
                </a>
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Verbinden Sie Ihr Bexio-Konto, um freigegebene Rechnungen automatisch als Kreditorenbelege zu erfassen.
            </p>
            <Button onClick={connect} disabled={isLoading}>
              <Link2 className="mr-2 h-4 w-4" />
              Mit Bexio verbinden
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
