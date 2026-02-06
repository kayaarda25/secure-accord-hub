import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Clock,
  MapPin,
  Users,
  Video,
  Repeat,
  Share2,
  Pencil,
  Check,
  X,
  ChevronLeft,
  Calendar as CalendarIcon,
  AlertTriangle,
  Wallet,
  FileText,
} from "lucide-react";
import type { CalendarEvent, Profile } from "@/hooks/useCalendarEvents";

interface DayViewProps {
  day: number;
  month: number;
  year: number;
  events: CalendarEvent[];
  onBack: () => void;
  onEditEvent: (event: CalendarEvent) => void;
  onAcceptEvent: (event: CalendarEvent) => void;
  onDeclineEvent: (event: CalendarEvent) => void;
  currentUserId: string | undefined;
  getProfileName: (userId: string) => string;
}

const HOURS = Array.from({ length: 24 }, (_, i) => i);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const EVENT_TYPES: Record<string, { label: string; icon: any }> = {
  meeting: { label: "Meeting", icon: Users },
  deadline: { label: "Deadline", icon: AlertTriangle },
  finance: { label: "Finanzen", icon: Wallet },
  contract: { label: "Vertrag", icon: FileText },
  other: { label: "Sonstiges", icon: CalendarIcon },
};

const WEEKDAY_NAMES = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];

function getEventHour(timeStr: string | null): number | null {
  if (!timeStr) return null;
  return parseInt(timeStr.split(":")[0], 10);
}

function formatTime(timeStr: string | null) {
  if (!timeStr) return "";
  return timeStr.slice(0, 5);
}

function isZoomLink(location: string | null): boolean {
  if (!location) return false;
  return location.includes("zoom.us") || location.includes("zoom.com");
}

export function DayView({
  day,
  month,
  year,
  events,
  onBack,
  onEditEvent,
  onAcceptEvent,
  onDeclineEvent,
  currentUserId,
  getProfileName,
}: DayViewProps) {
  const date = new Date(year, month, day);
  const weekday = WEEKDAY_NAMES[date.getDay()];

  // Separate all-day events (no start_time) from timed events
  const allDayEvents = events.filter((e) => !e.start_time);
  const timedEvents = events.filter((e) => e.start_time);

  const getEventsAtHour = (hour: number) =>
    timedEvents.filter((e) => getEventHour(e.start_time) === hour);

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "critical": return "border-l-destructive bg-destructive/5";
      case "high": return "border-l-warning bg-warning/5";
      default: return "border-l-accent bg-accent/5";
    }
  };

  const renderEvent = (event: CalendarEvent) => {
    const TypeIcon = EVENT_TYPES[event.event_type]?.icon || CalendarIcon;
    const isCreator = event.created_by === currentUserId;
    const myParticipation = event.participants?.find((p) => p.user_id === currentUserId);

    return (
      <div
        key={`${event.id}-${event.event_date}`}
        className={`p-3 rounded-lg border-l-2 ${getPriorityColor(event.priority)} space-y-2`}
      >
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <TypeIcon size={12} />
              <span>{EVENT_TYPES[event.event_type]?.label || event.event_type}</span>
              {event.is_recurring && <Repeat className="h-3 w-3" />}
            </div>
            <h4 className="font-medium text-sm text-foreground">{event.title}</h4>
          </div>
          {isCreator && (
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEditEvent(event)}>
              <Pencil className="h-3 w-3" />
            </Button>
          )}
        </div>

        <div className="text-xs text-muted-foreground space-y-1">
          {event.start_time && (
            <div className="flex items-center gap-2">
              <Clock size={12} />
              <span>
                {formatTime(event.start_time)}
                {event.end_time && ` - ${formatTime(event.end_time)}`}
              </span>
            </div>
          )}
          {event.location && (
            <div className="flex items-center gap-2">
              {isZoomLink(event.location) ? (
                <>
                  <Video size={12} className="text-accent" />
                  <a href={event.location} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline truncate">
                    Zoom-Meeting beitreten
                  </a>
                </>
              ) : (
                <>
                  <MapPin size={12} />
                  <span>{event.location}</span>
                </>
              )}
            </div>
          )}
          {event.description && <p className="mt-1">{event.description}</p>}
        </div>

        {/* Participants */}
        {event.participants && event.participants.length > 0 && (
          <div className="space-y-1">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Users size={12} />
              <span>{event.participants.length} Teilnehmer</span>
            </div>
            <div className="flex flex-wrap gap-1">
              {event.participants.map((p) => (
                <Badge
                  key={p.id}
                  variant={p.status === "accepted" ? "default" : p.status === "declined" ? "destructive" : "secondary"}
                  className="text-xs"
                >
                  {getProfileName(p.user_id)}
                  {p.status === "accepted" && <Check className="h-3 w-3 ml-1" />}
                  {p.status === "declined" && <X className="h-3 w-3 ml-1" />}
                </Badge>
              ))}
            </div>
            {/* Show response reasons */}
            {event.participants.filter((p) => p.response_reason).map((p) => (
              <p key={p.id} className="text-xs text-muted-foreground italic ml-2">
                {getProfileName(p.user_id)}: "{p.response_reason}"
              </p>
            ))}
          </div>
        )}

        {/* Accept/Decline for current user */}
        {myParticipation && myParticipation.status === "pending" && (
          <div className="flex gap-2 pt-1">
            <Button size="sm" variant="outline" onClick={() => onAcceptEvent(event)}>
              <Check className="h-3 w-3 mr-1" /> Annehmen
            </Button>
            <Button size="sm" variant="ghost" onClick={() => onDeclineEvent(event)}>
              <X className="h-3 w-3 mr-1" /> Ablehnen
            </Button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <div>
          <h2 className="text-lg font-semibold text-foreground">
            {weekday}, {day}. {["Januar","Februar","März","April","Mai","Juni","Juli","August","September","Oktober","November","Dezember"][month]} {year}
          </h2>
          <p className="text-sm text-muted-foreground">{events.length} Termine</p>
        </div>
      </div>

      {/* All-day events */}
      {allDayEvents.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-muted-foreground">Ganztägig</h3>
          {allDayEvents.map(renderEvent)}
        </div>
      )}

      {/* Hourly timeline */}
      <ScrollArea className="h-[calc(100vh-280px)]">
        <div className="space-y-0">
          {HOURS.map((hour) => {
            const hourEvents = getEventsAtHour(hour);
            return (
              <div key={hour} className="flex min-h-[60px] border-t border-border/30">
                <div className="w-16 shrink-0 py-2 text-xs text-muted-foreground text-right pr-3">
                  {String(hour).padStart(2, "0")}:00
                </div>
                <div className="flex-1 py-1 space-y-1 pl-2">
                  {hourEvents.map(renderEvent)}
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
