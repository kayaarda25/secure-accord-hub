import { useState, useEffect } from "react";
import { Layout } from "@/components/layout/Layout";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { VideoMeeting } from "@/components/communication/VideoMeeting";
import { MeetingScheduler } from "@/components/communication/MeetingScheduler";
import {
  MessageSquare,
  Users,
  Building2,
  Globe,
  Plus,
  Search,
  Filter,
  Send,
  Paperclip,
  FileText,
  Calendar,
  CheckCircle,
  Star,
  MoreHorizontal,
  ChevronRight,
  Loader2,
  Clock,
  Video,
} from "lucide-react";

type CommunicationType = "partner" | "authority" | "internal";

interface Thread {
  id: string;
  subject: string;
  type: CommunicationType;
  organization_id: string | null;
  is_official: boolean;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
  message_count?: number;
  last_message?: string;
}

interface Message {
  id: string;
  thread_id: string;
  sender_id: string;
  content: string;
  priority: string;
  is_decision: boolean;
  created_at: string;
  sender_name?: string;
}

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
  id: string;
  user_id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  department: string | null;
}

export default function Communication() {
  const { user, profile, hasAnyRole } = useAuth();
  const [activeTab, setActiveTab] = useState<CommunicationType | "meetings">("partner");
  const [threads, setThreads] = useState<Thread[]>([]);
  const [selectedThread, setSelectedThread] = useState<Thread | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [protocols, setProtocols] = useState<MeetingProtocol[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newMessage, setNewMessage] = useState("");
  const [showNewThread, setShowNewThread] = useState(false);
  const [showNewProtocol, setShowNewProtocol] = useState(false);
  const [showVideoMeeting, setShowVideoMeeting] = useState(false);
  const [showScheduler, setShowScheduler] = useState(false);
  const [meetingRoomCode, setMeetingRoomCode] = useState<string | undefined>(undefined);
  const [availableUsers, setAvailableUsers] = useState<UserProfile[]>([]);
  const [userSearchQuery, setUserSearchQuery] = useState("");

  // Form state for new thread
  const [threadForm, setThreadForm] = useState({
    subject: "",
    type: "partner" as CommunicationType,
    is_official: false,
    selectedMembers: [] as string[],
  });

  // Form state for new protocol
  const [protocolForm, setProtocolForm] = useState({
    title: "",
    meeting_date: "",
    location: "",
    attendees: "",
    agenda: "",
    minutes: "",
    decisions: "",
  });

  useEffect(() => {
    fetchAvailableUsers();
  }, []);

  const fetchAvailableUsers = async () => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, user_id, email, first_name, last_name, department")
        .eq("is_active", true)
        .order("first_name");
      
      if (error) throw error;
      setAvailableUsers(data || []);
    } catch (error) {
      console.error("Error fetching users:", error);
    }
  };

  const toggleMember = (userId: string) => {
    setThreadForm(prev => ({
      ...prev,
      selectedMembers: prev.selectedMembers.includes(userId)
        ? prev.selectedMembers.filter(id => id !== userId)
        : [...prev.selectedMembers, userId]
    }));
  };

  const filteredUsers = availableUsers.filter(u => {
    if (u.user_id === user?.id) return false; // Exclude current user
    const searchLower = userSearchQuery.toLowerCase();
    const fullName = `${u.first_name || ""} ${u.last_name || ""}`.toLowerCase();
    return fullName.includes(searchLower) || u.email.toLowerCase().includes(searchLower);
  });

  const canViewPartner = hasAnyRole(["management", "partner", "admin"]);
  const canViewAuthority = hasAnyRole(["state", "management", "admin"]);

  useEffect(() => {
    fetchThreads();
    if (activeTab === "meetings") {
      fetchProtocols();
    }
  }, [activeTab]);

  useEffect(() => {
    if (selectedThread) {
      fetchMessages(selectedThread.id);

      // Set up realtime subscription for messages
      const channel = supabase
        .channel(`messages-${selectedThread.id}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'communication_messages',
            filter: `thread_id=eq.${selectedThread.id}`,
          },
          (payload) => {
            console.log('New message received:', payload);
            const newMsg = payload.new as Message;
            setMessages((prev) => {
              // Avoid duplicates
              if (prev.some(m => m.id === newMsg.id)) return prev;
              return [...prev, newMsg];
            });
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [selectedThread]);

  const fetchThreads = async () => {
    setIsLoading(true);
    try {
      const { data } = await supabase
        .from("communication_threads")
        .select("*")
        .eq("type", activeTab === "meetings" ? "internal" : activeTab)
        .order("updated_at", { ascending: false });

      if (data) {
        setThreads(data as Thread[]);
      }
    } catch (error) {
      console.error("Error fetching threads:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchMessages = async (threadId: string) => {
    try {
      const { data } = await supabase
        .from("communication_messages")
        .select("*")
        .eq("thread_id", threadId)
        .order("created_at", { ascending: true });

      if (data) {
        setMessages(data as Message[]);
      }
    } catch (error) {
      console.error("Error fetching messages:", error);
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

  const handleCreateThread = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from("communication_threads")
        .insert({
          subject: threadForm.subject,
          type: threadForm.type,
          is_official: threadForm.is_official,
          created_by: user.id,
        })
        .select()
        .single();

      if (error) throw error;

      setShowNewThread(false);
      setThreadForm({ subject: "", type: "partner", is_official: false, selectedMembers: [] });
      fetchThreads();
      if (data) {
        setSelectedThread(data as Thread);
      }
    } catch (error) {
      console.error("Error creating thread:", error);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedThread || !newMessage.trim()) return;

    try {
      await supabase.from("communication_messages").insert({
        thread_id: selectedThread.id,
        sender_id: user.id,
        content: newMessage,
        priority: "normal",
      });

      setNewMessage("");
      fetchMessages(selectedThread.id);
    } catch (error) {
      console.error("Error sending message:", error);
    }
  };

  const handleCreateProtocol = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      const { error } = await supabase.from("meeting_protocols").insert({
        title: protocolForm.title,
        meeting_date: protocolForm.meeting_date,
        location: protocolForm.location || null,
        attendees: protocolForm.attendees.split(",").map((a) => a.trim()),
        agenda: protocolForm.agenda || null,
        minutes: protocolForm.minutes || null,
        decisions: protocolForm.decisions || null,
        created_by: user.id,
      });

      if (error) throw error;

      setShowNewProtocol(false);
      setProtocolForm({
        title: "",
        meeting_date: "",
        location: "",
        attendees: "",
        agenda: "",
        minutes: "",
        decisions: "",
      });
      fetchProtocols();
    } catch (error) {
      console.error("Error creating protocol:", error);
    }
  };

  const getTabIcon = (tab: CommunicationType | "meetings") => {
    switch (tab) {
      case "partner":
        return <Building2 size={18} />;
      case "authority":
        return <Globe size={18} />;
      case "internal":
        return <Users size={18} />;
      case "meetings":
        return <Calendar size={18} />;
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const tabs = [
    { id: "partner" as const, label: "Partners", visible: canViewPartner },
    { id: "authority" as const, label: "Authorities", visible: canViewAuthority },
    { id: "internal" as const, label: "Internal", visible: true },
    { id: "meetings" as const, label: "Protocols", visible: true },
  ];

  return (
    <Layout title="Communication" subtitle="Messages, protocols and online meetings">
      {/* Video Meeting Modal */}
      {showVideoMeeting && (
        <VideoMeeting 
          onClose={() => {
            setShowVideoMeeting(false);
            setMeetingRoomCode(undefined);
          }} 
          initialRoomCode={meetingRoomCode}
        />
      )}

      {/* Meeting Scheduler */}
      {showScheduler && (
        <MeetingScheduler 
          onClose={() => setShowScheduler(false)}
          onJoinMeeting={(code) => {
            setMeetingRoomCode(code);
            setShowScheduler(false);
            setShowVideoMeeting(true);
          }}
        />
      )}

      {/* Meeting Buttons */}
      <div className="mb-6 flex flex-wrap gap-3">
        <button
          onClick={() => setShowVideoMeeting(true)}
          className="px-4 py-2.5 bg-accent text-accent-foreground rounded-xl text-sm font-medium hover:bg-accent/90 transition-colors flex items-center gap-2 glow-gold"
        >
          <Video size={18} />
          Instant Meeting
        </button>
        <button
          onClick={() => setShowScheduler(true)}
          className="px-4 py-2.5 bg-muted text-foreground rounded-xl text-sm font-medium hover:bg-muted/80 transition-colors flex items-center gap-2"
        >
          <Calendar size={18} />
          Schedule Meeting
        </button>
      </div>
      {/* Tabs */}
      <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-2">
        {tabs
          .filter((t) => t.visible)
          .map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id);
                setSelectedThread(null);
              }}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? "bg-accent text-accent-foreground"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              {getTabIcon(tab.id)}
              {tab.label}
            </button>
          ))}
      </div>

      {activeTab === "meetings" ? (
        // Meeting Protocols View
        <div>
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
                  className="pl-10 pr-4 py-2 bg-muted rounded-xl text-sm text-foreground border-0 focus:ring-2 focus:ring-accent w-full sm:w-64"
                />
              </div>
            </div>
            <button
              onClick={() => setShowNewProtocol(true)}
              className="px-4 py-2 bg-accent text-accent-foreground rounded-xl text-sm font-medium hover:bg-accent/90 transition-colors flex items-center gap-2 glow-gold"
            >
              <Plus size={16} />
              New Protocol
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {protocols.map((protocol, index) => (
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
            {protocols.length === 0 && !isLoading && (
              <div className="col-span-full text-center py-12 text-muted-foreground">
                No protocols available
              </div>
            )}
          </div>
        </div>
      ) : (
        // Threads & Messages View
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6 h-auto lg:h-[calc(100vh-250px)]">
          {/* Thread List */}
          <div className="card-state flex flex-col max-h-[300px] lg:max-h-none">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <h3 className="font-semibold text-foreground">Conversations</h3>
              <button
                onClick={() => setShowNewThread(true)}
                className="p-2 rounded-xl hover:bg-muted text-accent transition-colors"
              >
                <Plus size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-accent" />
                </div>
              ) : threads.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  No conversations
                </div>
              ) : (
                threads.map((thread, index) => (
                  <button
                    key={thread.id}
                    onClick={() => setSelectedThread(thread)}
                    className={`w-full p-4 text-left border-b border-border/50 hover:bg-muted/30 transition-colors animate-fade-in ${
                      selectedThread?.id === thread.id ? "bg-muted/50" : ""
                    }`}
                    style={{ animationDelay: `${index * 30}ms` }}
                  >
                    <div className="flex items-start justify-between mb-1">
                      <p className="text-sm font-medium text-foreground truncate pr-2">
                        {thread.subject}
                      </p>
                      {thread.is_official && (
                        <Star size={14} className="text-accent flex-shrink-0" />
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(thread.updated_at)}
                    </p>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Message View */}
          <div className="lg:col-span-2 card-state flex flex-col">
            {selectedThread ? (
              <>
                <div className="p-4 border-b border-border">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-foreground">
                        {selectedThread.subject}
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        {selectedThread.is_official && "Official • "}
                        Created on {formatDate(selectedThread.created_at)}
                      </p>
                    </div>
                    <button className="p-2 rounded-lg hover:bg-muted text-muted-foreground">
                      <MoreHorizontal size={18} />
                    </button>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {messages.map((message, index) => {
                    const isOwnMessage = message.sender_id === user?.id;
                    return (
                      <div
                        key={message.id}
                        className={`flex ${isOwnMessage ? "justify-end" : "justify-start"} animate-fade-in`}
                        style={{ animationDelay: `${index * 30}ms` }}
                      >
                        <div
                          className={`max-w-[70%] p-3 rounded-lg ${
                            isOwnMessage
                              ? "bg-accent/20 text-foreground"
                              : "bg-muted text-foreground"
                          }`}
                        >
                          {message.is_decision && (
                            <div className="flex items-center gap-1 text-xs text-success mb-1">
                              <CheckCircle size={12} />
                              Decision
                            </div>
                          )}
                          <p className="text-sm">{message.content}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {formatTime(message.created_at)}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                  {messages.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground text-sm">
                      No messages yet
                    </div>
                  )}
                </div>

                <form
                  onSubmit={handleSendMessage}
                  className="p-4 border-t border-border flex items-center gap-3"
                >
                  <button
                    type="button"
                    className="p-2 rounded-lg hover:bg-muted text-muted-foreground"
                  >
                    <Paperclip size={18} />
                  </button>
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Type a message..."
                    className="flex-1 px-4 py-2.5 bg-muted border border-border rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-accent"
                  />
                  <button
                    type="submit"
                    disabled={!newMessage.trim()}
                    className="p-2.5 rounded-lg bg-accent text-accent-foreground hover:bg-accent/90 transition-colors disabled:opacity-50"
                  >
                    <Send size={18} />
                  </button>
                </form>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-muted-foreground p-8">
                <div className="text-center">
                  <MessageSquare size={48} className="mx-auto mb-4 opacity-30" />
                  <p>Select a conversation</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* New Thread Modal */}
      {showNewThread && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="card-state w-full max-w-md p-6 animate-fade-in max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-semibold text-foreground mb-6">
              New Conversation
            </h2>
            <form onSubmit={handleCreateThread} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1.5">
                  Subject
                </label>
                <input
                  type="text"
                  value={threadForm.subject}
                  onChange={(e) =>
                    setThreadForm({ ...threadForm, subject: e.target.value })
                  }
                  className="w-full px-4 py-2.5 bg-muted border border-border rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-accent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1.5">
                  Type
                </label>
                <select
                  value={threadForm.type}
                  onChange={(e) =>
                    setThreadForm({
                      ...threadForm,
                      type: e.target.value as CommunicationType,
                    })
                  }
                  className="w-full px-4 py-2.5 bg-muted border border-border rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-accent"
                >
                  <option value="partner">Partners</option>
                  <option value="authority">Authorities</option>
                  <option value="internal">Internal</option>
                </select>
              </div>

              {/* Member Selection */}
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1.5">
                  Select Participants
                </label>
                <div className="relative mb-2">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="text"
                    value={userSearchQuery}
                    onChange={(e) => setUserSearchQuery(e.target.value)}
                    placeholder="Search users..."
                    className="w-full pl-10 pr-4 py-2 bg-muted border border-border rounded-xl text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                  />
                </div>
                
                {/* Selected members */}
                {threadForm.selectedMembers.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-2">
                    {threadForm.selectedMembers.map(memberId => {
                      const member = availableUsers.find(u => u.user_id === memberId);
                      if (!member) return null;
                      return (
                        <span
                          key={memberId}
                          className="inline-flex items-center gap-1 px-2 py-1 bg-accent/20 text-accent rounded-md text-xs"
                        >
                          {member.first_name || member.email}
                          <button
                            type="button"
                            onClick={() => toggleMember(memberId)}
                            className="ml-1 hover:text-accent-foreground"
                          >
                            ×
                          </button>
                        </span>
                      );
                    })}
                  </div>
                )}
                
                {/* User list */}
                <div className="max-h-32 overflow-y-auto border border-border rounded-xl bg-muted">
                  {filteredUsers.length === 0 ? (
                    <p className="text-center text-muted-foreground text-sm py-3">
                      No users found
                    </p>
                  ) : (
                    filteredUsers.map(u => (
                      <button
                        key={u.user_id}
                        type="button"
                        onClick={() => toggleMember(u.user_id)}
                        className={`w-full text-left px-3 py-2 text-sm hover:bg-muted/80 transition-colors flex items-center justify-between ${
                          threadForm.selectedMembers.includes(u.user_id) ? "bg-accent/10" : ""
                        }`}
                      >
                        <div>
                          <span className="text-foreground">
                            {u.first_name || u.last_name 
                              ? `${u.first_name || ""} ${u.last_name || ""}`.trim() 
                              : u.email}
                          </span>
                          {u.department && (
                            <span className="text-muted-foreground text-xs ml-2">
                              ({u.department})
                            </span>
                          )}
                        </div>
                        {threadForm.selectedMembers.includes(u.user_id) && (
                          <span className="text-accent">✓</span>
                        )}
                      </button>
                    ))
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="is_official"
                  checked={threadForm.is_official}
                  onChange={(e) =>
                    setThreadForm({ ...threadForm, is_official: e.target.checked })
                  }
                  className="w-4 h-4 rounded border-border text-accent focus:ring-accent"
                />
                <label htmlFor="is_official" className="text-sm text-foreground">
                  Official Communication
                </label>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowNewThread(false)}
                  className="flex-1 py-2.5 bg-muted text-foreground rounded-xl font-medium hover:bg-muted/80 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-accent text-accent-foreground rounded-xl font-medium hover:bg-accent/90 transition-colors"
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* New Protocol Modal */}
      {showNewProtocol && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="card-state w-full max-w-lg p-6 animate-fade-in my-8">
            <h2 className="text-xl font-semibold text-foreground mb-6">
              New Meeting Protocol
            </h2>
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
                  className="w-full px-4 py-2.5 bg-muted border border-border rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-accent"
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
                    className="w-full px-4 py-2.5 bg-muted border border-border rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-accent"
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
                    className="w-full px-4 py-2.5 bg-muted border border-border rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-accent"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1.5">
                  Attendees (comma-separated)
                </label>
                <input
                  type="text"
                  value={protocolForm.attendees}
                  onChange={(e) =>
                    setProtocolForm({ ...protocolForm, attendees: e.target.value })
                  }
                  className="w-full px-4 py-2.5 bg-muted border border-border rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-accent"
                  placeholder="John Smith, Jane Doe, ..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1.5">
                  Agenda
                </label>
                <textarea
                  value={protocolForm.agenda}
                  onChange={(e) =>
                    setProtocolForm({ ...protocolForm, agenda: e.target.value })
                  }
                  className="w-full px-4 py-2.5 bg-muted border border-border rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-accent resize-none"
                  rows={3}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1.5">
                  Minutes / Notes
                </label>
                <textarea
                  value={protocolForm.minutes}
                  onChange={(e) =>
                    setProtocolForm({ ...protocolForm, minutes: e.target.value })
                  }
                  className="w-full px-4 py-2.5 bg-muted border border-border rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-accent resize-none"
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
                  className="w-full px-4 py-2.5 bg-muted border border-border rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-accent resize-none"
                  rows={2}
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowNewProtocol(false)}
                  className="flex-1 py-2.5 bg-muted text-foreground rounded-xl font-medium hover:bg-muted/80 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-accent text-accent-foreground rounded-xl font-medium hover:bg-accent/90 transition-colors"
                >
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  );
}
