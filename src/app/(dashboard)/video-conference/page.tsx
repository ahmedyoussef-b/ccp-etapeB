"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
} from "lucide-react";

const participants = [
  { id: 1, name: "Admin User", email: "admin@nexaflow.com", initials: "AD", isSelf: true, isMuted: false, isVideoOn: true },
  { id: 2, name: "Alice Martin", email: "alice@exemple.com", initials: "AM", isSelf: false, isMuted: true, isVideoOn: true },
  { id: 3, name: "Bob Dupont", email: "bob@exemple.com", initials: "BD", isSelf: false, isMuted: false, isVideoOn: false },
  { id: 4, name: "Claire Leroy", email: "claire@exemple.com", initials: "CL", isSelf: false, isMuted: true, isVideoOn: true },
];

const chatMessages = [
  { id: 1, user: "Alice Martin", text: "Pouvez-vous partager votre écran ?", time: "14:32" },
  { id: 2, user: "Admin User", text: "Oui, je lance le partage.", time: "14:33" },
  { id: 3, user: "Bob Dupont", text: "Merci, je regarde.", time: "14:33" },
];

export default function VideoConferencePage() {
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOn, setIsVideoOn] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [showParticipants, setShowParticipants] = useState(false);
  const [newMessage, setNewMessage] = useState("");
  const [messages, setMessages] = useState(chatMessages);
  const callDuration = "00:00:00";

  return (
    <section className="flex h-[calc(100vh-3.5rem)] flex-col">
      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 flex flex-col">
          <div className="flex-1 bg-black/5 dark:bg-white/5 p-4">
            <div className="grid h-full gap-3" style={{ gridTemplateColumns: "repeat(2, 1fr)", gridTemplateRows: "repeat(2, 1fr)" }}>
              {participants.map((p) => (
                <Card key={p.id} className="relative overflow-hidden bg-muted/50 flex items-center justify-center">
                  {p.isVideoOn ? (
                    <div className="absolute inset-0 bg-gradient-to-br from-muted to-muted/50 flex items-center justify-center">
                      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/20 text-xl font-semibold text-primary">
                        {p.initials}
                      </div>
                    </div>
                  ) : (
                    <div className="flex h-24 w-24 items-center justify-center rounded-full bg-primary/10 text-3xl font-bold text-primary">
                      {p.initials}
                    </div>
                  )}

                  <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-white drop-shadow-md">{p.name}</span>
                      {p.isSelf && (
                        <Badge variant="secondary" className="text-[10px] h-4 px-1">Vous</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      {p.isMuted && (
                        <div className="flex h-5 w-5 items-center justify-center rounded-full bg-red-500/80">
                          <MicOff className="h-3 w-3 text-white" />
                        </div>
                      )}
                      {!p.isVideoOn && (
                        <div className="flex h-5 w-5 items-center justify-center rounded-full bg-red-500/80">
                          <VideoOff className="h-3 w-3 text-white" />
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>

          <div className="border-t border-border bg-background px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-mono text-muted-foreground">{callDuration}</span>
                <Badge variant="secondary" className="text-xs">En direct</Badge>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant={isMuted ? "destructive" : "secondary"}
                  size="icon"
                  className="h-10 w-10 rounded-full"
                  onClick={() => setIsMuted(!isMuted)}
                >
                  {isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
                </Button>

                <Button
                  variant={isVideoOn ? "secondary" : "destructive"}
                  size="icon"
                  className="h-10 w-10 rounded-full"
                  onClick={() => setIsVideoOn(!isVideoOn)}
                >
                  {isVideoOn ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
                </Button>

                <Button
                  variant={isScreenSharing ? "default" : "secondary"}
                  size="icon"
                  className="h-10 w-10 rounded-full"
                  onClick={() => setIsScreenSharing(!isScreenSharing)}
                >
                  <ScreenShare className="h-5 w-5" />
                </Button>

                <Button
                  variant={showChat ? "default" : "secondary"}
                  size="icon"
                  className="h-10 w-10 rounded-full"
                  onClick={() => setShowChat(!showChat)}
                >
                  <MessageSquare className="h-5 w-5" />
                </Button>

                <Button
                  variant={showParticipants ? "default" : "secondary"}
                  size="icon"
                  className="h-10 w-10 rounded-full"
                  onClick={() => setShowParticipants(!showParticipants)}
                >
                  <Users className="h-5 w-5" />
                </Button>

                <Button
                  variant="secondary"
                  size="icon"
                  className="h-10 w-10 rounded-full"
                  onClick={() => alert("Paramètres de la réunion")}
                >
                  <Settings className="h-5 w-5" />
                </Button>

                <Button
                  variant="destructive"
                  size="icon"
                  className="h-10 w-10 rounded-full"
                  onClick={() => alert("Fin de l'appel")}
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
                    <span className="text-xs font-medium text-foreground">{msg.user}</span>
                    <span className="text-[10px] text-muted-foreground">{msg.time}</span>
                  </div>
                  <p className="text-sm text-muted-foreground pl-0">{msg.text}</p>
                </div>
              ))}
            </div>

            <div className="border-t border-border p-3">
              <form
                className="flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  const trimmed = newMessage.trim();
                  if (!trimmed) return;
                  const now = new Date();
                  const time = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;
                  setMessages((prev) => [...prev, { id: Date.now(), user: "Admin User", text: trimmed, time }]);
                  setNewMessage("");
                }}
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
              <h3 className="text-sm font-semibold text-foreground">Participants ({participants.length})</h3>
              <Button variant="ghost" size="icon" className="h-7 w-7">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-1">
              {participants.map((p) => (
                <div key={p.id} className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-muted/50">
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
                onClick={() => {
                  const inviteLink = "https://nexaflow.com/meeting/abc123";
                  navigator.clipboard?.writeText(inviteLink).then(
                    () => alert("Lien copié !"),
                    () => alert(`Lien : ${inviteLink}`)
                  );
                }}
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
