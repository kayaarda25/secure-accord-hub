import { useState } from "react";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useProjects, Project } from "@/hooks/useProjects";
import { CreateProjectDialog } from "@/components/projects/CreateProjectDialog";
import { ProjectCard } from "@/components/projects/ProjectCard";
import { ProjectDetailView } from "@/components/projects/ProjectDetailView";
import {
  Plus,
  LayoutGrid,
  Loader2,
  Inbox,
  Kanban,
  CheckCircle2,
  Circle,
  PlayCircle,
} from "lucide-react";

const KANBAN_COLUMNS = [
  { key: "planning", label: "Planung", icon: Circle },
  { key: "active", label: "Aktiv", icon: PlayCircle },
  { key: "completed", label: "Abgeschlossen", icon: CheckCircle2 },
];

export default function Projects() {
  const { projects, loading, createProject, updateProject, deleteProject, assignTaskToProject, refetch } = useProjects();
  const [view, setView] = useState<"grid" | "kanban">("grid");
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);

  if (loading) {
    return (
      <Layout title="Projekte" subtitle="Projektverwaltung">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-accent" />
        </div>
      </Layout>
    );
  }

  if (selectedProject) {
    return (
      <ProjectDetailView
        project={selectedProject}
        onBack={() => { setSelectedProject(null); refetch(); }}
        onAssignTask={assignTaskToProject}
      />
    );
  }

  return (
    <Layout title="Projekte" subtitle="Projektverwaltung">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Button variant={view === "grid" ? "default" : "outline"} size="sm" onClick={() => setView("grid")}>
            <LayoutGrid className="h-4 w-4" />
          </Button>
          <Button variant={view === "kanban" ? "default" : "outline"} size="sm" onClick={() => setView("kanban")}>
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
