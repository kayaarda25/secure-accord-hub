import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Globe, Plus, X, Shield } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

interface IPWhitelistProps {
  allowedIps: string[] | null;
  onUpdate: (ips: string[]) => void;
}

export function IPWhitelist({ allowedIps, onUpdate }: IPWhitelistProps) {
  const [newIp, setNewIp] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  const validateIP = (ip: string): boolean => {
    // IPv4 validation
    const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
    // IPv4 CIDR validation
    const cidrRegex = /^(\d{1,3}\.){3}\d{1,3}\/\d{1,2}$/;
    
    if (ipv4Regex.test(ip)) {
      const parts = ip.split('.').map(Number);
      return parts.every(part => part >= 0 && part <= 255);
    }
    
    if (cidrRegex.test(ip)) {
      const [ipPart, cidr] = ip.split('/');
      const parts = ipPart.split('.').map(Number);
      const cidrNum = parseInt(cidr);
      return parts.every(part => part >= 0 && part <= 255) && cidrNum >= 0 && cidrNum <= 32;
    }
    
    return false;
  };

  const handleAddIP = async () => {
    if (!user || !newIp.trim()) return;
    
    const trimmedIp = newIp.trim();
    
    if (!validateIP(trimmedIp)) {
      toast({
        title: "Ungültige IP-Adresse",
        description: "Bitte geben Sie eine gültige IPv4-Adresse ein (z.B. 192.168.1.1 oder 10.0.0.0/24)",
        variant: "destructive"
      });
      return;
    }

    const currentIps = allowedIps || [];
    if (currentIps.includes(trimmedIp)) {
      toast({
        title: "IP bereits vorhanden",
        description: "Diese IP-Adresse ist bereits in der Liste",
        variant: "destructive"
      });
      return;
    }

    setIsAdding(true);
    const updatedIps = [...currentIps, trimmedIp];

    const { error } = await supabase
      .from("security_settings")
      .update({ allowed_ips: updatedIps })
      .eq("user_id", user.id);

    if (error) {
      toast({
        title: "Fehler",
        description: "IP-Adresse konnte nicht hinzugefügt werden",
        variant: "destructive"
      });
    } else {
      onUpdate(updatedIps);
      setNewIp("");
      toast({
        title: "IP hinzugefügt",
        description: `${trimmedIp} wurde zur Whitelist hinzugefügt`
      });
    }
    setIsAdding(false);
  };

  const handleRemoveIP = async (ipToRemove: string) => {
    if (!user) return;

    const updatedIps = (allowedIps || []).filter(ip => ip !== ipToRemove);

    const { error } = await supabase
      .from("security_settings")
      .update({ allowed_ips: updatedIps.length > 0 ? updatedIps : null })
      .eq("user_id", user.id);

    if (error) {
      toast({
        title: "Fehler",
        description: "IP-Adresse konnte nicht entfernt werden",
        variant: "destructive"
      });
    } else {
      onUpdate(updatedIps);
      toast({
        title: "IP entfernt",
        description: `${ipToRemove} wurde von der Whitelist entfernt`
      });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Globe className="h-5 w-5" />
          IP-Whitelist
        </CardTitle>
        <CardDescription>
          Beschränken Sie den Zugriff auf bestimmte IP-Adressen
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input
            placeholder="z.B. 192.168.1.1"
            value={newIp}
            onChange={(e) => setNewIp(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAddIP()}
          />
          <Button 
            size="icon" 
            onClick={handleAddIP}
            disabled={isAdding || !newIp.trim()}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        {(!allowedIps || allowedIps.length === 0) ? (
          <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg">
            <Shield className="h-4 w-4 text-amber-600" />
            <p className="text-sm text-amber-800 dark:text-amber-200">
              Keine IP-Beschränkung aktiv - Zugriff von allen IPs erlaubt
            </p>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {allowedIps.map((ip) => (
              <Badge key={ip} variant="secondary" className="flex items-center gap-1 px-3 py-1">
                {ip}
                <button
                  onClick={() => handleRemoveIP(ip)}
                  className="ml-1 hover:text-destructive"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          Unterstützt IPv4-Adressen und CIDR-Notation (z.B. 10.0.0.0/24)
        </p>
      </CardContent>
    </Card>
  );
}
