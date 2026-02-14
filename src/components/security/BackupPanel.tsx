import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Database, Download, HardDrive, Calendar, FileArchive,
  RefreshCw, CloudOff, Clock, Shield, CheckCircle, Loader2, RotateCcw,
  FolderOpen, FolderSync, X,
} from "lucide-react";
import { useBackups, BackupJob } from "@/hooks/useBackups";
import { useToast } from "@/hooks/use-toast";

// Detect Electron environment
const isElectron = !!(window as any).electronAPI?.isElectron;
const electronAPI = (window as any).electronAPI;

function formatBytes(bytes: number | null): string {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1073741824) return `${(bytes / 1048576).toFixed(1)} MB`;
  return `${(bytes / 1073741824).toFixed(1)} GB`;
}

function formatDate(date: string | null): string {
  if (!date) return "—";
  return new Date(date).toLocaleString("de-CH", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export function BackupPanel() {
  const {
    jobs, schedule, isLoading, isCreating, isRestoring,
    createBackup, downloadBackup, restoreBackup, updateSchedule,
  } = useBackups();
  const { toast } = useToast();
  const [restoreTarget, setRestoreTarget] = useState<string | null>(null);
  const [backupFolder, setBackupFolder] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  // Load saved backup folder on mount (Electron only)
  useEffect(() => {
    if (isElectron) {
      electronAPI.getBackupFolder().then((folder: string | null) => {
        setBackupFolder(folder);
      });
    }
  }, []);

  const handleSelectFolder = async () => {
    if (!isElectron) return;
    const folder = await electronAPI.selectBackupFolder();
    if (folder) {
      setBackupFolder(folder);
      toast({ title: "Ordner gewählt", description: folder });
    }
  };

  const handleClearFolder = async () => {
    if (!isElectron) return;
    await electronAPI.clearBackupFolder();
    setBackupFolder(null);
    toast({ title: "Ordner entfernt", description: "Auto-Sync deaktiviert." });
  };

  const handleSyncToFolder = async (job: BackupJob) => {
    if (!isElectron || !job.file_path) return;
    setIsSyncing(true);
    try {
      // Download from Supabase storage as ArrayBuffer
      const { supabase } = await import("@/integrations/supabase/client");
      const { data, error } = await supabase.storage.from("backups").download(job.file_path);
      if (error || !data) throw new Error(error?.message || "Download fehlgeschlagen");

      const arrayBuffer = await data.arrayBuffer();
      const filename = job.file_path.split("/").pop() || `backup-${job.id}.json`;
      const result = await electronAPI.saveBackupToFolder(arrayBuffer, filename);

      if (result.success) {
        toast({ title: "Backup gespeichert", description: result.path });
      } else {
        throw new Error(result.error);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Fehler";
      toast({ title: "Speichern fehlgeschlagen", description: msg, variant: "destructive" });
    } finally {
      setIsSyncing(false);
    }
  };

  // Auto-sync: when a new completed job appears and folder is set
  const handleCreateAndSync = async () => {
    await createBackup();
    // After backup, if folder is set, sync the latest
    if (isElectron && backupFolder) {
      // Small delay to let the job list refresh
      setTimeout(async () => {
        const latestJob = jobs.find(j => j.status === "completed" && j.file_path);
        if (latestJob) {
          await handleSyncToFolder(latestJob);
        }
      }, 2000);
    }
  };

  const lastSuccessful = jobs.find(j => j.status === "completed");
  const totalSize = jobs
    .filter(j => j.status === "completed")
    .reduce((sum, j) => sum + (j.file_size || 0), 0);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-6">
        {/* Status */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <HardDrive className="h-5 w-5" />
                  Backup-Status
                </CardTitle>
                <CardDescription>Übersicht über den aktuellen Backup-Zustand</CardDescription>
              </div>
              {schedule?.is_active ? (
                <Badge variant="outline" className="text-green-600 border-green-300 bg-green-50 dark:bg-green-950/30">
                  <CheckCircle className="h-3 w-3 mr-1" />Aktiv
                </Badge>
              ) : (
                <Badge variant="outline" className="text-muted-foreground">Inaktiv</Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 rounded-lg bg-muted/50 border border-border">
                <p className="text-xs text-muted-foreground mb-1">Letztes Backup</p>
                <p className="text-sm font-semibold">{lastSuccessful ? formatDate(lastSuccessful.completed_at) : "Noch keins"}</p>
              </div>
              <div className="p-4 rounded-lg bg-muted/50 border border-border">
                <p className="text-xs text-muted-foreground mb-1">Backups gesamt</p>
                <p className="text-sm font-semibold">{jobs.filter(j => j.status === "completed").length}</p>
              </div>
              <div className="p-4 rounded-lg bg-muted/50 border border-border">
                <p className="text-xs text-muted-foreground mb-1">Speicherverbrauch</p>
                <p className="text-sm font-semibold">{formatBytes(totalSize)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* History */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Backup-Verlauf
                </CardTitle>
                <CardDescription>Letzte Backups und deren Status</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : jobs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Database className="h-10 w-10 mx-auto mb-3 opacity-40" />
                <p className="text-sm">Noch keine Backups vorhanden</p>
                <p className="text-xs mt-1">Erstellen Sie Ihr erstes Backup</p>
              </div>
            ) : (
              <div className="space-y-3">
                {jobs.map((job) => (
                  <BackupJobRow
                    key={job.id}
                    job={job}
                    onDownload={downloadBackup}
                    onRestore={(path) => setRestoreTarget(path)}
                    onSyncToFolder={isElectron && backupFolder ? handleSyncToFolder : undefined}
                    isSyncing={isSyncing}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Sidebar */}
      <div className="space-y-6">
        {/* Manual Backup */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5" />
              Manuelles Backup
            </CardTitle>
            <CardDescription>Erstellen Sie jetzt ein sofortiges Backup</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Ein Backup umfasst alle Daten, Dokumente und Einstellungen.
            </p>
            <Button className="w-full" onClick={handleCreateAndSync} disabled={isCreating}>
              {isCreating ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Backup wird erstellt...</>
              ) : (
                <><Database className="h-4 w-4 mr-2" />Backup erstellen</>
              )}
            </Button>
            {isElectron && backupFolder && (
              <p className="text-xs text-muted-foreground text-center">
                Wird automatisch in den Ordner gespeichert
              </p>
            )}
          </CardContent>
        </Card>

        {/* Electron Folder Sync */}
        {isElectron && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FolderSync className="h-5 w-5" />
                Ordner-Sync
              </CardTitle>
              <CardDescription>Backups automatisch in einem lokalen Ordner speichern</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {backupFolder ? (
                <>
                  <div className="p-3 rounded-lg bg-muted/50 border border-border">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 min-w-0">
                        <FolderOpen className="h-4 w-4 text-primary flex-shrink-0" />
                        <span className="text-sm font-mono truncate">{backupFolder}</span>
                      </div>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0 flex-shrink-0" onClick={handleClearFolder} title="Ordner entfernen">
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Neue Backups werden automatisch in diesen Ordner gespeichert.
                  </p>
                </>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">
                    Wählen Sie einen Ordner, in den Backups automatisch gespeichert werden.
                  </p>
                  <Button variant="outline" className="w-full" onClick={handleSelectFolder}>
                    <FolderOpen className="h-4 w-4 mr-2" />
                    Ordner auswählen
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        )}

        {/* Schedule */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Backup-Zeitplan
            </CardTitle>
            <CardDescription>Automatische Backup-Konfiguration</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Automatisch aktiv</Label>
              <Switch
                checked={schedule?.is_active ?? false}
                onCheckedChange={(checked) => updateSchedule({ is_active: checked })}
              />
            </div>

            <div>
              <Label className="text-xs text-muted-foreground mb-1.5 block">Häufigkeit</Label>
              <Select
                value={schedule?.frequency || "daily"}
                onValueChange={(val) => updateSchedule({ frequency: val })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Täglich</SelectItem>
                  <SelectItem value="weekly">Wöchentlich</SelectItem>
                  <SelectItem value="monthly">Monatlich</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs text-muted-foreground mb-1.5 block">Uhrzeit</Label>
              <Select
                value={schedule?.time_of_day?.slice(0, 5) || "03:00"}
                onValueChange={(val) => updateSchedule({ time_of_day: val })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["00:00", "01:00", "02:00", "03:00", "04:00", "05:00", "06:00", "12:00", "18:00", "22:00", "23:00"].map(t => (
                    <SelectItem key={t} value={t}>{t} Uhr</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="pt-2 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Verschlüsselung</span>
                <span className="font-medium">AES-256</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Aufbewahrung</span>
                <span className="font-medium">30 Backups</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Speicherort</span>
                <span className="font-medium">Schweiz</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tips */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Shield className="h-5 w-5" />Backup-Hinweise</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3 text-sm text-muted-foreground">
              <li className="flex items-start gap-2"><CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />Backups werden verschlüsselt gespeichert</li>
              <li className="flex items-start gap-2"><CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />In der Desktop-App: Auto-Sync in gewählten Ordner</li>
              <li className="flex items-start gap-2"><CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />Wiederherstellung innerhalb von Minuten</li>
              <li className="flex items-start gap-2"><CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />Daten ausschliesslich in der Schweiz</li>
            </ul>
          </CardContent>
        </Card>
      </div>

      {/* Restore Confirmation Dialog */}
      <AlertDialog open={!!restoreTarget} onOpenChange={(open) => !open && setRestoreTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Backup wiederherstellen?</AlertDialogTitle>
            <AlertDialogDescription>
              Achtung: Bestehende Daten werden mit den Daten aus dem Backup überschrieben. 
              Dieser Vorgang kann nicht rückgängig gemacht werden. 
              Es wird empfohlen, vorher ein aktuelles Backup zu erstellen.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (restoreTarget) restoreBackup(restoreTarget);
                setRestoreTarget(null);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isRestoring}
            >
              {isRestoring ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Wird wiederhergestellt...</>
              ) : (
                <><RotateCcw className="h-4 w-4 mr-2" />Wiederherstellen</>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function BackupJobRow({ job, onDownload, onRestore, onSyncToFolder, isSyncing }: {
  job: BackupJob;
  onDownload: (path: string) => void;
  onRestore: (path: string) => void;
  onSyncToFolder?: (job: BackupJob) => void;
  isSyncing?: boolean;
}) {
  const isSuccess = job.status === "completed";
  const isRunning = job.status === "running";
  const isFailed = job.status === "failed";

  return (
    <div className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/30 transition-colors">
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg ${isSuccess ? "bg-green-100 dark:bg-green-950/40" : isFailed ? "bg-destructive/10" : "bg-muted"}`}>
          {isRunning ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : isSuccess ? (
            <FileArchive className="h-4 w-4 text-green-600 dark:text-green-400" />
          ) : (
            <CloudOff className="h-4 w-4 text-destructive" />
          )}
        </div>
        <div>
          <p className="text-sm font-medium">
            {job.backup_type === "manual" ? "Manuelles Backup" : "Automatisches Backup"}
          </p>
          <p className="text-xs text-muted-foreground">
            {formatDate(job.completed_at || job.started_at || job.created_at)}
            {isSuccess && job.file_size && ` · ${formatBytes(job.file_size)}`}
            {isSuccess && job.tables_count && ` · ${job.tables_count} Tabellen`}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Badge variant={job.backup_type === "manual" ? "secondary" : "outline"} className="text-xs">
          {job.backup_type === "manual" ? "Manuell" : "Auto"}
        </Badge>
        {isSuccess && job.file_path && (
          <>
            {onSyncToFolder && (
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => onSyncToFolder(job)} disabled={isSyncing} title="In Ordner speichern">
                {isSyncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <FolderSync className="h-4 w-4" />}
              </Button>
            )}
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => onDownload(job.file_path!)} title="Herunterladen">
              <Download className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => onRestore(job.file_path!)} title="Wiederherstellen">
              <RotateCcw className="h-4 w-4" />
            </Button>
          </>
        )}
        {isRunning && <Badge className="text-xs">Läuft...</Badge>}
        {isFailed && <Badge variant="destructive" className="text-xs">Fehlgeschlagen</Badge>}
      </div>
    </div>
  );
}
