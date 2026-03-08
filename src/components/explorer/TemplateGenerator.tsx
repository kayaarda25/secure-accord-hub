import { useState, useEffect } from "react";
import { FileText, Download, FileType, BookUser, Save, Trash2, Globe } from "lucide-react";
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
  generateEmptyDocumentDocx,
  generateEmptyDocumentPdf,
  setLetterheadConfig,
  type ContractData,
  type PaymentInstructionData,
  type EmptyDocumentData,
} from "@/lib/documentGenerator";
import {
  CONTRACT_TYPES,
  LANGUAGE_OPTIONS,
  LABELS,
  getDefaultTerms,
  getContractPreamble,
  type DocLanguage,
  type ContractType,
} from "@/lib/legalTermsLibrary";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface TemplateGeneratorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface LetterheadPreset {
  id: string;
  preset_name: string;
  company_name: string;
  subtitle: string | null;
  address: string | null;
  primary_color: string | null;
  footer_text: string | null;
  is_default: boolean | null;
}

export function TemplateGenerator({ open, onOpenChange }: TemplateGeneratorProps) {
  const [activeTab, setActiveTab] = useState("contract");
  const [docLanguage, setDocLanguage] = useState<DocLanguage>("de");
  const [letterheadPresets, setLetterheadPresets] = useState<LetterheadPreset[]>([]);
  const [selectedPresetId, setSelectedPresetId] = useState<string>("");
  const [savedAddresses, setSavedAddresses] = useState<Array<{ id: string; label: string; full_address: string }>>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string>("new");
  const [saveAddressLabel, setSaveAddressLabel] = useState("");
  const [showSaveAddress, setShowSaveAddress] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    if (open && user) {
      loadLetterheadPresets();
      loadSavedAddresses();
    }
  }, [open, user]);

  const loadSavedAddresses = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("saved_addresses")
      .select("id, label, full_address")
      .eq("user_id", user.id)
      .order("label");
    if (data) setSavedAddresses(data);
  };

  const handleSaveAddress = async (addressText: string) => {
    if (!user || !saveAddressLabel.trim() || !addressText.trim()) {
      toast.error("Bitte Label und Adresse eingeben");
      return;
    }
    const { error } = await supabase.from("saved_addresses").insert({
      user_id: user.id,
      label: saveAddressLabel.trim(),
      name: addressText.split("\n")[0] || saveAddressLabel.trim(),
      full_address: addressText.trim(),
    });
    if (error) {
      toast.error("Fehler beim Speichern der Adresse");
    } else {
      toast.success("Adresse gespeichert");
      setSaveAddressLabel("");
      setShowSaveAddress(false);
      loadSavedAddresses();
    }
  };

  const handleDeleteAddress = async (id: string) => {
    const { error } = await supabase.from("saved_addresses").delete().eq("id", id);
    if (error) {
      toast.error("Fehler beim Löschen");
    } else {
      toast.success("Adresse gelöscht");
      setSelectedAddressId("new");
      loadSavedAddresses();
    }
  };

  const handleSelectAddress = (addressId: string) => {
    setSelectedAddressId(addressId);
    if (addressId === "new") return;
    const addr = savedAddresses.find(a => a.id === addressId);
    if (addr) {
      if (activeTab === "empty") {
        setEmptyDocData(prev => ({ ...prev, recipient: addr.full_address }));
      } else if (activeTab === "payment") {
        setPaymentData(prev => ({ ...prev, recipient: addr.full_address }));
      }
    }
  };

  const loadLetterheadPresets = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("letterhead_settings")
      .select("*")
      .eq("user_id", user.id)
      .order("preset_name");
    if (data && data.length > 0) {
      setLetterheadPresets(data);
      const defaultPreset = data.find(p => p.is_default) || data[0];
      setSelectedPresetId(defaultPreset.id);
      applyPreset(defaultPreset);
    }
  };

  const applyPreset = (preset: LetterheadPreset) => {
    setLetterheadConfig({
      companyName: preset.company_name,
      subtitle: preset.subtitle || "",
      address: preset.address || "",
      primaryColor: "000000",
      footerText: preset.footer_text || "Confidential",
    });
  };

  const handlePresetChange = (presetId: string) => {
    setSelectedPresetId(presetId);
    const preset = letterheadPresets.find(p => p.id === presetId);
    if (preset) applyPreset(preset);
  };
  
  // Contract state
  const [contractType, setContractType] = useState<ContractType>("service");
  const [contractData, setContractData] = useState<ContractData>({
    title: LABELS.de.contractTitle.service,
    contractNumber: "",
    date: new Date().toLocaleDateString("de-CH"),
    language: "de",
    contractType: "service",
    partyA: { name: "", address: "", representative: "" },
    partyB: { name: "", address: "", representative: "" },
    preamble: getContractPreamble("service", "de"),
    terms: getDefaultTerms("service", "de"),
    value: "",
    currency: "CHF",
    duration: "12 Monate",
    specialClauses: [],
  });

  // When contract type or language changes, update terms
  const handleContractTypeChange = (type: ContractType) => {
    setContractType(type);
    const terms = getDefaultTerms(type, docLanguage);
    const preamble = getContractPreamble(type, docLanguage);
    const title = LABELS[docLanguage].contractTitle[type];
    setContractData(prev => ({
      ...prev,
      contractType: type,
      language: docLanguage,
      terms,
      preamble,
      title,
    }));
  };

  const handleDocLanguageChange = (lang: DocLanguage) => {
    setDocLanguage(lang);
    const terms = getDefaultTerms(contractType, lang);
    const preamble = getContractPreamble(contractType, lang);
    const title = LABELS[lang].contractTitle[contractType];
    setContractData(prev => ({
      ...prev,
      language: lang,
      terms,
      preamble,
      title,
    }));
  };

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

  // Empty document state
  const [emptyDocData, setEmptyDocData] = useState<EmptyDocumentData>({
    title: "Dokument",
    recipient: "",
    location: "",
    content: "",
    date: new Date().toLocaleDateString("de-CH"),
  });

  const handleGenerateContract = (format: "pdf" | "docx") => {
    if (!contractData.partyA.name || !contractData.partyB.name) {
      toast.error("Bitte füllen Sie die Partei-Informationen aus");
      return;
    }
    try {
      const dataWithLang = { ...contractData, language: docLanguage, contractType };
      if (format === "pdf") {
        generateContractPdf(dataWithLang);
      } else {
        generateContractDocx(dataWithLang);
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
      const dataWithLang = { ...paymentData, language: docLanguage };
      if (format === "pdf") {
        generatePaymentInstructionPdf(dataWithLang);
      } else {
        generatePaymentInstructionDocx(dataWithLang);
      }
      toast.success(`Zahlungsanweisung als ${format.toUpperCase()} generiert`);
    } catch (error) {
      toast.error("Fehler beim Generieren der Zahlungsanweisung");
      console.error(error);
    }
  };

  const handleGenerateEmpty = (format: "pdf" | "docx") => {
    if (!emptyDocData.title || !emptyDocData.content) {
      toast.error("Bitte geben Sie Titel und Inhalt ein");
      return;
    }
    try {
      const dataWithLang = { ...emptyDocData, language: docLanguage };
      if (format === "pdf") {
        generateEmptyDocumentPdf(dataWithLang);
      } else {
        generateEmptyDocumentDocx(dataWithLang);
      }
      toast.success(`Dokument als ${format.toUpperCase()} generiert`);
    } catch (error) {
      toast.error("Fehler beim Generieren des Dokuments");
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

  const l = LABELS[docLanguage];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText size={20} />
            Dokumentvorlage generieren
          </DialogTitle>
        </DialogHeader>

        {/* Language + Letterhead Selection */}
        <div className="flex gap-3 pb-3 border-b">
          {/* Document Language */}
          <div className="flex-1 space-y-1">
            <Label className="text-xs text-muted-foreground flex items-center gap-1">
              <Globe size={12} />
              Dokumentsprache
            </Label>
            <Select value={docLanguage} onValueChange={(v) => handleDocLanguageChange(v as DocLanguage)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LANGUAGE_OPTIONS.map((lang) => (
                  <SelectItem key={lang.value} value={lang.value}>
                    <span className="flex items-center gap-2">
                      <span>{lang.flag}</span>
                      <span>{lang.label}</span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Letterhead Preset */}
          {letterheadPresets.length > 0 && (
            <div className="flex-1 space-y-1">
              <Label className="text-xs text-muted-foreground">Briefkopf-Preset</Label>
              <Select value={selectedPresetId} onValueChange={handlePresetChange}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Briefkopf wählen..." />
                </SelectTrigger>
                <SelectContent>
                  {letterheadPresets.map((preset) => (
                    <SelectItem key={preset.id} value={preset.id}>
                      {preset.preset_name}
                      {preset.is_default && " (Standard)"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 overflow-hidden flex flex-col">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="contract">Vertrag</TabsTrigger>
            <TabsTrigger value="payment">Zahlungsanweisung</TabsTrigger>
            <TabsTrigger value="empty">Leeres Dokument</TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-y-auto mt-4">
            <TabsContent value="contract" className="m-0 space-y-4">
              {/* Contract Type Selection */}
              <div className="space-y-2">
                <Label>Vertragsart</Label>
                <Select value={contractType} onValueChange={(v) => handleContractTypeChange(v as ContractType)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CONTRACT_TYPES.map(t => (
                      <SelectItem key={t.id} value={t.id}>
                        <div>
                          <div className="font-medium">{t.names[docLanguage]}</div>
                          <div className="text-xs text-muted-foreground">{t.descriptions[docLanguage]}</div>
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
              <div className="space-y-3 p-4 rounded-lg border border-border">
                <h4 className="font-semibold text-sm">{l.partyA}</h4>
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
                    <Label className="text-xs">{l.representative}</Label>
                    <Input
                      value={contractData.partyA.representative || ""}
                      onChange={(e) => updateContractParty("partyA", "representative", e.target.value)}
                      placeholder="Name des Vertreters"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">{l.address}</Label>
                  <Input
                    value={contractData.partyA.address}
                    onChange={(e) => updateContractParty("partyA", "address", e.target.value)}
                    placeholder="Vollständige Adresse"
                  />
                </div>
              </div>

              {/* Party B */}
              <div className="space-y-3 p-4 rounded-lg border border-border">
                <h4 className="font-semibold text-sm">{l.partyB}</h4>
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
                    <Label className="text-xs">{l.representative}</Label>
                    <Input
                      value={contractData.partyB.representative || ""}
                      onChange={(e) => updateContractParty("partyB", "representative", e.target.value)}
                      placeholder="Name des Vertreters"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">{l.address}</Label>
                  <Input
                    value={contractData.partyB.address}
                    onChange={(e) => updateContractParty("partyB", "address", e.target.value)}
                    placeholder="Vollständige Adresse"
                  />
                </div>
              </div>

              {/* Preamble */}
              <div className="space-y-2">
                <Label>{l.preamble}</Label>
                <Textarea
                  value={contractData.preamble || ""}
                  onChange={(e) => setContractData(prev => ({ ...prev, preamble: e.target.value }))}
                  className="min-h-[80px] font-serif text-sm"
                  placeholder="Präambel / Einleitung..."
                />
              </div>

              {/* Contract Terms (Articles) */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>{l.terms}</Label>
                  <Button variant="outline" size="sm" onClick={addContractTerm}>
                    Artikel hinzufügen
                  </Button>
                </div>
                {contractData.terms.map((term, index) => {
                  const parts = term.split("\n");
                  const title = parts[0];
                  return (
                    <div key={index} className="space-y-1 p-3 rounded border border-border/50">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-muted-foreground">
                          Artikel {index + 1}
                        </span>
                        {contractData.terms.length > 1 && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 text-destructive text-xs"
                            onClick={() => removeContractTerm(index)}
                          >
                            ×
                          </Button>
                        )}
                      </div>
                      <Textarea
                        value={term}
                        onChange={(e) => updateContractTerm(index, e.target.value)}
                        className="min-h-[100px] text-sm font-serif"
                        placeholder="Titel&#10;Artikeltext..."
                      />
                    </div>
                  );
                })}
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
              <div className="space-y-3 p-4 rounded-lg border border-border">
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
              <div className="space-y-3 p-4 rounded-lg border border-border">
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
                  <Label className="text-xs">Inhalt / Bemerkungen</Label>
                  <Textarea
                    value={paymentData.notes || ""}
                    onChange={(e) => setPaymentData(prev => ({ ...prev, notes: e.target.value }))}
                    placeholder="Sehr geehrte Damen und Herren,&#10;&#10;Bitte überweisen Sie den oben genannten Betrag...&#10;&#10;Mit freundlichen Grüssen"
                    className="min-h-[180px] font-normal"
                  />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="empty" className="m-0 space-y-4">
              <div className="space-y-4">
                {/* Recipient Address with saved addresses */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Empfänger-Adresse</Label>
                    <div className="flex items-center gap-2">
                      {savedAddresses.length > 0 && (
                        <Select value={selectedAddressId} onValueChange={handleSelectAddress}>
                          <SelectTrigger className="w-[200px] h-8 text-xs">
                            <BookUser size={14} className="mr-1" />
                            <SelectValue placeholder="Gespeicherte Adresse" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="new">Neue Adresse</SelectItem>
                            {savedAddresses.map((addr) => (
                              <SelectItem key={addr.id} value={addr.id}>
                                {addr.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                      {selectedAddressId !== "new" && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive"
                          onClick={() => handleDeleteAddress(selectedAddressId)}
                          title="Adresse löschen"
                        >
                          <Trash2 size={14} />
                        </Button>
                      )}
                    </div>
                  </div>
                  <Textarea
                    value={emptyDocData.recipient || ""}
                    onChange={(e) => {
                      setEmptyDocData(prev => ({ ...prev, recipient: e.target.value }));
                      setSelectedAddressId("new");
                    }}
                    placeholder="Name&#10;Strasse und Hausnummer&#10;PLZ Ort&#10;Land"
                    className="min-h-[100px] font-normal"
                  />
                  {emptyDocData.recipient && selectedAddressId === "new" && (
                    <>
                      {!showSaveAddress ? (
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-xs"
                          onClick={() => setShowSaveAddress(true)}
                        >
                          <Save size={14} className="mr-1" />
                          Adresse speichern
                        </Button>
                      ) : (
                        <div className="flex gap-2">
                          <Input
                            value={saveAddressLabel}
                            onChange={(e) => setSaveAddressLabel(e.target.value)}
                            placeholder="Bezeichnung (z.B. Firma XY)"
                            className="h-8 text-xs"
                          />
                          <Button
                            size="sm"
                            className="h-8 text-xs"
                            onClick={() => handleSaveAddress(emptyDocData.recipient || "")}
                          >
                            Speichern
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 text-xs"
                            onClick={() => { setShowSaveAddress(false); setSaveAddressLabel(""); }}
                          >
                            ×
                          </Button>
                        </div>
                      )}
                    </>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Titel *</Label>
                  <Input
                    value={emptyDocData.title}
                    onChange={(e) => setEmptyDocData(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="Betreff / Titel"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Ort</Label>
                    <Input
                      value={emptyDocData.location || ""}
                      onChange={(e) => setEmptyDocData(prev => ({ ...prev, location: e.target.value }))}
                      placeholder="z.B. Zürich"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Datum</Label>
                    <Input
                      value={emptyDocData.date}
                      onChange={(e) => setEmptyDocData(prev => ({ ...prev, date: e.target.value }))}
                      placeholder="Datum"
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label>Inhalt *</Label>
                  <Textarea
                    value={emptyDocData.content}
                    onChange={(e) => setEmptyDocData(prev => ({ ...prev, content: e.target.value }))}
                    placeholder="Sehr geehrte Damen und Herren,&#10;&#10;...&#10;&#10;Mit freundlichen Grüssen"
                    className="min-h-[220px] font-normal"
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
                onClick={() => {
                  if (activeTab === "contract") handleGenerateContract("pdf");
                  else if (activeTab === "payment") handleGeneratePayment("pdf");
                  else handleGenerateEmpty("pdf");
                }}
              >
                <FileText size={16} className="mr-2" />
                Als PDF herunterladen
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  if (activeTab === "contract") handleGenerateContract("docx");
                  else if (activeTab === "payment") handleGeneratePayment("docx");
                  else handleGenerateEmpty("docx");
                }}
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
