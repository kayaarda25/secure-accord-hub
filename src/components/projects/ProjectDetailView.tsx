import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Layout } from "@/components/layout/Layout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { ArrowLeft, Plus, FileText, Loader2, User, Calendar } from "lucide-react";
import { Project } from "@/hooks/useProjects";
import { CreateProjectTaskDialog } from "./CreateProjectTaskDialog";

interface TaskParticipant {
  id: string;
  user_id: string;
  status: string;
}

interface Task {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  due_date: string | null;
  project_id: string | null;
  participants: TaskParticipant[];
}

interface Profile {
  id: string;
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
}

const TASK_STATUS_LABELS: Record<string, string> = {
  todo: "To Do",
  in_progress: "In Arbeit",
  done: "Erledigt",
};

const PRIORITY_COLORS: Record<string, string> = {
  low: "bg-muted text-muted-foreground",
  normal: "bg-accent/20 text-accent",
  high: "bg-warning/20 text-warning",
  critical: "bg-destructive/20 text-destructive",
};

interface ProjectDetailViewProps {
  project: Project;
  onBack: () => void;
  onAssignTask: (taskId: string, projectId: string | null) => Promise<void>;
}

export function ProjectDetailView({ project, onBack, onAssignTask }: ProjectDetailViewProps) {
  const { user } = useAuth();
  const [projectTasks, setProjectTasks] = useState<Task[]>([]);
  const [unassignedTasks, setUnassignedTasks] = useState<Task[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [quickTitle, setQuickTitle] = useState("");
  const [isQuickAdding, setIsQuickAdding] = useState(false);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);

  const fetchProfiles = useCallback(async () => {
    const { data } = await supabase
      .from("profiles")
      .select("id, user_id, first_name, last_name, email")
      .eq("is_active", true);
    setProfiles(data || []);
  }, []);

  useEffect(() => {
    fetchProjectTasks();
    fetchProfiles();
  }, [project.id]);

  const fetchProjectTasks = async () => {
    setTasksLoading(true);
    try {
      const [{ data: assigned }, { data: unassigned }] = await Promise.all([
        supabase
          .from("tasks")
          .select("id, title, description, status, priority, due_date, project_id, participants:task_participants(id, user_id, status)")
          .eq("project_id", project.id)
          .order("created_at", { ascending: false }),
        supabase
          .from("tasks")
          .select("id, title, description, status, priority, due_date, project_id, participants:task_participants(id, user_id, status)")
          .is("project_id", null)
          .order("created_at", { ascending: false }),
      ]);
      setProjectTasks((assigned || []) as Task[]);
      setUnassignedTasks((unassigned || []) as Task[]);
    } catch (error) {
      console.error("Error fetching tasks:", error);
    } finally {
      setTasksLoading(false);
    }
  };

  const getProfileName = (userId: string) => {
    const profile = profiles.find((p) => p.user_id === userId);
    if (profile?.first_name || profile?.last_name) {
      return `${profile.first_name || ""} ${profile.last_name || ""}`.trim();
    }
    return profile?.email || "Unbekannt";
  };

  const handleQuickAdd = async () => {
    if (!user || !quickTitle.trim()) return;
    setIsQuickAdding(true);
    try {
      const { error } = await supabase.from("tasks").insert({
        title: quickTitle.trim(),
        status: "todo",
        priority: "normal",
        created_by: user.id,
        project_id: project.id,
      });
      if (error) throw error;
      toast.success("Task erstellt");
      setQuickTitle("");
      fetchProjectTasks();
    } catch (error) {
      console.error("Error quick-adding task:", error);
      toast.error("Fehler beim Erstellen");
    } finally {
      setIsQuickAdding(false);
    }
  };

  const handleUnassignTask = async (taskId: string) => {
    await onAssignTask(taskId, null);
    fetchProjectTasks();
  };

  const handleAssignTask = async (taskId: string) => {
    await onAssignTask(taskId, project.id);
    fetchProjectTasks();
  };

  const isOverdue = (dueDate: string | null) => {
    if (!dueDate) return false;
    return new Date(dueDate) < new Date(new Date().toISOString().split("T")[0]);
  };

  const todoTasks = projectTasks.filter((t) => t.status === "todo");
  const inProgressTasks = projectTasks.filter((t) => t.status === "in_progress");
  const doneTasks = projectTasks.filter((t) => t.status === "done");

  const renderTaskCard = (task: Task) => (
    <Card key={task.id} className="p-3 group">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-medium truncate">{task.title}</span>
            {task.priority !== "normal" && (
              <Badge variant="secondary" className={`text-[10px] px-1.5 py-0 ${PRIORITY_COLORS[task.priority]}`}>
                {task.priority === "high" ? "Hoch" : task.priority === "critical" ? "Kritisch" : "Niedrig"}
              </Badge>
            )}
          </div>
          {task.description && (
            <p className="text-xs text-muted-foreground line-clamp-2 mb-1.5">{task.description}</p>
          )}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            {task.due_date && (
              <div className={`flex items-center gap-1 text-xs ${isOverdue(task.due_date) && task.status !== "done" ? "text-destructive font-medium" : "text-muted-foreground"}`}>
                <Calendar className="h-3 w-3" />
                {new Date(task.due_date).toLocaleDateString("de-CH")}
              </div>
            )}
            {task.participants && task.participants.length > 0 && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <User className="h-3 w-3" />
                {task.participants.map((p) => getProfileName(p.user_id)).join(", ")}
              </div>
            )}
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="text-xs opacity-0 group-hover:opacity-100 shrink-0"
          onClick={() => handleUnassignTask(task.id)}
        >
          Entfernen
        </Button>
      </div>
    </Card>
  );

  return (
    <Layout title={project.name} subtitle="Projektdetails">
      <div className="flex items-center justify-between mb-4">
        <Button variant="ghost" size="sm" onClick={onBack} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Zurück
        </Button>
        <Button size="sm" onClick={() => setDetailDialogOpen(true)}>
          <FileText className="h-4 w-4 mr-2" />
          Task mit Details
        </Button>
      </div>

      {project.description && (
        <p className="text-sm text-muted-foreground mb-4">{project.description}</p>
      )}

      {/* Inline Quick Add */}
      <div className="flex gap-2 mb-6">
        <Input
          value={quickTitle}
          onChange={(e) => setQuickTitle(e.target.value)}
          placeholder="Neuer Task – Titel eingeben und Enter drücken..."
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleQuickAdd();
            }
          }}
          disabled={isQuickAdding}
        />
        <Button onClick={handleQuickAdd} disabled={isQuickAdding || !quickTitle.trim()} size="sm">
          {isQuickAdding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
        </Button>
      </div>

      {/* Task Kanban */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {[
          { key: "todo", label: "To Do", tasks: todoTasks, color: "text-primary" },
          { key: "in_progress", label: "In Arbeit", tasks: inProgressTasks, color: "text-warning" },
          { key: "done", label: "Erledigt", tasks: doneTasks, color: "text-success" },
        ].map((col) => (
          <div key={col.key} className="space-y-2">
            <div className="flex items-center gap-2 px-1">
              <span className={`text-sm font-semibold ${col.color}`}>{col.label}</span>
              <Badge variant="secondary" className="text-xs">{col.tasks.length}</Badge>
            </div>
            <div className="space-y-2 min-h-[100px] p-2 rounded-lg bg-muted/30 border border-border/50">
              {col.tasks.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">Keine Tasks</p>
              ) : (
                col.tasks.map(renderTaskCard)
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Unassigned tasks */}
      {unassignedTasks.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Verfügbare Tasks zuordnen</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {unassignedTasks.map((task) => (
                <div key={task.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50">
                  <div className="flex-1 min-w-0 mr-2">
                    <p className="text-sm font-medium">{task.title}</p>
                    {task.description && (
                      <p className="text-xs text-muted-foreground truncate">{task.description}</p>
                    )}
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-muted-foreground">{TASK_STATUS_LABELS[task.status] || task.status}</span>
                      {task.due_date && (
                        <span className="text-xs text-muted-foreground">
                          · {new Date(task.due_date).toLocaleDateString("de-CH")}
                        </span>
                      )}
                    </div>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => handleAssignTask(task.id)}>
                    <Plus className="h-3 w-3 mr-1" />
                    Zuordnen
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <CreateProjectTaskDialog
        open={detailDialogOpen}
        onOpenChange={setDetailDialogOpen}
        projectId={project.id}
        profiles={profiles}
        onCreated={fetchProjectTasks}
      />
    </Layout>
  );
}