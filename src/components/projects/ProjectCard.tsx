import { Project } from "@/hooks/useProjects";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { MoreHorizontal, Calendar, CheckCircle2, Trash2 } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

interface ProjectCardProps {
  project: Project;
  onClick: () => void;
  onDelete: () => void;
  onStatusChange: (status: string) => void;
}

const STATUS_LABELS: Record<string, string> = {
  planning: "Planung",
  active: "Aktiv",
  on_hold: "Pausiert",
  completed: "Abgeschlossen",
};

const PRIORITY_COLORS: Record<string, string> = {
  low: "bg-muted text-muted-foreground",
  normal: "bg-primary/10 text-primary",
  high: "bg-warning/10 text-warning",
  critical: "bg-destructive/10 text-destructive",
};

export function ProjectCard({ project, onClick, onDelete, onStatusChange }: ProjectCardProps) {
  const progress = project.task_count
    ? Math.round(((project.done_count || 0) / project.task_count) * 100)
    : 0;

  const formatDate = (d: string | null) =>
    d ? new Date(d).toLocaleDateString("de-CH", { day: "numeric", month: "short" }) : null;

  return (
    <Card
      className="hover:shadow-lg transition-shadow cursor-pointer group"
      onClick={onClick}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: project.color || "#c9a227" }} />
            <CardTitle className="text-base line-clamp-1">{project.name}</CardTitle>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
              {Object.entries(STATUS_LABELS).map(([key, label]) => (
                <DropdownMenuItem key={key} onClick={() => onStatusChange(key)}>
                  {label}
                </DropdownMenuItem>
              ))}
              <DropdownMenuItem className="text-destructive" onClick={onDelete}>
                <Trash2 className="h-4 w-4 mr-2" />
                Löschen
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {project.description && (
          <p className="text-xs text-muted-foreground line-clamp-2">{project.description}</p>
        )}

        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline" className="text-xs">
            {STATUS_LABELS[project.status] || project.status}
          </Badge>
          <Badge className={`text-xs ${PRIORITY_COLORS[project.priority] || ""}`} variant="secondary">
            {project.priority}
          </Badge>
        </div>

        <div className="space-y-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3" />
              {project.done_count || 0}/{project.task_count || 0} Tasks
            </span>
            <span>{progress}%</span>
          </div>
          <Progress value={progress} className="h-1.5" />
        </div>

        {(project.start_date || project.end_date) && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Calendar className="h-3 w-3" />
            {formatDate(project.start_date)} – {formatDate(project.end_date) || "offen"}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
