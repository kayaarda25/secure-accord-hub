import { useState, useEffect, useCallback, useRef } from "react";
import { Layout } from "@/components/layout/Layout";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useE2ECrypto } from "@/hooks/useE2ECrypto";
import { VideoMeeting } from "@/components/communication/VideoMeeting";
import { MeetingScheduler } from "@/components/communication/MeetingScheduler";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  MessageSquare,
  Users,
  Building2,
  Globe,
  Plus,
  Search,
  Send,
  Paperclip,
  CheckCircle,
  Star,
  MoreHorizontal,
  Loader2,
  Video,
  MessageCircle,
  Lock,
  Calendar,
} from "lucide-react";

type CommunicationType = "partner" | "authority" | "internal" | "direct";

interface Thread {
  id: string;
  subject: string | null;
  type: CommunicationType;
  organization_id: string | null;
  is_official: boolean;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
  created_by: string;
  message_count?: number;
  last_message?: string;
  participants?: ThreadParticipant[];
}

interface ThreadParticipant {
  id: string;
  thread_id: string;
  user_id: string;
  joined_at: string;
  last_read_at: string | null;
  profile?: UserProfile;
}

interface Message {
  id: string;
  thread_id: string;
  sender_id: string;
  content: string;
  encrypted_content?: string | null; // JSON payload {iv, ciphertext}
  priority: string;
  is_decision: boolean;
  created_at: string;
  sender_name?: string;
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
  const { toast } = useToast();
  const { ready: cryptoReady, encrypt, decrypt } = useE2ECrypto(user?.id);
  const [activeTab, setActiveTab] = useState<CommunicationType>("direct");
  const [threads, setThreads] = useState<Thread[]>([]);
  const [selectedThread, setSelectedThread] = useState<Thread | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  
  const [isLoading, setIsLoading] = useState(true);
  const [isCreatingThread, setIsCreatingThread] = useState(false);
  const [newMessage, setNewMessage] = useState("");
  const [showNewThread, setShowNewThread] = useState(false);
  
  const [showVideoMeeting, setShowVideoMeeting] = useState(false);
  const [showScheduler, setShowScheduler] = useState(false);
  const [meetingRoomCode, setMeetingRoomCode] = useState<string | undefined>(undefined);
  const [availableUsers, setAvailableUsers] = useState<UserProfile[]>([]);
  const [userSearchQuery, setUserSearchQuery] = useState("");

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const scrollMessagesToBottom = useCallback((behavior: ScrollBehavior = "auto") => {
    // scrollIntoView finds the nearest scrollable ancestor (Radix ScrollArea viewport)
    // and scrolls that container (not the whole page).
    messagesEndRef.current?.scrollIntoView({ block: "end", behavior });
  }, []);

  const maybeDecryptMessage = useCallback(
    async (msg: Message): Promise<Message> => {
      if (!msg.encrypted_content || !user?.id || !cryptoReady) return msg;
      try {
        const payloads = JSON.parse(msg.encrypted_content) as Record<
          string,
          { iv: string; ciphertext: string }
        >;
        const myPayload = payloads[user.id];
        if (!myPayload) return msg;
        const decryptedText = await decrypt(myPayload, msg.sender_id);
        if (!decryptedText) return msg;
        return { ...msg, content: decryptedText };
      } catch (err) {
        console.error("Decryption failed for message", msg.id, err);
        return msg;
      }
    },
    [cryptoReady, decrypt, user?.id]
  );

  // Form state for new thread
  const [threadForm, setThreadForm] = useState({
    subject: "",
    type: "partner" as CommunicationType,
    is_official: false,
    selectedMembers: [] as string[],
  });


  // Fetch available users first, then threads when users are loaded
  useEffect(() => {
    fetchAvailableUsers();
  }, []);

  // Fetch threads only after availableUsers are loaded
  const [usersLoaded, setUsersLoaded] = useState(false);

  const fetchAvailableUsers = async () => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, user_id, email, first_name, last_name, department")
        .eq("is_active", true)
        .order("first_name");
      
      if (error) throw error;
      setAvailableUsers(data || []);
      setUsersLoaded(true);
    } catch (error) {
      console.error("Error fetching users:", error);
      setUsersLoaded(true); // Still mark as loaded to avoid blocking
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

  // Fetch threads only after users are loaded
  useEffect(() => {
    if (usersLoaded) {
      fetchThreads();
    }
  }, [activeTab, usersLoaded]);

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
            console.log("New message received:", payload);
            const incoming = payload.new as Message;
            (async () => {
              const newMsg = await maybeDecryptMessage(incoming);
              setMessages((prev) => {
                // Avoid duplicates
                if (prev.some((m) => m.id === newMsg.id)) return prev;
                return [...prev, newMsg];
              });
              queueMicrotask(() => scrollMessagesToBottom("smooth"));
            })();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [selectedThread, maybeDecryptMessage, scrollMessagesToBottom]);

  // When crypto becomes ready, re-fetch so existing messages get decrypted.
  useEffect(() => {
    if (!selectedThread?.id) return;
    if (!cryptoReady) return;
    fetchMessages(selectedThread.id);
  }, [cryptoReady, selectedThread?.id]);

  // When messages change (initial load, decrypt, send), keep the latest visible.
  useEffect(() => {
    if (!selectedThread) return;
    // auto to avoid jumpy smooth scroll on initial load
    scrollMessagesToBottom(messages.length > 0 ? "auto" : "auto");
  }, [messages.length, selectedThread?.id, scrollMessagesToBottom]);

  const fetchThreads = async () => {
    setIsLoading(true);
    try {
      if (activeTab === "direct") {
        // Fetch direct threads where user is a participant
        const { data: participantData } = await (supabase as any)
          .from("thread_participants")
          .select("thread_id")
          .eq("user_id", user?.id);
        
        const threadIds = (participantData as any[])?.map((p: any) => p.thread_id) || [];
        
        if (threadIds.length > 0) {
          const { data } = await (supabase as any)
            .from("communication_threads")
            .select("*")
            .eq("type", "direct")
            .in("id", threadIds)
            .order("updated_at", { ascending: false });

          // Fetch participants for each thread
          if (data) {
            const threadsWithParticipants = await Promise.all(
              (data as any[]).map(async (thread: any) => {
                const { data: participants } = await (supabase as any)
                  .from("thread_participants")
                  .select("*")
                  .eq("thread_id", thread.id);
                
                // Fetch profiles for participants
                const participantsWithProfiles = await Promise.all(
                  ((participants as any[]) || []).map(async (p: any) => {
                    const profile = availableUsers.find(u => u.user_id === p.user_id);
                    return { ...p, profile };
                  })
                );
                
                return { ...thread, participants: participantsWithProfiles };
              })
            );
            setThreads(threadsWithParticipants as Thread[]);
          }
        } else {
          setThreads([]);
        }
      } else {
        const { data } = await (supabase as any)
          .from("communication_threads")
          .select("*")
          .eq("type", activeTab)
          .order("updated_at", { ascending: false });

        if (data) {
          setThreads(data as Thread[]);
        }
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
        // Decrypt messages if encrypted
        const decryptedMessages = await Promise.all(
          (data as Message[]).map(async (msg) => {
            if (msg.encrypted_content && user?.id && cryptoReady) {
              try {
                const payloads = JSON.parse(msg.encrypted_content) as Record<
                  string,
                  { iv: string; ciphertext: string }
                >;
                const myPayload = payloads[user.id];
                if (myPayload) {
                  const decryptedText = await decrypt(myPayload, msg.sender_id);
                  if (decryptedText) {
                    return { ...msg, content: decryptedText };
                  }
                }
              } catch (err) {
                console.error("Decryption failed for message", msg.id, err);
              }
            }
            return msg;
          })
        );
        setMessages(decryptedMessages);
      }
    } catch (error) {
      console.error("Error fetching messages:", error);
    }
  };


  const handleCreateThread = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (isCreatingThread) return;

    setIsCreatingThread(true);
    try {
      // Create via backend function to avoid client-side RLS dead-ends.
      const { data, error } = await supabase.functions.invoke("create-communication-thread", {
        body: {
          subject: threadForm.subject || null,
          type: threadForm.type,
          is_official: threadForm.is_official,
          selectedMembers: threadForm.selectedMembers,
        },
      });

      if (error) {
        console.error("Error creating thread (function):", error);
        toast({
          title: "Fehler",
          description: error.message || "Chat konnte nicht erstellt werden.",
          variant: "destructive",
        });
        return;
      }

      const createdThread = (data as any)?.thread as Thread | undefined;
      if (!createdThread?.id) {
        toast({
          title: "Fehler",
          description: "Chat konnte nicht erstellt werden (ungültige Antwort).",
          variant: "destructive",
        });
        return;
      }

      setShowNewThread(false);
      setThreadForm({ subject: "", type: "direct", is_official: false, selectedMembers: [] });
      toast({ title: "Erstellt", description: "Chat wurde erstellt." });
      await fetchThreads();
      setSelectedThread(createdThread);
    } catch (error) {
      console.error("Error creating thread:", error);
      toast({
        title: "Fehler",
        description: "Chat konnte nicht erstellt werden.",
        variant: "destructive",
      });
    } finally {
      setIsCreatingThread(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedThread || !newMessage.trim()) return;

    try {
      // For direct chats, encrypt for each participant
      let encryptedContent: string | null = null;
      const plaintext = newMessage;

      if (selectedThread.type === "direct" && cryptoReady && selectedThread.participants) {
        // Encrypt message for all participants (including self for read-back)
        const allParticipantIds = selectedThread.participants.map((p) => p.user_id);
        const encryptedPayloads: Record<string, { iv: string; ciphertext: string }> = {};

        for (const participantId of allParticipantIds) {
          const payload = await encrypt(plaintext, participantId);
          if (payload) {
            encryptedPayloads[participantId] = payload;
          }
        }

        if (Object.keys(encryptedPayloads).length > 0) {
          encryptedContent = JSON.stringify(encryptedPayloads);
        }
      }

      await supabase.from("communication_messages").insert({
        thread_id: selectedThread.id,
        sender_id: user.id,
        content: encryptedContent ? "[Verschlüsselte Nachricht]" : plaintext,
        encrypted_content: encryptedContent,
        priority: "normal",
      });

      setNewMessage("");
      fetchMessages(selectedThread.id);
      queueMicrotask(() => scrollMessagesToBottom("smooth"));
    } catch (error) {
      console.error("Error sending message:", error);
    }
  };


  const getTabIcon = (tab: CommunicationType) => {
    switch (tab) {
      case "direct":
        return <MessageCircle size={18} />;
      case "partner":
        return <Building2 size={18} />;
      case "authority":
        return <Globe size={18} />;
      case "internal":
        return <Users size={18} />;
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

  // Get display name for a thread (for direct chats, show participant names)
  const getThreadDisplayName = (thread: Thread) => {
    if (thread.type === "direct" && thread.participants) {
      // Filter out current user and show other participants
      const otherParticipants = thread.participants.filter(
        p => p.user_id !== user?.id
      );
      
      if (otherParticipants.length === 0) {
        return "Nur du";
      }
      
      const names = otherParticipants.map(p => {
        if (p.profile) {
          if (p.profile.first_name || p.profile.last_name) {
            return `${p.profile.first_name || ""} ${p.profile.last_name || ""}`.trim();
          }
          return p.profile.email;
        }
        return "Unbekannt";
      });
      
      if (names.length <= 2) {
        return names.join(", ");
      }
      return `${names.slice(0, 2).join(", ")} +${names.length - 2}`;
    }
    
    return thread.subject || "Kein Betreff";
  };

  const tabs = [
    { id: "direct" as const, label: "Direkt", visible: true },
    { id: "partner" as const, label: "Partners", visible: false },
    { id: "authority" as const, label: "Authorities", visible: false },
    { id: "internal" as const, label: "Internal", visible: false },
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

       {/* Threads & Messages View */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6 h-[calc(100vh-250px)] min-h-0">
          {/* Thread List */}
          <div className="card-state flex flex-col max-h-[300px] lg:max-h-none min-h-0">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <h3 className="font-semibold text-foreground">
                {activeTab === "direct" ? "Chats" : "Conversations"}
              </h3>
              <button
                onClick={() => {
                  // Set the correct type based on active tab
                  setThreadForm(prev => ({
                    ...prev,
                    type: activeTab === "direct" ? "direct" : activeTab as CommunicationType,
                    subject: "",
                    selectedMembers: [],
                  }));
                  setShowNewThread(true);
                }}
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
                  {activeTab === "direct" ? "Keine Chats" : "No conversations"}
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
                        {getThreadDisplayName(thread)}
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
          <div className="lg:col-span-2 card-state flex flex-col min-h-0">
            {selectedThread ? (
              <>
                <div className="p-4 border-b border-border">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-foreground">
                        {getThreadDisplayName(selectedThread)}
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        {selectedThread.is_official && "Official • "}
                        {selectedThread.type === "direct" 
                          ? `${selectedThread.participants?.length || 0} Teilnehmer`
                          : `Created on ${formatDate(selectedThread.created_at)}`}
                      </p>
                    </div>
                    <button className="p-2 rounded-lg hover:bg-muted text-muted-foreground">
                      <MoreHorizontal size={18} />
                    </button>
                  </div>

                  {/* E2E Encryption Badge */}
                  {selectedThread.type === "direct" && cryptoReady && (
                    <div className="mt-3 flex items-center justify-center gap-1.5 py-2 px-3 bg-green-500/10 text-green-600 dark:text-green-400 rounded-lg text-xs font-medium">
                      <Lock size={12} />
                      <span>Nachrichten sind Ende-zu-Ende verschlüsselt</span>
                    </div>
                  )}
                </div>

                <ScrollArea className="flex-1 min-h-0">
                  <div className="p-4 space-y-4">
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
                    <div ref={messagesEndRef} />
                  </div>
                </ScrollArea>

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

      {/* New Thread Modal */}
      {showNewThread && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="card-state w-full max-w-md p-6 animate-fade-in max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-semibold text-foreground mb-6">
              {activeTab === "direct" ? "Neuer Chat" : "New Conversation"}
            </h2>
            <form onSubmit={handleCreateThread} className="space-y-4">
              {/* Subject field - only show for non-direct chats */}
              {activeTab !== "direct" && (
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
              )}

              {/* Type selector - only show for non-direct chats */}
              {activeTab !== "direct" && (
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
              )}

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

              {/* Official checkbox - only for non-direct chats */}
              {activeTab !== "direct" && (
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
              )}

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
                  disabled={isCreatingThread}
                  className="flex-1 py-2.5 bg-accent text-accent-foreground rounded-xl font-medium hover:bg-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isCreatingThread ? (
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Creating…
                    </span>
                  ) : (
                    "Create"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  );
}
