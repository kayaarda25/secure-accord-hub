import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  Video,
  VideoOff,
  Mic,
  MicOff,
  Phone,
  PhoneOff,
  Users,
  Monitor,
  Copy,
  Check,
  Loader2,
  X,
} from "lucide-react";

interface Participant {
  id: string;
  name: string;
  stream?: MediaStream;
}

interface VideoMeetingProps {
  onClose: () => void;
}

export function VideoMeeting({ onClose }: VideoMeetingProps) {
  const { user, profile } = useAuth();
  const [roomId, setRoomId] = useState<string>("");
  const [isInRoom, setIsInRoom] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [error, setError] = useState<string | null>(null);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const userName = profile?.first_name
    ? `${profile.first_name} ${profile.last_name || ""}`.trim()
    : user?.email || "Unbekannt";

  // ICE servers configuration
  const iceServers = {
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" },
    ],
  };

  const createPeerConnection = useCallback((peerId: string) => {
    console.log("Creating peer connection for:", peerId);
    const pc = new RTCPeerConnection(iceServers);

    pc.onicecandidate = (event) => {
      if (event.candidate && channelRef.current) {
        console.log("Sending ICE candidate to:", peerId);
        channelRef.current.send({
          type: "broadcast",
          event: "ice-candidate",
          payload: {
            candidate: event.candidate,
            from: user?.id,
            to: peerId,
          },
        });
      }
    };

    pc.ontrack = (event) => {
      console.log("Received track from:", peerId);
      setParticipants((prev) => {
        const existing = prev.find((p) => p.id === peerId);
        if (existing) {
          return prev.map((p) =>
            p.id === peerId ? { ...p, stream: event.streams[0] } : p
          );
        }
        return prev;
      });
    };

    pc.onconnectionstatechange = () => {
      console.log(`Connection state for ${peerId}:`, pc.connectionState);
      if (pc.connectionState === "disconnected" || pc.connectionState === "failed") {
        handlePeerDisconnect(peerId);
      }
    };

    // Add local tracks
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        pc.addTrack(track, localStreamRef.current!);
      });
    }

    peerConnectionsRef.current.set(peerId, pc);
    return pc;
  }, [user?.id]);

  const handlePeerDisconnect = (peerId: string) => {
    console.log("Peer disconnected:", peerId);
    const pc = peerConnectionsRef.current.get(peerId);
    if (pc) {
      pc.close();
      peerConnectionsRef.current.delete(peerId);
    }
    setParticipants((prev) => prev.filter((p) => p.id !== peerId));
  };

  const initializeMedia = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      localStreamRef.current = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
      return true;
    } catch (err) {
      console.error("Error accessing media devices:", err);
      setError("Kamera/Mikrofon-Zugriff verweigert. Bitte erlauben Sie den Zugriff.");
      return false;
    }
  };

  const joinRoom = async (roomToJoin: string) => {
    if (!user) return;
    setIsJoining(true);
    setError(null);

    const mediaReady = await initializeMedia();
    if (!mediaReady) {
      setIsJoining(false);
      return;
    }

    console.log("Joining room:", roomToJoin);

    // Subscribe to the room channel
    const channel = supabase.channel(`meeting:${roomToJoin}`, {
      config: {
        presence: { key: user.id },
      },
    });

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
        console.log("Presence sync:", state);
        
        const presentUsers = Object.entries(state).map(([key, value]) => ({
          id: key,
          name: (value as any)[0]?.name || "Unbekannt",
        })).filter((p) => p.id !== user.id);

        setParticipants((prev) => {
          // Merge with existing participants that have streams
          return presentUsers.map((newP) => {
            const existing = prev.find((p) => p.id === newP.id);
            return existing ? { ...newP, stream: existing.stream } : newP;
          });
        });
      })
      .on("presence", { event: "join" }, async ({ key, newPresences }) => {
        console.log("User joined:", key, newPresences);
        if (key !== user.id) {
          // Create offer for new participant
          const pc = createPeerConnection(key);
          try {
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            channel.send({
              type: "broadcast",
              event: "offer",
              payload: {
                offer: pc.localDescription,
                from: user.id,
                to: key,
                name: userName,
              },
            });
          } catch (err) {
            console.error("Error creating offer:", err);
          }
        }
      })
      .on("presence", { event: "leave" }, ({ key }) => {
        console.log("User left:", key);
        handlePeerDisconnect(key);
      })
      .on("broadcast", { event: "offer" }, async ({ payload }) => {
        if (payload.to !== user.id) return;
        console.log("Received offer from:", payload.from);
        
        const pc = createPeerConnection(payload.from);
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(payload.offer));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          channel.send({
            type: "broadcast",
            event: "answer",
            payload: {
              answer: pc.localDescription,
              from: user.id,
              to: payload.from,
              name: userName,
            },
          });
        } catch (err) {
          console.error("Error handling offer:", err);
        }
      })
      .on("broadcast", { event: "answer" }, async ({ payload }) => {
        if (payload.to !== user.id) return;
        console.log("Received answer from:", payload.from);
        
        const pc = peerConnectionsRef.current.get(payload.from);
        if (pc) {
          try {
            await pc.setRemoteDescription(new RTCSessionDescription(payload.answer));
          } catch (err) {
            console.error("Error setting remote description:", err);
          }
        }
      })
      .on("broadcast", { event: "ice-candidate" }, async ({ payload }) => {
        if (payload.to !== user.id) return;
        console.log("Received ICE candidate from:", payload.from);
        
        const pc = peerConnectionsRef.current.get(payload.from);
        if (pc) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(payload.candidate));
          } catch (err) {
            console.error("Error adding ICE candidate:", err);
          }
        }
      });

    await channel.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await channel.track({ name: userName });
        console.log("Subscribed to channel and tracking presence");
      }
    });

    channelRef.current = channel;
    setRoomId(roomToJoin);
    setIsInRoom(true);
    setIsJoining(false);
  };

  const createRoom = async () => {
    const newRoomId = Math.random().toString(36).substring(2, 8).toUpperCase();
    await joinRoom(newRoomId);
  };

  const leaveRoom = () => {
    console.log("Leaving room");
    
    // Stop all tracks
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((track) => track.stop());
      screenStreamRef.current = null;
    }

    // Close all peer connections
    peerConnectionsRef.current.forEach((pc) => pc.close());
    peerConnectionsRef.current.clear();

    // Unsubscribe from channel
    if (channelRef.current) {
      channelRef.current.unsubscribe();
      channelRef.current = null;
    }

    setIsInRoom(false);
    setRoomId("");
    setParticipants([]);
    setIsScreenSharing(false);
    onClose();
  };

  const toggleVideo = () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoEnabled(videoTrack.enabled);
      }
    }
  };

  const toggleAudio = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsAudioEnabled(audioTrack.enabled);
      }
    }
  };

  const toggleScreenShare = async () => {
    if (isScreenSharing) {
      // Stop screen sharing
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach((track) => track.stop());
        screenStreamRef.current = null;
      }
      // Replace screen track with camera track
      if (localStreamRef.current) {
        const videoTrack = localStreamRef.current.getVideoTracks()[0];
        peerConnectionsRef.current.forEach((pc) => {
          const sender = pc.getSenders().find((s) => s.track?.kind === "video");
          if (sender && videoTrack) {
            sender.replaceTrack(videoTrack);
          }
        });
      }
      setIsScreenSharing(false);
    } else {
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
        });
        screenStreamRef.current = screenStream;
        
        const screenTrack = screenStream.getVideoTracks()[0];
        screenTrack.onended = () => {
          setIsScreenSharing(false);
        };

        // Replace camera track with screen track
        peerConnectionsRef.current.forEach((pc) => {
          const sender = pc.getSenders().find((s) => s.track?.kind === "video");
          if (sender) {
            sender.replaceTrack(screenTrack);
          }
        });

        if (localVideoRef.current) {
          localVideoRef.current.srcObject = screenStream;
        }
        
        setIsScreenSharing(true);
      } catch (err) {
        console.error("Error sharing screen:", err);
      }
    }
  };

  const copyRoomId = () => {
    navigator.clipboard.writeText(roomId);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  useEffect(() => {
    return () => {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach((track) => track.stop());
      }
      peerConnectionsRef.current.forEach((pc) => pc.close());
      if (channelRef.current) {
        channelRef.current.unsubscribe();
      }
    };
  }, []);

  if (!isInRoom) {
    return (
      <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="card-state w-full max-w-md p-6 animate-fade-in">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-foreground">
              Online-Sitzung
            </h2>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-muted text-muted-foreground"
            >
              <X size={18} />
            </button>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-destructive/10 border border-destructive/30 rounded-lg text-destructive text-sm">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <button
              onClick={createRoom}
              disabled={isJoining}
              className="w-full py-3 bg-accent text-accent-foreground rounded-lg font-medium hover:bg-accent/90 transition-colors flex items-center justify-center gap-2"
            >
              {isJoining ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <>
                  <Video size={20} />
                  Neue Sitzung erstellen
                </>
              )}
            </button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border"></div>
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">oder</span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1.5">
                Sitzungs-Code eingeben
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={roomId}
                  onChange={(e) => setRoomId(e.target.value.toUpperCase())}
                  placeholder="z.B. ABC123"
                  className="flex-1 px-4 py-2.5 bg-muted border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-accent uppercase"
                  maxLength={6}
                />
                <button
                  onClick={() => joinRoom(roomId)}
                  disabled={!roomId || isJoining}
                  className="px-4 py-2.5 bg-muted text-foreground rounded-lg font-medium hover:bg-muted/80 transition-colors disabled:opacity-50"
                >
                  {isJoining ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    "Beitreten"
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-background z-50 flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-border flex items-center justify-between bg-card">
        <div className="flex items-center gap-3">
          <Video className="text-accent" size={24} />
          <div>
            <h2 className="font-semibold text-foreground">Online-Sitzung</h2>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Code: {roomId}</span>
              <button
                onClick={copyRoomId}
                className="p-1 rounded hover:bg-muted text-muted-foreground"
              >
                {isCopied ? <Check size={14} /> : <Copy size={14} />}
              </button>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Users size={18} className="text-muted-foreground" />
          <span className="text-sm text-muted-foreground">
            {participants.length + 1} Teilnehmer
          </span>
        </div>
      </div>

      {/* Video Grid */}
      <div className="flex-1 p-4 overflow-auto">
        <div
          className={`grid gap-4 h-full ${
            participants.length === 0
              ? "grid-cols-1"
              : participants.length <= 1
              ? "grid-cols-1 md:grid-cols-2"
              : participants.length <= 3
              ? "grid-cols-2"
              : "grid-cols-2 md:grid-cols-3"
          }`}
        >
          {/* Local Video */}
          <div className="relative bg-muted rounded-lg overflow-hidden aspect-video">
            <video
              ref={localVideoRef}
              autoPlay
              muted
              playsInline
              className="w-full h-full object-cover"
            />
            <div className="absolute bottom-3 left-3 px-2 py-1 bg-background/80 rounded text-sm text-foreground">
              {userName} (Sie)
            </div>
            {!isVideoEnabled && (
              <div className="absolute inset-0 bg-muted flex items-center justify-center">
                <VideoOff size={48} className="text-muted-foreground" />
              </div>
            )}
          </div>

          {/* Remote Videos */}
          {participants.map((participant) => (
            <div
              key={participant.id}
              className="relative bg-muted rounded-lg overflow-hidden aspect-video"
            >
              {participant.stream ? (
                <RemoteVideo stream={participant.stream} />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              )}
              <div className="absolute bottom-3 left-3 px-2 py-1 bg-background/80 rounded text-sm text-foreground">
                {participant.name}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Controls */}
      <div className="p-4 border-t border-border bg-card">
        <div className="flex items-center justify-center gap-4">
          <button
            onClick={toggleAudio}
            className={`p-4 rounded-full transition-colors ${
              isAudioEnabled
                ? "bg-muted hover:bg-muted/80 text-foreground"
                : "bg-destructive text-destructive-foreground"
            }`}
          >
            {isAudioEnabled ? <Mic size={24} /> : <MicOff size={24} />}
          </button>
          <button
            onClick={toggleVideo}
            className={`p-4 rounded-full transition-colors ${
              isVideoEnabled
                ? "bg-muted hover:bg-muted/80 text-foreground"
                : "bg-destructive text-destructive-foreground"
            }`}
          >
            {isVideoEnabled ? <Video size={24} /> : <VideoOff size={24} />}
          </button>
          <button
            onClick={toggleScreenShare}
            className={`p-4 rounded-full transition-colors ${
              isScreenSharing
                ? "bg-accent text-accent-foreground"
                : "bg-muted hover:bg-muted/80 text-foreground"
            }`}
          >
            <Monitor size={24} />
          </button>
          <button
            onClick={leaveRoom}
            className="p-4 rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors"
          >
            <PhoneOff size={24} />
          </button>
        </div>
      </div>
    </div>
  );
}

function RemoteVideo({ stream }: { stream: MediaStream }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <video
      ref={videoRef}
      autoPlay
      playsInline
      className="w-full h-full object-cover"
    />
  );
}
