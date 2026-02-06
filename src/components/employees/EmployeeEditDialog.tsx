import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface Employee {
  id: string;
  user_id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  department: string | null;
  position: string | null;
  phone: string | null;
}

interface EmployeeEditDialogProps {
  employee: Employee | null;
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

export function EmployeeEditDialog({ employee, open, onOpenChange, onSuccess }: EmployeeEditDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState<{
    first_name: string;
    last_name: string;
    department: string;
    position: string;
    phone: string;
  }>({
    first_name: "",
    last_name: "",
    department: "",
    position: "",
    phone: "",
  });

  useEffect(() => {
    if (employee) {
      setFormData({
        first_name: employee.first_name || "",
        last_name: employee.last_name || "",
        // Keep Select controlled for lifetime: empty string = no selection
        department: employee.department ?? "",
        position: employee.position ?? "",
        phone: employee.phone || "",
      });
    }
  }, [employee]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employee) return;

    setIsLoading(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          first_name: formData.first_name || null,
          last_name: formData.last_name || null,
          department: formData.department ? formData.department : null,
          position: formData.position ? formData.position : null,
          phone: formData.phone || null,
        })
        .eq("id", employee.id);

      if (error) throw error;

      toast.success("Mitarbeiter erfolgreich aktualisiert");
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error("Error updating employee:", error);
      toast.error("Fehler beim Aktualisieren des Mitarbeiters");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Mitarbeiter bearbeiten</DialogTitle>
          <DialogDescription>
            Aktualisieren Sie die Informationen für {employee?.email}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label htmlFor="first_name" className="text-sm font-medium leading-none">Vorname</label>
                <Input
                  id="first_name"
                  value={formData.first_name}
                  onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                  placeholder="Vorname"
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="last_name" className="text-sm font-medium leading-none">Nachname</label>
                <Input
                  id="last_name"
                  value={formData.last_name}
                  onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                  placeholder="Nachname"
                />
              </div>
            </div>

            <div className="space-y-2">
              <span className="text-sm font-medium leading-none">Abteilung</span>
              <Select
                value={formData.department}
                onValueChange={(value) => setFormData({ ...formData, department: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Abteilung auswählen" />
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
              <span className="text-sm font-medium leading-none">Position</span>
              <Select
                value={formData.position}
                onValueChange={(value) => setFormData({ ...formData, position: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Position auswählen" />
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

            <div className="space-y-2">
              <label htmlFor="phone" className="text-sm font-medium leading-none">Telefon</label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="+41 XX XXX XX XX"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Abbrechen
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Speichern
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
