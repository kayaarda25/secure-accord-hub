import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Layout } from "@/components/layout/Layout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { ArrowLeft, Plus, FileText, Loader2 } from "lucide-react";
import { Project } from "@/hooks/useProjects";
import { CreateProjectTaskDialog } from "./CreateProjectTaskDialog";

interface Task {
  id: string;
  title: string;
  status: string;
  priority: string;
  due_date: string | null;
  project_id: string | null;
}

const TASK_STATUS_LABELS: Record<string, string> = {
  todo: "To Do",
  in_progress: "In Arbeit",
  done: "Erledigt",
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
  const [tasksLoading, setTasksLoading] = useState(false);
  const [quickTitle, setQuickTitle] = useState("");
  const [isQuickAdding, setIsQuickAdding] = useState(false);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);

  useEffect(() => {
    fetchProjectTasks();
  }, [project.id]);

  const fetchProjectTasks = async () => {
    setTasksLoading(true);
    try {
      const [{ data: assigned }, { data: unassigned }] = await Promise.all([
        supabase
          .from("tasks")
          .select("id, title, status, priority, due_date, project_id")
          .eq("project_id", project.id)
          .order("created_at", { ascending: false }),
        supabase
          .from("tasks")
          .select("id, title, status, priority, due_date, project_id")
          .is("project_id", null)
          .order("created_at", { ascending: false }),
      ]);
      setProjectTasks(assigned || []);
      setUnassignedTasks(unassigned || []);
    } catch (error) {
      console.error("Error fetching tasks:", error);
    } finally {
      setTasksLoading(false);
    }
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

  const todoTasks = projectTasks.filter((t) => t.status === "todo");
  const inProgressTasks = projectTasks.filter((t) => t.status === "in_progress");
  const doneTasks = projectTasks.filter((t) => t.status === "done");

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
                col.tasks.map((task) => (
                  <Card key={task.id} className="p-3 group">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{task.title}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs opacity-0 group-hover:opacity-100"
                        onClick={() => handleUnassignTask(task.id)}
                      >
                        Entfernen
                      </Button>
                    </div>
                    {task.due_date && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(task.due_date).toLocaleDateString("de-CH")}
                      </p>
                    )}
                  </Card>
                ))
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
                  <div>
                    <p className="text-sm font-medium">{task.title}</p>
                    <p className="text-xs text-muted-foreground">{TASK_STATUS_LABELS[task.status] || task.status}</p>
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
        onCreated={fetchProjectTasks}
      />
    </Layout>
  );
}
