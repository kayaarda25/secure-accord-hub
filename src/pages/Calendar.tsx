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

interface CalendarEvent {
  id: number;
  title: string;
  date: string;
  time: string;
  type: string;
  priority: string;
  description?: string;
  location?: string;
  attendees?: string[];
}

// Empty events array - data will come from database
const events: CalendarEvent[] = [];

const months = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

export default function Calendar() {
  const today = new Date();
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [currentYear, setCurrentYear] = useState(today.getFullYear());

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
            Critical
          </span>
        );
      case "warning":
        return (
          <span className="px-2 py-0.5 text-xs font-medium rounded status-warning">
            Important
          </span>
        );
      default:
        return null;
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
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
    <Layout title="Calendar & Deadlines" subtitle="Overview of all important dates">
      {/* Action Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
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
          New Event
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar Grid */}
        <div className="lg:col-span-2 card-state p-4 sm:p-6">
          {/* Weekday Headers */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
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
                day === today.getDate() && currentMonth === today.getMonth() && currentYear === today.getFullYear();

              return (
                <div
                  key={index}
                  className={`min-h-[60px] sm:min-h-[80px] p-1 sm:p-2 rounded-lg border transition-colors ${
                    day
                      ? "border-border/50 hover:border-border cursor-pointer"
                      : "border-transparent"
                  } ${isToday ? "bg-accent/10 border-accent/30" : ""}`}
                >
                  {day && (
                    <>
                      <span
                        className={`text-xs sm:text-sm font-medium ${
                          isToday ? "text-accent" : "text-foreground"
                        }`}
                      >
                        {day}
                      </span>
                      <div className="mt-1 space-y-1 hidden sm:block">
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
                            +{dayEvents.length - 2} more
                          </span>
                        )}
                      </div>
                      {dayEvents.length > 0 && (
                        <div className="sm:hidden mt-1">
                          <div className={`w-2 h-2 rounded-full ${
                            dayEvents.some(e => e.priority === "critical")
                              ? "bg-destructive"
                              : dayEvents.some(e => e.priority === "warning")
                              ? "bg-warning"
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
          <h3 className="font-semibold text-foreground">Upcoming Events</h3>
          {events.length === 0 ? (
            <div className="card-state p-6 text-center">
              <CalendarIcon size={32} className="mx-auto text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground">No upcoming events</p>
              <p className="text-xs text-muted-foreground mt-1">Click "New Event" to add one</p>
            </div>
          ) : (
            events.map((event, index) => (
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
                        ? "Deadline"
                        : event.type === "meeting"
                        ? "Meeting"
                        : event.type === "finance"
                        ? "Finance"
                        : "Contract"}
                    </span>
                  </div>
                  {getPriorityBadge(event.priority)}
                </div>
                <h4 className="font-medium text-foreground mb-1">{event.title}</h4>
                <div className="space-y-1 text-xs text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <CalendarIcon size={12} />
                    <span>{formatDate(event.date)}</span>
                    {event.time !== "Deadline" && (
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
            ))
          )}
        </div>
      </div>
    </Layout>
  );
}
