import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Save, Loader2, ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { format } from "date-fns";
import { de } from "date-fns/locale";

interface CarrierRate {
  id: string;
  carrier_name: string;
  country: string;
  inbound_rate: number;
  outbound_rate: number;
  currency: string;
  effective_from: string;
  effective_until: string | null;
  is_active: boolean;
  notes: string | null;
  created_at: string;
}

const COUNTRIES = [
  { code: "UG", name: "Uganda" },
  { code: "KE", name: "Kenia" },
  { code: "TZ", name: "Tansania" },
  { code: "RW", name: "Ruanda" },
  { code: "CD", name: "DR Kongo" },
  { code: "SS", name: "Südsudan" },
  { code: "BI", name: "Burundi" },
  { code: "ET", name: "Äthiopien" },
  { code: "ZM", name: "Sambia" },
  { code: "MW", name: "Malawi" },
];

const CURRENCIES = ["USD", "EUR", "CHF", "UGX"];

export function CarrierRatesSettings() {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const [rates, setRates] = useState<CarrierRate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingRate, setEditingRate] = useState<CarrierRate | null>(null);

  // Form state
  const [carrierName, setCarrierName] = useState("");
  const [country, setCountry] = useState("");
  const [inboundRate, setInboundRate] = useState("");
  const [outboundRate, setOutboundRate] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [effectiveFrom, setEffectiveFrom] = useState(format(new Date(), "yyyy-MM-dd"));
  const [effectiveUntil, setEffectiveUntil] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [notes, setNotes] = useState("");

  useEffect(() => {
    fetchRates();
  }, []);

  const fetchRates = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("carrier_rates")
        .select("*")
        .order("country", { ascending: true })
        .order("carrier_name", { ascending: true });

      if (error) throw error;
      setRates(data || []);
    } catch (error) {
      console.error("Error fetching carrier rates:", error);
      toast({ title: "Fehler", description: "Rates konnten nicht geladen werden", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setCarrierName("");
    setCountry("");
    setInboundRate("");
    setOutboundRate("");
    setCurrency("USD");
    setEffectiveFrom(format(new Date(), "yyyy-MM-dd"));
    setEffectiveUntil("");
    setIsActive(true);
    setNotes("");
    setEditingRate(null);
  };

  const openEditDialog = (rate: CarrierRate) => {
    setEditingRate(rate);
    setCarrierName(rate.carrier_name);
    setCountry(rate.country);
    setInboundRate(rate.inbound_rate.toString());
    setOutboundRate(rate.outbound_rate.toString());
    setCurrency(rate.currency);
    setEffectiveFrom(rate.effective_from);
    setEffectiveUntil(rate.effective_until || "");
    setIsActive(rate.is_active);
    setNotes(rate.notes || "");
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!carrierName || !country || !inboundRate || !outboundRate) {
      toast({ title: "Fehler", description: "Bitte füllen Sie alle Pflichtfelder aus", variant: "destructive" });
      return;
    }

    setIsSaving(true);

    try {
      const rateData = {
        carrier_name: carrierName,
        country,
        inbound_rate: parseFloat(inboundRate),
        outbound_rate: parseFloat(outboundRate),
        currency,
        effective_from: effectiveFrom,
        effective_until: effectiveUntil || null,
        is_active: isActive,
        notes: notes || null,
        organization_id: profile?.organization_id,
        created_by: user?.id,
      };

      if (editingRate) {
        const { error } = await supabase
          .from("carrier_rates")
          .update(rateData)
          .eq("id", editingRate.id);

        if (error) throw error;
        toast({ title: "Gespeichert", description: "Rate wurde aktualisiert" });
      } else {
        const { error } = await supabase
          .from("carrier_rates")
          .insert(rateData);

        if (error) throw error;
        toast({ title: "Erstellt", description: "Neue Rate wurde hinzugefügt" });
      }

      setIsDialogOpen(false);
      resetForm();
      fetchRates();
    } catch (error) {
      console.error("Error saving carrier rate:", error);
      toast({ title: "Fehler", description: "Rate konnte nicht gespeichert werden", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Möchten Sie diese Rate wirklich löschen?")) return;

    try {
      const { error } = await supabase
        .from("carrier_rates")
        .delete()
        .eq("id", id);

      if (error) throw error;
      toast({ title: "Gelöscht", description: "Rate wurde entfernt" });
      fetchRates();
    } catch (error) {
      console.error("Error deleting carrier rate:", error);
      toast({ title: "Fehler", description: "Rate konnte nicht gelöscht werden", variant: "destructive" });
    }
  };

  const getCountryName = (code: string) => {
    return COUNTRIES.find(c => c.code === code)?.name || code;
  };

  const formatRate = (rate: number, currency: string) => {
    return new Intl.NumberFormat("de-CH", {
      style: "currency",
      currency,
      minimumFractionDigits: 4,
      maximumFractionDigits: 4,
    }).format(rate);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle>Carrier Rates</CardTitle>
          <CardDescription>
            Inbound und Outbound Rates für Mobilfunkanbieter verwalten
          </CardDescription>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Neue Rate
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>
                {editingRate ? "Rate bearbeiten" : "Neue Rate erstellen"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Label htmlFor="carrier">Carrier / Anbieter *</Label>
                  <Input
                    id="carrier"
                    value={carrierName}
                    onChange={(e) => setCarrierName(e.target.value)}
                    placeholder="z.B. MTN, Airtel, Safaricom"
                  />
                </div>
                <div>
                  <Label htmlFor="country">Land *</Label>
                  <Select value={country} onValueChange={setCountry}>
                    <SelectTrigger>
                      <SelectValue placeholder="Land wählen" />
                    </SelectTrigger>
                    <SelectContent>
                      {COUNTRIES.map((c) => (
                        <SelectItem key={c.code} value={c.code}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="currency">Währung</Label>
                  <Select value={currency} onValueChange={setCurrency}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CURRENCIES.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="inbound" className="flex items-center gap-2">
                    <ArrowDownLeft className="h-3 w-3 text-success" />
                    Inbound Rate *
                  </Label>
                  <Input
                    id="inbound"
                    type="number"
                    step="0.0001"
                    value={inboundRate}
                    onChange={(e) => setInboundRate(e.target.value)}
                    placeholder="0.0000"
                  />
                </div>
                <div>
                  <Label htmlFor="outbound" className="flex items-center gap-2">
                    <ArrowUpRight className="h-3 w-3 text-info" />
                    Outbound Rate *
                  </Label>
                  <Input
                    id="outbound"
                    type="number"
                    step="0.0001"
                    value={outboundRate}
                    onChange={(e) => setOutboundRate(e.target.value)}
                    placeholder="0.0000"
                  />
                </div>
                <div>
                  <Label htmlFor="effectiveFrom">Gültig ab *</Label>
                  <Input
                    id="effectiveFrom"
                    type="date"
                    value={effectiveFrom}
                    onChange={(e) => setEffectiveFrom(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="effectiveUntil">Gültig bis</Label>
                  <Input
                    id="effectiveUntil"
                    type="date"
                    value={effectiveUntil}
                    onChange={(e) => setEffectiveUntil(e.target.value)}
                  />
                </div>
                <div className="col-span-2 flex items-center gap-2">
                  <Switch
                    checked={isActive}
                    onCheckedChange={setIsActive}
                    id="isActive"
                  />
                  <Label htmlFor="isActive">Aktiv</Label>
                </div>
                <div className="col-span-2">
                  <Label htmlFor="notes">Notizen</Label>
                  <Textarea
                    id="notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Optionale Notizen..."
                    rows={2}
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                Abbrechen
              </Button>
              <Button onClick={handleSave} disabled={isSaving}>
                {isSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Speichern...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Speichern
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
            Laden...
          </div>
        ) : rates.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            Keine Carrier Rates vorhanden. Erstellen Sie die erste Rate.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Carrier</TableHead>
                <TableHead>Land</TableHead>
                <TableHead className="text-right">
                  <span className="flex items-center justify-end gap-1">
                    <ArrowDownLeft className="h-3 w-3 text-success" />
                    Inbound
                  </span>
                </TableHead>
                <TableHead className="text-right">
                  <span className="flex items-center justify-end gap-1">
                    <ArrowUpRight className="h-3 w-3 text-info" />
                    Outbound
                  </span>
                </TableHead>
                <TableHead>Gültig ab</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Aktionen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rates.map((rate) => (
                <TableRow key={rate.id}>
                  <TableCell className="font-medium">{rate.carrier_name}</TableCell>
                  <TableCell>{getCountryName(rate.country)}</TableCell>
                  <TableCell className="text-right font-mono text-sm">
                    {formatRate(rate.inbound_rate, rate.currency)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm">
                    {formatRate(rate.outbound_rate, rate.currency)}
                  </TableCell>
                  <TableCell>
                    {format(new Date(rate.effective_from), "dd.MM.yyyy", { locale: de })}
                    {rate.effective_until && (
                      <span className="text-muted-foreground">
                        {" - "}
                        {format(new Date(rate.effective_until), "dd.MM.yyyy", { locale: de })}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={rate.is_active ? "default" : "secondary"}>
                      {rate.is_active ? "Aktiv" : "Inaktiv"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEditDialog(rate)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(rate.id)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
