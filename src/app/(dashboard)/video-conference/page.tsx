"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Video,
  VideoOff,
  Mic,
  MicOff,
  MessageSquare,
  Users,
  PhoneOff,
  Settings,
  Send,
  MoreVertical,
  ScreenShare,
  Copy,
  Clock,
  Loader2,
} from "lucide-react";

type Participant = {
  id: string;
  name: string;
  email: string;
  initials: string;
  isSelf: boolean;
  isMuted: boolean;
  isVideoOn: boolean;
};

type ChatMessage = {
  id: string;
  userId: string;
  userName: string;
  text: string;
  time: string;
};

const INITIAL_PARTICIPANTS: Participant[] = [
  { id: "self", name: "Admin User", email: "admin@nexaflow.com", initials: "AD", isSelf: true, isMuted: false, isVideoOn: true },
  { id: "p2", name: "Alice Martin", email: "alice@exemple.com", initials: "AM", isSelf: false, isMuted: true, isVideoOn: true },
  { id: "p3", name: "Bob Dupont", email: "bob@exemple.com", initials: "BD", isSelf: false, isMuted: false, isVideoOn: false },
  { id: "p4", name: "Claire Leroy", email: "claire@exemple.com", initials: "CL", isSelf: false, isMuted: true, isVideoOn: true },
];

const INITIAL_MESSAGES: ChatMessage[] = [
  { id: "m1", userId: "p2", userName: "Alice Martin", text: "Pouvez-vous partager votre écran ?", time: "14:32" },
  { id: "m2", userId: "self", userName: "Admin User", text: "Oui, je lance le partage.", time: "14:33" },
  { id: "m3", userId: "p3", userName: "Bob Dupont", text: "Merci, je regarde.", time: "14:33" },
];

function formatTime(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600)
    .toString()
    .padStart(2, "0");
  const m = Math.floor((totalSeconds % 3600) / 60)
    .toString()
    .padStart(2, "0");
  const s = (totalSeconds % 60)
    .toString()
    .padStart(2, "0");
  return `${h}:${m}:${s}`;
}

function VideoTile({
  participant,
  isLoadingMedia,
}: {
  participant: Participant;
  isLoadingMedia: boolean;
}) {
  return (
    <Card className="relative overflow-hidden bg-muted/50 flex items-center justify-center">
      {participant.isVideoOn && !isLoadingMedia ? (
        <div className="absolute inset-0 bg-gradient-to-br from-muted to-muted/50 flex items-center justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/20 text-xl font-semibold text-primary">
            {participant.initials}
          </div>
        </div>
      ) : (
        <div className="absolute inset-0 flex items-center justify-center bg-muted/80">
          <Avatar className="h-24 w-24">
            <AvatarFallback className="text-3xl font-bold">
              {participant.initials}
            </AvatarFallback>
          </Avatar>
        </div>
      )}

      <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-white drop-shadow-md">
            {participant.name}
          </span>
          {participant.isSelf && (
            <Badge variant="secondary" className="text-[10px] h-4 px-1">
              Vous
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1">
          {participant.isMuted && (
            <div className="flex h-5 w-5 items-center justify-center rounded-full bg-red-500/80">
              <MicOff className="h-3 w-3 text-white" />
            </div>
          )}
          {!participant.isVideoOn && (
            <div className="flex h-5 w-5 items-center justify-center rounded-full bg-red-500/80">
              <VideoOff className="h-3 w-3 text-white" />
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

export default function VideoConferencePage() {
  const [participants, setParticipants] = useState<Participant[]>(INITIAL_PARTICIPANTS);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOn, setIsVideoOn] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [showParticipants, setShowParticipants] = useState(false);
  const [newMessage, setNewMessage] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>(INITIAL_MESSAGES);
  const [callDuration, setCallDuration] = useState(0);
  const [isLoadingMedia, setIsLoadingMedia] = useState(true);
  const [mediaError, setMediaError] = useState<string | null>(null);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);

  const selfParticipant = participants.find((p) => p.isSelf);
  const remoteParticipants = participants.filter((p) => !p.isSelf);

  const stopTracks = useCallback((stream: MediaStream | null) => {
    if (!stream) return;
    stream.getTracks().forEach((track) => track.stop());
  }, []);

  const updateSelf = useCallback(
    (patch: Partial<Participant>) => {
      setParticipants((prev) =>
        prev.map((p) => (p.isSelf ? { ...p, ...patch } : p))
      );
    },
    []
  );

  useEffect(() => {
    const interval = window.setInterval(() => {
      setCallDuration((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let cancelled = false;

    async function initLocalMedia() {
      setIsLoadingMedia(true);
      setMediaError(null);
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });
        if (cancelled) {
          stopTracks(stream);
          return;
        }
        localStreamRef.current = stream;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
        updateSelf({ isVideoOn: true, isMuted: false });
      } catch (err) {
        if (!cancelled) {
          const message =
            err instanceof Error ? err.message : "Impossible d'accéder à la caméra/micro";
          setMediaError(message);
          updateSelf({ isVideoOn: false, isMuted: true });
        }
      } finally {
        if (!cancelled) {
          setIsLoadingMedia(false);
        }
      }
    }

    initLocalMedia();

    return () => {
      cancelled = true;
      stopTracks(localStreamRef.current);
      localStreamRef.current = null;
      stopTracks(screenStreamRef.current);
      screenStreamRef.current = null;
    };
  }, [stopTracks, updateSelf]);

  const toggleMute = useCallback(() => {
    const next = !isMuted;
    setIsMuted(next);
    localStreamRef.current?.getAudioTracks().forEach((track) => {
      track.enabled = !next;
    });
    updateSelf({ isMuted: next });
  }, [isMuted, updateSelf]);

  const toggleVideo = useCallback(async () => {
    const next = !isVideoOn;
    setIsVideoOn(next);
    if (localStreamRef.current) {
      localStreamRef.current.getVideoTracks().forEach((track) => {
        track.enabled = !next;
      });
    }
    if (!next && localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    } else if (next && localStreamRef.current && localVideoRef.current) {
      localVideoRef.current.srcObject = localStreamRef.current;
    }
    updateSelf({ isVideoOn: next });
  }, [isVideoOn, updateSelf]);

  const toggleScreenShare = useCallback(async () => {
    if (isScreenSharing) {
      stopTracks(screenStreamRef.current);
      screenStreamRef.current = null;
      setIsScreenSharing(false);
      if (localStreamRef.current && localVideoRef.current) {
        localVideoRef.current.srcObject = localStreamRef.current;
      }
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true,
      });
      screenStreamRef.current = stream;
      setIsScreenSharing(true);
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
      stream.getVideoTracks()[0].addEventListener("ended", () => {
        stopTracks(screenStreamRef.current);
        screenStreamRef.current = null;
        setIsScreenSharing(false);
        if (localStreamRef.current && localVideoRef.current) {
          localVideoRef.current.srcObject = localStreamRef.current;
        }
      });
    } catch {
      // User cancelled screen share picker
    }
  }, [isScreenSharing, stopTracks]);

  const handleSendMessage = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const trimmed = newMessage.trim();
      if (!trimmed || !selfParticipant) return;
      const now = new Date();
      const time = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;
      setMessages((prev) => [
        ...prev,
        {
          id: `m-${Date.now()}`,
          userId: selfParticipant.id,
          userName: selfParticipant.name,
          text: trimmed,
          time,
        },
      ]);
      setNewMessage("");
    },
    [newMessage, selfParticipant]
  );

  const copyInviteLink = useCallback(async () => {
    const inviteLink = "https://nexaflow.com/meeting/abc123";
    try {
      await navigator.clipboard.writeText(inviteLink);
    } catch {
      // Fallback handled below if needed
    }
  }, []);

  const handleEndCall = useCallback(() => {
    stopTracks(localStreamRef.current);
    localStreamRef.current = null;
    stopTracks(screenStreamRef.current);
    screenStreamRef.current = null;
    setIsMuted(false);
    setIsVideoOn(false);
    setIsScreenSharing(false);
    setCallDuration(0);
    setMediaError(null);
  }, [stopTracks]);

  return (
    <section className="flex h-[calc(100vh-3.5rem)] flex-col">
      {mediaError && (
        <div className="bg-destructive/10 text-destructive text-xs px-4 py-2 border-b border-destructive/20">
          {mediaError}
        </div>
      )}
      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 flex flex-col">
          <div className="flex-1 bg-black/5 dark:bg-white/5 p-4">
            <div
              className="grid h-full gap-3"
              style={{
                gridTemplateColumns: "repeat(2, 1fr)",
                gridTemplateRows: "repeat(2, 1fr)",
              }}
            >
              <Card className="relative overflow-hidden bg-muted/50 flex items-center justify-center">
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className="absolute inset-0 h-full w-full object-cover"
                />
                {(!isVideoOn || isLoadingMedia) && (
                  <div className="absolute inset-0 flex items-center justify-center bg-muted/80">
                    <Avatar className="h-24 w-24">
                      <AvatarFallback className="text-3xl font-bold">
                        {selfParticipant?.initials}
                      </AvatarFallback>
                    </Avatar>
                  </div>
                )}
                {isLoadingMedia && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                    <Loader2 className="h-8 w-8 animate-spin text-white" />
                  </div>
                )}
                <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-white drop-shadow-md">
                      {selfParticipant?.name}
                    </span>
                    <Badge variant="secondary" className="text-[10px] h-4 px-1">
                      Vous
                    </Badge>
                  </div>
                  <div className="flex items-center gap-1">
                    {isMuted && (
                      <div className="flex h-5 w-5 items-center justify-center rounded-full bg-red-500/80">
                        <MicOff className="h-3 w-3 text-white" />
                      </div>
                    )}
                    {!isVideoOn && (
                      <div className="flex h-5 w-5 items-center justify-center rounded-full bg-red-500/80">
                        <VideoOff className="h-3 w-3 text-white" />
                      </div>
                    )}
                  </div>
                </div>
              </Card>
              {remoteParticipants.map((p) => (
                <VideoTile
                  key={p.id}
                  participant={p}
                  isLoadingMedia={isLoadingMedia}
                />
              ))}
            </div>
          </div>

          <div className="border-t border-border bg-background px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-mono text-muted-foreground">
                  {formatTime(callDuration)}
                </span>
                <Badge variant="secondary" className="text-xs">
                  En direct
                </Badge>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant={isMuted ? "destructive" : "secondary"}
                  size="icon"
                  className="h-10 w-10 rounded-full"
                  onClick={toggleMute}
                  title={isMuted ? "Réactiver le micro" : "Couper le micro"}
                >
                  {isMuted ? (
                    <MicOff className="h-5 w-5" />
                  ) : (
                    <Mic className="h-5 w-5" />
                  )}
                </Button>

                <Button
                  variant={isVideoOn ? "secondary" : "destructive"}
                  size="icon"
                  className="h-10 w-10 rounded-full"
                  onClick={toggleVideo}
                  title={isVideoOn ? "Couper la caméra" : "Allumer la caméra"}
                >
                  {isVideoOn ? (
                    <Video className="h-5 w-5" />
                  ) : (
                    <VideoOff className="h-5 w-5" />
                  )}
                </Button>

                <Button
                  variant={isScreenSharing ? "default" : "secondary"}
                  size="icon"
                  className="h-10 w-10 rounded-full"
                  onClick={toggleScreenShare}
                  title={isScreenSharing ? "Arrêter le partage" : "Partager l'écran"}
                >
                  <ScreenShare className="h-5 w-5" />
                </Button>

                <Button
                  variant={showChat ? "default" : "secondary"}
                  size="icon"
                  className="h-10 w-10 rounded-full"
                  onClick={() => setShowChat(!showChat)}
                  title="Chat"
                >
                  <MessageSquare className="h-5 w-5" />
                </Button>

                <Button
                  variant={showParticipants ? "default" : "secondary"}
                  size="icon"
                  className="h-10 w-10 rounded-full"
                  onClick={() => setShowParticipants(!showParticipants)}
                  title="Participants"
                >
                  <Users className="h-5 w-5" />
                </Button>

                <Button
                  variant="secondary"
                  size="icon"
                  className="h-10 w-10 rounded-full"
                  onClick={() => {}}
                  title="Paramètres"
                >
                  <Settings className="h-5 w-5" />
                </Button>

                <Button
                  variant="destructive"
                  size="icon"
                  className="h-10 w-10 rounded-full"
                  onClick={handleEndCall}
                  title="Fin de l'appel"
                >
                  <PhoneOff className="h-5 w-5" />
                </Button>
              </div>
            </div>
          </div>
        </div>

        {showChat && (
          <div className="w-80 border-l border-border bg-background flex flex-col">
            <div className="border-b border-border px-4 py-3">
              <h3 className="text-sm font-semibold text-foreground">Chat de la réunion</h3>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.map((msg) => (
                <div key={msg.id} className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-foreground">
                      {msg.userName}
                    </span>
                    <span className="text-[10px] text-muted-foreground">{msg.time}</span>
                  </div>
                  <p className="text-sm text-muted-foreground pl-0">{msg.text}</p>
                </div>
              ))}
            </div>

            <div className="border-t border-border p-3">
              <form
                className="flex gap-2"
                onSubmit={handleSendMessage}
              >
                <Input
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Écrire un message..."
                  className="h-9 text-sm"
                />
                <Button type="submit" size="icon" className="h-9 w-9 shrink-0">
                  <Send className="h-4 w-4" />
                </Button>
              </form>
            </div>
          </div>
        )}

        {showParticipants && (
          <div className="w-72 border-l border-border bg-background flex flex-col">
            <div className="border-b border-border px-4 py-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">
                Participants ({participants.length})
              </h3>
              <Button variant="ghost" size="icon" className="h-7 w-7">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-1">
              {participants.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-muted/50"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                    {p.initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {p.name}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">{p.email}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    {p.isMuted && <MicOff className="h-3.5 w-3.5 text-muted-foreground" />}
                    {!p.isVideoOn && <VideoOff className="h-3.5 w-3.5 text-muted-foreground" />}
                  </div>
                </div>
              ))}
            </div>

            <div className="border-t border-border p-3">
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={copyInviteLink}
              >
                <Copy className="h-4 w-4 mr-2" />
                Copier le lien d&apos;invitation
              </Button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
