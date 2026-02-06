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
import { INSURANCE_RATES, InsuranceRecordInput } from "@/hooks/useSocialInsurance";

interface Profile {
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
}

interface AddInsuranceRecordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: InsuranceRecordInput) => void;
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
  const [bvgTotal, setBvgTotal] = useState("");
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

  // Calculate preview of automatic contributions
  const grossValue = parseFloat(grossSalary) || 0;
  const previewAhv = grossValue * INSURANCE_RATES.AHV_IV_EO * 2; // Total (AN + AG)
  const previewAlv = grossValue * INSURANCE_RATES.ALV * 2;
  const previewUvg = grossValue * (INSURANCE_RATES.UVG_NBU + INSURANCE_RATES.UVG_BU);
  const previewKtg = grossValue * INSURANCE_RATES.KTG;

  const handleSubmit = () => {
    if (!userId || !grossSalary || !bvgTotal) return;

    onSubmit({
      user_id: userId,
      year: parseInt(year),
      month: parseInt(month),
      gross_salary: parseFloat(grossSalary),
      bvg_total: parseFloat(bvgTotal),
      notes: notes || undefined,
    });

    // Reset form
    setUserId("");
    setGrossSalary("");
    setBvgTotal("");
    setNotes("");
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setUserId("");
      setGrossSalary("");
      setBvgTotal("");
      setNotes("");
    }
    onOpenChange(open);
  };

  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("de-CH", {
      style: "currency",
      currency: "CHF",
    }).format(value);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Versicherungseintrag hinzufügen</DialogTitle>
          <DialogDescription>
            Erfassen Sie die Sozialversicherungsbeiträge für einen Mitarbeiter.
            BVG wird manuell eingegeben, alle anderen Beiträge automatisch berechnet.
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
            <Label>BVG Total (CHF) - wird 50/50 aufgeteilt</Label>
            <Input
              type="number"
              value={bvgTotal}
              onChange={(e) => setBvgTotal(e.target.value)}
              placeholder="z.B. 500 (Gesamtbetrag AN + AG)"
              min="0"
              step="10"
            />
            {bvgTotal && (
              <p className="text-xs text-muted-foreground">
                → AN: {formatCurrency(parseFloat(bvgTotal) / 2)} | AG: {formatCurrency(parseFloat(bvgTotal) / 2)}
              </p>
            )}
          </div>

          {/* Preview of automatic calculations */}
          {grossValue > 0 && (
            <div className="rounded-lg border bg-muted/50 p-3 space-y-2">
              <p className="text-sm font-medium">Automatisch berechnete Beiträge:</p>
              <div className="grid grid-cols-2 gap-2 text-sm text-muted-foreground">
                <div>
                  <span className="font-medium">AHV/IV/EO:</span> {formatCurrency(previewAhv)}
                  <span className="text-xs block">50% AN / 50% AG</span>
                </div>
                <div>
                  <span className="font-medium">ALV:</span> {formatCurrency(previewAlv)}
                  <span className="text-xs block">50% AN / 50% AG</span>
                </div>
                <div>
                  <span className="font-medium">UVG:</span> {formatCurrency(previewUvg)}
                  <span className="text-xs block">NBU (AN) + BU (AG)</span>
                </div>
                <div>
                  <span className="font-medium">KTG:</span> {formatCurrency(previewKtg)}
                  <span className="text-xs block">100% AG</span>
                </div>
              </div>
            </div>
          )}

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
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Abbrechen
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!userId || !grossSalary || !bvgTotal || isLoading}
          >
            {isLoading ? "Wird gespeichert..." : "Speichern"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
