import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Plus, Trash2, Loader2, ChevronDown, ChevronRight } from "lucide-react";

interface SubItem {
  label: string;
  amount: string;
}

interface CategoryGroup {
  category: string;
  items: SubItem[];
  isOpen: boolean;
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
  isGatewayUser: boolean;
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
  isGatewayUser,
  onSubmit,
}: CreateOpexBudgetDialogProps) {
  const [period, setPeriod] = useState(new Date().toISOString().slice(0, 7));
  const [costCenterId, setCostCenterId] = useState("");
  const [currency, setCurrency] = useState("CHF");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [categoryGroups, setCategoryGroups] = useState<CategoryGroup[]>(
    CATEGORIES.map((c) => ({
      category: c.value,
      items: [{ label: "", amount: "" }],
      isOpen: false,
    }))
  );

  const toggleCategory = (idx: number) => {
    setCategoryGroups((prev) =>
      prev.map((g, i) => (i === idx ? { ...g, isOpen: !g.isOpen } : g))
    );
  };

  const addSubItem = (catIdx: number) => {
    setCategoryGroups((prev) =>
      prev.map((g, i) =>
        i === catIdx ? { ...g, items: [...g.items, { label: "", amount: "" }] } : g
      )
    );
  };

  const removeSubItem = (catIdx: number, itemIdx: number) => {
    setCategoryGroups((prev) =>
      prev.map((g, i) =>
        i === catIdx && g.items.length > 1
          ? { ...g, items: g.items.filter((_, j) => j !== itemIdx) }
          : g
      )
    );
  };

  const updateSubItem = (catIdx: number, itemIdx: number, field: keyof SubItem, value: string) => {
    setCategoryGroups((prev) =>
      prev.map((g, i) =>
        i === catIdx
          ? {
              ...g,
              items: g.items.map((item, j) =>
                j === itemIdx ? { ...item, [field]: value } : item
              ),
            }
          : g
      )
    );
  };

  const getCategoryTotal = (group: CategoryGroup) =>
    group.items.reduce((s, item) => s + (parseFloat(item.amount) || 0), 0);

  const grandTotal = categoryGroups.reduce((s, g) => s + getCategoryTotal(g), 0);

  const getOrgLabel = (cc: CostCenter) => {
    if (cc.code.startsWith("MGIM") || cc.code.startsWith("MGIC")) {
      return isGatewayUser ? "MGI" : cc.code.startsWith("MGIM") ? "MGI Media" : "MGI Communications";
    }
    return "Gateway";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!costCenterId) return;

    let sortOrder = 0;
    const lineItems: { category: string; label: string; amount: number; sort_order: number }[] = [];

    for (const group of categoryGroups) {
      for (const item of group.items) {
        const amt = parseFloat(item.amount) || 0;
        if (amt > 0 && item.label.trim()) {
          lineItems.push({
            category: group.category,
            label: item.label.trim(),
            amount: amt,
            sort_order: sortOrder++,
          });
        }
      }
    }

    if (lineItems.length === 0) return;

    setIsSubmitting(true);
    const result = await onSubmit(costCenterId, null, period, currency, notes, lineItems);
    setIsSubmitting(false);

    if (result) {
      setPeriod(new Date().toISOString().slice(0, 7));
      setCostCenterId("");
      setNotes("");
      setCategoryGroups(
        CATEGORIES.map((c) => ({
          category: c.value,
          items: [{ label: "", amount: "" }],
          isOpen: false,
        }))
      );
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[750px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Neue OPEX erstellen</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Meta */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <Label>Periode *</Label>
              <Input type="month" value={period} onChange={(e) => setPeriod(e.target.value)} required />
            </div>
            <div>
              <Label>Organisation *</Label>
              <Select value={costCenterId} onValueChange={setCostCenterId}>
                <SelectTrigger>
                  <SelectValue placeholder="Auswählen..." />
                </SelectTrigger>
                <SelectContent>
                  {costCenters.map((cc) => (
                    <SelectItem key={cc.id} value={cc.id}>
                      {getOrgLabel(cc)}
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

          {/* Categories with sub-items */}
          <div>
            <Label className="text-base mb-3 block">Ausgaben nach Kategorie</Label>
            <div className="space-y-1">
              {categoryGroups.map((group, catIdx) => {
                const catLabel = CATEGORIES.find((c) => c.value === group.category)?.label || group.category;
                const catTotal = getCategoryTotal(group);
                const hasValues = catTotal > 0;

                return (
                  <div
                    key={group.category}
                    className={`rounded-lg border transition-colors ${
                      hasValues ? "border-accent/30 bg-accent/5" : "border-border"
                    }`}
                  >
                    <Collapsible open={group.isOpen} onOpenChange={() => toggleCategory(catIdx)}>
                      <CollapsibleTrigger className="w-full">
                        <div className="flex items-center justify-between p-3 hover:bg-muted/50 transition-colors rounded-lg">
                          <div className="flex items-center gap-2">
                            {group.isOpen ? (
                              <ChevronDown className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <ChevronRight className="h-4 w-4 text-muted-foreground" />
                            )}
                            <span className="text-sm font-medium text-foreground">{catLabel}</span>
                            {group.items.length > 1 && (
                              <span className="text-xs text-muted-foreground">
                                ({group.items.length} Posten)
                              </span>
                            )}
                          </div>
                          <span
                            className={`text-sm font-semibold ${
                              hasValues ? "text-accent" : "text-muted-foreground"
                            }`}
                          >
                            {new Intl.NumberFormat("de-CH", {
                              style: "currency",
                              currency,
                            }).format(catTotal)}
                          </span>
                        </div>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="px-3 pb-3 space-y-2">
                          {group.items.map((item, itemIdx) => (
                            <div key={itemIdx} className="flex items-center gap-2">
                              <Input
                                value={item.label}
                                onChange={(e) => updateSubItem(catIdx, itemIdx, "label", e.target.value)}
                                placeholder={`z.B. ${catLabel} Posten ${itemIdx + 1}`}
                                className="flex-1"
                              />
                              <Input
                                type="number"
                                step="0.01"
                                min="0"
                                value={item.amount}
                                onChange={(e) => updateSubItem(catIdx, itemIdx, "amount", e.target.value)}
                                placeholder="0.00"
                                className="w-32 text-right"
                              />
                              <span className="text-xs text-muted-foreground w-8">{currency}</span>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => removeSubItem(catIdx, itemIdx)}
                                disabled={group.items.length <= 1}
                                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          ))}
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => addSubItem(catIdx)}
                            className="text-xs text-muted-foreground hover:text-foreground"
                          >
                            <Plus className="h-3 w-3 mr-1" /> Posten hinzufügen
                          </Button>
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Total */}
          <div className="p-4 bg-accent/10 rounded-lg border border-accent/30">
            <div className="flex items-center justify-between">
              <span className="text-lg font-semibold text-foreground">Gesamt</span>
              <span className="text-xl font-bold text-accent">
                {new Intl.NumberFormat("de-CH", { style: "currency", currency }).format(grandTotal)}
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
            <Button type="submit" disabled={isSubmitting || !costCenterId || grandTotal === 0} className="flex-1">
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              OPEX erstellen
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
