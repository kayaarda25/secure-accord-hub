import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Download, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

// Telecom providers list
const TELECOM_PROVIDERS = [
  "Movicel",
  "Angola Telecom",
  "Unitel",
  "Africell",
  "SARA3COM",
  "Multitel",
  "Tchoca",
  "MS Telecom",
];

interface ProviderData {
  minutes: string;
  usd: string;
}

interface DeclarationFormData {
  country: string;
  declarationType: string;
  periodStart: string;
  periodEnd: string;
  mgiIncomingRevenue: Record<string, ProviderData>;
  mgiOutgoingCost: Record<string, ProviderData>;
  opexMgi: string;
  giaOutgoingRevenue: Record<string, ProviderData>;
  giaIncomingCost: Record<string, ProviderData>;
  opexGia: string;
  grxFiscalization: string;
  networkManagementSystem: string;
  marginSplitInfosi: string;
  marginSplitMgi: string;
  notes: string;
}

interface CarrierRate {
  id: string;
  carrier_name: string;
  country: string;
  inbound_rate: number;
  outbound_rate: number;
  currency: string;
  is_active: boolean;
}

interface DeclarationFormProps {
  onSubmit: (data: DeclarationFormData, totals: {
    mgiIncomingTotals: { minutes: number; usd: number };
    mgiOutgoingTotals: { minutes: number; usd: number };
    giaOutgoingTotals: { minutes: number; usd: number };
    giaIncomingTotals: { minutes: number; usd: number };
    totalMgiBalance: number;
    totalGiaBalance: number;
    marginHeld: number;
    infosiShare: number;
    mgiShare: number;
  }) => Promise<void>;
  onCancel: () => void;
  isSubmitting: boolean;
}

const createEmptyProviderData = (): Record<string, ProviderData> => {
  return Object.fromEntries(
    TELECOM_PROVIDERS.map(provider => [provider, { minutes: "", usd: "" }])
  );
};

export function DeclarationForm({ onSubmit, onCancel, isSubmitting }: DeclarationFormProps) {
  const [carrierRates, setCarrierRates] = useState<CarrierRate[]>([]);
  const [formData, setFormData] = useState<DeclarationFormData>({
    country: "Angola",
    declarationType: "GIA",
    periodStart: "",
    periodEnd: "",
    mgiIncomingRevenue: createEmptyProviderData(),
    mgiOutgoingCost: createEmptyProviderData(),
    opexMgi: "",
    giaOutgoingRevenue: createEmptyProviderData(),
    giaIncomingCost: createEmptyProviderData(),
    opexGia: "",
    grxFiscalization: "",
    networkManagementSystem: "",
    marginSplitInfosi: "30",
    marginSplitMgi: "70",
    notes: "",
  });

  useEffect(() => {
    fetchCarrierRates();
  }, []);

  const fetchCarrierRates = async () => {
    try {
      const { data, error } = await supabase
        .from("carrier_rates")
        .select("*")
        .eq("is_active", true);
      
      if (error) throw error;
      setCarrierRates(data || []);
    } catch (error) {
      console.error("Error fetching carrier rates:", error);
    }
  };

  const getCarrierRate = (carrierName: string, country: string, isInbound: boolean): number => {
    const countryCodeMap: Record<string, string> = {
      "Angola": "AO",
      "Uganda": "UG",
      "Kenya": "KE",
      "Tanzania": "TZ",
      "Rwanda": "RW",
      "DR Congo": "CD",
      "South Sudan": "SS",
      "Burundi": "BI",
      "Ethiopia": "ET",
      "Zambia": "ZM",
      "Malawi": "MW",
    };
    
    const countryCode = countryCodeMap[country] || country;
    
    const rate = carrierRates.find(r => {
      const carrierMatch = r.carrier_name.toLowerCase() === carrierName.toLowerCase();
      const countryMatch = r.country === countryCode || 
                          r.country.toLowerCase() === country.toLowerCase() ||
                          r.country === country;
      return carrierMatch && countryMatch;
    });
    
    if (rate) {
      return isInbound ? rate.inbound_rate : rate.outbound_rate;
    }
    return 0;
  };

  const formatNumber = (num: number) => {
    if (num === 0) return "0";
    return new Intl.NumberFormat("de-CH", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(num).replace(/,/g, "'");
  };

  const parseNumber = (str: string): number => {
    if (!str) return 0;
    return parseFloat(str.replace(/[^0-9.-]/g, "")) || 0;
  };

  const formatDateDisplay = (dateStr: string) => {
    if (!dateStr) return "";
    return new Date(dateStr).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const updateProviderData = (
    section: keyof Pick<DeclarationFormData, 'mgiIncomingRevenue' | 'mgiOutgoingCost' | 'giaOutgoingRevenue' | 'giaIncomingCost'>,
    provider: string,
    field: 'minutes' | 'usd',
    value: string
  ) => {
    setFormData(prev => {
      const currentProviderData = { ...prev[section][provider] };
      currentProviderData[field] = value;
      
      if (field === 'minutes' && value) {
        const minutes = parseNumber(value);
        const isInbound = section === 'mgiIncomingRevenue' || section === 'giaIncomingCost';
        const rate = getCarrierRate(provider, prev.country, isInbound);
        
        if (rate > 0) {
          const calculatedUsd = minutes * rate;
          currentProviderData.usd = calculatedUsd.toFixed(2);
        }
      }
      
      return {
        ...prev,
        [section]: {
          ...prev[section],
          [provider]: currentProviderData,
        },
      };
    });
  };

  const calculateTotals = (data: Record<string, ProviderData>) => {
    let totalMinutes = 0;
    let totalUsd = 0;
    Object.values(data).forEach(p => {
      totalMinutes += parseNumber(p.minutes);
      totalUsd += parseNumber(p.usd);
    });
    return { minutes: totalMinutes, usd: totalUsd };
  };

  const calculateBalance = (revenue: Record<string, ProviderData>, cost: Record<string, ProviderData>) => {
    const balances: Record<string, number> = {};
    TELECOM_PROVIDERS.forEach(provider => {
      const rev = parseNumber(revenue[provider]?.usd || "0");
      const cst = parseNumber(cost[provider]?.usd || "0");
      balances[provider] = rev - cst;
    });
    return balances;
  };

  const mgiIncomingTotals = calculateTotals(formData.mgiIncomingRevenue);
  const mgiOutgoingTotals = calculateTotals(formData.mgiOutgoingCost);
  const giaOutgoingTotals = calculateTotals(formData.giaOutgoingRevenue);
  const giaIncomingTotals = calculateTotals(formData.giaIncomingCost);

  const mgiBalances = calculateBalance(formData.mgiIncomingRevenue, formData.mgiOutgoingCost);
  const giaBalances = calculateBalance(formData.giaOutgoingRevenue, formData.giaIncomingCost);

  const opexMgi = parseNumber(formData.opexMgi);
  const opexGia = parseNumber(formData.opexGia);

  const mgiOutgoingWithOpex = mgiOutgoingTotals.usd + opexMgi;
  const giaIncomingWithOpex = giaIncomingTotals.usd + opexGia;

  const totalMgiBalance = mgiIncomingTotals.usd - mgiOutgoingWithOpex;
  const totalGiaBalance = giaOutgoingTotals.usd - giaIncomingWithOpex;

  const marginHeld = totalMgiBalance + totalGiaBalance;
  const grxFiscalization = parseNumber(formData.grxFiscalization);
  const networkManagement = parseNumber(formData.networkManagementSystem);
  
  const marginSplitInfosiPercent = parseNumber(formData.marginSplitInfosi) / 100;
  const marginSplitMgiPercent = parseNumber(formData.marginSplitMgi) / 100;
  
  const marginToSplit = marginHeld - grxFiscalization - networkManagement;
  const infosiShare = marginToSplit * marginSplitInfosiPercent;
  const mgiShare = marginToSplit * marginSplitMgiPercent;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit(formData, {
      mgiIncomingTotals,
      mgiOutgoingTotals,
      giaOutgoingTotals,
      giaIncomingTotals,
      totalMgiBalance,
      totalGiaBalance,
      marginHeld,
      infosiShare,
      mgiShare,
    });
  };

  // Styled table component that matches the PDF
  const TrafficTable = ({
    title,
    section,
    data,
    totals,
    isRevenue = true,
  }: {
    title: string;
    section: keyof Pick<DeclarationFormData, 'mgiIncomingRevenue' | 'mgiOutgoingCost' | 'giaOutgoingRevenue' | 'giaIncomingCost'>;
    data: Record<string, ProviderData>;
    totals: { minutes: number; usd: number };
    isRevenue?: boolean;
  }) => (
    <div className="mb-4">
      {/* Table Header Row - Blue */}
      <div className="bg-[#5a8bb8] text-white font-semibold text-sm grid grid-cols-[1fr,120px,120px] rounded-t-md overflow-hidden">
        <div className="px-3 py-2">{title}</div>
        <div className="px-3 py-2 text-right border-l border-[#4a7ba8]">{formatNumber(totals.minutes)}</div>
        <div className="px-3 py-2 text-right border-l border-[#4a7ba8]">{formatNumber(totals.usd)}</div>
      </div>
      {/* Provider Rows */}
      <div className="border border-t-0 border-border rounded-b-md overflow-hidden">
        {TELECOM_PROVIDERS.map((provider, idx) => (
          <div
            key={provider}
            className={`grid grid-cols-[1fr,120px,120px] ${idx % 2 === 0 ? 'bg-background' : 'bg-muted/30'} ${idx < TELECOM_PROVIDERS.length - 1 ? 'border-b border-border' : ''}`}
          >
            <div className="px-3 py-1.5 text-sm font-medium">{provider}</div>
            <div className="px-1 py-1 border-l border-border">
              <Input
                type="text"
                placeholder="0"
                className="h-7 text-right text-sm border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0"
                value={data[provider]?.minutes || ""}
                onChange={(e) => updateProviderData(section, provider, 'minutes', e.target.value)}
              />
            </div>
            <div className="px-1 py-1 border-l border-border">
              <Input
                type="text"
                placeholder="0"
                className="h-7 text-right text-sm border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0"
                value={data[provider]?.usd || ""}
                onChange={(e) => updateProviderData(section, provider, 'usd', e.target.value)}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const BalanceTable = ({
    title,
    balances,
    opex,
    opexLabel,
    totalBalance,
    onOpexChange,
  }: {
    title: string;
    balances: Record<string, number>;
    opex: number;
    opexLabel: string;
    totalBalance: number;
    onOpexChange: (value: string) => void;
  }) => (
    <div className="mb-4">
      {/* Summary Header - Darker Blue */}
      <div className="bg-[#1a365d] text-white font-semibold text-sm grid grid-cols-[1fr,120px,120px] rounded-t-md overflow-hidden">
        <div className="px-3 py-2">{title}</div>
        <div className="px-3 py-2 text-right border-l border-[#0a2647]"></div>
        <div className="px-3 py-2 text-right border-l border-[#0a2647] font-bold">
          <span className={totalBalance < 0 ? 'text-red-300' : 'text-green-300'}>
            {formatNumber(totalBalance)}
          </span>
        </div>
      </div>
      {/* Balance Rows */}
      <div className="border border-t-0 border-border rounded-b-md overflow-hidden bg-[#e8f0f6]">
        {TELECOM_PROVIDERS.map((provider, idx) => {
          const balance = balances[provider] || 0;
          return (
            <div
              key={provider}
              className={`grid grid-cols-[1fr,120px,120px] ${idx < TELECOM_PROVIDERS.length - 1 ? 'border-b border-border/50' : ''}`}
            >
              <div className="px-3 py-1.5 text-sm">{provider}</div>
              <div className="px-3 py-1.5 text-right border-l border-border/50"></div>
              <div className={`px-3 py-1.5 text-right border-l border-border/50 text-sm font-medium ${balance < 0 ? 'text-destructive' : ''}`}>
                {formatNumber(balance)}
              </div>
            </div>
          );
        })}
        {/* OPEX Row */}
        <div className="grid grid-cols-[1fr,120px,120px] border-t border-border/50">
          <div className="px-3 py-1.5 text-sm font-medium">{opexLabel}</div>
          <div className="px-3 py-1.5 text-right border-l border-border/50"></div>
          <div className="px-1 py-1 border-l border-border/50">
            <Input
              type="text"
              placeholder="0"
              className="h-7 text-right text-sm border-0 bg-white/50 focus-visible:ring-0 focus-visible:ring-offset-0 text-destructive font-medium"
              value={opex > 0 ? `-${opex}` : ""}
              onChange={(e) => {
                const val = e.target.value.replace('-', '');
                onOpexChange(val);
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 bg-background overflow-auto">
      {/* Header Bar */}
      <div className="sticky top-0 z-10 bg-card border-b border-border px-6 py-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-6">
          <Button variant="ghost" size="icon" onClick={onCancel}>
            <X className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-xl font-bold text-foreground">
              Declaration {formData.declarationType} - {formData.country}
            </h1>
            <p className="text-sm text-muted-foreground">
              {formData.periodStart && formData.periodEnd 
                ? `${formatDateDisplay(formData.periodStart)} - ${formatDateDisplay(formData.periodEnd)}`
                : "Select period"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit}
            disabled={isSubmitting || !formData.periodStart || !formData.periodEnd}
            className="bg-primary hover:bg-primary/90"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Download className="mr-2 h-4 w-4" />
                Save & Generate PDF
              </>
            )}
          </Button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="max-w-5xl mx-auto px-6 py-8">
        {/* Header Section - Like the PDF */}
        <div className="mb-8 flex items-start justify-between">
          <div className="flex items-center gap-8">
            {/* Country Select */}
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground uppercase tracking-wide">Country</Label>
              <Select 
                value={formData.country} 
                onValueChange={(v) => setFormData(prev => ({ ...prev, country: v }))}
              >
                <SelectTrigger className="w-40 h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Angola">Angola</SelectItem>
                  <SelectItem value="Uganda">Uganda</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {/* Type Select */}
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground uppercase tracking-wide">Type</Label>
              <Select 
                value={formData.declarationType} 
                onValueChange={(v) => setFormData(prev => ({ ...prev, declarationType: v }))}
              >
                <SelectTrigger className="w-32 h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="GIA">GIA</SelectItem>
                  <SelectItem value="MGI">MGI</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {/* Period */}
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground uppercase tracking-wide">Period Start</Label>
              <Input 
                type="date" 
                className="w-40 h-9"
                value={formData.periodStart}
                onChange={(e) => setFormData(prev => ({ ...prev, periodStart: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground uppercase tracking-wide">Period End</Label>
              <Input 
                type="date" 
                className="w-40 h-9"
                value={formData.periodEnd}
                onChange={(e) => setFormData(prev => ({ ...prev, periodEnd: e.target.value }))}
              />
            </div>
          </div>
          {/* MGI Logo placeholder */}
          <div className="text-3xl font-bold text-primary">mgi<span className="text-primary">"</span></div>
        </div>

        {/* Section Title */}
        <h2 className="text-lg font-bold mb-4 text-foreground">Traffic</h2>
        
        {/* Column Headers */}
        <div className="grid grid-cols-[1fr,120px,120px] mb-2 text-sm font-semibold text-muted-foreground">
          <div></div>
          <div className="text-right px-3">Minutes</div>
          <div className="text-right px-3">USD</div>
        </div>

        {/* MGI Section */}
        <div className="mb-8">
          <h3 className="text-base font-bold mb-3 text-foreground">Traffic and Monies held by MGI</h3>
          
          <TrafficTable
            title="Revenue from international incoming traffic"
            section="mgiIncomingRevenue"
            data={formData.mgiIncomingRevenue}
            totals={mgiIncomingTotals}
          />
          
          <TrafficTable
            title="Cost for international outgoing traffic PLUS OPEX"
            section="mgiOutgoingCost"
            data={formData.mgiOutgoingCost}
            totals={{ minutes: mgiOutgoingTotals.minutes, usd: mgiOutgoingWithOpex }}
            isRevenue={false}
          />
          
          {/* OPEX MGI Input */}
          <div className="grid grid-cols-[1fr,120px,120px] mb-2 bg-muted/50 rounded-md">
            <div className="px-3 py-2 text-sm font-medium">OPEX mgi</div>
            <div className="px-3 py-2"></div>
            <div className="px-1 py-1">
              <Input
                type="text"
                placeholder="0"
                className="h-8 text-right text-sm"
                value={formData.opexMgi}
                onChange={(e) => setFormData(prev => ({ ...prev, opexMgi: e.target.value }))}
              />
            </div>
          </div>

          <BalanceTable
            title="Balance of revenue in MGI"
            balances={mgiBalances}
            opex={opexMgi}
            opexLabel="OPEX mgi"
            totalBalance={totalMgiBalance}
            onOpexChange={(v) => setFormData(prev => ({ ...prev, opexMgi: v }))}
          />
        </div>

        {/* GIA Section */}
        <div className="mb-8">
          <h3 className="text-base font-bold mb-3 text-foreground">Traffic and Monies held by GIA</h3>
          
          <TrafficTable
            title="Revenue from international outgoing traffic"
            section="giaOutgoingRevenue"
            data={formData.giaOutgoingRevenue}
            totals={giaOutgoingTotals}
          />
          
          <TrafficTable
            title="Cost for international incoming traffic"
            section="giaIncomingCost"
            data={formData.giaIncomingCost}
            totals={giaIncomingTotals}
            isRevenue={false}
          />
          
          {/* OPEX GIA Input */}
          <div className="grid grid-cols-[1fr,120px,120px] mb-2 bg-muted/50 rounded-md">
            <div className="px-3 py-2 text-sm font-medium">Opex GIA</div>
            <div className="px-3 py-2"></div>
            <div className="px-1 py-1">
              <Input
                type="text"
                placeholder="0"
                className="h-8 text-right text-sm"
                value={formData.opexGia}
                onChange={(e) => setFormData(prev => ({ ...prev, opexGia: e.target.value }))}
              />
            </div>
          </div>

          <BalanceTable
            title="Balance of revenue in GIA"
            balances={giaBalances}
            opex={opexGia}
            opexLabel="OPEX gia"
            totalBalance={totalGiaBalance}
            onOpexChange={(v) => setFormData(prev => ({ ...prev, opexGia: v }))}
          />
        </div>

        {/* Margin Section */}
        <div className="mb-8 p-6 bg-muted/30 rounded-xl border border-border">
          <h3 className="text-base font-bold mb-4 text-foreground">Margin Calculation</h3>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-background p-4 rounded-lg border border-border">
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Margin held (MGI + GIA)</p>
              <p className={`text-2xl font-bold ${marginHeld < 0 ? 'text-destructive' : 'text-foreground'}`}>
                {formatNumber(marginHeld)}
              </p>
            </div>
            <div className="bg-background p-4 rounded-lg border border-border">
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">MGI Balance</p>
              <p className={`text-2xl font-bold ${totalMgiBalance < 0 ? 'text-destructive' : 'text-foreground'}`}>
                {formatNumber(totalMgiBalance)}
              </p>
            </div>
            <div className="bg-background p-4 rounded-lg border border-border">
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">GIA Balance</p>
              <p className={`text-2xl font-bold ${totalGiaBalance < 0 ? 'text-destructive' : 'text-foreground'}`}>
                {formatNumber(totalGiaBalance)}
              </p>
            </div>
            <div className="bg-background p-4 rounded-lg border border-border">
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Margin to Split</p>
              <p className={`text-2xl font-bold ${marginToSplit < 0 ? 'text-destructive' : 'text-foreground'}`}>
                {formatNumber(marginToSplit)}
              </p>
            </div>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground uppercase tracking-wide">GRX Fiscalization</Label>
              <Input
                type="text"
                placeholder="0"
                className="text-right"
                value={formData.grxFiscalization}
                onChange={(e) => setFormData(prev => ({ ...prev, grxFiscalization: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground uppercase tracking-wide">Network Management</Label>
              <Input
                type="text"
                placeholder="0"
                className="text-right"
                value={formData.networkManagementSystem}
                onChange={(e) => setFormData(prev => ({ ...prev, networkManagementSystem: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground uppercase tracking-wide">INFOSI Split (%)</Label>
              <Input
                type="text"
                className="text-right"
                value={formData.marginSplitInfosi}
                onChange={(e) => setFormData(prev => ({ ...prev, marginSplitInfosi: e.target.value }))}
              />
              <p className="text-sm text-primary font-semibold text-right">{formatNumber(infosiShare)} USD</p>
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground uppercase tracking-wide">MGI Split (%)</Label>
              <Input
                type="text"
                className="text-right"
                value={formData.marginSplitMgi}
                onChange={(e) => setFormData(prev => ({ ...prev, marginSplitMgi: e.target.value }))}
              />
              <p className="text-sm text-primary font-semibold text-right">{formatNumber(mgiShare)} USD</p>
            </div>
          </div>
        </div>

        {/* Notes */}
        <div className="mb-8">
          <Label className="text-xs text-muted-foreground uppercase tracking-wide">Notes</Label>
          <Textarea
            placeholder="Optional notes..."
            className="mt-2"
            value={formData.notes}
            onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
          />
        </div>
      </form>
    </div>
  );
}
