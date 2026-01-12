import { useState, useEffect } from "react";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  CheckSquare,
  Plus,
  Clock,
  Check,
  X,
  Loader2,
  Repeat,
  Share2,
  Circle,
  CheckCircle2,
  PlayCircle,
  Calendar,
  AlertTriangle,
  Inbox,
} from "lucide-react";

interface Task {
  id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  priority: string;
  status: string;
  is_recurring: boolean;
  recurrence_type: string | null;
  created_by: string;
  completed_at: string | null;
  participants?: TaskParticipant[];
}

interface TaskParticipant {
  id: string;
  user_id: string;
  status: string;
}

interface Profile {
  id: string;
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
}

const PRIORITY_CONFIG: Record<string, { label: string; color: string; icon: typeof AlertTriangle }> = {
  low: { label: "Low", color: "text-muted-foreground", icon: Circle },
  normal: { label: "Normal", color: "text-primary", icon: Circle },
  high: { label: "High", color: "text-warning", icon: AlertTriangle },
  critical: { label: "Critical", color: "text-destructive", icon: AlertTriangle },
};

const STATUS_CONFIG: Record<string, { label: string; icon: typeof Circle }> = {
  todo: { label: "To Do", icon: Circle },
  in_progress: { label: "In Progress", icon: PlayCircle },
  done: { label: "Done", icon: CheckCircle2 },
};

export default function Tasks() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>("all");

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    due_date: "",
    priority: "normal",
    is_recurring: false,
    recurrence_type: "weekly",
    recurrence_end_date: "",
    selectedParticipants: [] as string[],
  });

  useEffect(() => {
    fetchTasks();
    fetchProfiles();
  }, []);

  const fetchTasks = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("tasks")
        .select(`
          *,
          participants:task_participants(
            id,
            user_id,
            status
          )
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setTasks(data || []);
    } catch (error) {
      console.error("Error fetching tasks:", error);
      toast.error("Failed to load tasks");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchProfiles = async () => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, user_id, first_name, last_name, email")
        .eq("is_active", true);

      if (error) throw error;
      setProfiles(data || []);
    } catch (error) {
      console.error("Error fetching profiles:", error);
    }
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (!formData.title) {
      toast.error("Please enter a title");
      return;
    }

    setIsSubmitting(true);
    try {
      const { data: taskData, error: taskError } = await supabase
        .from("tasks")
        .insert({
          title: formData.title,
          description: formData.description || null,
          due_date: formData.due_date || null,
          priority: formData.priority,
          status: "todo",
          is_recurring: formData.is_recurring,
          recurrence_type: formData.is_recurring ? formData.recurrence_type : null,
          recurrence_end_date: formData.is_recurring && formData.recurrence_end_date ? formData.recurrence_end_date : null,
          created_by: user.id,
        })
        .select()
        .single();

      if (taskError) throw taskError;

      // Add participants if any selected
      if (formData.selectedParticipants.length > 0) {
        const participantsToInsert = formData.selectedParticipants.map(userId => ({
          task_id: taskData.id,
          user_id: userId,
          status: "pending",
        }));

        const { error: partError } = await supabase
          .from("task_participants")
          .insert(participantsToInsert);

        if (partError) throw partError;
      }

      toast.success("Task created successfully");
      resetForm();
      setCreateDialogOpen(false);
      fetchTasks();
    } catch (error) {
      console.error("Error creating task:", error);
      toast.error("Failed to create task");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateTaskStatus = async (taskId: string, newStatus: string) => {
    try {
      const updateData: Record<string, unknown> = { status: newStatus };
      if (newStatus === "done") {
        updateData.completed_at = new Date().toISOString();
      } else {
        updateData.completed_at = null;
      }

      const { error } = await supabase
        .from("tasks")
        .update(updateData)
        .eq("id", taskId);

      if (error) throw error;
      toast.success(`Task marked as ${STATUS_CONFIG[newStatus]?.label || newStatus}`);
      fetchTasks();
    } catch (error) {
      console.error("Error updating task:", error);
      toast.error("Failed to update task");
    }
  };

  const handleRespondToTask = async (taskId: string, status: "accepted" | "declined") => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from("task_participants")
        .update({ status, responded_at: new Date().toISOString() })
        .eq("task_id", taskId)
        .eq("user_id", user.id);

      if (error) throw error;
      toast.success(`Task ${status}`);
      fetchTasks();
    } catch (error) {
      console.error("Error responding to task:", error);
      toast.error("Failed to respond to task");
    }
  };

  const resetForm = () => {
    setFormData({
      title: "",
      description: "",
      due_date: "",
      priority: "normal",
      is_recurring: false,
      recurrence_type: "weekly",
      recurrence_end_date: "",
      selectedParticipants: [],
    });
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "No due date";
    return new Date(dateStr).toLocaleDateString("en-US", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const isOverdue = (dueDate: string | null, status: string) => {
    if (!dueDate || status === "done") return false;
    return new Date(dueDate) < new Date();
  };

  const filteredTasks = tasks.filter(task => {
    if (filterStatus === "all") return true;
    return task.status === filterStatus;
  });

  const pendingInvitations = tasks.filter(t => 
    t.participants?.some(p => p.user_id === user?.id && p.status === "pending")
  );

  const todoCount = tasks.filter(t => t.status === "todo").length;
  const inProgressCount = tasks.filter(t => t.status === "in_progress").length;
  const doneCount = tasks.filter(t => t.status === "done").length;

  if (isLoading) {
    return (
      <Layout title="Tasks" subtitle="Manage your tasks and to-dos">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-accent" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="Tasks" subtitle="Manage your tasks and to-dos">
      {/* Pending Invitations */}
      {pendingInvitations.length > 0 && (
        <Card className="mb-6 border-warning/50 bg-warning/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Share2 className="h-4 w-4" />
              Shared Tasks Pending ({pendingInvitations.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {pendingInvitations.map(task => (
                <div key={task.id} className="flex items-center justify-between p-2 bg-background rounded-lg">
                  <div>
                    <p className="font-medium text-sm">{task.title}</p>
                    <p className="text-xs text-muted-foreground">Due: {formatDate(task.due_date)}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => handleRespondToTask(task.id, "accepted")}
                    >
                      <Check className="h-4 w-4 mr-1" />
                      Accept
                    </Button>
                    <Button 
                      size="sm" 
                      variant="ghost"
                      onClick={() => handleRespondToTask(task.id, "declined")}
                    >
                      <X className="h-4 w-4 mr-1" />
                      Decline
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Tasks</p>
                <p className="text-2xl font-bold">{tasks.length}</p>
              </div>
              <CheckSquare className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">To Do</p>
                <p className="text-2xl font-bold text-primary">{todoCount}</p>
              </div>
              <Circle className="h-8 w-8 text-primary" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">In Progress</p>
                <p className="text-2xl font-bold text-warning">{inProgressCount}</p>
              </div>
              <PlayCircle className="h-8 w-8 text-warning" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Completed</p>
                <p className="text-2xl font-bold text-success">{doneCount}</p>
              </div>
              <CheckCircle2 className="h-8 w-8 text-success" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Action Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Filter" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Tasks</SelectItem>
              <SelectItem value="todo">To Do</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="done">Done</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button className="glow-gold">
              <Plus size={16} className="mr-2" />
              New Task
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Create New Task</DialogTitle>
              <DialogDescription>
                Add a new task to your list
              </DialogDescription>
            </DialogHeader>
            
            <form onSubmit={handleCreateTask} className="space-y-4">
              <div className="space-y-2">
                <Label>Title *</Label>
                <Input
                  value={formData.title}
                  onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="Task title"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Due Date</Label>
                  <Input
                    type="date"
                    value={formData.due_date}
                    onChange={(e) => setFormData(prev => ({ ...prev, due_date: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Priority</Label>
                  <Select 
                    value={formData.priority} 
                    onValueChange={(v) => setFormData(prev => ({ ...prev, priority: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="normal">Normal</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="critical">Critical</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Task description"
                />
              </div>

              {/* Recurrence */}
              <div className="space-y-4 p-4 bg-muted/30 rounded-lg">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="recurring"
                    checked={formData.is_recurring}
                    onCheckedChange={(checked) => 
                      setFormData(prev => ({ ...prev, is_recurring: checked as boolean }))
                    }
                  />
                  <Label htmlFor="recurring" className="flex items-center gap-2">
                    <Repeat className="h-4 w-4" />
                    Recurring Task
                  </Label>
                </div>

                {formData.is_recurring && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Repeat</Label>
                      <Select 
                        value={formData.recurrence_type} 
                        onValueChange={(v) => setFormData(prev => ({ ...prev, recurrence_type: v }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="daily">Daily</SelectItem>
                          <SelectItem value="weekly">Weekly</SelectItem>
                          <SelectItem value="monthly">Monthly</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Until</Label>
                      <Input
                        type="date"
                        value={formData.recurrence_end_date}
                        onChange={(e) => setFormData(prev => ({ ...prev, recurrence_end_date: e.target.value }))}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Share with participants */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Share2 className="h-4 w-4" />
                  Share with
                </Label>
                <div className="max-h-32 overflow-y-auto border rounded-lg p-2 space-y-1">
                  {profiles
                    .filter(p => p.user_id !== user?.id)
                    .map(profile => (
                      <div key={profile.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={profile.id}
                          checked={formData.selectedParticipants.includes(profile.user_id)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setFormData(prev => ({
                                ...prev,
                                selectedParticipants: [...prev.selectedParticipants, profile.user_id]
                              }));
                            } else {
                              setFormData(prev => ({
                                ...prev,
                                selectedParticipants: prev.selectedParticipants.filter(id => id !== profile.user_id)
                              }));
                            }
                          }}
                        />
                        <Label htmlFor={profile.id} className="text-sm">
                          {profile.first_name || profile.last_name 
                            ? `${profile.first_name || ""} ${profile.last_name || ""}`.trim()
                            : profile.email}
                        </Label>
                      </div>
                    ))}
                </div>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setCreateDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting} className="glow-gold">
                  {isSubmitting ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="mr-2 h-4 w-4" />
                  )}
                  Create Task
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Tasks List */}
      <Card>
        <CardHeader>
          <CardTitle>Tasks</CardTitle>
          <CardDescription>
            {filteredTasks.length} tasks found
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredTasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Inbox className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">No tasks found</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Create your first task to get started.
              </p>
              <Button onClick={() => setCreateDialogOpen(true)} className="glow-gold">
                <Plus className="mr-2 h-4 w-4" />
                New Task
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredTasks.map((task) => {
                const priorityConfig = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.normal;
                const statusConfig = STATUS_CONFIG[task.status] || STATUS_CONFIG.todo;
                const StatusIcon = statusConfig.icon;
                const overdue = isOverdue(task.due_date, task.status);

                return (
                  <div
                    key={task.id}
                    className={`p-4 rounded-lg border transition-colors ${
                      task.status === "done" 
                        ? "bg-muted/30 border-muted" 
                        : overdue 
                        ? "bg-destructive/5 border-destructive/30"
                        : "bg-card border-border hover:border-accent/50"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3 flex-1">
                        <button
                          onClick={() => {
                            const nextStatus = task.status === "todo" 
                              ? "in_progress" 
                              : task.status === "in_progress" 
                              ? "done" 
                              : "todo";
                            handleUpdateTaskStatus(task.id, nextStatus);
                          }}
                          className={`mt-1 transition-colors ${
                            task.status === "done" 
                              ? "text-success" 
                              : task.status === "in_progress"
                              ? "text-warning"
                              : "text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          <StatusIcon className="h-5 w-5" />
                        </button>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className={`font-medium ${task.status === "done" ? "line-through text-muted-foreground" : ""}`}>
                              {task.title}
                            </h4>
                            {task.is_recurring && (
                              <Repeat className="h-3 w-3 text-accent" />
                            )}
                            {task.participants && task.participants.length > 0 && (
                              <Share2 className="h-3 w-3 text-accent" />
                            )}
                          </div>
                          {task.description && (
                            <p className="text-sm text-muted-foreground mb-2">{task.description}</p>
                          )}
                          <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            {task.due_date && (
                              <span className={`flex items-center gap-1 ${overdue ? "text-destructive font-medium" : ""}`}>
                                <Calendar className="h-3 w-3" />
                                {formatDate(task.due_date)}
                                {overdue && " (Overdue)"}
                              </span>
                            )}
                            {task.participants && task.participants.length > 0 && (
                              <span className="flex items-center gap-1">
                                <Share2 className="h-3 w-3" />
                                {task.participants.length} shared
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge 
                          variant={task.priority === "critical" ? "destructive" : task.priority === "high" ? "default" : "secondary"}
                          className={task.priority === "high" ? "bg-warning text-warning-foreground" : ""}
                        >
                          {priorityConfig.label}
                        </Badge>
                        <Select 
                          value={task.status}
                          onValueChange={(v) => handleUpdateTaskStatus(task.id, v)}
                        >
                          <SelectTrigger className="w-32 h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="todo">To Do</SelectItem>
                            <SelectItem value="in_progress">In Progress</SelectItem>
                            <SelectItem value="done">Done</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </Layout>
  );
}