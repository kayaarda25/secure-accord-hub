import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  Search,
  Plus,
  MoreHorizontal,
  CheckCircle,
  Loader2,
  X,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface MeetingProtocol {
  id: string;
  title: string;
  meeting_date: string;
  location: string | null;
  attendees: string[];
  agenda: string | null;
  minutes: string | null;
  decisions: string | null;
  created_at: string;
}

interface UserProfile {
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
}

export function ProtocolsPanel() {
  const { user } = useAuth();
  const [protocols, setProtocols] = useState<MeetingProtocol[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showNewProtocol, setShowNewProtocol] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedAttendees, setSelectedAttendees] = useState<string[]>([]);
  const [attendeesOpen, setAttendeesOpen] = useState(false);
  const [protocolForm, setProtocolForm] = useState({
    title: "",
    meeting_date: "",
    location: "",
    topic: "",
    notes: "",
    decisions: "",
  });

  useEffect(() => {
    fetchProtocols();
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const { data } = await supabase
        .from("profiles")
        .select("user_id, first_name, last_name, email")
        .eq("is_active", true)
        .order("first_name");

      if (data) {
        setUsers(data);
      }
    } catch (error) {
      console.error("Error fetching users:", error);
    }
  };

  const fetchProtocols = async () => {
    setIsLoading(true);
    try {
      const { data } = await supabase
        .from("meeting_protocols")
        .select("*")
        .order("meeting_date", { ascending: false });

      if (data) {
        setProtocols(data as MeetingProtocol[]);
      }
    } catch (error) {
      console.error("Error fetching protocols:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const getUserDisplayName = (userProfile: UserProfile) => {
    if (userProfile.first_name || userProfile.last_name) {
      return `${userProfile.first_name || ""} ${userProfile.last_name || ""}`.trim();
    }
    return userProfile.email;
  };

  const toggleAttendee = (userId: string) => {
    setSelectedAttendees((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId]
    );
  };

  const getSelectedAttendeesNames = () => {
    return selectedAttendees
      .map((id) => {
        const user = users.find((u) => u.user_id === id);
        return user ? getUserDisplayName(user) : "";
      })
      .filter(Boolean);
  };

  const handleCreateProtocol = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      const attendeeNames = getSelectedAttendeesNames();

      const { error } = await supabase.from("meeting_protocols").insert({
        title: protocolForm.title,
        meeting_date: protocolForm.meeting_date,
        location: protocolForm.location || null,
        attendees: attendeeNames,
        agenda: protocolForm.topic || null,
        minutes: protocolForm.notes || null,
        decisions: protocolForm.decisions || null,
        created_by: user.id,
      });

      if (error) throw error;

      setShowNewProtocol(false);
      setProtocolForm({
        title: "",
        meeting_date: "",
        location: "",
        topic: "",
        notes: "",
        decisions: "",
      });
      setSelectedAttendees([]);
      toast.success("Protocol created");
      fetchProtocols();
    } catch (error) {
      console.error("Error creating protocol:", error);
      toast.error("Failed to create protocol");
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const filteredProtocols = protocols.filter((protocol) =>
    protocol.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-accent" />
      </div>
    );
  }

  return (
    <div>
      {/* Action Bar */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <input
              type="text"
              placeholder="Search protocols..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-4 py-2 bg-muted rounded-lg text-sm text-foreground border-0 focus:ring-2 focus:ring-accent w-64"
            />
          </div>
        </div>
        <button
          onClick={() => setShowNewProtocol(true)}
          className="px-4 py-2 bg-accent text-accent-foreground rounded-lg text-sm font-medium hover:bg-accent/90 transition-colors flex items-center gap-2 glow-gold"
        >
          <Plus size={16} />
          New Protocol
        </button>
      </div>

      {/* Protocols Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredProtocols.map((protocol, index) => (
          <div
            key={protocol.id}
            className="card-state p-4 hover:bg-muted/30 transition-colors cursor-pointer animate-fade-in"
            style={{ animationDelay: `${index * 50}ms` }}
          >
            <div className="flex items-start justify-between mb-3">
              <span className="badge-gold">{formatDate(protocol.meeting_date)}</span>
              <button className="p-1 rounded hover:bg-muted text-muted-foreground">
                <MoreHorizontal size={14} />
              </button>
            </div>
            <h4 className="font-medium text-foreground mb-2">{protocol.title}</h4>
            {protocol.location && (
              <p className="text-xs text-muted-foreground mb-2">📍 {protocol.location}</p>
            )}
            <div className="flex flex-wrap gap-1 mb-3">
              {protocol.attendees?.slice(0, 3).map((attendee) => (
                <span
                  key={attendee}
                  className="px-2 py-0.5 text-xs bg-muted rounded text-muted-foreground"
                >
                  {attendee}
                </span>
              ))}
              {protocol.attendees?.length > 3 && (
                <span className="px-2 py-0.5 text-xs bg-muted rounded text-muted-foreground">
                  +{protocol.attendees.length - 3}
                </span>
              )}
            </div>
            {protocol.decisions && (
              <div className="flex items-center gap-2 text-xs text-success">
                <CheckCircle size={12} />
                <span>Decisions documented</span>
              </div>
            )}
          </div>
        ))}
        {filteredProtocols.length === 0 && (
          <div className="col-span-full text-center py-12 text-muted-foreground">
            No protocols available
          </div>
        )}
      </div>

      {/* New Protocol Modal */}
      {showNewProtocol && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="card-state w-full max-w-lg p-6 animate-fade-in my-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-foreground">
                New Meeting Protocol
              </h2>
              <button
                onClick={() => setShowNewProtocol(false)}
                className="p-2 rounded-lg hover:bg-muted text-muted-foreground"
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleCreateProtocol} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1.5">
                  Title
                </label>
                <input
                  type="text"
                  value={protocolForm.title}
                  onChange={(e) =>
                    setProtocolForm({ ...protocolForm, title: e.target.value })
                  }
                  className="w-full px-4 py-2.5 bg-muted border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-accent"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-1.5">
                    Date
                  </label>
                  <input
                    type="date"
                    value={protocolForm.meeting_date}
                    onChange={(e) =>
                      setProtocolForm({ ...protocolForm, meeting_date: e.target.value })
                    }
                    className="w-full px-4 py-2.5 bg-muted border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-accent"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-1.5">
                    Location
                  </label>
                  <input
                    type="text"
                    value={protocolForm.location}
                    onChange={(e) =>
                      setProtocolForm({ ...protocolForm, location: e.target.value })
                    }
                    className="w-full px-4 py-2.5 bg-muted border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-accent"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1.5">
                  Attendees
                </label>
                <Popover open={attendeesOpen} onOpenChange={setAttendeesOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={attendeesOpen}
                      className="w-full justify-between bg-muted border-border text-foreground hover:bg-muted/80 h-auto min-h-[42px] py-2"
                    >
                      <div className="flex flex-wrap gap-1">
                        {selectedAttendees.length === 0 ? (
                          <span className="text-muted-foreground">Select attendees...</span>
                        ) : (
                          getSelectedAttendeesNames().map((name, idx) => (
                            <span
                              key={idx}
                              className="px-2 py-0.5 bg-accent/20 text-accent rounded text-xs"
                            >
                              {name}
                            </span>
                          ))
                        )}
                      </div>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-full p-0" align="start">
                    <div className="max-h-60 overflow-y-auto p-1">
                      {users.map((userProfile) => (
                        <div
                          key={userProfile.user_id}
                          className={cn(
                            "flex items-center gap-2 px-3 py-2 cursor-pointer rounded hover:bg-muted",
                            selectedAttendees.includes(userProfile.user_id) && "bg-accent/10"
                          )}
                          onClick={() => toggleAttendee(userProfile.user_id)}
                        >
                          <div
                            className={cn(
                              "w-4 h-4 border rounded flex items-center justify-center",
                              selectedAttendees.includes(userProfile.user_id)
                                ? "bg-accent border-accent"
                                : "border-border"
                            )}
                          >
                            {selectedAttendees.includes(userProfile.user_id) && (
                              <Check size={12} className="text-accent-foreground" />
                            )}
                          </div>
                          <span className="text-sm">{getUserDisplayName(userProfile)}</span>
                        </div>
                      ))}
                      {users.length === 0 && (
                        <div className="px-3 py-2 text-sm text-muted-foreground">
                          No users found
                        </div>
                      )}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>

              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1.5">
                  Topic
                </label>
                <textarea
                  value={protocolForm.topic}
                  onChange={(e) =>
                    setProtocolForm({ ...protocolForm, topic: e.target.value })
                  }
                  className="w-full px-4 py-2.5 bg-muted border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-accent resize-none"
                  rows={3}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1.5">
                  Notes
                </label>
                <textarea
                  value={protocolForm.notes}
                  onChange={(e) =>
                    setProtocolForm({ ...protocolForm, notes: e.target.value })
                  }
                  className="w-full px-4 py-2.5 bg-muted border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-accent resize-none"
                  rows={4}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1.5">
                  Decisions
                </label>
                <textarea
                  value={protocolForm.decisions}
                  onChange={(e) =>
                    setProtocolForm({ ...protocolForm, decisions: e.target.value })
                  }
                  className="w-full px-4 py-2.5 bg-muted border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-accent resize-none"
                  rows={2}
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowNewProtocol(false)}
                  className="flex-1 py-2.5 bg-muted text-foreground rounded-lg font-medium hover:bg-muted/80 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-accent text-accent-foreground rounded-lg font-medium hover:bg-accent/90 transition-colors"
                >
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
