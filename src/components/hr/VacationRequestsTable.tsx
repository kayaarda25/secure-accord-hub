import { format } from "date-fns";
import { de } from "date-fns/locale";
import { Check, X, Ban } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useAuth } from "@/contexts/AuthContext";

interface VacationRequest {
  id: string;
  user_id: string;
  start_date: string;
  end_date: string;
  days_count: number;
  reason: string | null;
  status: "pending" | "approved" | "rejected" | "cancelled";
  rejection_reason: string | null;
  created_at: string;
  profiles?: {
    first_name: string | null;
    last_name: string | null;
    email: string;
  };
}

interface VacationRequestsTableProps {
  requests: VacationRequest[];
  isManager: boolean;
  onApprove: (id: string) => void;
  onReject: (id: string, reason: string) => void;
  onCancel: (id: string) => void;
}

const statusConfig = {
  pending: { label: "Offen", variant: "secondary" as const },
  approved: { label: "Genehmigt", variant: "default" as const },
  rejected: { label: "Abgelehnt", variant: "destructive" as const },
  cancelled: { label: "Storniert", variant: "outline" as const },
};

export function VacationRequestsTable({
  requests,
  isManager,
  onApprove,
  onReject,
  onCancel,
}: VacationRequestsTableProps) {
  const { user } = useAuth();

  const handleReject = (id: string) => {
    const reason = prompt("Ablehnungsgrund:");
    if (reason) {
      onReject(id, reason);
    }
  };

  if (requests.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Keine Ferienanträge vorhanden
      </div>
    );
  }

  return (
    <TooltipProvider>
      <Table>
        <TableHeader>
          <TableRow>
            {isManager && <TableHead>Mitarbeiter</TableHead>}
            <TableHead>Von</TableHead>
            <TableHead>Bis</TableHead>
            <TableHead>Tage</TableHead>
            <TableHead>Grund</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Aktionen</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {requests.map((request) => {
            const isOwn = request.user_id === user?.id;
            const canApprove = isManager && request.status === "pending" && !isOwn;
            const canCancel = isOwn && request.status === "pending";

            return (
              <TableRow key={request.id}>
                {isManager && (
                  <TableCell>
                    {request.profiles
                      ? `${request.profiles.first_name || ""} ${request.profiles.last_name || ""}`.trim() ||
                        request.profiles.email
                      : "—"}
                  </TableCell>
                )}
                <TableCell>
                  {format(new Date(request.start_date), "dd.MM.yyyy", { locale: de })}
                </TableCell>
                <TableCell>
                  {format(new Date(request.end_date), "dd.MM.yyyy", { locale: de })}
                </TableCell>
                <TableCell>{request.days_count}</TableCell>
                <TableCell className="max-w-[200px] truncate">
                  {request.reason || "—"}
                </TableCell>
                <TableCell>
                  <Tooltip>
                    <TooltipTrigger>
                      <Badge variant={statusConfig[request.status].variant}>
                        {statusConfig[request.status].label}
                      </Badge>
                    </TooltipTrigger>
                    {request.rejection_reason && (
                      <TooltipContent>
                        <p>{request.rejection_reason}</p>
                      </TooltipContent>
                    )}
                  </Tooltip>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    {canApprove && (
                      <>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-primary hover:text-primary/80 hover:bg-primary/10"
                          onClick={() => onApprove(request.id)}
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-destructive hover:text-destructive/80 hover:bg-destructive/10"
                          onClick={() => handleReject(request.id)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                    {canCancel && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={() => onCancel(request.id)}
                      >
                        <Ban className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TooltipProvider>
  );
}
