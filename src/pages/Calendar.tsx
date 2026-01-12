import { Layout } from "@/components/layout/Layout";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Plus,
  Clock,
  MapPin,
  Users,
  FileText,
  Wallet,
  AlertTriangle,
} from "lucide-react";
import { useState } from "react";

const events = [
  {
    id: 1,
    title: "Lizenzverlängerung Uganda",
    date: "2024-10-28",
    time: "Frist",
    type: "deadline",
    priority: "critical",
    description: "Telekom-Lizenz muss erneuert werden",
  },
  {
    id: 2,
    title: "Q3 Quartalsabrechnung",
    date: "2024-10-31",
    time: "Frist",
    type: "finance",
    priority: "warning",
    description: "Finanzberichte an Partner",
  },
  {
    id: 3,
    title: "Partner-Review Meeting",
    date: "2024-11-05",
    time: "10:00",
    type: "meeting",
    priority: "normal",
    location: "Zürich / Video",
    attendees: ["MGI AG", "URA", "MTN"],
  },
  {
    id: 4,
    title: "Board Meeting Q4",
    date: "2024-11-12",
    time: "14:00",
    type: "meeting",
    priority: "normal",
    location: "Bern",
    attendees: ["Vorstand", "Geschäftsführung"],
  },
  {
    id: 5,
    title: "Vertragsverlängerung MTN",
    date: "2024-11-15",
    time: "Frist",
    type: "contract",
    priority: "normal",
    description: "Revenue-Share Vertrag",
  },
  {
    id: 6,
    title: "Compliance Audit",
    date: "2024-11-20",
    time: "09:00",
    type: "meeting",
    priority: "warning",
    location: "Zürich",
    attendees: ["KPMG", "Interne Revision"],
  },
];

const months = [
  "Januar", "Februar", "März", "April", "Mai", "Juni",
  "Juli", "August", "September", "Oktober", "November", "Dezember"
];

export default function Calendar() {
  const [currentMonth, setCurrentMonth] = useState(9); // October
  const [currentYear, setCurrentYear] = useState(2024);

  const getEventIcon = (type: string) => {
    switch (type) {
      case "deadline":
        return <AlertTriangle size={14} />;
      case "finance":
        return <Wallet size={14} />;
      case "meeting":
        return <Users size={14} />;
      case "contract":
        return <FileText size={14} />;
      default:
        return <CalendarIcon size={14} />;
    }
  };

  const getPriorityStyles = (priority: string) => {
    switch (priority) {
      case "critical":
        return "border-l-destructive bg-destructive/5";
      case "warning":
        return "border-l-warning bg-warning/5";
      default:
        return "border-l-accent bg-accent/5";
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case "critical":
        return (
          <span className="px-2 py-0.5 text-xs font-medium rounded status-critical">
            Kritisch
          </span>
        );
      case "warning":
        return (
          <span className="px-2 py-0.5 text-xs font-medium rounded status-warning">
            Wichtig
          </span>
        );
      default:
        return null;
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("de-CH", {
      weekday: "short",
      day: "numeric",
      month: "short",
    });
  };

  const getDaysInMonth = (month: number, year: number) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (month: number, year: number) => {
    return new Date(year, month, 1).getDay();
  };

  const daysInMonth = getDaysInMonth(currentMonth, currentYear);
  const firstDay = getFirstDayOfMonth(currentMonth, currentYear);

  const calendarDays = [];
  for (let i = 0; i < firstDay; i++) {
    calendarDays.push(null);
  }
  for (let i = 1; i <= daysInMonth; i++) {
    calendarDays.push(i);
  }

  const getEventsForDay = (day: number) => {
    const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    return events.filter((e) => e.date === dateStr);
  };

  return (
    <Layout title="Kalender & Fristen" subtitle="Übersicht aller wichtigen Termine">
      {/* Action Bar */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => {
              if (currentMonth === 0) {
                setCurrentMonth(11);
                setCurrentYear(currentYear - 1);
              } else {
                setCurrentMonth(currentMonth - 1);
              }
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
              if (currentMonth === 11) {
                setCurrentMonth(0);
                setCurrentYear(currentYear + 1);
              } else {
                setCurrentMonth(currentMonth + 1);
              }
            }}
            className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronRight size={20} />
          </button>
        </div>
        <button className="px-4 py-2 bg-accent text-accent-foreground rounded-lg text-sm font-medium hover:bg-accent/90 transition-colors flex items-center gap-2 glow-gold">
          <Plus size={16} />
          Neuer Termin
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar Grid */}
        <div className="lg:col-span-2 card-state p-6">
          {/* Weekday Headers */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"].map((day) => (
              <div
                key={day}
                className="text-center text-xs font-medium text-muted-foreground py-2"
              >
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Days */}
          <div className="grid grid-cols-7 gap-1">
            {calendarDays.map((day, index) => {
              const dayEvents = day ? getEventsForDay(day) : [];
              const isToday =
                day === 21 && currentMonth === 9 && currentYear === 2024;

              return (
                <div
                  key={index}
                  className={`min-h-[80px] p-2 rounded-lg border transition-colors ${
                    day
                      ? "border-border/50 hover:border-border cursor-pointer"
                      : "border-transparent"
                  } ${isToday ? "bg-accent/10 border-accent/30" : ""}`}
                >
                  {day && (
                    <>
                      <span
                        className={`text-sm font-medium ${
                          isToday ? "text-accent" : "text-foreground"
                        }`}
                      >
                        {day}
                      </span>
                      <div className="mt-1 space-y-1">
                        {dayEvents.slice(0, 2).map((event) => (
                          <div
                            key={event.id}
                            className={`text-xs p-1 rounded truncate ${
                              event.priority === "critical"
                                ? "bg-destructive/20 text-destructive"
                                : event.priority === "warning"
                                ? "bg-warning/20 text-warning"
                                : "bg-accent/20 text-accent"
                            }`}
                          >
                            {event.title.slice(0, 12)}...
                          </div>
                        ))}
                        {dayEvents.length > 2 && (
                          <span className="text-xs text-muted-foreground">
                            +{dayEvents.length - 2} mehr
                          </span>
                        )}
                      </div>
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
          {events.map((event, index) => (
            <div
              key={event.id}
              className={`card-state p-4 border-l-2 ${getPriorityStyles(
                event.priority
              )} animate-fade-in`}
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2 text-muted-foreground">
                  {getEventIcon(event.type)}
                  <span className="text-xs uppercase tracking-wider">
                    {event.type === "deadline"
                      ? "Frist"
                      : event.type === "meeting"
                      ? "Meeting"
                      : event.type === "finance"
                      ? "Finanzen"
                      : "Vertrag"}
                  </span>
                </div>
                {getPriorityBadge(event.priority)}
              </div>
              <h4 className="font-medium text-foreground mb-1">{event.title}</h4>
              <div className="space-y-1 text-xs text-muted-foreground">
                <div className="flex items-center gap-2">
                  <CalendarIcon size={12} />
                  <span>{formatDate(event.date)}</span>
                  {event.time !== "Frist" && (
                    <>
                      <Clock size={12} className="ml-2" />
                      <span>{event.time}</span>
                    </>
                  )}
                </div>
                {event.location && (
                  <div className="flex items-center gap-2">
                    <MapPin size={12} />
                    <span>{event.location}</span>
                  </div>
                )}
                {event.attendees && (
                  <div className="flex items-center gap-2">
                    <Users size={12} />
                    <span>{event.attendees.join(", ")}</span>
                  </div>
                )}
                {event.description && (
                  <p className="mt-2 text-muted-foreground">
                    {event.description}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </Layout>
  );
}
