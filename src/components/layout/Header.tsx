import { useState, useEffect } from "react";
import { Shield, Clock, Menu, Timer } from "lucide-react";
import { NotificationCenter } from "@/components/notifications/NotificationCenter";
import { GlobalSearch } from "@/components/search/GlobalSearch";
import { ThemeToggle } from "@/components/theme/ThemeToggle";

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
    <header className="h-14 header-frosted flex items-center justify-between px-4 lg:px-6 sticky top-0 z-40">
      <div className="flex items-center gap-3">
        {/* Mobile menu button */}
        {onMenuClick && (
          <button
            onClick={onMenuClick}
            className="p-2 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-all duration-200 lg:hidden"
          >
            <Menu size={18} />
          </button>
        )}
        
        <div>
          <h1 className="text-base font-semibold text-foreground tracking-tight">{title}</h1>
          {subtitle && (
            <p className="text-xs text-muted-foreground hidden sm:block">{subtitle}</p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1.5 sm:gap-3">
        {/* Date & Time */}
        <div className="hidden lg:flex items-center gap-2 text-xs text-muted-foreground">
          <Clock size={12} className="opacity-60" />
          <span className="font-medium">{currentDate}</span>
        </div>

        {/* Divider */}
        <div className="hidden lg:block h-4 w-px bg-border/60" />

        {/* Session Timer */}
        <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-muted/40 border border-border/50">
          <Timer size={12} className="text-muted-foreground/70" />
          <span className="text-[11px] font-mono font-medium text-muted-foreground tabular-nums">
            {formatDuration(sessionSeconds)}
          </span>
        </div>

        {/* Security Status */}
        <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-md status-success">
          <Shield size={12} />
          <span className="text-[11px] font-semibold uppercase tracking-wide">Secure</span>
        </div>

        {/* Divider */}
        <div className="hidden sm:block h-4 w-px bg-border/60" />

        {/* Theme Toggle */}
        <ThemeToggle />

        {/* Global Search */}
        <GlobalSearch />

        {/* Notifications */}
        <NotificationCenter />
      </div>
    </header>
  );
}
