import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link2, Link2Off, Loader2, ExternalLink, Plus, Trash2, Building2 } from "lucide-react";
import { useBexio } from "@/hooks/useBexio";
import { useMultiBexio } from "@/hooks/useMultiBexio";
import bexioLogo from "@/assets/bexio-logo.png";

export function BexioConnectionCard() {
  const { isConnected, isLoading, connect, disconnect } = useBexio();
  const { accounts, selectedAccountId, setSelectedAccountId, removeAccount, isLoading: accountsLoading, refetch } = useMultiBexio();
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [newAccountName, setNewAccountName] = useState("");
  const [newEntityType, setNewEntityType] = useState("default");

  const handleAddAccount = async () => {
    if (!newAccountName.trim()) return;
    // Trigger Bexio OAuth with account metadata – user logs in with a different Bexio account
    await connect(newAccountName.trim(), newEntityType);
    setNewAccountName("");
    setNewEntityType("default");
    setAddDialogOpen(false);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <img src={bexioLogo} alt="Bexio" className="h-5 w-auto" />
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
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Rechnungen werden nach Freigabe direkt als Zahlungsauftrag in Bexio erstellt.
            </p>

            {/* Multi-Account Section */}
            {accounts.length > 0 && (
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground flex items-center gap-1">
                  <Building2 className="h-3 w-3" />
                  Entity / Konto
                </Label>
                <Select value={selectedAccountId || ""} onValueChange={setSelectedAccountId}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Konto auswählen" />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts.map((acc) => (
                      <SelectItem key={acc.id} value={acc.id}>
                        {acc.account_name} ({acc.entity_type})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Plus className="mr-2 h-4 w-4" />
                    Konto hinzufügen
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Bexio-Konto hinzufügen</DialogTitle>
                    <DialogDescription>
                      Fügen Sie ein weiteres Bexio-Konto für eine andere Entity hinzu.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Kontoname</Label>
                      <Input
                        placeholder="z.B. MGI Media GmbH"
                        value={newAccountName}
                        onChange={(e) => setNewAccountName(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Entity-Typ</Label>
                      <Select value={newEntityType} onValueChange={setNewEntityType}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="default">Standard</SelectItem>
                          <SelectItem value="mgi_media">MGI Media</SelectItem>
                          <SelectItem value="mgi_communications">MGI Communications</SelectItem>
                          <SelectItem value="gateway">Gateway</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setAddDialogOpen(false)}>Abbrechen</Button>
                    <Button onClick={handleAddAccount} disabled={!newAccountName.trim()}>Hinzufügen</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

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

            {/* Account list */}
            {accounts.length > 1 && (
              <div className="space-y-1 pt-2 border-t">
                <p className="text-xs text-muted-foreground mb-2">Verknüpfte Konten:</p>
                {accounts.map((acc) => (
                  <div key={acc.id} className="flex items-center justify-between text-sm py-1">
                    <span className={acc.id === selectedAccountId ? "font-medium" : "text-muted-foreground"}>
                      {acc.account_name}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                      onClick={() => removeAccount(acc.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Verbinden Sie Ihr Bexio-Konto, um freigegebene Rechnungen automatisch als Zahlungsauftrag zu erfassen.
            </p>
            <Button onClick={() => connect()} disabled={isLoading}>
              <Link2 className="mr-2 h-4 w-4" />
              Mit Bexio verbinden
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
