import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Shield } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

type AppRole = "admin" | "state" | "management" | "finance" | "partner";

interface Employee {
  user_id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  roles: AppRole[];
}

interface RolesDialogProps {
  employee: Employee | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

const ROLE_CONFIG: { role: AppRole; label: string; description: string; variant: "destructive" | "default" | "secondary" | "outline" }[] = [
  { role: "admin", label: "Administrator", description: "Voller Zugriff auf alle Funktionen", variant: "destructive" },
  { role: "management", label: "Management", description: "Kann Berichte und Übersichten einsehen", variant: "default" },
  { role: "finance", label: "Finance", description: "Zugriff auf Finanzmodule", variant: "secondary" },
  { role: "state", label: "State", description: "Staatliche Aufsichtsfunktion", variant: "outline" },
  { role: "partner", label: "Partner", description: "Externer Partnerzugang", variant: "secondary" },
];

export function RolesDialog({ employee, open, onOpenChange, onSuccess }: RolesDialogProps) {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [selectedRoles, setSelectedRoles] = useState<AppRole[]>([]);

  useEffect(() => {
    if (employee) {
      setSelectedRoles(employee.roles || []);
    }
  }, [employee]);

  const toggleRole = (role: AppRole) => {
    setSelectedRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]
    );
  };

  const handleSubmit = async () => {
    if (!employee || !user) return;

    setIsLoading(true);
    try {
      // Delete existing roles
      const { error: deleteError } = await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", employee.user_id);

      if (deleteError) throw deleteError;

      // Insert new roles
      if (selectedRoles.length > 0) {
        const roleInserts = selectedRoles.map((role) => ({
          user_id: employee.user_id,
          role: role,
          granted_by: user.id,
        }));

        const { error: insertError } = await supabase.from("user_roles").insert(roleInserts);
        if (insertError) throw insertError;
      }

      toast.success("Rollen erfolgreich aktualisiert");
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error("Error updating roles:", error);
      toast.error("Fehler beim Aktualisieren der Rollen");
    } finally {
      setIsLoading(false);
    }
  };

  const displayName = employee?.first_name && employee?.last_name
    ? `${employee.first_name} ${employee.last_name}`
    : employee?.email;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Rollen verwalten
          </DialogTitle>
          <DialogDescription>
            Rollen für {displayName} bearbeiten
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          {ROLE_CONFIG.map(({ role, label, description, variant }) => {
            const isChecked = selectedRoles.includes(role);
            return (
              <div
                key={role}
                className="flex items-start space-x-3 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer"
                onClick={() => toggleRole(role)}
              >
                <Checkbox
                  checked={isChecked}
                  onCheckedChange={() => {}}
                  className="pointer-events-none"
                />
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <Label className="cursor-pointer font-medium">{label}</Label>
                    <Badge variant={variant} className="text-xs">
                      {role}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{description}</p>
                </div>
              </div>
            );
          })}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Abbrechen
          </Button>
          <Button onClick={handleSubmit} disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Speichern
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
