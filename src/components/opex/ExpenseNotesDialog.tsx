import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageSquare, Send, Loader2, Trash2, User } from "lucide-react";

interface ExpenseNote {
  id: string;
  expense_id: string;
  user_id: string;
  content: string;
  created_at: string;
  updated_at: string;
  profile?: {
    first_name: string | null;
    last_name: string | null;
    email: string;
  };
}

interface ExpenseNotesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  expenseId: string;
  expenseTitle: string;
}

export function ExpenseNotesDialog({
  open,
  onOpenChange,
  expenseId,
  expenseTitle,
}: ExpenseNotesDialogProps) {
  const { user } = useAuth();
  const [notes, setNotes] = useState<ExpenseNote[]>([]);
  const [newNote, setNewNote] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (open && expenseId) {
      fetchNotes();
    }
  }, [open, expenseId]);

  const fetchNotes = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("opex_expense_notes")
        .select("*")
        .eq("expense_id", expenseId)
        .order("created_at", { ascending: true });

      if (error) throw error;

      // Fetch user profiles for notes
      if (data && data.length > 0) {
        const userIds = [...new Set(data.map((n) => n.user_id))];
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, first_name, last_name, email")
          .in("user_id", userIds);

        const notesWithProfiles = data.map((note) => ({
          ...note,
          profile: profiles?.find((p) => p.user_id === note.user_id),
        }));

        setNotes(notesWithProfiles);
      } else {
        setNotes([]);
      }
    } catch (error) {
      console.error("Error fetching notes:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmitNote = async () => {
    if (!user || !newNote.trim()) return;

    setIsSubmitting(true);
    try {
      const { error } = await supabase.from("opex_expense_notes").insert({
        expense_id: expenseId,
        user_id: user.id,
        content: newNote.trim(),
      });

      if (error) throw error;

      setNewNote("");
      fetchNotes();
    } catch (error) {
      console.error("Error adding note:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    try {
      const { error } = await supabase
        .from("opex_expense_notes")
        .delete()
        .eq("id", noteId);

      if (error) throw error;
      fetchNotes();
    } catch (error) {
      console.error("Error deleting note:", error);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString("de-DE", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getUserName = (note: ExpenseNote) => {
    if (note.profile?.first_name || note.profile?.last_name) {
      return `${note.profile.first_name || ""} ${note.profile.last_name || ""}`.trim();
    }
    return note.profile?.email || "Unbekannt";
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare size={20} className="text-accent" />
            Kommentare
          </DialogTitle>
          <p className="text-sm text-muted-foreground">{expenseTitle}</p>
        </DialogHeader>

        <div className="space-y-4">
          {/* Notes List */}
          <ScrollArea className="h-[300px] pr-4">
            {isLoading ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : notes.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                <MessageSquare size={32} className="mb-2 opacity-50" />
                <p className="text-sm">Noch keine Kommentare</p>
              </div>
            ) : (
              <div className="space-y-3">
                {notes.map((note) => (
                  <div
                    key={note.id}
                    className={`p-3 rounded-lg ${
                      note.user_id === user?.id
                        ? "bg-accent/10 border border-accent/20"
                        : "bg-muted"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-accent/20 flex items-center justify-center">
                          <User size={12} className="text-accent" />
                        </div>
                        <span className="text-sm font-medium text-foreground">
                          {getUserName(note)}
                        </span>
                      </div>
                      {note.user_id === user?.id && (
                        <button
                          onClick={() => handleDeleteNote(note.id)}
                          className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                    <p className="text-sm text-foreground whitespace-pre-wrap pl-8">
                      {note.content}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1 pl-8">
                      {formatDate(note.created_at)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>

          {/* New Note Input */}
          <div className="flex gap-2">
            <Textarea
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              placeholder="Kommentar hinzufügen..."
              className="resize-none"
              rows={2}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  handleSubmitNote();
                }
              }}
            />
            <Button
              onClick={handleSubmitNote}
              disabled={isSubmitting || !newNote.trim()}
              size="icon"
              className="h-auto"
            >
              {isSubmitting ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Send size={16} />
              )}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Tipp: Cmd/Ctrl + Enter zum Senden
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
