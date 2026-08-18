"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { toast } from "sonner";
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
  UserPlus,
  Wifi,
  WifiOff,
  Mail,
} from "lucide-react";
import { getClientUser } from "@/lib/procedures/client-auth";

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

type OnlineUser = {
  userId: string;
  email: string;
  role: string;
  name: string;
  lastSeen: number;
};

type MeetingInvitee = {
  userId: string;
  email: string;
  name: string;
  status: "pending" | "accepted" | "rejected";
  invitedAt: number;
};

type Meeting = {
  id: string;
  roomName: string;
  createdBy: string;
  createdByName: string;
  createdAt: number;
  invitees: MeetingInvitee[];
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

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function VideoTile({
  participant,
  isLoadingMedia,
}: {
  participant: Participant;
  isLoadingMedia: boolean;
}) {
  console.log("[Visioconf] VideoTile rendu", { participantId: participant.id, participantName: participant.name, isSelf: participant.isSelf });
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
  console.log("[Visioconf] Page vidéo-conférence montée");
  const currentUser = getClientUser();
  console.log("[Visioconf] Utilisateur courant", currentUser);
  const [participants, setParticipants] = useState<Participant[]>(INITIAL_PARTICIPANTS);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOn, setIsVideoOn] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [showParticipants, setShowParticipants] = useState(false);
  const [showInvitePanel, setShowInvitePanel] = useState(false);
  const [newMessage, setNewMessage] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>(INITIAL_MESSAGES);
  const [callDuration, setCallDuration] = useState(0);
  const [isLoadingMedia, setIsLoadingMedia] = useState(true);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [isLoadingPresence, setIsLoadingPresence] = useState(false);
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [pendingInvitations, setPendingInvitations] = useState<{ meetingId: string; roomName: string; createdByName: string }[]>([]);
  const [inviteSearch, setInviteSearch] = useState("");

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const heartbeatRef = useRef<number | null>(null);
  const presenceIntervalRef = useRef<number | null>(null);
  const invitationsIntervalRef = useRef<number | null>(null);

  const selfParticipant = participants.find((p) => p.isSelf);
  const remoteParticipants = participants.filter((p) => !p.isSelf);

  const stopTracks = useCallback((stream: MediaStream | null) => {
    if (!stream) return;
    stream.getTracks().forEach((track) => track.stop());
    console.log("[Visioconf] Tracks média arrêtés");
  }, []);

  const updateSelf = useCallback(
    (patch: Partial<Participant>) => {
      setParticipants((prev) =>
        prev.map((p) => (p.isSelf ? { ...p, ...patch } : p))
      );
    },
    []
  );

  const sendHeartbeat = useCallback(async () => {
    if (!currentUser) return;
    console.log("[Visioconf] Envoi heartbeat présence");
    try {
      await fetch("/api/presence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: currentUser.email,
        }),
      });
    } catch {
      console.warn("[Visioconf] Heartbeat échoué");
    }
  }, [currentUser]);

  const fetchOnlineUsers = useCallback(async () => {
    console.log("[Visioconf] Récupération des utilisateurs en ligne...");
    setIsLoadingPresence(true);
    try {
      const res = await fetch("/api/presence");
      if (res.ok) {
        const data = await res.json();
        const users: OnlineUser[] = data.users || [];
        const filtered = users.filter((u) => u.userId !== currentUser?.userId);
        console.log("[Visioconf] Utilisateurs en ligne reçus", { count: filtered.length, users: filtered });
        setOnlineUsers(filtered);
      } else {
        console.warn("[Visioconf] Erreur récupération présence", { status: res.status });
      }
    } catch {
      console.warn("[Visioconf] Erreur réseau récupération présence");
    } finally {
      setIsLoadingPresence(false);
    }
  }, [currentUser]);

  const fetchInvitations = useCallback(async () => {
    if (!currentUser) return;
    console.log("[Visioconf] Récupération des invitations...");
    try {
      const res = await fetch("/api/invitations");
      if (res.ok) {
        const data = await res.json();
        const invitations = data.invitations || [];
        console.log("[Visioconf] Invitations reçues", { count: invitations.length, invitations });
        setPendingInvitations(invitations);
      } else {
        console.warn("[Visioconf] Erreur récupération invitations", { status: res.status });
      }
    } catch {
      console.warn("[Visioconf] Erreur réseau récupération invitations");
    }
  }, [currentUser]);

  useEffect(() => {
    console.log("[Visioconf] Démarrage timer appel");
    const interval = window.setInterval(() => {
      setCallDuration((prev) => prev + 1);
    }, 1000);
    return () => {
      console.log("[Visioconf] Arrêt timer appel");
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let cancelled = false;

    async function initLocalMedia() {
      console.log("[Visioconf] Initialisation média local (caméra/micro)...");
      setIsLoadingMedia(true);
      setMediaError(null);
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });
        console.log("[Visioconf] getLocalMedia succès", { streamId: stream.id, videoTracks: stream.getVideoTracks().length, audioTracks: stream.getAudioTracks().length });
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
        console.error("[Visioconf] getLocalMedia erreur", err);
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
      console.log("[Visioconf] Nettoyage média local");
      cancelled = true;
      stopTracks(localStreamRef.current);
      localStreamRef.current = null;
      stopTracks(screenStreamRef.current);
      screenStreamRef.current = null;
    };
  }, [stopTracks, updateSelf]);

  useEffect(() => {
    console.log("[Visioconf] Démarrage heartbeats et polling");
    sendHeartbeat();
    heartbeatRef.current = window.setInterval(sendHeartbeat, 20_000);
    presenceIntervalRef.current = window.setInterval(fetchOnlineUsers, 30_000);
    invitationsIntervalRef.current = window.setInterval(fetchInvitations, 30_000);

    return () => {
      console.log("[Visioconf] Arrêt heartbeats et polling");
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
      if (presenceIntervalRef.current) clearInterval(presenceIntervalRef.current);
      if (invitationsIntervalRef.current) clearInterval(invitationsIntervalRef.current);
    };
  }, [sendHeartbeat, fetchOnlineUsers, fetchInvitations]);

  useEffect(() => {
    fetchOnlineUsers();
    fetchInvitations();
  }, [fetchOnlineUsers, fetchInvitations]);

  const toggleMute = useCallback(() => {
    const next = !isMuted;
    console.log("[Visioconf] Toggle mute", { next });
    setIsMuted(next);
    localStreamRef.current?.getAudioTracks().forEach((track) => {
      track.enabled = !next;
    });
    updateSelf({ isMuted: next });
  }, [isMuted, updateSelf]);

  const toggleVideo = useCallback(() => {
    const next = !isVideoOn;
    console.log("[Visioconf] Toggle vidéo", { next });
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
    console.log("[Visioconf] Toggle partage écran", { isScreenSharing });
    if (isScreenSharing) {
      stopTracks(screenStreamRef.current);
      screenStreamRef.current = null;
      setIsScreenSharing(false);
      if (localStreamRef.current && localVideoRef.current) {
        localVideoRef.current.srcObject = localStreamRef.current;
      }
      console.log("[Visioconf] Partage écran arrêté");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true,
      });
      console.log("[Visioconf] getDisplayMedia succès", { streamId: stream.id });
      screenStreamRef.current = stream;
      setIsScreenSharing(true);
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
      stream.getVideoTracks()[0].addEventListener("ended", () => {
        console.log("[Visioconf] Partage écran terminé (navigateur)");
        stopTracks(screenStreamRef.current);
        screenStreamRef.current = null;
        setIsScreenSharing(false);
        if (localStreamRef.current && localVideoRef.current) {
          localVideoRef.current.srcObject = localStreamRef.current;
        }
      });
    } catch {
      console.warn("[Visioconf] getDisplayMedia annulé par l'utilisateur");
    }
  }, [isScreenSharing, stopTracks]);

  const handleSendMessage = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const trimmed = newMessage.trim();
      if (!trimmed || !selfParticipant) return;
      console.log("[Visioconf] Message chat envoyé", { text: trimmed, userId: selfParticipant.id });
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
    const inviteLink = meeting ? `${window.location.origin}/video-conference?room=${meeting.id}` : `${window.location.origin}/video-conference`;
    console.log("[Visioconf] Copier lien invitation", { inviteLink });
    try {
      await navigator.clipboard.writeText(inviteLink);
      toast.success("Lien d'invitation copié");
    } catch {
      toast.error("Impossible de copier le lien");
    }
  }, [meeting]);

  const handleEndCall = useCallback(() => {
    console.log("[Visioconf] Fin d'appel demandée");
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

  const handleCreateMeeting = useCallback(async () => {
    if (!currentUser) return;
    console.log("[Visioconf] Création de réunion...");
    try {
      const res = await fetch("/api/meetings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomName: `Réunion ${new Date().toLocaleString("fr-FR")}`,
          invitees: [],
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setMeeting(data.meeting);
        console.log("[Visioconf] Réunion créée", { meetingId: data.meeting.id, roomName: data.meeting.roomName });
        toast.success("Réunion créée avec succès");
      } else {
        console.error("[Visioconf] Erreur création réunion", { status: res.status });
        toast.error("Impossible de créer la réunion");
      }
    } catch {
      console.error("[Visioconf] Erreur réseau création réunion");
      toast.error("Erreur lors de la création de la réunion");
    }
  }, [currentUser]);

  const handleInviteUsers = useCallback(async () => {
    if (!meeting || !currentUser) return;
    const selected = onlineUsers.filter((u) => u.userId !== currentUser.userId);
    console.log("[Visioconf] Invitation groupée", { meetingId: meeting.id, count: selected.length, users: selected });
    if (selected.length === 0) {
      toast.error("Aucun utilisateur en ligne à inviter");
      return;
    }
    try {
      const res = await fetch(`/api/meetings/${meeting.id}/invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invitees: selected.map((u) => ({
            userId: u.userId,
            email: u.email,
            name: u.name,
          })),
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setMeeting(data.meeting);
        console.log("[Visioconf] Invitations groupées envoyées", { meetingId: meeting.id, count: selected.length });
        toast.success(`${selected.length} invitation(s) envoyée(s)`);
      } else {
        console.error("[Visioconf] Erreur invitation groupée", { status: res.status });
        toast.error("Impossible d'envoyer les invitations");
      }
    } catch {
      console.error("[Visioconf] Erreur réseau invitation groupée");
      toast.error("Erreur lors de l'envoi des invitations");
    }
  }, [meeting, currentUser, onlineUsers]);

  const filteredOnlineUsers = onlineUsers.filter((u) => {
    const q = inviteSearch.toLowerCase();
    return u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q) || u.role.toLowerCase().includes(q);
  });

  console.log("[Visioconf] Rendu page", { participants: participants.length, onlineUsers: onlineUsers.length, pendingInvitations: pendingInvitations.length, meeting: meeting?.id, showChat, showParticipants, showInvitePanel });

  return (
    <section className="flex h-[calc(100vh-3.5rem)] flex-col">
      {mediaError && (
        <div className="bg-destructive/10 text-destructive text-xs px-4 py-2 border-b border-destructive/20">
          {mediaError}
        </div>
      )}
      {pendingInvitations.length > 0 && (
        <div className="bg-primary/10 text-primary text-xs px-4 py-2 border-b border-primary/20 flex items-center gap-2">
          <Mail className="h-3.5 w-3.5" />
          <span className="font-medium">{pendingInvitations.length} invitation(s) en attente</span>
          {pendingInvitations.slice(0, 2).map((inv) => (
            <span key={inv.meetingId} className="ml-2">
              - {inv.roomName} par {inv.createdByName}
            </span>
          ))}
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
                  variant={showInvitePanel ? "default" : "secondary"}
                  size="icon"
                  className="h-10 w-10 rounded-full"
                  onClick={() => {
                    setShowInvitePanel(!showInvitePanel);
                    if (!showInvitePanel) {
                      fetchOnlineUsers();
                    }
                  }}
                  title="Inviter"
                >
                  <UserPlus className="h-5 w-5" />
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

            <div className="border-t border-border p-3 space-y-2">
              {!meeting ? (
                <Button
                  variant="default"
                  size="sm"
                  className="w-full"
                  onClick={handleCreateMeeting}
                >
                  <Users className="h-4 w-4 mr-2" />
                  Créer une réunion
                </Button>
              ) : (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={handleInviteUsers}
                  >
                    <UserPlus className="h-4 w-4 mr-2" />
                    Inviter les utilisateurs en ligne
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="w-full"
                    onClick={copyInviteLink}
                  >
                    <Copy className="h-4 w-4 mr-2" />
                    Copier le lien d&apos;invitation
                  </Button>
                </>
              )}
            </div>
          </div>
        )}

        {showInvitePanel && (
          <div className="w-80 border-l border-border bg-background flex flex-col">
            <div className="border-b border-border px-4 py-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">Utilisateurs en ligne</h3>
              <div className="flex items-center gap-1 text-xs text-emerald-600">
                {isLoadingPresence ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <>
                    <Wifi className="h-3.5 w-3.5" />
                    <span>{onlineUsers.length} en ligne</span>
                  </>
                )}
              </div>
            </div>

            <div className="p-3 border-b border-border">
              <Input
                placeholder="Rechercher un utilisateur..."
                value={inviteSearch}
                onChange={(e) => setInviteSearch(e.target.value)}
                className="h-9 text-sm"
              />
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-1">
              {filteredOnlineUsers.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <WifiOff className="h-8 w-8 text-muted-foreground/50 mb-2" />
                  <p className="text-xs text-muted-foreground">
                    {isLoadingPresence ? "Recherche d&apos;utilisateurs..." : "Aucun utilisateur en ligne"}
                  </p>
                </div>
              ) : (
                filteredOnlineUsers.map((u) => (
                  <div
                    key={u.userId}
                    className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-muted/50"
                  >
                    <div className="relative">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                        {getInitials(u.name)}
                      </div>
                      <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500 border-2 border-background" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {u.name}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={async () => {
                        if (!meeting) {
                          toast.error("Veuillez d'abord créer une réunion");
                          return;
                        }
                        console.log("[Visioconf] Invitation individuelle", { meetingId: meeting.id, userId: u.userId, userName: u.name });
                        try {
                          const res = await fetch(`/api/meetings/${meeting.id}/invite`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              invitees: [{ userId: u.userId, email: u.email, name: u.name }],
                            }),
                          });
                          if (res.ok) {
                            console.log("[Visioconf] Invitation individuelle envoyée", { meetingId: meeting.id, userId: u.userId });
                            toast.success(`Invitation envoyée à ${u.name}`);
                          } else {
                            console.error("[Visioconf] Erreur invitation individuelle", { status: res.status });
                            toast.error("Impossible d'envoyer l'invitation");
                          }
                        } catch {
                          console.error("[Visioconf] Erreur réseau invitation individuelle");
                          toast.error("Erreur lors de l'envoi");
                        }
                      }}
                    >
                      <Mail className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
