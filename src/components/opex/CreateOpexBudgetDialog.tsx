import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Loader2 } from "lucide-react";

interface LineItemInput {
  category: string;
  label: string;
  amount: string;
}

interface CostCenter {
  id: string;
  code: string;
  name: string;
}

interface CreateOpexBudgetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  costCenters: CostCenter[];
  onSubmit: (
    costCenterId: string,
    organizationId: string | null,
    period: string,
    currency: string,
    notes: string,
    lineItems: { category: string; label: string; amount: number; sort_order: number }[]
  ) => Promise<any>;
}

const CATEGORIES = [
  { value: "salaries", label: "Salaries & Wages" },
  { value: "rent", label: "Rent & Lease" },
  { value: "insurance", label: "Insurance" },
  { value: "transportation", label: "Transportation" },
  { value: "it", label: "IT & Technology" },
  { value: "utilities", label: "Utilities" },
  { value: "maintenance", label: "Maintenance" },
  { value: "marketing", label: "Marketing & Ads" },
  { value: "training", label: "Training & Education" },
  { value: "office", label: "Office Supplies" },
  { value: "communication", label: "Communication" },
  { value: "other", label: "Other" },
];

export function CreateOpexBudgetDialog({
  open,
  onOpenChange,
  costCenters,
  onSubmit,
}: CreateOpexBudgetDialogProps) {
  const [period, setPeriod] = useState(new Date().toISOString().slice(0, 7));
  const [costCenterId, setCostCenterId] = useState("");
  const [currency, setCurrency] = useState("CHF");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lineItems, setLineItems] = useState<LineItemInput[]>([
    { category: "salaries", label: "Salaries & Wages", amount: "" },
  ]);

  const addLineItem = () => {
    setLineItems([...lineItems, { category: "other", label: "", amount: "" }]);
  };

  const removeLineItem = (index: number) => {
    if (lineItems.length <= 1) return;
    setLineItems(lineItems.filter((_, i) => i !== index));
  };

  const updateLineItem = (index: number, field: keyof LineItemInput, value: string) => {
    const updated = [...lineItems];
    updated[index] = { ...updated[index], [field]: value };
    if (field === "category") {
      const cat = CATEGORIES.find((c) => c.value === value);
      if (cat && !updated[index].label) {
        updated[index].label = cat.label;
      }
    }
    setLineItems(updated);
  };

  const total = lineItems.reduce((s, li) => s + (parseFloat(li.amount) || 0), 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!costCenterId) return;

    const validItems = lineItems
      .filter((li) => li.label && parseFloat(li.amount) > 0)
      .map((li, idx) => ({
        category: li.category,
        label: li.label,
        amount: parseFloat(li.amount),
        sort_order: idx,
      }));

    if (validItems.length === 0) return;

    setIsSubmitting(true);
    const result = await onSubmit(costCenterId, null, period, currency, notes, validItems);
    setIsSubmitting(false);

    if (result) {
      // Reset
      setPeriod(new Date().toISOString().slice(0, 7));
      setCostCenterId("");
      setNotes("");
      setLineItems([{ category: "salaries", label: "Salaries & Wages", amount: "" }]);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Neues OPEX-Budget erstellen</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Meta */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <Label>Periode *</Label>
              <Input type="month" value={period} onChange={(e) => setPeriod(e.target.value)} required />
            </div>
            <div>
              <Label>Kostenstelle *</Label>
              <Select value={costCenterId} onValueChange={setCostCenterId}>
                <SelectTrigger>
                  <SelectValue placeholder="Auswählen..." />
                </SelectTrigger>
                <SelectContent>
                  {costCenters.map((cc) => (
                    <SelectItem key={cc.id} value={cc.id}>
                      {cc.code} – {cc.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Währung</Label>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CHF">CHF</SelectItem>
                  <SelectItem value="EUR">EUR</SelectItem>
                  <SelectItem value="USD">USD</SelectItem>
                  <SelectItem value="UGX">UGX</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Line Items */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <Label className="text-base">Budgetposten</Label>
              <Button type="button" variant="outline" size="sm" onClick={addLineItem}>
                <Plus className="h-4 w-4 mr-1" /> Posten hinzufügen
              </Button>
            </div>
            <div className="space-y-2">
              {lineItems.map((item, idx) => (
                <div key={idx} className="flex items-center gap-2 p-3 bg-muted rounded-lg border border-border">
                  <Select
                    value={item.category}
                    onValueChange={(v) => updateLineItem(idx, "category", v)}
                  >
                    <SelectTrigger className="w-[160px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map((c) => (
                        <SelectItem key={c.value} value={c.value}>
                          {c.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    value={item.label}
                    onChange={(e) => updateLineItem(idx, "label", e.target.value)}
                    placeholder="Bezeichnung"
                    className="flex-1"
                  />
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={item.amount}
                    onChange={(e) => updateLineItem(idx, "amount", e.target.value)}
                    placeholder="0.00"
                    className="w-32 text-right"
                  />
                  <span className="text-xs text-muted-foreground w-10">{currency}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeLineItem(idx)}
                    disabled={lineItems.length <= 1}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          {/* Total */}
          <div className="p-4 bg-accent/10 rounded-lg border border-accent/30">
            <div className="flex items-center justify-between">
              <span className="text-lg font-semibold text-foreground">Gesamt</span>
              <span className="text-xl font-bold text-accent">
                {new Intl.NumberFormat("de-CH", { style: "currency", currency }).format(total)}
              </span>
            </div>
          </div>

          {/* Notes */}
          <div>
            <Label>Notizen</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optionale Anmerkungen..."
              rows={2}
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
              Abbrechen
            </Button>
            <Button type="submit" disabled={isSubmitting || !costCenterId} className="flex-1">
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Budget erstellen
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
