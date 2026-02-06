import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Save, Repeat, CalendarDays } from "lucide-react";
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

const RECURRENCE_TYPES = [
  { value: "daily", label: "Täglich" },
  { value: "weekly", label: "Wöchentlich" },
  { value: "monthly", label: "Monatlich" },
  { value: "yearly", label: "Jährlich" },
];

type EditScope = "single" | "series";

export function EditEventDialog({
  open,
  onOpenChange,
  event,
  onEventUpdated,
}: EditEventDialogProps) {
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showScopeDialog, setShowScopeDialog] = useState(false);
  const [editScope, setEditScope] = useState<EditScope>("series");
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    event_date: "",
    start_time: "",
    end_time: "",
    location: "",
    event_type: "meeting",
    priority: "normal",
    is_recurring: false,
    recurrence_type: "" as string,
    recurrence_end_date: "",
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
        is_recurring: event.is_recurring || false,
        recurrence_type: event.recurrence_type || "",
        recurrence_end_date: event.recurrence_end_date || "",
      });
      setEditScope("series");
    }
  }, [event]);

  const isRecurringEvent = event?.is_recurring || event?._isOccurrence;

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !event) return;

    if (!formData.title || !formData.event_date) {
      toast.error("Bitte füllen Sie die Pflichtfelder aus");
      return;
    }

    if (event.created_by !== user.id) {
      toast.error("Nur der Ersteller kann den Termin bearbeiten");
      return;
    }

    // For recurring events that are occurrences, ask scope
    if (isRecurringEvent && event._isOccurrence) {
      setShowScopeDialog(true);
      return;
    }

    // Direct save for non-recurring or original recurring events
    saveChanges("series");
  };

  const saveChanges = async (scope: EditScope) => {
    if (!user || !event) return;
    setShowScopeDialog(false);
    setIsSubmitting(true);

    try {
      const eventId = event._parentId || event.id;

      if (scope === "series") {
        // Update the parent/original event (affects entire series)
        const updateData: Record<string, unknown> = {
          title: formData.title,
          description: formData.description || null,
          start_time: formData.start_time || null,
          end_time: formData.end_time || null,
          location: formData.location || null,
          event_type: formData.event_type,
          priority: formData.priority,
          is_recurring: formData.is_recurring,
          recurrence_type: formData.is_recurring ? formData.recurrence_type || null : null,
          recurrence_end_date: formData.is_recurring ? formData.recurrence_end_date || null : null,
        };

        // Only update event_date if editing the original (not an occurrence)
        if (!event._isOccurrence) {
          updateData.event_date = formData.event_date;
        }

        const { error } = await supabase
          .from("calendar_events")
          .update(updateData)
          .eq("id", eventId);

        if (error) throw error;
        toast.success("Terminserie aktualisiert");
      } else {
        // "single" - create a new non-recurring event for this occurrence and exclude from series
        // We create a standalone event for this single date
        const { error: insertError } = await supabase
          .from("calendar_events")
          .insert({
            title: formData.title,
            description: formData.description || null,
            event_date: formData.event_date,
            start_time: formData.start_time || null,
            end_time: formData.end_time || null,
            location: formData.location || null,
            event_type: formData.event_type,
            priority: formData.priority,
            is_recurring: false,
            created_by: user.id,
            parent_event_id: eventId,
          });

        if (insertError) throw insertError;
        toast.success("Einzelner Termin geändert");
      }

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
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {isRecurringEvent && <Repeat size={18} className="text-accent" />}
              Termin bearbeiten
            </DialogTitle>
            <DialogDescription>
              {isRecurringEvent
                ? "Änderungen an einem wiederkehrenden Termin"
                : "Ändern Sie die Details des Termins"}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleFormSubmit} className="space-y-4">
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

            {/* Recurrence Section */}
            <div className="space-y-3 rounded-lg border p-3 bg-muted/30">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Repeat size={16} className="text-muted-foreground" />
                  <Label className="font-medium">Wiederkehrend</Label>
                </div>
                <Switch
                  checked={formData.is_recurring}
                  onCheckedChange={(checked) =>
                    setFormData((p) => ({
                      ...p,
                      is_recurring: checked,
                      recurrence_type: checked ? p.recurrence_type || "weekly" : "",
                      recurrence_end_date: checked ? p.recurrence_end_date : "",
                    }))
                  }
                />
              </div>

              {formData.is_recurring && (
                <div className="grid grid-cols-2 gap-3 pt-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Wiederholung</Label>
                    <Select
                      value={formData.recurrence_type}
                      onValueChange={(v) => setFormData((p) => ({ ...p, recurrence_type: v }))}
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="Auswählen" />
                      </SelectTrigger>
                      <SelectContent>
                        {RECURRENCE_TYPES.map((t) => (
                          <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Enddatum</Label>
                    <Input
                      type="date"
                      className="h-9"
                      value={formData.recurrence_end_date}
                      onChange={(e) => setFormData((p) => ({ ...p, recurrence_end_date: e.target.value }))}
                      placeholder="Kein Ende"
                    />
                  </div>
                </div>
              )}
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

      {/* Scope selection for recurring event occurrences */}
      <AlertDialog open={showScopeDialog} onOpenChange={setShowScopeDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Terminserie bearbeiten</AlertDialogTitle>
            <AlertDialogDescription>
              Möchten Sie nur diesen einzelnen Termin oder die gesamte Serie ändern?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <Button
              variant="outline"
              onClick={() => saveChanges("single")}
              className="flex items-center gap-2"
            >
              <CalendarDays size={16} />
              Nur diesen Termin
            </Button>
            <AlertDialogAction
              onClick={() => saveChanges("series")}
              className="flex items-center gap-2"
            >
              <Repeat size={16} />
              Gesamte Serie
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
