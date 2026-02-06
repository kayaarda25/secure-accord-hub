import { useState } from "react";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Plus,
  Clock,
  MapPin,
  Users,
  AlertTriangle,
  Wallet,
  FileText,
  Loader2,
  Repeat,
  Share2,
  Video,
} from "lucide-react";
import { CreateEventDialog } from "@/components/calendar/CreateEventDialog";
import { EditEventDialog } from "@/components/calendar/EditEventDialog";
import { RespondEventDialog } from "@/components/calendar/RespondEventDialog";
import { DayView } from "@/components/calendar/DayView";
import { useCalendarEvents, type CalendarEvent } from "@/hooks/useCalendarEvents";

const months = [
  "Januar", "Februar", "März", "April", "Mai", "Juni",
  "Juli", "August", "September", "Oktober", "November", "Dezember"
];

const EVENT_TYPES = [
  { value: "meeting", label: "Meeting", icon: Users },
  { value: "deadline", label: "Deadline", icon: AlertTriangle },
  { value: "finance", label: "Finanzen", icon: Wallet },
  { value: "contract", label: "Vertrag", icon: FileText },
  { value: "other", label: "Sonstiges", icon: CalendarIcon },
];

export default function Calendar() {
  const { user } = useAuth();
  const today = new Date();
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editEvent, setEditEvent] = useState<CalendarEvent | null>(null);
  const [respondEvent, setRespondEvent] = useState<{ event: CalendarEvent; action: "accepted" | "declined" } | null>(null);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);

  const {
    expandedEvents,
    profiles,
    isLoading,
    fetchEvents,
    getEventsForDay,
    getProfileName,
  } = useCalendarEvents(currentMonth, currentYear);

  const getEventIcon = (type: string) => {
    const eventType = EVENT_TYPES.find((t) => t.value === type);
    const Icon = eventType?.icon || CalendarIcon;
    return <Icon size={14} />;
  };

  const getPriorityStyles = (priority: string) => {
    switch (priority) {
      case "critical": return "border-l-destructive bg-destructive/5";
      case "high": return "border-l-warning bg-warning/5";
      default: return "border-l-accent bg-accent/5";
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case "critical": return <Badge variant="destructive">Critical</Badge>;
      case "high": return <Badge className="bg-warning text-warning-foreground">Important</Badge>;
      default: return null;
    }
  };

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString("de-DE", { weekday: "short", day: "numeric", month: "short" });

  const isZoomLink = (location: string | null) =>
    location ? location.includes("zoom.us") || location.includes("zoom.com") : false;

  const formatTime = (timeStr: string | null) => (timeStr ? timeStr.slice(0, 5) : "");

  const getDaysInMonth = (m: number, y: number) => new Date(y, m + 1, 0).getDate();
  const getFirstDayOfMonth = (m: number, y: number) => new Date(y, m, 1).getDay();

  const daysInMonth = getDaysInMonth(currentMonth, currentYear);
  const firstDay = getFirstDayOfMonth(currentMonth, currentYear);

  const calendarDays: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) calendarDays.push(null);
  for (let i = 1; i <= daysInMonth; i++) calendarDays.push(i);

  const upcomingEvents = expandedEvents
    .filter((e) => new Date(e.event_date) >= new Date(today.toISOString().split("T")[0]))
    .slice(0, 5);

  const pendingInvitations = expandedEvents.filter((e) =>
    e.participants?.some((p) => p.user_id === user?.id && p.status === "pending")
  );

  if (isLoading) {
    return (
      <Layout title="Kalender & Termine" subtitle="Übersicht aller wichtigen Termine">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-accent" />
        </div>
      </Layout>
    );
  }

  // Day View
  if (selectedDay !== null) {
    const dayEvents = getEventsForDay(selectedDay);
    return (
      <Layout title="Kalender & Termine" subtitle="Tagesansicht">
        <DayView
          day={selectedDay}
          month={currentMonth}
          year={currentYear}
          events={dayEvents}
          onBack={() => setSelectedDay(null)}
          onEditEvent={(ev) => setEditEvent(ev)}
          onAcceptEvent={(ev) => setRespondEvent({ event: ev, action: "accepted" })}
          onDeclineEvent={(ev) => setRespondEvent({ event: ev, action: "declined" })}
          currentUserId={user?.id}
          getProfileName={getProfileName}
        />

        <EditEventDialog
          open={!!editEvent}
          onOpenChange={(open) => !open && setEditEvent(null)}
          event={editEvent}
          onEventUpdated={() => { fetchEvents(); setEditEvent(null); }}
        />
        <RespondEventDialog
          open={!!respondEvent}
          onOpenChange={(open) => !open && setRespondEvent(null)}
          eventId={respondEvent?.event.id || ""}
          eventTitle={respondEvent?.event.title || ""}
          action={respondEvent?.action || "accepted"}
          onResponded={() => { fetchEvents(); setRespondEvent(null); }}
        />
      </Layout>
    );
  }

  return (
    <Layout title="Kalender & Termine" subtitle="Übersicht aller wichtigen Termine">
      {/* Pending Invitations */}
      {pendingInvitations.length > 0 && (
        <Card className="mb-6 border-warning/50 bg-warning/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Share2 className="h-4 w-4" />
              Offene Einladungen ({pendingInvitations.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {pendingInvitations.map((event) => (
                <div key={`${event.id}-${event.event_date}`} className="flex items-center justify-between p-2 bg-background rounded-lg">
                  <div>
                    <p className="font-medium text-sm">{event.title}</p>
                    <p className="text-xs text-muted-foreground">{formatDate(event.event_date)}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => setRespondEvent({ event, action: "accepted" })}>
                      Annehmen
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setRespondEvent({ event, action: "declined" })}>
                      Ablehnen
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Action Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => {
              if (currentMonth === 0) { setCurrentMonth(11); setCurrentYear(currentYear - 1); }
              else setCurrentMonth(currentMonth - 1);
            }}
            className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronLeft size={20} />
          </button>
          <h2 className="text-lg font-semibold text-foreground min-w-[160px] text-center">
            {months[currentMonth]} {currentYear}
          </h2>
          <button
            onClick={() => {
              if (currentMonth === 11) { setCurrentMonth(0); setCurrentYear(currentYear + 1); }
              else setCurrentMonth(currentMonth + 1);
            }}
            className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronRight size={20} />
          </button>
        </div>

        <Button className="glow-gold" onClick={() => setCreateDialogOpen(true)}>
          <Plus size={16} className="mr-2" />
          Neuer Termin
        </Button>

        <CreateEventDialog
          open={createDialogOpen}
          onOpenChange={setCreateDialogOpen}
          profiles={profiles}
          onEventCreated={fetchEvents}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar Grid */}
        <div className="lg:col-span-2 card-state p-4 sm:p-6">
          <div className="grid grid-cols-7 gap-1 mb-2">
            {["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"].map((day) => (
              <div key={day} className="text-center text-xs font-medium text-muted-foreground py-2">{day}</div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {calendarDays.map((day, index) => {
              const dayEvents = day ? getEventsForDay(day) : [];
              const isToday = day === today.getDate() && currentMonth === today.getMonth() && currentYear === today.getFullYear();

              return (
                <div
                  key={index}
                  onClick={() => day && setSelectedDay(day)}
                  className={`min-h-[60px] sm:min-h-[80px] p-1 sm:p-2 rounded-lg border transition-colors ${
                    day ? "border-border/50 hover:border-border cursor-pointer hover:bg-muted/30" : "border-transparent"
                  } ${isToday ? "bg-accent/10 border-accent/30" : ""}`}
                >
                  {day && (
                    <>
                      <span className={`text-xs sm:text-sm font-medium ${isToday ? "text-accent" : "text-foreground"}`}>{day}</span>
                      <div className="mt-1 space-y-1 hidden sm:block">
                        {dayEvents.slice(0, 2).map((event, ei) => (
                          <div
                            key={`${event.id}-${ei}`}
                            className={`text-xs p-1 rounded truncate flex items-center gap-1 ${
                              event.priority === "critical" ? "bg-destructive/20 text-destructive"
                              : event.priority === "high" ? "bg-warning/20 text-warning"
                              : "bg-accent/20 text-accent"
                            }`}
                          >
                            {event.is_recurring && <Repeat className="h-3 w-3 flex-shrink-0" />}
                            <span className="truncate">{event.title.slice(0, 10)}</span>
                          </div>
                        ))}
                        {dayEvents.length > 2 && (
                          <span className="text-xs text-muted-foreground">+{dayEvents.length - 2}</span>
                        )}
                      </div>
                      {dayEvents.length > 0 && (
                        <div className="sm:hidden mt-1">
                          <div className={`w-2 h-2 rounded-full ${
                            dayEvents.some((e) => e.priority === "critical") ? "bg-destructive"
                            : dayEvents.some((e) => e.priority === "high") ? "bg-warning"
                            : "bg-accent"
                          }`} />
                        </div>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Upcoming Events */}
        <div className="space-y-4">
          <h3 className="font-semibold text-foreground">Anstehende Termine</h3>
          {upcomingEvents.length === 0 ? (
            <div className="card-state p-6 text-center">
              <CalendarIcon size={32} className="mx-auto text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground">Keine anstehenden Termine</p>
            </div>
          ) : (
            upcomingEvents.map((event, index) => (
              <div
                key={`${event.id}-${event.event_date}-${index}`}
                className={`card-state p-4 border-l-2 ${getPriorityStyles(event.priority)} animate-fade-in cursor-pointer`}
                style={{ animationDelay: `${index * 50}ms` }}
                onClick={() => {
                  const d = new Date(event.event_date);
                  setCurrentMonth(d.getMonth());
                  setCurrentYear(d.getFullYear());
                  setSelectedDay(d.getDate());
                }}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    {getEventIcon(event.event_type)}
                    <span className="text-xs uppercase tracking-wider">
                      {EVENT_TYPES.find((t) => t.value === event.event_type)?.label || event.event_type}
                    </span>
                    {event.is_recurring && <Repeat className="h-3 w-3 text-accent" />}
                  </div>
                  {getPriorityBadge(event.priority)}
                </div>
                <h4 className="font-medium text-foreground mb-1">{event.title}</h4>
                <div className="space-y-1 text-xs text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <CalendarIcon size={12} />
                    <span>{formatDate(event.event_date)}</span>
                    {event.start_time && (
                      <>
                        <Clock size={12} className="ml-2" />
                        <span>{formatTime(event.start_time)}</span>
                        {event.end_time && <span>- {formatTime(event.end_time)}</span>}
                      </>
                    )}
                  </div>
                  {event.location && (
                    <div className="flex items-center gap-2">
                      {isZoomLink(event.location) ? (
                        <><Video size={12} className="text-accent" /><span className="text-accent">Zoom</span></>
                      ) : (
                        <><MapPin size={12} /><span>{event.location}</span></>
                      )}
                    </div>
                  )}
                  {event.participants && event.participants.length > 0 && (
                    <div className="flex items-center gap-2">
                      <Users size={12} />
                      <span>{event.participants.length} Teilnehmer</span>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <EditEventDialog
        open={!!editEvent}
        onOpenChange={(open) => !open && setEditEvent(null)}
        event={editEvent}
        onEventUpdated={() => { fetchEvents(); setEditEvent(null); }}
      />
      <RespondEventDialog
        open={!!respondEvent}
        onOpenChange={(open) => !open && setRespondEvent(null)}
        eventId={respondEvent?.event.id || ""}
        eventTitle={respondEvent?.event.title || ""}
        action={respondEvent?.action || "accepted"}
        onResponded={() => { fetchEvents(); setRespondEvent(null); }}
      />
    </Layout>
  );
}
