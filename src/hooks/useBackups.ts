import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

export interface BackupJob {
  id: string;
  user_id: string;
  status: string;
  backup_type: string;
  file_path: string | null;
  file_size: number | null;
  tables_count: number | null;
  documents_count: number | null;
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface BackupSchedule {
  id: string;
  user_id: string;
  frequency: string;
  time_of_day: string;
  day_of_week: number | null;
  day_of_month: number | null;
  is_active: boolean;
  last_triggered_at: string | null;
}

export function useBackups() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [jobs, setJobs] = useState<BackupJob[]>([]);
  const [schedule, setSchedule] = useState<BackupSchedule | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);

  const fetchData = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);

    const [jobsRes, scheduleRes] = await Promise.all([
      supabase
        .from("backup_jobs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20),
      supabase
        .from("backup_schedules")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle(),
    ]);

    if (jobsRes.data) setJobs(jobsRes.data as BackupJob[]);
    if (scheduleRes.data) setSchedule(scheduleRes.data as BackupSchedule);

    setIsLoading(false);
  }, [user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const createBackup = async (): Promise<{ success: boolean; filePath?: string }> => {
    if (!user) return { success: false };
    setIsCreating(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/daily-backup`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({ type: "manual", user_id: user.id }),
        }
      );

      const result = await res.json();

      if (result.success) {
        const fileInfo = result.files ? ` und ${result.files} Dateien` : "";
        toast({ title: "Backup erstellt", description: `${result.tables} Tabellen mit ${result.rows} Datensätzen${fileInfo} gesichert.` });
        await fetchData();
        return { success: true, filePath: result.filename };
      } else {
        throw new Error(result.error);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unbekannter Fehler";
      toast({ title: "Backup fehlgeschlagen", description: msg, variant: "destructive" });
      return { success: false };
    } finally {
      setIsCreating(false);
    }
  };

  const downloadBackup = async (filePath: string) => {
    try {
      toast({ title: "ZIP wird erstellt", description: "Alle Tabellen und Dateien werden zusammengestellt..." });

      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/download-backup-zip`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({ file_path: filePath }),
        }
      );

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.error || `HTTP ${res.status}`);
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      // Extract filename from Content-Disposition or generate one
      const disposition = res.headers.get("Content-Disposition");
      const filenameMatch = disposition?.match(/filename="?(.+?)"?$/);
      a.download = filenameMatch?.[1] || `backup-${new Date().toISOString().slice(0, 10)}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({ title: "Download gestartet", description: a.download });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Fehler";
      toast({ title: "Download fehlgeschlagen", description: msg, variant: "destructive" });
    }
  };

  const restoreBackup = async (filePath: string) => {
    if (!user) return;
    setIsRestoring(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/restore-backup`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({ file_path: filePath }),
        }
      );

      const result = await res.json();

      if (result.success) {
        const fileInfo = result.files_restored ? ` + ${result.files_restored} Dateien` : "";
        toast({
          title: "Wiederherstellung abgeschlossen",
          description: `${result.total_restored} Datensätze${fileInfo} wiederhergestellt.`,
        });
      } else {
        throw new Error(result.error);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Fehler";
      toast({ title: "Wiederherstellung fehlgeschlagen", description: msg, variant: "destructive" });
    } finally {
      setIsRestoring(false);
    }
  };

  const restoreFromZip = async (file: File) => {
    if (!user) return;
    setIsRestoring(true);

    try {
      toast({ title: "Wiederherstellung läuft", description: "ZIP wird verarbeitet..." });

      const { data: { session } } = await supabase.auth.getSession();
      const arrayBuffer = await file.arrayBuffer();

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/restore-backup-upload`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/zip",
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: arrayBuffer,
        }
      );

      const result = await res.json();

      if (result.success) {
        const fileInfo = result.files_restored ? ` + ${result.files_restored} Dateien` : "";
        toast({
          title: "Wiederherstellung abgeschlossen",
          description: `${result.total_restored} Datensätze${fileInfo} wiederhergestellt.`,
        });
        await fetchData();
      } else {
        throw new Error(result.error);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Fehler";
      toast({ title: "Wiederherstellung fehlgeschlagen", description: msg, variant: "destructive" });
    } finally {
      setIsRestoring(false);
    }
  };

  const updateSchedule = async (updates: Partial<BackupSchedule>) => {
    if (!user) return;

    if (schedule) {
      const { error } = await supabase
        .from("backup_schedules")
        .update(updates)
        .eq("id", schedule.id);

      if (!error) {
        setSchedule(prev => prev ? { ...prev, ...updates } : null);
        toast({ title: "Gespeichert", description: "Backup-Zeitplan aktualisiert." });
      }
    } else {
      const { data, error } = await supabase
        .from("backup_schedules")
        .insert({ user_id: user.id, ...updates })
        .select()
        .single();

      if (!error && data) {
        setSchedule(data as BackupSchedule);
        toast({ title: "Gespeichert", description: "Backup-Zeitplan erstellt." });
      }
    }
  };

  return {
    jobs,
    schedule,
    isLoading,
    isCreating,
    isRestoring,
    createBackup,
    downloadBackup,
    restoreBackup,
    restoreFromZip,
    updateSchedule,
    refetch: fetchData,
  };
}
