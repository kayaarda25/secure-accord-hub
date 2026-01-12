import { ReactNode } from "react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface MetricCardProps {
  title: string;
  value: string;
  change?: number;
  changeLabel?: string;
  icon: ReactNode;
  variant?: "default" | "accent" | "success" | "warning" | "critical";
}

export function MetricCard({
  title,
  value,
  change,
  changeLabel,
  icon,
  variant = "default",
}: MetricCardProps) {
  const getTrendIcon = () => {
    if (change === undefined) return null;
    if (change > 0) return <TrendingUp size={14} className="text-success" />;
    if (change < 0) return <TrendingDown size={14} className="text-destructive" />;
    return <Minus size={14} className="text-muted-foreground" />;
  };

  const getChangeColor = () => {
    if (change === undefined) return "";
    if (change > 0) return "text-success";
    if (change < 0) return "text-destructive";
    return "text-muted-foreground";
  };

  const cardClasses = {
    default: "card-state",
    accent: "card-accent",
    success: "card-state border-success/20",
    warning: "card-state border-warning/20",
    critical: "card-state border-destructive/20",
  };

  return (
    <div className={`${cardClasses[variant]} p-6 animate-fade-in`}>
      <div className="flex items-start justify-between mb-4">
        <div className="p-2 rounded-lg bg-muted/50">{icon}</div>
        {change !== undefined && (
          <div className={`flex items-center gap-1 text-sm ${getChangeColor()}`}>
            {getTrendIcon()}
            <span>{Math.abs(change)}%</span>
          </div>
        )}
      </div>
      <div className="metric-label mb-1">{title}</div>
      <div className="metric-value animate-count">{value}</div>
      {changeLabel && (
        <p className="text-xs text-muted-foreground mt-2">{changeLabel}</p>
      )}
    </div>
  );
}
