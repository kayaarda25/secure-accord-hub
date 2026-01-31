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
  Trash2,
  Download,
  Mail,
  Pencil,
} from "lucide-react";
import { toast } from "sonner";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { generateMeetingProtocolDocx, downloadMeetingProtocol, type ProtocolTopic, type MeetingProtocolData } from "@/lib/documentGenerator";

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

interface TopicItem {
  id: string;
  topic: string;
  notes: string;
}

export function ProtocolsPanel() {
  const { user } = useAuth();
  const [protocols, setProtocols] = useState<MeetingProtocol[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showNewProtocol, setShowNewProtocol] = useState(false);
  const [editingProtocol, setEditingProtocol] = useState<MeetingProtocol | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedAttendees, setSelectedAttendees] = useState<string[]>([]);
  const [attendeesOpen, setAttendeesOpen] = useState(false);
  const [topics, setTopics] = useState<TopicItem[]>([
    { id: crypto.randomUUID(), topic: "", notes: "" }
  ]);
  const [protocolForm, setProtocolForm] = useState({
    title: "",
    meeting_date: "",
    location: "",
    decisions: "",
  });
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

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

  const addTopic = () => {
    setTopics([...topics, { id: crypto.randomUUID(), topic: "", notes: "" }]);
  };

  const removeTopic = (id: string) => {
    if (topics.length > 1) {
      setTopics(topics.filter((t) => t.id !== id));
    }
  };

  const updateTopic = (id: string, field: "topic" | "notes", value: string) => {
    setTopics(
      topics.map((t) => (t.id === id ? { ...t, [field]: value } : t))
    );
  };

  const resetForm = () => {
    setProtocolForm({
      title: "",
      meeting_date: "",
      location: "",
      decisions: "",
    });
    setSelectedAttendees([]);
    setTopics([{ id: crypto.randomUUID(), topic: "", notes: "" }]);
    setEditingProtocol(null);
  };

  // Load protocol data for editing
  const loadProtocolForEdit = (protocol: MeetingProtocol) => {
    // Parse topics from agenda/minutes
    const agendaLines = (protocol.agenda || "").split("\n").filter(l => l.trim());
    const minutesLines = (protocol.minutes || "").split("\n\n").filter(l => l.trim());
    
    const parsedTopics: TopicItem[] = agendaLines.length > 0 
      ? agendaLines.map((line, idx) => {
          const topic = line.replace(/^\d+\.\s*/, "");
          const notesMatch = minutesLines.find(m => m.startsWith(`Topic ${idx + 1}:`));
          const notes = notesMatch ? notesMatch.replace(`Topic ${idx + 1}: `, "") : "";
          return { id: crypto.randomUUID(), topic, notes };
        })
      : [{ id: crypto.randomUUID(), topic: "", notes: "" }];

    // Find user IDs for attendees
    const attendeeUserIds = protocol.attendees
      ?.map(attendeeName => {
        const foundUser = users.find(u => {
          const displayName = getUserDisplayName(u);
          return displayName === attendeeName;
        });
        return foundUser?.user_id;
      })
      .filter(Boolean) as string[] || [];

    setProtocolForm({
      title: protocol.title,
      meeting_date: protocol.meeting_date,
      location: protocol.location || "",
      decisions: protocol.decisions || "",
    });
    setSelectedAttendees(attendeeUserIds);
    setTopics(parsedTopics);
    setEditingProtocol(protocol);
    setShowNewProtocol(true);
    setOpenMenuId(null);
  };

  // Handle update protocol
  const handleUpdateProtocol = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !editingProtocol) return;

    try {
      const attendeeNames = getSelectedAttendeesNames();
      
      // Combine all topics into agenda and all notes into minutes
      const combinedAgenda = topics
        .map((t, idx) => `${idx + 1}. ${t.topic}`)
        .filter((t) => t.trim() !== `${topics.indexOf(topics.find(x => x.topic === '') || topics[0]) + 1}. `)
        .join("\n");
      
      const combinedMinutes = topics
        .map((t, idx) => t.notes ? `Topic ${idx + 1}: ${t.notes}` : "")
        .filter(Boolean)
        .join("\n\n");

      // Update protocol in database
      const { error } = await supabase
        .from("meeting_protocols")
        .update({
          title: protocolForm.title,
          meeting_date: protocolForm.meeting_date,
          location: protocolForm.location || null,
          attendees: attendeeNames,
          agenda: combinedAgenda || null,
          minutes: combinedMinutes || null,
          decisions: protocolForm.decisions || null,
        })
        .eq("id", editingProtocol.id);

      if (error) throw error;

      setShowNewProtocol(false);
      resetForm();
      toast.success("Protocol updated successfully");
      fetchProtocols();
    } catch (error) {
      console.error("Error updating protocol:", error);
      toast.error("Failed to update protocol");
    }
  };

  // Get or create the Protokolle folder
  const getOrCreateProtokollFolder = async (): Promise<string | null> => {
    if (!user) return null;
    
    try {
      // Check if Protokolle folder exists
      const { data: existingFolder } = await supabase
        .from("document_folders")
        .select("id")
        .eq("name", "Protokolle")
        .is("parent_id", null)
        .single();
      
      if (existingFolder) {
        return existingFolder.id;
      }
      
      // Create Protokolle folder if it doesn't exist
      const { data: newFolder, error } = await supabase
        .from("document_folders")
        .insert({
          name: "Protokolle",
          created_by: user.id,
          icon: "FileText",
          color: "#C9A227",
        })
        .select()
        .single();
      
      if (error) throw error;
      return newFolder.id;
    } catch (error) {
      console.error("Error getting/creating Protokolle folder:", error);
      return null;
    }
  };

  // Upload Word document to storage and create document entries
  const saveProtocolToExplorer = async (
    docBlob: Blob,
    protocolId: string,
    filename: string,
    attendeeUserIds: string[]
  ) => {
    if (!user) return;
    
    try {
      const folderId = await getOrCreateProtokollFolder();
      if (!folderId) {
        console.error("Could not get Protokolle folder");
        return;
      }

      // Upload file to storage - path must start with user.id for RLS policy
      const filePath = `${user.id}/protocols/${protocolId}/${filename}`;
      const { error: uploadError } = await supabase.storage
        .from("documents")
        .upload(filePath, docBlob, {
          contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          upsert: true,
        });

      if (uploadError) {
        console.error("Storage upload error:", uploadError);
        return;
      }

      // Create document entry in documents table
      const { data: docEntry, error: docError } = await supabase
        .from("documents")
        .insert({
          name: filename,
          file_path: filePath,
          folder_id: folderId,
          type: "document",
          mime_type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          file_size: docBlob.size,
          uploaded_by: user.id,
        })
        .select()
        .single();

      if (docError) {
        console.error("Document entry error:", docError);
        return;
      }

      // Share document with all attendees
      if (docEntry && attendeeUserIds.length > 0) {
        const shareEntries = attendeeUserIds.map((attendeeId) => ({
          document_id: docEntry.id,
          shared_with_user_id: attendeeId,
          shared_by: user.id,
        }));

        await supabase.from("document_shares").insert(shareEntries);
      }

      console.log("Protocol saved to Explorer:", filename);
    } catch (error) {
      console.error("Error saving protocol to Explorer:", error);
    }
  };

  const handleCreateProtocol = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      const attendeeNames = getSelectedAttendeesNames();
      
      // Get attendee emails for sending
      const attendeeEmails = selectedAttendees
        .map((id) => users.find((u) => u.user_id === id)?.email)
        .filter(Boolean) as string[];
      
      // Combine all topics into agenda and all notes into minutes
      const combinedAgenda = topics
        .map((t, idx) => `${idx + 1}. ${t.topic}`)
        .filter((t) => t.trim() !== `${topics.indexOf(topics.find(x => x.topic === '') || topics[0]) + 1}. `)
        .join("\n");
      
      const combinedMinutes = topics
        .map((t, idx) => t.notes ? `Topic ${idx + 1}: ${t.notes}` : "")
        .filter(Boolean)
        .join("\n\n");

      // Insert protocol into database
      const { data: protocolData, error } = await supabase.from("meeting_protocols").insert({
        title: protocolForm.title,
        meeting_date: protocolForm.meeting_date,
        location: protocolForm.location || null,
        attendees: attendeeNames,
        agenda: combinedAgenda || null,
        minutes: combinedMinutes || null,
        decisions: protocolForm.decisions || null,
        created_by: user.id,
      }).select().single();

      if (error) throw error;

      // Generate Word document
      const protocolTopics: ProtocolTopic[] = topics
        .filter(t => t.topic.trim())
        .map(t => ({ topic: t.topic, notes: t.notes }));

      const protocolDataForDoc: MeetingProtocolData = {
        title: protocolForm.title,
        date: protocolForm.meeting_date,
        location: protocolForm.location,
        attendees: attendeeNames,
        topics: protocolTopics,
        decisions: protocolForm.decisions || undefined,
      };

      // Generate the Word document as blob
      const docBlob = await generateMeetingProtocolDocx(protocolDataForDoc);
      const filename = `${protocolForm.meeting_date}_MoM_${protocolForm.title.replace(/\s+/g, "_")}.docx`;

      // Save to Explorer (Protokolle folder)
      await saveProtocolToExplorer(docBlob, protocolData.id, filename, selectedAttendees);

      // Send protocol to all attendees via email
      if (attendeeEmails.length > 0) {
        toast.loading("Sending protocol to attendees...", { id: "protocol-send" });
        
        // Convert blob to base64
        const arrayBuffer = await docBlob.arrayBuffer();
        const base64 = btoa(
          new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), "")
        );

        // Send protocol to all attendees
        const { error: sendError } = await supabase.functions.invoke("send-protocol", {
          body: {
            protocol_id: protocolData.id,
            title: protocolForm.title,
            date: protocolForm.meeting_date,
            location: protocolForm.location,
            attendee_emails: attendeeEmails,
            attendee_names: attendeeNames,
            topics: protocolTopics,
            decisions: protocolForm.decisions || undefined,
            document_base64: base64,
          },
        });

        if (sendError) {
          console.error("Error sending protocol:", sendError);
          toast.error("Protocol created but failed to send emails", { id: "protocol-send" });
        } else {
          toast.success(`Protocol sent to ${attendeeEmails.length} attendees`, { id: "protocol-send" });
        }
      }

      setShowNewProtocol(false);
      resetForm();
      toast.success("Protocol saved to Protokolle folder");
      fetchProtocols();
    } catch (error) {
      console.error("Error creating protocol:", error);
      toast.error("Failed to create protocol");
    }
  };

  const handleDownloadProtocol = async (protocol: MeetingProtocol) => {
    try {
      // Parse topics from agenda/minutes
      const agendaLines = (protocol.agenda || "").split("\n").filter(l => l.trim());
      const minutesLines = (protocol.minutes || "").split("\n\n").filter(l => l.trim());
      
      const protocolTopics: ProtocolTopic[] = agendaLines.map((line, idx) => {
        const topic = line.replace(/^\d+\.\s*/, "");
        const notesMatch = minutesLines.find(m => m.startsWith(`Topic ${idx + 1}:`));
        const notes = notesMatch ? notesMatch.replace(`Topic ${idx + 1}: `, "") : "";
        return { topic, notes };
      });

      const protocolDataForDoc: MeetingProtocolData = {
        title: protocol.title,
        date: protocol.meeting_date,
        location: protocol.location || "",
        attendees: protocol.attendees || [],
        topics: protocolTopics,
        decisions: protocol.decisions || undefined,
      };

      await downloadMeetingProtocol(protocolDataForDoc);
      toast.success("Protocol downloaded");
    } catch (error) {
      console.error("Error downloading protocol:", error);
      toast.error("Failed to download protocol");
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
              <div className="flex items-center gap-1">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDownloadProtocol(protocol);
                  }}
                  className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-accent transition-colors"
                  title="Download Word Document"
                >
                  <Download size={14} />
                </button>
                <Popover 
                  open={openMenuId === protocol.id} 
                  onOpenChange={(open) => setOpenMenuId(open ? protocol.id : null)}
                >
                  <PopoverTrigger asChild>
                    <button 
                      className="p-1 rounded hover:bg-muted text-muted-foreground"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <MoreHorizontal size={14} />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-40 p-1" align="end">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        loadProtocolForEdit(protocol);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-muted rounded transition-colors"
                    >
                      <Pencil size={14} />
                      Edit
                    </button>
                  </PopoverContent>
                </Popover>
              </div>
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
            <div className="flex items-center gap-3">
              {protocol.decisions && (
                <div className="flex items-center gap-1.5 text-xs text-success">
                  <CheckCircle size={12} />
                  <span>Decisions</span>
                </div>
              )}
              {protocol.attendees && protocol.attendees.length > 0 && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Mail size={12} />
                  <span>Sent to {protocol.attendees.length}</span>
                </div>
              )}
            </div>
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
          <div className="card-state w-full max-w-lg p-6 animate-fade-in my-8 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-foreground">
                {editingProtocol ? "Edit Meeting Protocol" : "New Meeting Protocol"}
              </h2>
              <button
                onClick={() => {
                  setShowNewProtocol(false);
                  resetForm();
                }}
                className="p-2 rounded-lg hover:bg-muted text-muted-foreground"
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={editingProtocol ? handleUpdateProtocol : handleCreateProtocol} className="space-y-4">
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

              {/* Dynamic Topics */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <label className="block text-sm font-medium text-muted-foreground">
                    Topics
                  </label>
                  <button
                    type="button"
                    onClick={addTopic}
                    className="text-xs text-accent hover:text-accent/80 flex items-center gap-1"
                  >
                    <Plus size={14} />
                    Add Topic
                  </button>
                </div>

                {topics.map((topicItem, index) => (
                  <div
                    key={topicItem.id}
                    className="p-4 bg-muted/50 rounded-lg border border-border space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-muted-foreground">
                        Topic {index + 1}
                      </span>
                      {topics.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeTopic(topicItem.id)}
                          className="p-1 text-muted-foreground hover:text-destructive rounded"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                    <input
                      type="text"
                      value={topicItem.topic}
                      onChange={(e) => updateTopic(topicItem.id, "topic", e.target.value)}
                      placeholder="Topic title..."
                      className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                    />
                    <textarea
                      value={topicItem.notes}
                      onChange={(e) => updateTopic(topicItem.id, "notes", e.target.value)}
                      placeholder="Notes for this topic..."
                      className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent resize-none"
                      rows={3}
                    />
                  </div>
                ))}
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
                  onClick={() => {
                    setShowNewProtocol(false);
                    resetForm();
                  }}
                  className="flex-1 py-2.5 bg-muted text-foreground rounded-lg font-medium hover:bg-muted/80 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-accent text-accent-foreground rounded-lg font-medium hover:bg-accent/90 transition-colors"
                >
                  {editingProtocol ? "Update" : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
