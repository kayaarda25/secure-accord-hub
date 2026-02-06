import { useState, useEffect } from "react";
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

interface Profile {
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
}

interface AddInsuranceRecordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: {
    user_id: string;
    year: number;
    month: number;
    gross_salary: number;
    notes?: string;
  }) => void;
  isLoading?: boolean;
  currentYear: number;
  currentMonth: number;
}

const monthNames = [
  "Januar", "Februar", "März", "April", "Mai", "Juni",
  "Juli", "August", "September", "Oktober", "November", "Dezember"
];

export function AddInsuranceRecordDialog({
  open,
  onOpenChange,
  onSubmit,
  isLoading,
  currentYear,
  currentMonth,
}: AddInsuranceRecordDialogProps) {
  const [userId, setUserId] = useState("");
  const [year, setYear] = useState(currentYear.toString());
  const [month, setMonth] = useState(currentMonth.toString());
  const [grossSalary, setGrossSalary] = useState("");
  const [notes, setNotes] = useState("");
  const [employees, setEmployees] = useState<Profile[]>([]);

  useEffect(() => {
    const fetchEmployees = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("user_id, first_name, last_name, email")
        .eq("is_active", true);
      if (data) setEmployees(data);
    };
    if (open) fetchEmployees();
  }, [open]);

  const handleSubmit = () => {
    if (!userId || !grossSalary) return;

    onSubmit({
      user_id: userId,
      year: parseInt(year),
      month: parseInt(month),
      gross_salary: parseFloat(grossSalary),
      notes: notes || undefined,
    });

    // Reset form
    setUserId("");
    setGrossSalary("");
    setNotes("");
  };

  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Versicherungseintrag hinzufügen</DialogTitle>
          <DialogDescription>
            Erfassen Sie die Sozialversicherungsbeiträge für einen Mitarbeiter.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label>Mitarbeiter</Label>
            <Select value={userId} onValueChange={setUserId}>
              <SelectTrigger>
                <SelectValue placeholder="Mitarbeiter wählen" />
              </SelectTrigger>
              <SelectContent>
                {employees.map((emp) => (
                  <SelectItem key={emp.user_id} value={emp.user_id}>
                    {emp.first_name || emp.last_name
                      ? `${emp.first_name || ""} ${emp.last_name || ""}`.trim()
                      : emp.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>Jahr</Label>
              <Select value={year} onValueChange={setYear}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {years.map((y) => (
                    <SelectItem key={y} value={y.toString()}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Monat</Label>
              <Select value={month} onValueChange={setMonth}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {monthNames.map((name, idx) => (
                    <SelectItem key={idx} value={(idx + 1).toString()}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-2">
            <Label>Bruttolohn (CHF)</Label>
            <Input
              type="number"
              value={grossSalary}
              onChange={(e) => setGrossSalary(e.target.value)}
              placeholder="z.B. 7500"
              min="0"
              step="100"
            />
          </div>

          <div className="grid gap-2">
            <Label>Bemerkungen (optional)</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Zusätzliche Notizen"
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Abbrechen
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!userId || !grossSalary || isLoading}
          >
            {isLoading ? "Wird gespeichert..." : "Speichern"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
