import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface CreateEmployeeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

const MARITAL_STATUSES = [
  { value: "single", label: "Ledig" },
  { value: "married", label: "Verheiratet" },
  { value: "divorced", label: "Geschieden" },
  { value: "widowed", label: "Verwitwet" },
  { value: "separated", label: "Getrennt" },
  { value: "registered_partnership", label: "Eingetragene Partnerschaft" },
];

const EMPLOYMENT_TYPES = [
  { value: "full_time", label: "Vollzeit" },
  { value: "part_time", label: "Teilzeit" },
  { value: "temporary", label: "Temporär" },
  { value: "intern", label: "Praktikum" },
  { value: "freelance", label: "Freelance" },
];

export function CreateEmployeeDialog({ open, onOpenChange, onSuccess }: CreateEmployeeDialogProps) {
  const { user, profile } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    email: "",
    position: "",
    ahv_number: "",
    marital_status: "",
    children_count: 0,
    monthly_salary: "",
    employment_type: "full_time",
    employment_start: "",
    employment_end: "",
    birth_date: "",
    nationality: "",
    address: "",
    bank_iban: "",
    emergency_contact: "",
    notes: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !profile?.organization_id) return;

    if (!formData.first_name.trim() || !formData.last_name.trim()) {
      toast.error("Vor- und Nachname sind erforderlich");
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase.from("employee_records").insert({
        first_name: formData.first_name.trim(),
        last_name: formData.last_name.trim(),
        email: formData.email.trim() || null,
        position: formData.position.trim() || null,
        ahv_number: formData.ahv_number.trim() || null,
        marital_status: formData.marital_status || null,
        children_count: formData.children_count,
        monthly_salary: formData.monthly_salary ? parseFloat(formData.monthly_salary) : null,
        employment_type: formData.employment_type,
        employment_start: formData.employment_start || null,
        employment_end: formData.employment_end || null,
        birth_date: formData.birth_date || null,
        nationality: formData.nationality.trim() || null,
        address: formData.address.trim() || null,
        bank_iban: formData.bank_iban.trim() || null,
        emergency_contact: formData.emergency_contact.trim() || null,
        notes: formData.notes.trim() || null,
        organization_id: profile.organization_id,
        created_by: user.id,
        is_system_user: false,
        profile_id: null,
      });

      if (error) throw error;

      toast.success("Mitarbeiter erfolgreich erfasst");
      onSuccess();
      onOpenChange(false);
      setFormData({
        first_name: "",
        last_name: "",
        email: "",
        position: "",
        ahv_number: "",
        marital_status: "",
        children_count: 0,
        monthly_salary: "",
        employment_type: "full_time",
        employment_start: "",
        employment_end: "",
        birth_date: "",
        nationality: "",
        address: "",
        bank_iban: "",
        emergency_contact: "",
        notes: "",
      });
    } catch (error) {
      console.error("Error creating employee:", error);
      toast.error("Fehler beim Erstellen des Mitarbeiters");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Neuen Mitarbeiter erfassen</DialogTitle>
          <DialogDescription>
            Erfassen Sie einen Mitarbeiter ohne Systemzugang. Alle HR-relevanten Daten können hier gepflegt werden.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-6 py-4">
            {/* Personal Info */}
            <div>
              <h4 className="text-sm font-semibold text-foreground mb-3">Personalien</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="first_name">Vorname *</Label>
                  <Input
                    id="first_name"
                    value={formData.first_name}
                    onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="last_name">Nachname *</Label>
                  <Input
                    id="last_name"
                    value={formData.last_name}
                    onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="birth_date">Geburtsdatum</Label>
                  <Input
                    id="birth_date"
                    type="date"
                    value={formData.birth_date}
                    onChange={(e) => setFormData({ ...formData, birth_date: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="nationality">Nationalität</Label>
                  <Input
                    id="nationality"
                    value={formData.nationality}
                    onChange={(e) => setFormData({ ...formData, nationality: e.target.value })}
                    placeholder="z.B. CH"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Zivilstand</Label>
                  <Select
                    value={formData.marital_status}
                    onValueChange={(v) => setFormData({ ...formData, marital_status: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Auswählen" />
                    </SelectTrigger>
                    <SelectContent>
                      {MARITAL_STATUSES.map((s) => (
                        <SelectItem key={s.value} value={s.value}>
                          {s.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="children_count">Kinder</Label>
                  <Input
                    id="children_count"
                    type="number"
                    min={0}
                    value={formData.children_count}
                    onChange={(e) => setFormData({ ...formData, children_count: parseInt(e.target.value) || 0 })}
                  />
                </div>
              </div>
            </div>

            {/* Contact */}
            <div>
              <h4 className="text-sm font-semibold text-foreground mb-3">Kontakt</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="email">E-Mail</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="emergency_contact">Notfallkontakt</Label>
                  <Input
                    id="emergency_contact"
                    value={formData.emergency_contact}
                    onChange={(e) => setFormData({ ...formData, emergency_contact: e.target.value })}
                  />
                </div>
                <div className="col-span-2 space-y-2">
                  <Label htmlFor="address">Adresse</Label>
                  <Textarea
                    id="address"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    rows={2}
                  />
                </div>
              </div>
            </div>

            {/* Employment */}
            <div>
              <h4 className="text-sm font-semibold text-foreground mb-3">Arbeitsverhältnis</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="position">Position</Label>
                  <Input
                    id="position"
                    value={formData.position}
                    onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Beschäftigungsart</Label>
                  <Select
                    value={formData.employment_type}
                    onValueChange={(v) => setFormData({ ...formData, employment_type: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {EMPLOYMENT_TYPES.map((t) => (
                        <SelectItem key={t.value} value={t.value}>
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="employment_start">Eintritt</Label>
                  <Input
                    id="employment_start"
                    type="date"
                    value={formData.employment_start}
                    onChange={(e) => setFormData({ ...formData, employment_start: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="employment_end">Austritt</Label>
                  <Input
                    id="employment_end"
                    type="date"
                    value={formData.employment_end}
                    onChange={(e) => setFormData({ ...formData, employment_end: e.target.value })}
                  />
                </div>
              </div>
            </div>

            {/* Financial */}
            <div>
              <h4 className="text-sm font-semibold text-foreground mb-3">Finanzen & Sozialversicherung</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="monthly_salary">Monatslohn (CHF)</Label>
                  <Input
                    id="monthly_salary"
                    type="number"
                    step="0.01"
                    min={0}
                    value={formData.monthly_salary}
                    onChange={(e) => setFormData({ ...formData, monthly_salary: e.target.value })}
                    placeholder="z.B. 6500.00"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ahv_number">AHV-Nummer</Label>
                  <Input
                    id="ahv_number"
                    value={formData.ahv_number}
                    onChange={(e) => setFormData({ ...formData, ahv_number: e.target.value })}
                    placeholder="756.XXXX.XXXX.XX"
                  />
                </div>
                <div className="col-span-2 space-y-2">
                  <Label htmlFor="bank_iban">Bank IBAN</Label>
                  <Input
                    id="bank_iban"
                    value={formData.bank_iban}
                    onChange={(e) => setFormData({ ...formData, bank_iban: e.target.value })}
                    placeholder="CH00 0000 0000 0000 0000 0"
                  />
                </div>
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="notes">Bemerkungen</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Abbrechen
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Mitarbeiter erfassen
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
