import { useState, useEffect } from "react";
import { Shield, Clock, Menu, Timer } from "lucide-react";
import { NotificationCenter } from "@/components/notifications/NotificationCenter";
import { GlobalSearch } from "@/components/search/GlobalSearch";

interface HeaderProps {
  title: string;
  subtitle?: string;
  onMenuClick?: () => void;
}

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  if (hours > 0) {
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export function Header({ title, subtitle, onMenuClick }: HeaderProps) {
  const [sessionSeconds, setSessionSeconds] = useState(0);
  
  const currentDate = new Date().toLocaleDateString("de-DE", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  // Session timer - counts how long user has been on the page
  useEffect(() => {
    const interval = setInterval(() => {
      setSessionSeconds(prev => prev + 1);
    }, 1000);
    
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="h-16 border-b border-border bg-background/50 backdrop-blur-sm flex items-center justify-between px-4 lg:px-6 sticky top-0 z-40">
      <div className="flex items-center gap-3">
        {/* Mobile menu button */}
        {onMenuClick && (
          <button
            onClick={onMenuClick}
            className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors lg:hidden"
          >
            <Menu size={20} />
          </button>
        )}
        
        <div>
          <h1 className="text-lg font-semibold text-foreground">{title}</h1>
          {subtitle && (
            <p className="text-sm text-muted-foreground hidden sm:block">{subtitle}</p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-4">
        {/* Date & Time */}
        <div className="hidden lg:flex items-center gap-2 text-sm text-muted-foreground">
          <Clock size={14} />
          <span>{currentDate}</span>
        </div>

        {/* Session Timer */}
        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted/50 border border-border">
          <Timer size={14} className="text-muted-foreground" />
          <span className="text-xs font-mono font-medium text-muted-foreground">
            {formatDuration(sessionSeconds)}
          </span>
        </div>

        {/* Security Status */}
        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-success/10 border border-success/20">
          <Shield size={14} className="text-success" />
          <span className="text-xs font-medium text-success">Secure</span>
        </div>

        {/* Global Search */}
        <GlobalSearch />

        {/* Notifications */}
        <NotificationCenter />
      </div>
    </header>
  );
}
