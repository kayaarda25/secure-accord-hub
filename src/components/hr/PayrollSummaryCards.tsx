import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, BadgeEuro, TrendingDown, Building2 } from "lucide-react";

interface PayrollSummaryCardsProps {
  totalEmployees: number;
  totalGrossSalary: number;
  totalNetSalary: number;
  totalEmployerCosts: number;
  totalPayrollCost: number;
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("de-CH", {
    style: "currency",
    currency: "CHF",
  }).format(value);
};

export function PayrollSummaryCards({
  totalEmployees,
  totalGrossSalary,
  totalNetSalary,
  totalEmployerCosts,
  totalPayrollCost,
}: PayrollSummaryCardsProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Mitarbeiter</CardTitle>
          <Users className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{totalEmployees}</div>
          <p className="text-xs text-muted-foreground">Aktive Lohnempfänger</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Bruttolohnsumme</CardTitle>
          <BadgeEuro className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatCurrency(totalGrossSalary)}</div>
          <p className="text-xs text-muted-foreground">Monatlich gesamt</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Nettolohnsumme</CardTitle>
          <TrendingDown className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatCurrency(totalNetSalary)}</div>
          <p className="text-xs text-muted-foreground">Auszahlung an Mitarbeiter</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Arbeitgeberkosten</CardTitle>
          <Building2 className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatCurrency(totalPayrollCost)}</div>
          <p className="text-xs text-muted-foreground">Inkl. Sozialabgaben AG</p>
        </CardContent>
      </Card>
    </div>
  );
}
