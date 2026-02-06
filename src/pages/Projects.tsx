import { useState, useEffect } from "react";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useProjects, Project } from "@/hooks/useProjects";
import { CreateProjectDialog } from "@/components/projects/CreateProjectDialog";
import { ProjectCard } from "@/components/projects/ProjectCard";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import {
  Plus,
  LayoutGrid,
  List,
  Loader2,
  Inbox,
  Kanban,
  CheckCircle2,
  Circle,
  PlayCircle,
  ArrowLeft,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Task {
  id: string;
  title: string;
  status: string;
  priority: string;
  due_date: string | null;
  project_id: string | null;
}

const KANBAN_COLUMNS = [
  { key: "planning", label: "Planung", icon: Circle },
  { key: "active", label: "Aktiv", icon: PlayCircle },
  { key: "completed", label: "Abgeschlossen", icon: CheckCircle2 },
];

const TASK_STATUS_LABELS: Record<string, string> = {
  todo: "To Do",
  in_progress: "In Arbeit",
  done: "Erledigt",
};

export default function Projects() {
  const { user } = useAuth();
  const { projects, loading, createProject, updateProject, deleteProject, assignTaskToProject, refetch } = useProjects();
  const [view, setView] = useState<"grid" | "kanban">("grid");
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [projectTasks, setProjectTasks] = useState<Task[]>([]);
  const [unassignedTasks, setUnassignedTasks] = useState<Task[]>([]);
  const [tasksLoading, setTasksLoading] = useState(false);

  useEffect(() => {
    if (selectedProject) {
      fetchProjectTasks(selectedProject.id);
    }
  }, [selectedProject]);

  const fetchProjectTasks = async (projectId: string) => {
    setTasksLoading(true);
    try {
      const [{ data: assigned }, { data: unassigned }] = await Promise.all([
        supabase
          .from("tasks")
          .select("id, title, status, priority, due_date, project_id")
          .eq("project_id", projectId)
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

  const handleAssignTask = async (taskId: string) => {
    if (!selectedProject) return;
    await assignTaskToProject(taskId, selectedProject.id);
    fetchProjectTasks(selectedProject.id);
  };

  const handleUnassignTask = async (taskId: string) => {
    await assignTaskToProject(taskId, null);
    if (selectedProject) fetchProjectTasks(selectedProject.id);
  };

  if (loading) {
    return (
      <Layout title="Projekte" subtitle="Projektverwaltung">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-accent" />
        </div>
      </Layout>
    );
  }

  // Project detail view
  if (selectedProject) {
    const todoTasks = projectTasks.filter((t) => t.status === "todo");
    const inProgressTasks = projectTasks.filter((t) => t.status === "in_progress");
    const doneTasks = projectTasks.filter((t) => t.status === "done");

    return (
      <Layout title={selectedProject.name} subtitle="Projektdetails">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setSelectedProject(null)}
          className="mb-4 gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Zurück
        </Button>

        {selectedProject.description && (
          <p className="text-sm text-muted-foreground mb-6">{selectedProject.description}</p>
        )}

        {/* Task Kanban for this project */}
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

        {/* Unassigned tasks to add */}
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
      </Layout>
    );
  }

  // Main projects view
  return (
    <Layout title="Projekte" subtitle="Projektverwaltung">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Button
            variant={view === "grid" ? "default" : "outline"}
            size="sm"
            onClick={() => setView("grid")}
          >
            <LayoutGrid className="h-4 w-4" />
          </Button>
          <Button
            variant={view === "kanban" ? "default" : "outline"}
            size="sm"
            onClick={() => setView("kanban")}
          >
            <Kanban className="h-4 w-4" />
          </Button>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="glow-gold">
          <Plus className="h-4 w-4 mr-2" />
          Neues Projekt
        </Button>
      </div>

      {projects.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Inbox className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold text-foreground mb-2">Keine Projekte</h3>
          <p className="text-sm text-muted-foreground mb-4">Erstellen Sie Ihr erstes Projekt</p>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Projekt erstellen
          </Button>
        </div>
      ) : view === "grid" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              onClick={() => setSelectedProject(project)}
              onDelete={() => deleteProject(project.id)}
              onStatusChange={(status) => updateProject(project.id, { status })}
            />
          ))}
        </div>
      ) : (
        // Kanban view by project status
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {KANBAN_COLUMNS.map((col) => {
            const Icon = col.icon;
            const columnProjects = projects.filter((p) => p.status === col.key);
            return (
              <div key={col.key} className="space-y-3">
                <div className="flex items-center gap-2 px-1">
                  <Icon className="h-4 w-4 text-accent" />
                  <span className="text-sm font-semibold">{col.label}</span>
                  <Badge variant="secondary" className="text-xs">{columnProjects.length}</Badge>
                </div>
                <div className="space-y-3 min-h-[200px] p-2 rounded-lg bg-muted/20 border border-border/50">
                  {columnProjects.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-8">Keine Projekte</p>
                  ) : (
                    columnProjects.map((project) => (
                      <ProjectCard
                        key={project.id}
                        project={project}
                        onClick={() => setSelectedProject(project)}
                        onDelete={() => deleteProject(project.id)}
                        onStatusChange={(status) => updateProject(project.id, { status })}
                      />
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <CreateProjectDialog open={createOpen} onOpenChange={setCreateOpen} onCreate={createProject} />
    </Layout>
  );
}
