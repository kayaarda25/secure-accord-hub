import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import type { PayrollSummary } from "@/hooks/usePayroll";

interface PayrollTableProps {
  summaries: PayrollSummary[];
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("de-CH", {
    style: "currency",
    currency: "CHF",
  }).format(value);
};

export function PayrollTable({ summaries }: PayrollTableProps) {
  if (summaries.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Keine Lohndaten für diesen Monat vorhanden.
        <br />
        <span className="text-sm">
          Erfassen Sie zuerst Sozialversicherungsbeiträge unter "Sozialversicherungen".
        </span>
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Mitarbeiter</TableHead>
            <TableHead className="text-right">Bruttolohn</TableHead>
            <TableHead className="text-right">Abzüge AN</TableHead>
            <TableHead className="text-right">Nettolohn</TableHead>
            <TableHead className="text-right">AG-Kosten</TableHead>
            <TableHead className="text-right">Gesamtkosten</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {summaries.map((summary) => (
            <TableRow key={summary.id}>
              <TableCell>
                <div>
                  <div className="font-medium">{summary.employeeName}</div>
                  <div className="text-sm text-muted-foreground">{summary.email}</div>
                </div>
              </TableCell>
              <TableCell className="text-right font-medium">
                {formatCurrency(summary.grossSalary)}
              </TableCell>
              <TableCell className="text-right text-destructive">
                -{formatCurrency(summary.employeeDeductions)}
              </TableCell>
              <TableCell className="text-right">
                <Badge variant="secondary" className="font-mono">
                  {formatCurrency(summary.netSalary)}
                </Badge>
              </TableCell>
              <TableCell className="text-right text-muted-foreground">
                {formatCurrency(summary.employerCosts)}
              </TableCell>
              <TableCell className="text-right font-semibold">
                {formatCurrency(summary.totalCost)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
