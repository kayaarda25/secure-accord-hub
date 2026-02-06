import { useState } from "react";
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
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Plus,
  Loader2,
  Repeat,
  Share2,
  Video,
  MapPin,
} from "lucide-react";

interface Profile {
  id: string;
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
}

interface CreateEventDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profiles: Profile[];
  onEventCreated: () => void;
}

const EVENT_TYPES = [
  { value: "meeting", label: "Meeting" },
  { value: "deadline", label: "Deadline" },
  { value: "finance", label: "Finance" },
  { value: "contract", label: "Contract" },
  { value: "other", label: "Other" },
];

const WEEKDAYS = [
  { value: "0", label: "So" },
  { value: "1", label: "Mo" },
  { value: "2", label: "Di" },
  { value: "3", label: "Mi" },
  { value: "4", label: "Do" },
  { value: "5", label: "Fr" },
  { value: "6", label: "Sa" },
];

const MONTHS = [
  { value: "1", label: "Januar" },
  { value: "2", label: "Februar" },
  { value: "3", label: "März" },
  { value: "4", label: "April" },
  { value: "5", label: "Mai" },
  { value: "6", label: "Juni" },
  { value: "7", label: "Juli" },
  { value: "8", label: "August" },
  { value: "9", label: "September" },
  { value: "10", label: "Oktober" },
  { value: "11", label: "November" },
  { value: "12", label: "Dezember" },
];

export function CreateEventDialog({
  open,
  onOpenChange,
  profiles,
  onEventCreated,
}: CreateEventDialogProps) {
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCreatingZoom, setIsCreatingZoom] = useState(false);

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
    recurrence_type: "daily",
    recurrence_interval: 1,
    recurrence_weekdays: [] as string[],
    recurrence_month_day: 1,
    recurrence_month: "1",
    recurrence_end_type: "never" as "never" | "date" | "count",
    recurrence_end_date: "",
    recurrence_count: 10,
    selectedParticipants: [] as string[],
    is_online_meeting: false,
    create_zoom_link: false,
  });

  const resetForm = () => {
    setFormData({
      title: "",
      description: "",
      event_date: "",
      start_time: "",
      end_time: "",
      location: "",
      event_type: "meeting",
      priority: "normal",
      is_recurring: false,
      recurrence_type: "daily",
      recurrence_interval: 1,
      recurrence_weekdays: [],
      recurrence_month_day: 1,
      recurrence_month: "1",
      recurrence_end_type: "never",
      recurrence_end_date: "",
      recurrence_count: 10,
      selectedParticipants: [],
      is_online_meeting: false,
      create_zoom_link: false,
    });
  };

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (!formData.title || !formData.event_date) {
      toast.error("Bitte füllen Sie die Pflichtfelder aus");
      return;
    }

    if (!formData.start_time && formData.create_zoom_link) {
      toast.error("Startzeit ist erforderlich für Zoom-Meetings");
      return;
    }

    setIsSubmitting(true);
    let zoomMeetingUrl: string | null = null;

    try {
      // Create Zoom meeting if requested
      if (formData.create_zoom_link && formData.start_time) {
        setIsCreatingZoom(true);
        
        const participantEmails = formData.selectedParticipants
          .map(userId => profiles.find(p => p.user_id === userId)?.email)
          .filter(Boolean) as string[];

        // Calculate duration in minutes
        let duration = 60; // default
        if (formData.start_time && formData.end_time) {
          const [startH, startM] = formData.start_time.split(":").map(Number);
          const [endH, endM] = formData.end_time.split(":").map(Number);
          duration = (endH * 60 + endM) - (startH * 60 + startM);
          if (duration <= 0) duration = 60;
        }

        const meetingDateTime = new Date(`${formData.event_date}T${formData.start_time}:00`);

        const { data: zoomData, error: zoomError } = await supabase.functions.invoke(
          "create-zoom-meeting",
          {
            body: {
              meeting: {
                title: formData.title,
                date: meetingDateTime.toISOString(),
                duration,
                description: formData.description || undefined,
              },
              participants: participantEmails,
            },
          }
        );

        if (zoomError) {
          console.error("Zoom error:", zoomError);
          toast.error("Zoom-Meeting konnte nicht erstellt werden");
        } else if (zoomData?.zoomMeeting?.joinUrl) {
          zoomMeetingUrl = zoomData.zoomMeeting.joinUrl;
          toast.success("Zoom-Meeting erstellt und Einladungen versendet");
        }
        
        setIsCreatingZoom(false);
      }

      // Build recurrence metadata
      const recurrenceMetadata = formData.is_recurring
        ? JSON.stringify({
            type: formData.recurrence_type,
            interval: formData.recurrence_interval,
            weekdays: formData.recurrence_weekdays,
            monthDay: formData.recurrence_month_day,
            month: formData.recurrence_month,
            endType: formData.recurrence_end_type,
            endDate: formData.recurrence_end_date || null,
            count: formData.recurrence_count,
          })
        : null;

      // Combine location with Zoom link if applicable
      let finalLocation = formData.location;
      if (zoomMeetingUrl) {
        finalLocation = zoomMeetingUrl;
      } else if (formData.is_online_meeting && !formData.create_zoom_link) {
        finalLocation = formData.location || "Online-Meeting";
      }

      const { data: eventData, error: eventError } = await supabase
        .from("calendar_events")
        .insert({
          title: formData.title,
          description: formData.description || null,
          event_date: formData.event_date,
          start_time: formData.start_time || null,
          end_time: formData.end_time || null,
          location: finalLocation || null,
          event_type: formData.event_type,
          priority: formData.priority,
          is_recurring: formData.is_recurring,
          recurrence_type: formData.is_recurring ? formData.recurrence_type : null,
          recurrence_end_date:
            formData.is_recurring && formData.recurrence_end_type === "date"
              ? formData.recurrence_end_date
              : null,
          created_by: user.id,
        })
        .select()
        .single();

      if (eventError) throw eventError;

      // Add participants if any selected
      if (formData.selectedParticipants.length > 0) {
        const participantsToInsert = formData.selectedParticipants.map((userId) => ({
          event_id: eventData.id,
          user_id: userId,
          status: "pending",
        }));

        const { error: partError } = await supabase
          .from("calendar_event_participants")
          .insert(participantsToInsert);

        if (partError) throw partError;
      }

      toast.success("Termin erfolgreich erstellt");
      resetForm();
      onOpenChange(false);
      onEventCreated();
    } catch (error) {
      console.error("Error creating event:", error);
      toast.error("Fehler beim Erstellen des Termins");
    } finally {
      setIsSubmitting(false);
      setIsCreatingZoom(false);
    }
  };

  const handleWeekdayToggle = (day: string) => {
    setFormData((prev) => ({
      ...prev,
      recurrence_weekdays: prev.recurrence_weekdays.includes(day)
        ? prev.recurrence_weekdays.filter((d) => d !== day)
        : [...prev.recurrence_weekdays, day],
    }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Neuen Termin erstellen</DialogTitle>
          <DialogDescription>
            Fügen Sie einen neuen Termin zu Ihrem Kalender hinzu
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleCreateEvent} className="space-y-4">
          {/* Title */}
          <div className="space-y-2">
            <Label>Titel *</Label>
            <Input
              value={formData.title}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, title: e.target.value }))
              }
              placeholder="Titel des Termins"
            />
          </div>

          {/* Date and Type */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Datum *</Label>
              <Input
                type="date"
                value={formData.event_date}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, event_date: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Typ</Label>
              <Select
                value={formData.event_type}
                onValueChange={(v) =>
                  setFormData((prev) => ({ ...prev, event_type: v }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EVENT_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Time */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Startzeit</Label>
              <Input
                type="time"
                value={formData.start_time}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, start_time: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Endzeit</Label>
              <Input
                type="time"
                value={formData.end_time}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, end_time: e.target.value }))
                }
              />
            </div>
          </div>

          {/* Online Meeting / Zoom */}
          <div className="space-y-4 p-4 bg-muted/30 rounded-lg">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="online-meeting"
                checked={formData.is_online_meeting}
                onCheckedChange={(checked) =>
                  setFormData((prev) => ({
                    ...prev,
                    is_online_meeting: checked as boolean,
                    create_zoom_link: false,
                    location: checked ? "" : prev.location,
                  }))
                }
              />
              <Label htmlFor="online-meeting" className="flex items-center gap-2">
                <Video className="h-4 w-4" />
                Online-Meeting
              </Label>
            </div>

            {formData.is_online_meeting && (
              <div className="ml-6 space-y-3">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="create-zoom"
                    checked={formData.create_zoom_link}
                    onCheckedChange={(checked) =>
                      setFormData((prev) => ({
                        ...prev,
                        create_zoom_link: checked as boolean,
                      }))
                    }
                  />
                  <Label htmlFor="create-zoom" className="text-sm">
                    Zoom-Meeting automatisch erstellen & Einladungen versenden
                  </Label>
                </div>

                {!formData.create_zoom_link && (
                  <div className="space-y-2">
                    <Label className="text-sm">Meeting-Link (optional)</Label>
                    <Input
                      value={formData.location}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, location: e.target.value }))
                      }
                      placeholder="https://zoom.us/j/..."
                    />
                  </div>
                )}
              </div>
            )}

            {!formData.is_online_meeting && (
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  Ort
                </Label>
                <Input
                  value={formData.location}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, location: e.target.value }))
                  }
                  placeholder="Ort des Termins"
                />
              </div>
            )}
          </div>

          {/* Priority */}
          <div className="space-y-2">
            <Label>Priorität</Label>
            <Select
              value={formData.priority}
              onValueChange={(v) =>
                setFormData((prev) => ({ ...prev, priority: v }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="normal">Normal</SelectItem>
                <SelectItem value="high">Hoch</SelectItem>
                <SelectItem value="critical">Kritisch</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label>Beschreibung</Label>
            <Textarea
              value={formData.description}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, description: e.target.value }))
              }
              placeholder="Beschreibung des Termins"
            />
          </div>

          {/* Recurrence - Outlook Style */}
          <div className="space-y-4 p-4 bg-muted/30 rounded-lg">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="recurring"
                checked={formData.is_recurring}
                onCheckedChange={(checked) =>
                  setFormData((prev) => ({
                    ...prev,
                    is_recurring: checked as boolean,
                  }))
                }
              />
              <Label htmlFor="recurring" className="flex items-center gap-2">
                <Repeat className="h-4 w-4" />
                Wiederkehrender Termin
              </Label>
            </div>

            {formData.is_recurring && (
              <div className="space-y-4 ml-6">
                {/* Recurrence Pattern */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Wiederholungsmuster</Label>
                  <RadioGroup
                    value={formData.recurrence_type}
                    onValueChange={(v) =>
                      setFormData((prev) => ({ ...prev, recurrence_type: v }))
                    }
                    className="space-y-2"
                  >
                    {/* Daily */}
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="daily" id="daily" />
                      <Label htmlFor="daily" className="text-sm font-normal">
                        Täglich
                      </Label>
                    </div>
                    {formData.recurrence_type === "daily" && (
                      <div className="ml-6 flex items-center gap-2 text-sm">
                        <span>Alle</span>
                        <Input
                          type="number"
                          min={1}
                          max={365}
                          className="w-16"
                          value={formData.recurrence_interval}
                          onChange={(e) =>
                            setFormData((prev) => ({
                              ...prev,
                              recurrence_interval: parseInt(e.target.value) || 1,
                            }))
                          }
                        />
                        <span>Tag(e)</span>
                      </div>
                    )}

                    {/* Weekly */}
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="weekly" id="weekly" />
                      <Label htmlFor="weekly" className="text-sm font-normal">
                        Wöchentlich
                      </Label>
                    </div>
                    {formData.recurrence_type === "weekly" && (
                      <div className="ml-6 space-y-2">
                        <div className="flex items-center gap-2 text-sm">
                          <span>Alle</span>
                          <Input
                            type="number"
                            min={1}
                            max={52}
                            className="w-16"
                            value={formData.recurrence_interval}
                            onChange={(e) =>
                              setFormData((prev) => ({
                                ...prev,
                                recurrence_interval: parseInt(e.target.value) || 1,
                              }))
                            }
                          />
                          <span>Woche(n) am:</span>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {WEEKDAYS.map((day) => (
                            <Button
                              key={day.value}
                              type="button"
                              size="sm"
                              variant={
                                formData.recurrence_weekdays.includes(day.value)
                                  ? "default"
                                  : "outline"
                              }
                              className="w-10 h-8"
                              onClick={() => handleWeekdayToggle(day.value)}
                            >
                              {day.label}
                            </Button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Monthly */}
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="monthly" id="monthly" />
                      <Label htmlFor="monthly" className="text-sm font-normal">
                        Monatlich
                      </Label>
                    </div>
                    {formData.recurrence_type === "monthly" && (
                      <div className="ml-6 flex items-center gap-2 text-sm flex-wrap">
                        <span>Am</span>
                        <Input
                          type="number"
                          min={1}
                          max={31}
                          className="w-16"
                          value={formData.recurrence_month_day}
                          onChange={(e) =>
                            setFormData((prev) => ({
                              ...prev,
                              recurrence_month_day: parseInt(e.target.value) || 1,
                            }))
                          }
                        />
                        <span>. Tag, alle</span>
                        <Input
                          type="number"
                          min={1}
                          max={12}
                          className="w-16"
                          value={formData.recurrence_interval}
                          onChange={(e) =>
                            setFormData((prev) => ({
                              ...prev,
                              recurrence_interval: parseInt(e.target.value) || 1,
                            }))
                          }
                        />
                        <span>Monat(e)</span>
                      </div>
                    )}

                    {/* Yearly */}
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="yearly" id="yearly" />
                      <Label htmlFor="yearly" className="text-sm font-normal">
                        Jährlich
                      </Label>
                    </div>
                    {formData.recurrence_type === "yearly" && (
                      <div className="ml-6 flex items-center gap-2 text-sm flex-wrap">
                        <span>Am</span>
                        <Input
                          type="number"
                          min={1}
                          max={31}
                          className="w-16"
                          value={formData.recurrence_month_day}
                          onChange={(e) =>
                            setFormData((prev) => ({
                              ...prev,
                              recurrence_month_day: parseInt(e.target.value) || 1,
                            }))
                          }
                        />
                        <span>.</span>
                        <Select
                          value={formData.recurrence_month}
                          onValueChange={(v) =>
                            setFormData((prev) => ({ ...prev, recurrence_month: v }))
                          }
                        >
                          <SelectTrigger className="w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {MONTHS.map((month) => (
                              <SelectItem key={month.value} value={month.value}>
                                {month.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </RadioGroup>
                </div>

                {/* End Condition */}
                <div className="space-y-2 pt-2 border-t border-border/50">
                  <Label className="text-sm font-medium">Seriendauer</Label>
                  <RadioGroup
                    value={formData.recurrence_end_type}
                    onValueChange={(v) =>
                      setFormData((prev) => ({
                        ...prev,
                        recurrence_end_type: v as "never" | "date" | "count",
                      }))
                    }
                    className="space-y-2"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="never" id="never" />
                      <Label htmlFor="never" className="text-sm font-normal">
                        Kein Enddatum
                      </Label>
                    </div>

                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="date" id="end-date" />
                      <Label htmlFor="end-date" className="text-sm font-normal">
                        Endet am:
                      </Label>
                      {formData.recurrence_end_type === "date" && (
                        <Input
                          type="date"
                          className="w-40"
                          value={formData.recurrence_end_date}
                          onChange={(e) =>
                            setFormData((prev) => ({
                              ...prev,
                              recurrence_end_date: e.target.value,
                            }))
                          }
                        />
                      )}
                    </div>

                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="count" id="end-count" />
                      <Label htmlFor="end-count" className="text-sm font-normal">
                        Endet nach
                      </Label>
                      {formData.recurrence_end_type === "count" && (
                        <>
                          <Input
                            type="number"
                            min={1}
                            max={999}
                            className="w-20"
                            value={formData.recurrence_count}
                            onChange={(e) =>
                              setFormData((prev) => ({
                                ...prev,
                                recurrence_count: parseInt(e.target.value) || 1,
                              }))
                            }
                          />
                          <span className="text-sm">Terminen</span>
                        </>
                      )}
                    </div>
                  </RadioGroup>
                </div>
              </div>
            )}
          </div>

          {/* Participants */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Share2 className="h-4 w-4" />
              Teilnehmer einladen
            </Label>
            <div className="max-h-32 overflow-y-auto border rounded-lg p-2 space-y-1">
              {profiles
                .filter((p) => p.user_id !== user?.id)
                .map((profile) => (
                  <div key={profile.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={profile.id}
                      checked={formData.selectedParticipants.includes(profile.user_id)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setFormData((prev) => ({
                            ...prev,
                            selectedParticipants: [
                              ...prev.selectedParticipants,
                              profile.user_id,
                            ],
                          }));
                        } else {
                          setFormData((prev) => ({
                            ...prev,
                            selectedParticipants: prev.selectedParticipants.filter(
                              (id) => id !== profile.user_id
                            ),
                          }));
                        }
                      }}
                    />
                    <Label htmlFor={profile.id} className="text-sm">
                      {profile.first_name || profile.last_name
                        ? `${profile.first_name || ""} ${profile.last_name || ""}`.trim()
                        : profile.email}
                    </Label>
                  </div>
                ))}
              {profiles.filter((p) => p.user_id !== user?.id).length === 0 && (
                <p className="text-sm text-muted-foreground py-2 text-center">
                  Keine Benutzer verfügbar
                </p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Abbrechen
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="glow-gold"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {isCreatingZoom ? "Zoom erstellen..." : "Erstellen..."}
                </>
              ) : (
                <>
                  <Plus className="mr-2 h-4 w-4" />
                  Termin erstellen
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
