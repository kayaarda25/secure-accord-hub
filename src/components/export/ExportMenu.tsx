import { Download, FileSpreadsheet, FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface ExportMenuProps {
  onExportCSV: () => void;
  onExportExcel: () => void;
  onExportPDF: () => void;
  isExporting?: boolean;
  disabled?: boolean;
}

export function ExportMenu({
  onExportCSV,
  onExportExcel,
  onExportPDF,
  isExporting = false,
  disabled = false,
}: ExportMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" disabled={disabled || isExporting}>
          {isExporting ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Download className="mr-2 h-4 w-4" />
          )}
          Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={onExportCSV} className="gap-2">
          <FileText className="h-4 w-4" />
          <span>CSV (.csv)</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onExportExcel} className="gap-2">
          <FileSpreadsheet className="h-4 w-4" />
          <span>Excel (.xls)</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onExportPDF} className="gap-2">
          <FileText className="h-4 w-4" />
          <span>PDF (Drucken)</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
