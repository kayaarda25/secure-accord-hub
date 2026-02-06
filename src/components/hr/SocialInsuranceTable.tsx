import { Trash2 } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";

interface SocialInsuranceRecord {
  id: string;
  user_id: string;
  year: number;
  month: number;
  gross_salary: number;
  ahv_iv_eo_employee: number;
  ahv_iv_eo_employer: number;
  alv_employee: number;
  alv_employer: number;
  bvg_employee: number;
  bvg_employer: number;
  uvg_nbu: number;
  uvg_bu: number;
  ktg: number;
  notes: string | null;
  profiles?: {
    first_name: string | null;
    last_name: string | null;
    email: string;
  };
}

interface SocialInsuranceTableProps {
  records: SocialInsuranceRecord[];
  canManage: boolean;
  onDelete: (id: string) => void;
}

const monthNames = [
  "Januar", "Februar", "März", "April", "Mai", "Juni",
  "Juli", "August", "September", "Oktober", "November", "Dezember"
];

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("de-CH", {
    style: "currency",
    currency: "CHF",
  }).format(value);
};

export function SocialInsuranceTable({
  records,
  canManage,
  onDelete,
}: SocialInsuranceTableProps) {
  if (records.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Keine Sozialversicherungseinträge vorhanden
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Mitarbeiter</TableHead>
            <TableHead>Periode</TableHead>
            <TableHead className="text-right">Bruttolohn</TableHead>
            <TableHead className="text-right">AHV/IV/EO</TableHead>
            <TableHead className="text-right">ALV</TableHead>
            <TableHead className="text-right">BVG</TableHead>
            <TableHead className="text-right">UVG</TableHead>
            <TableHead className="text-right">Total AN</TableHead>
            {canManage && <TableHead></TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {records.map((record) => {
            const employeeTotal =
              Number(record.ahv_iv_eo_employee) +
              Number(record.alv_employee) +
              Number(record.bvg_employee) +
              Number(record.uvg_nbu);

            return (
              <TableRow key={record.id}>
                <TableCell>
                  {record.profiles
                    ? `${record.profiles.first_name || ""} ${record.profiles.last_name || ""}`.trim() ||
                      record.profiles.email
                    : "—"}
                </TableCell>
                <TableCell>
                  {monthNames[record.month - 1]} {record.year}
                </TableCell>
                <TableCell className="text-right font-medium">
                  {formatCurrency(Number(record.gross_salary))}
                </TableCell>
                <TableCell className="text-right">
                  {formatCurrency(Number(record.ahv_iv_eo_employee))}
                </TableCell>
                <TableCell className="text-right">
                  {formatCurrency(Number(record.alv_employee))}
                </TableCell>
                <TableCell className="text-right">
                  {formatCurrency(Number(record.bvg_employee))}
                </TableCell>
                <TableCell className="text-right">
                  {formatCurrency(Number(record.uvg_nbu))}
                </TableCell>
                <TableCell className="text-right font-medium">
                  {formatCurrency(employeeTotal)}
                </TableCell>
                {canManage && (
                  <TableCell>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => onDelete(record.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                )}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
