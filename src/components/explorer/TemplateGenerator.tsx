import { useState, useEffect } from "react";
import { FileText, Download, FileType } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  generateContractDocx,
  generateContractPdf,
  generatePaymentInstructionDocx,
  generatePaymentInstructionPdf,
  setLetterheadConfig,
  type ContractData,
  type PaymentInstructionData,
} from "@/lib/documentGenerator";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface TemplateGeneratorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const CONTRACT_TEMPLATES = [
  { id: "standard", name: "Standard-Vertrag", description: "Allgemeiner Geschäftsvertrag" },
  { id: "service", name: "Dienstleistungsvertrag", description: "Für Dienstleistungen und Beratung" },
  { id: "partnership", name: "Partnerschaftsvertrag", description: "Für Kooperationen und Joint Ventures" },
  { id: "nda", name: "Vertraulichkeitsvereinbarung", description: "NDA / Geheimhaltungsvertrag" },
];

export function TemplateGenerator({ open, onOpenChange }: TemplateGeneratorProps) {
  const [activeTab, setActiveTab] = useState("contract");
  const { user } = useAuth();

  // Load letterhead settings when dialog opens
  useEffect(() => {
    if (open && user) {
      loadLetterheadSettings();
    }
  }, [open, user]);

  const loadLetterheadSettings = async () => {
    if (!user) return;
    
    const { data } = await supabase
      .from("letterhead_settings")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (data) {
      setLetterheadConfig({
        companyName: data.company_name,
        subtitle: data.subtitle || "",
        address: data.address || "",
        primaryColor: data.primary_color || "#c97c5d",
        footerText: data.footer_text || "Confidential",
      });
    }
  };
  
  // Contract state
  const [contractTemplate, setContractTemplate] = useState("standard");
  const [contractData, setContractData] = useState<ContractData>({
    title: "Kooperationsvertrag",
    contractNumber: "",
    date: new Date().toLocaleDateString("de-CH"),
    partyA: { name: "", address: "", representative: "" },
    partyB: { name: "", address: "", representative: "" },
    terms: [
      "Die Parteien vereinbaren eine Zusammenarbeit im Bereich der staatlichen Kooperation.",
      "Die Vertragslaufzeit beginnt mit Unterzeichnung und endet nach 12 Monaten.",
      "Beide Parteien verpflichten sich zur Vertraulichkeit bezüglich aller ausgetauschten Informationen.",
    ],
    value: "",
    currency: "CHF",
    duration: "12 Monate",
    specialClauses: [],
  });

  // Payment instruction state
  const [paymentData, setPaymentData] = useState<PaymentInstructionData>({
    recipient: "",
    iban: "",
    bic: "",
    bankName: "",
    amount: "",
    currency: "CHF",
    reference: "",
    purpose: "",
    dueDate: "",
  });

  const handleGenerateContract = (format: "pdf" | "docx") => {
    if (!contractData.partyA.name || !contractData.partyB.name) {
      toast.error("Bitte füllen Sie die Partei-Informationen aus");
      return;
    }

    try {
      if (format === "pdf") {
        generateContractPdf(contractData);
      } else {
        generateContractDocx(contractData);
      }
      toast.success(`Vertrag als ${format.toUpperCase()} generiert`);
    } catch (error) {
      toast.error("Fehler beim Generieren des Vertrags");
      console.error(error);
    }
  };

  const handleGeneratePayment = (format: "pdf" | "docx") => {
    if (!paymentData.recipient || !paymentData.iban || !paymentData.amount) {
      toast.error("Bitte füllen Sie alle Pflichtfelder aus");
      return;
    }

    try {
      if (format === "pdf") {
        generatePaymentInstructionPdf(paymentData);
      } else {
        generatePaymentInstructionDocx(paymentData);
      }
      toast.success(`Zahlungsanweisung als ${format.toUpperCase()} generiert`);
    } catch (error) {
      toast.error("Fehler beim Generieren der Zahlungsanweisung");
      console.error(error);
    }
  };

  const updateContractParty = (party: "partyA" | "partyB", field: string, value: string) => {
    setContractData(prev => ({
      ...prev,
      [party]: { ...prev[party], [field]: value }
    }));
  };

  const updateContractTerm = (index: number, value: string) => {
    setContractData(prev => ({
      ...prev,
      terms: prev.terms.map((t, i) => i === index ? value : t)
    }));
  };

  const addContractTerm = () => {
    setContractData(prev => ({
      ...prev,
      terms: [...prev.terms, ""]
    }));
  };

  const removeContractTerm = (index: number) => {
    setContractData(prev => ({
      ...prev,
      terms: prev.terms.filter((_, i) => i !== index)
    }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText size={20} className="text-accent" />
            Dokument-Vorlage generieren
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 overflow-hidden flex flex-col">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="contract">Vertrag</TabsTrigger>
            <TabsTrigger value="payment">Zahlungsanweisung</TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-y-auto mt-4">
            <TabsContent value="contract" className="m-0 space-y-4">
              {/* Template Selection */}
              <div className="space-y-2">
                <Label>Vorlage</Label>
                <Select value={contractTemplate} onValueChange={setContractTemplate}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CONTRACT_TEMPLATES.map(t => (
                      <SelectItem key={t.id} value={t.id}>
                        <div>
                          <div className="font-medium">{t.name}</div>
                          <div className="text-xs text-muted-foreground">{t.description}</div>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Titel</Label>
                  <Input
                    value={contractData.title}
                    onChange={(e) => setContractData(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="Vertragsbezeichnung"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Vertragsnummer</Label>
                  <Input
                    value={contractData.contractNumber}
                    onChange={(e) => setContractData(prev => ({ ...prev, contractNumber: e.target.value }))}
                    placeholder="z.B. MGI-2024-001"
                  />
                </div>
              </div>

              {/* Party A */}
              <div className="space-y-3 p-4 rounded-lg bg-muted/30 border border-border/50">
                <h4 className="font-semibold text-sm">Partei A (Auftraggeber)</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label className="text-xs">Name / Firma</Label>
                    <Input
                      value={contractData.partyA.name}
                      onChange={(e) => updateContractParty("partyA", "name", e.target.value)}
                      placeholder="Firma / Organisation"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Vertreter</Label>
                    <Input
                      value={contractData.partyA.representative || ""}
                      onChange={(e) => updateContractParty("partyA", "representative", e.target.value)}
                      placeholder="Name des Vertreters"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Adresse</Label>
                  <Input
                    value={contractData.partyA.address}
                    onChange={(e) => updateContractParty("partyA", "address", e.target.value)}
                    placeholder="Vollständige Adresse"
                  />
                </div>
              </div>

              {/* Party B */}
              <div className="space-y-3 p-4 rounded-lg bg-muted/30 border border-border/50">
                <h4 className="font-semibold text-sm">Partei B (Auftragnehmer)</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label className="text-xs">Name / Firma</Label>
                    <Input
                      value={contractData.partyB.name}
                      onChange={(e) => updateContractParty("partyB", "name", e.target.value)}
                      placeholder="Firma / Organisation"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Vertreter</Label>
                    <Input
                      value={contractData.partyB.representative || ""}
                      onChange={(e) => updateContractParty("partyB", "representative", e.target.value)}
                      placeholder="Name des Vertreters"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Adresse</Label>
                  <Input
                    value={contractData.partyB.address}
                    onChange={(e) => updateContractParty("partyB", "address", e.target.value)}
                    placeholder="Vollständige Adresse"
                  />
                </div>
              </div>

              {/* Contract Terms */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Vertragsbedingungen</Label>
                  <Button variant="outline" size="sm" onClick={addContractTerm}>
                    Bedingung hinzufügen
                  </Button>
                </div>
                {contractData.terms.map((term, index) => (
                  <div key={index} className="flex gap-2">
                    <span className="text-sm font-medium text-muted-foreground w-6 pt-2">
                      {index + 1}.
                    </span>
                    <Textarea
                      value={term}
                      onChange={(e) => updateContractTerm(index, e.target.value)}
                      className="flex-1 min-h-[60px]"
                      placeholder="Vertragsbedingung..."
                    />
                    {contractData.terms.length > 1 && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive"
                        onClick={() => removeContractTerm(index)}
                      >
                        ×
                      </Button>
                    )}
                  </div>
                ))}
              </div>

              {/* Value & Duration */}
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Vertragswert</Label>
                  <Input
                    value={contractData.value || ""}
                    onChange={(e) => setContractData(prev => ({ ...prev, value: e.target.value }))}
                    placeholder="z.B. 50'000"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Währung</Label>
                  <Select 
                    value={contractData.currency} 
                    onValueChange={(v) => setContractData(prev => ({ ...prev, currency: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CHF">CHF</SelectItem>
                      <SelectItem value="EUR">EUR</SelectItem>
                      <SelectItem value="USD">USD</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Laufzeit</Label>
                  <Input
                    value={contractData.duration || ""}
                    onChange={(e) => setContractData(prev => ({ ...prev, duration: e.target.value }))}
                    placeholder="z.B. 12 Monate"
                  />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="payment" className="m-0 space-y-4">
              {/* Recipient Info */}
              <div className="space-y-3 p-4 rounded-lg bg-muted/30 border border-border/50">
                <h4 className="font-semibold text-sm">Empfänger</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2 col-span-2">
                    <Label className="text-xs">Name / Firma *</Label>
                    <Input
                      value={paymentData.recipient}
                      onChange={(e) => setPaymentData(prev => ({ ...prev, recipient: e.target.value }))}
                      placeholder="Empfängername"
                    />
                  </div>
                  <div className="space-y-2 col-span-2">
                    <Label className="text-xs">IBAN *</Label>
                    <Input
                      value={paymentData.iban}
                      onChange={(e) => setPaymentData(prev => ({ ...prev, iban: e.target.value }))}
                      placeholder="CH00 0000 0000 0000 0000 0"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">BIC/SWIFT</Label>
                    <Input
                      value={paymentData.bic || ""}
                      onChange={(e) => setPaymentData(prev => ({ ...prev, bic: e.target.value }))}
                      placeholder="XXXXCHXX"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Bank</Label>
                    <Input
                      value={paymentData.bankName}
                      onChange={(e) => setPaymentData(prev => ({ ...prev, bankName: e.target.value }))}
                      placeholder="Bankname"
                    />
                  </div>
                </div>
              </div>

              {/* Payment Details */}
              <div className="space-y-3 p-4 rounded-lg bg-muted/30 border border-border/50">
                <h4 className="font-semibold text-sm">Zahlungsdetails</h4>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-2">
                    <Label className="text-xs">Betrag *</Label>
                    <Input
                      value={paymentData.amount}
                      onChange={(e) => setPaymentData(prev => ({ ...prev, amount: e.target.value }))}
                      placeholder="10'000.00"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Währung</Label>
                    <Select 
                      value={paymentData.currency} 
                      onValueChange={(v) => setPaymentData(prev => ({ ...prev, currency: v }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="CHF">CHF</SelectItem>
                        <SelectItem value="EUR">EUR</SelectItem>
                        <SelectItem value="USD">USD</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Fälligkeitsdatum</Label>
                    <Input
                      type="date"
                      value={paymentData.dueDate || ""}
                      onChange={(e) => setPaymentData(prev => ({ ...prev, dueDate: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Referenz / Zahlungszweck</Label>
                  <Input
                    value={paymentData.reference}
                    onChange={(e) => setPaymentData(prev => ({ ...prev, reference: e.target.value }))}
                    placeholder="Rechnungsnummer oder Referenz"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Verwendungszweck</Label>
                  <Textarea
                    value={paymentData.purpose}
                    onChange={(e) => setPaymentData(prev => ({ ...prev, purpose: e.target.value }))}
                    placeholder="Beschreibung des Zahlungszwecks"
                    className="min-h-[60px]"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Bemerkungen (optional)</Label>
                  <Textarea
                    value={paymentData.notes || ""}
                    onChange={(e) => setPaymentData(prev => ({ ...prev, notes: e.target.value }))}
                    placeholder="Zusätzliche Anmerkungen oder Hinweise"
                    className="min-h-[60px]"
                  />
                </div>
              </div>
            </TabsContent>
          </div>
        </Tabs>

        <DialogFooter className="mt-4 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Abbrechen
          </Button>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button>
                <Download size={16} className="mr-2" />
                Generieren
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => activeTab === "contract" 
                  ? handleGenerateContract("pdf") 
                  : handleGeneratePayment("pdf")
                }
              >
                <FileText size={16} className="mr-2" />
                Als PDF herunterladen
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => activeTab === "contract" 
                  ? handleGenerateContract("docx") 
                  : handleGeneratePayment("docx")
                }
              >
                <FileType size={16} className="mr-2" />
                Als Word (.docx) herunterladen
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
