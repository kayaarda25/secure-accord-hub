import { useNavigate } from "react-router-dom";
import { 
  FileText, 
  CheckSquare, 
  Receipt, 
  Calendar, 
  Bell, 
  AlertCircle,
  TrendingUp,
  Check,
  Trash2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { de } from "date-fns/locale";

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  link: string | null;
  is_read: boolean;
  created_at: string;
}

interface NotificationItemProps {
  notification: Notification;
  onMarkAsRead: (id: string) => void;
  onDelete: (id: string) => void;
}

const typeIcons: Record<string, typeof Bell> = {
  task: CheckSquare,
  document: FileText,
  expense: Receipt,
  calendar: Calendar,
  system: Bell,
  approval: AlertCircle,
  budget: TrendingUp,
};

const typeColors: Record<string, string> = {
  task: "text-blue-500 bg-blue-500/10",
  document: "text-purple-500 bg-purple-500/10",
  expense: "text-green-500 bg-green-500/10",
  calendar: "text-orange-500 bg-orange-500/10",
  system: "text-gray-500 bg-gray-500/10",
  approval: "text-amber-500 bg-amber-500/10",
  budget: "text-emerald-500 bg-emerald-500/10",
};

export function NotificationItem({ notification, onMarkAsRead, onDelete }: NotificationItemProps) {
  const navigate = useNavigate();
  const Icon = typeIcons[notification.type] || Bell;
  const colorClass = typeColors[notification.type] || "text-gray-500 bg-gray-500/10";

  const handleClick = () => {
    if (!notification.is_read) {
      onMarkAsRead(notification.id);
    }
    if (notification.link) {
      navigate(notification.link);
    }
  };

  return (
    <div
      className={cn(
        "flex items-start gap-3 p-3 hover:bg-muted/50 cursor-pointer transition-colors group",
        !notification.is_read && "bg-primary/5"
      )}
      onClick={handleClick}
    >
      <div className={cn("p-2 rounded-lg", colorClass)}>
        <Icon className="h-4 w-4" />
      </div>
      
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className={cn(
            "text-sm line-clamp-1",
            !notification.is_read && "font-medium"
          )}>
            {notification.title}
          </p>
          {!notification.is_read && (
            <div className="h-2 w-2 rounded-full bg-primary flex-shrink-0 mt-1.5" />
          )}
        </div>
        <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
          {notification.message}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          {formatDistanceToNow(new Date(notification.created_at), {
            addSuffix: true,
            locale: de,
          })}
        </p>
      </div>

      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {!notification.is_read && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={(e) => {
              e.stopPropagation();
              onMarkAsRead(notification.id);
            }}
          >
            <Check className="h-3 w-3" />
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-destructive hover:text-destructive"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(notification.id);
          }}
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}
