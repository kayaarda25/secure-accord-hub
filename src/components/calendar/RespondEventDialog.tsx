import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Check, X, Loader2 } from "lucide-react";

interface RespondEventDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventId: string;
  eventTitle: string;
  action: "accepted" | "declined";
  onResponded: () => void;
}

export function RespondEventDialog({
  open,
  onOpenChange,
  eventId,
  eventTitle,
  action,
  onResponded,
}: RespondEventDialogProps) {
  const { user } = useAuth();
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!user) return;
    setIsSubmitting(true);

    try {
      const { error } = await supabase
        .from("calendar_event_participants")
        .update({
          status: action,
          responded_at: new Date().toISOString(),
          response_reason: reason || null,
        })
        .eq("event_id", eventId)
        .eq("user_id", user.id);

      if (error) throw error;
      toast.success(
        `Termin ${action === "accepted" ? "angenommen" : "abgelehnt"}`
      );
      setReason("");
      onOpenChange(false);
      onResponded();
    } catch (error) {
      console.error("Error responding to event:", error);
      toast.error("Fehler beim Antworten");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {action === "accepted" ? "Termin annehmen" : "Termin ablehnen"}
          </DialogTitle>
          <DialogDescription>
            {eventTitle}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>
              Begründung {action === "declined" ? "(empfohlen)" : "(optional)"}
            </Label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={
                action === "accepted"
                  ? "z.B. Nehme gerne teil..."
                  : "z.B. Bin zu diesem Zeitpunkt verhindert..."
              }
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Abbrechen
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting}
            variant={action === "accepted" ? "default" : "destructive"}
          >
            {isSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : action === "accepted" ? (
              <Check className="h-4 w-4 mr-2" />
            ) : (
              <X className="h-4 w-4 mr-2" />
            )}
            {action === "accepted" ? "Annehmen" : "Ablehnen"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
