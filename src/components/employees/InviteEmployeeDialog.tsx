import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Mail, Copy } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

type AppRole = "admin" | "state" | "management" | "finance" | "partner";

interface InviteEmployeeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

const DEPARTMENTS = [
  "Executive",
  "Finance",
  "Legal",
  "Administration",
  "Project Management",
  "Communication",
  "IT",
  "HR",
];

const POSITIONS = [
  "CEO",
  "Department Head",
  "Project Manager",
  "Specialist",
  "Consultant",
  "Assistant",
  "Intern",
];

const ROLES: { role: AppRole; label: string }[] = [
  { role: "admin", label: "Administrator" },
  { role: "management", label: "Management" },
  { role: "finance", label: "Finance" },
  { role: "state", label: "State" },
  { role: "partner", label: "Partner" },
];

export function InviteEmployeeDialog({ open, onOpenChange, onSuccess }: InviteEmployeeDialogProps) {
  const { profile } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    department: "",
    position: "",
    roles: [] as AppRole[],
  });

  const toggleRole = (role: AppRole) => {
    setFormData((prev) => ({
      ...prev,
      roles: prev.roles.includes(role)
        ? prev.roles.filter((r) => r !== role)
        : [...prev.roles, role],
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.email) {
      toast.error("E-Mail-Adresse ist erforderlich");
      return;
    }

    if (!profile?.organization_id) {
      toast.error("Keine Organisation zugewiesen");
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("invite-user", {
        body: {
          email: formData.email,
          department: formData.department || null,
          position: formData.position || null,
          organizationId: profile.organization_id,
          roles: formData.roles,
        },
      });

      if (error) throw error;

      if (data?.error) {
        toast.error(data.error);
        return;
      }

      toast.success("Einladung erfolgreich gesendet!", {
        description: `Eine E-Mail wurde an ${formData.email} gesendet.`,
      });

      // Show invitation link option
      if (data?.invitationUrl) {
        toast.info("Einladungslink", {
          description: "Der Link kann auch manuell geteilt werden.",
          action: {
            label: "Kopieren",
            onClick: () => {
              navigator.clipboard.writeText(data.invitationUrl);
              toast.success("Link kopiert!");
            },
          },
          duration: 10000,
        });
      }

      setFormData({ email: "", department: "", position: "", roles: [] });
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error("Error inviting user:", error);
      toast.error(error.message || "Fehler beim Senden der Einladung");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Mitarbeiter einladen
          </DialogTitle>
          <DialogDescription>
            Senden Sie eine Einladung per E-Mail. Der Mitarbeiter kann dann sein eigenes Konto erstellen.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="email">E-Mail-Adresse *</Label>
              <Input
                id="email"
                type="email"
                placeholder="name@example.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Abteilung</Label>
                <Select
                  value={formData.department}
                  onValueChange={(value) => setFormData({ ...formData, department: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Auswählen" />
                  </SelectTrigger>
                  <SelectContent>
                    {DEPARTMENTS.map((dept) => (
                      <SelectItem key={dept} value={dept}>
                        {dept}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Position</Label>
                <Select
                  value={formData.position}
                  onValueChange={(value) => setFormData({ ...formData, position: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Auswählen" />
                  </SelectTrigger>
                  <SelectContent>
                    {POSITIONS.map((pos) => (
                      <SelectItem key={pos} value={pos}>
                        {pos}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Rollen zuweisen</Label>
              <div className="grid grid-cols-2 gap-2">
                {ROLES.map(({ role, label }) => (
                  <div
                    key={role}
                    className="flex items-center space-x-2 p-2 rounded border hover:bg-muted/50 cursor-pointer"
                    onClick={() => toggleRole(role)}
                  >
                    <Checkbox
                      checked={formData.roles.includes(role)}
                      onCheckedChange={() => toggleRole(role)}
                    />
                    <Label className="cursor-pointer text-sm">{label}</Label>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Abbrechen
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Einladung senden
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
