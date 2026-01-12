import { Bell, Search, Shield, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface HeaderProps {
  title: string;
  subtitle?: string;
}

export function Header({ title, subtitle }: HeaderProps) {
  const currentDate = new Date().toLocaleDateString("de-CH", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <header className="h-16 border-b border-border bg-background/50 backdrop-blur-sm flex items-center justify-between px-6 sticky top-0 z-40">
      <div>
        <h1 className="text-lg font-semibold text-foreground">{title}</h1>
        {subtitle && (
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        )}
      </div>

      <div className="flex items-center gap-4">
        {/* Date & Time */}
        <div className="hidden md:flex items-center gap-2 text-sm text-muted-foreground">
          <Clock size={14} />
          <span>{currentDate}</span>
        </div>

        {/* Security Status */}
        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-md bg-success/10 border border-success/20">
          <Shield size={14} className="text-success" />
          <span className="text-xs font-medium text-success">Secure</span>
        </div>

        {/* Search */}
        <button className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
          <Search size={18} />
        </button>

        {/* Notifications */}
        <button className="relative p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
          <Bell size={18} />
          <span className="absolute top-1 right-1 w-2 h-2 bg-accent rounded-full" />
        </button>
      </div>
    </header>
  );
}
