import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface Project {
  id: string;
  name: string;
  description: string | null;
  status: string;
  priority: string;
  color: string | null;
  created_by: string;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
  updated_at: string;
  task_count?: number;
  done_count?: number;
}

export function useProjects() {
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) fetchProjects();
  }, [user]);

  const fetchProjects = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Fetch task counts per project
      const projectsWithCounts = await Promise.all(
        (data || []).map(async (project) => {
          const { count: taskCount } = await supabase
            .from("tasks")
            .select("*", { count: "exact", head: true })
            .eq("project_id", project.id);

          const { count: doneCount } = await supabase
            .from("tasks")
            .select("*", { count: "exact", head: true })
            .eq("project_id", project.id)
            .eq("status", "done");

          return {
            ...project,
            task_count: taskCount || 0,
            done_count: doneCount || 0,
          };
        })
      );

      setProjects(projectsWithCounts);
    } catch (error) {
      console.error("Error fetching projects:", error);
      toast.error("Projekte konnten nicht geladen werden");
    } finally {
      setLoading(false);
    }
  };

  const createProject = async (data: {
    name: string;
    description?: string;
    status?: string;
    priority?: string;
    color?: string;
    start_date?: string;
    end_date?: string;
  }) => {
    if (!user) return;
    try {
      const { error } = await supabase.from("projects").insert({
        ...data,
        created_by: user.id,
      });
      if (error) throw error;
      toast.success("Projekt erstellt");
      fetchProjects();
    } catch (error) {
      console.error("Error creating project:", error);
      toast.error("Fehler beim Erstellen");
    }
  };

  const updateProject = async (id: string, data: Partial<Project>) => {
    try {
      const { error } = await supabase
        .from("projects")
        .update(data)
        .eq("id", id);
      if (error) throw error;
      toast.success("Projekt aktualisiert");
      fetchProjects();
    } catch (error) {
      console.error("Error updating project:", error);
      toast.error("Fehler beim Aktualisieren");
    }
  };

  const deleteProject = async (id: string) => {
    try {
      const { error } = await supabase.from("projects").delete().eq("id", id);
      if (error) throw error;
      toast.success("Projekt gelöscht");
      fetchProjects();
    } catch (error) {
      console.error("Error deleting project:", error);
      toast.error("Fehler beim Löschen");
    }
  };

  const assignTaskToProject = async (taskId: string, projectId: string | null) => {
    try {
      const { error } = await supabase
        .from("tasks")
        .update({ project_id: projectId })
        .eq("id", taskId);
      if (error) throw error;
      fetchProjects();
    } catch (error) {
      console.error("Error assigning task:", error);
      toast.error("Fehler beim Zuordnen");
    }
  };

  return { projects, loading, createProject, updateProject, deleteProject, assignTaskToProject, refetch: fetchProjects };
}
