import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Save } from "lucide-react";
import type { CalendarEvent } from "@/hooks/useCalendarEvents";

interface EditEventDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event: CalendarEvent | null;
  onEventUpdated: () => void;
}

const EVENT_TYPES = [
  { value: "meeting", label: "Meeting" },
  { value: "deadline", label: "Deadline" },
  { value: "finance", label: "Finanzen" },
  { value: "contract", label: "Vertrag" },
  { value: "other", label: "Sonstiges" },
];

export function EditEventDialog({
  open,
  onOpenChange,
  event,
  onEventUpdated,
}: EditEventDialogProps) {
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    event_date: "",
    start_time: "",
    end_time: "",
    location: "",
    event_type: "meeting",
    priority: "normal",
  });

  useEffect(() => {
    if (event) {
      setFormData({
        title: event.title,
        description: event.description || "",
        event_date: event.event_date,
        start_time: event.start_time?.slice(0, 5) || "",
        end_time: event.end_time?.slice(0, 5) || "",
        location: event.location || "",
        event_type: event.event_type,
        priority: event.priority,
      });
    }
  }, [event]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !event) return;

    if (!formData.title || !formData.event_date) {
      toast.error("Bitte füllen Sie die Pflichtfelder aus");
      return;
    }

    // Only allow editing if user is the creator
    if (event.created_by !== user.id) {
      toast.error("Nur der Ersteller kann den Termin bearbeiten");
      return;
    }

    setIsSubmitting(true);
    try {
      const eventId = event._parentId || event.id;
      const { error } = await supabase
        .from("calendar_events")
        .update({
          title: formData.title,
          description: formData.description || null,
          event_date: formData.event_date,
          start_time: formData.start_time || null,
          end_time: formData.end_time || null,
          location: formData.location || null,
          event_type: formData.event_type,
          priority: formData.priority,
        })
        .eq("id", eventId);

      if (error) throw error;

      toast.success("Termin aktualisiert");
      onOpenChange(false);
      onEventUpdated();
    } catch (error) {
      console.error("Error updating event:", error);
      toast.error("Fehler beim Aktualisieren");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Termin bearbeiten</DialogTitle>
          <DialogDescription>Ändern Sie die Details des Termins</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Titel *</Label>
            <Input
              value={formData.title}
              onChange={(e) => setFormData((p) => ({ ...p, title: e.target.value }))}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Datum *</Label>
              <Input
                type="date"
                value={formData.event_date}
                onChange={(e) => setFormData((p) => ({ ...p, event_date: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Typ</Label>
              <Select
                value={formData.event_type}
                onValueChange={(v) => setFormData((p) => ({ ...p, event_type: v }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {EVENT_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Startzeit</Label>
              <Input
                type="time"
                value={formData.start_time}
                onChange={(e) => setFormData((p) => ({ ...p, start_time: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Endzeit</Label>
              <Input
                type="time"
                value={formData.end_time}
                onChange={(e) => setFormData((p) => ({ ...p, end_time: e.target.value }))}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Ort</Label>
            <Input
              value={formData.location}
              onChange={(e) => setFormData((p) => ({ ...p, location: e.target.value }))}
            />
          </div>

          <div className="space-y-2">
            <Label>Priorität</Label>
            <Select
              value={formData.priority}
              onValueChange={(v) => setFormData((p) => ({ ...p, priority: v }))}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="normal">Normal</SelectItem>
                <SelectItem value="high">Hoch</SelectItem>
                <SelectItem value="critical">Kritisch</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Beschreibung</Label>
            <Textarea
              value={formData.description}
              onChange={(e) => setFormData((p) => ({ ...p, description: e.target.value }))}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Abbrechen
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Speichern
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
