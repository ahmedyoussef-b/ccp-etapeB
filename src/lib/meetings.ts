export type Meeting = {
  id: string;
  roomName: string;
  createdBy: string;
  createdByName: string;
  createdAt: number;
  invitees: MeetingInvitee[];
};

export type MeetingInvitee = {
  userId: string;
  email: string;
  name: string;
  status: "pending" | "accepted" | "rejected";
  invitedAt: number;
};

const meetings = new Map<string, Meeting>();

export function createMeeting(meeting: Meeting): Meeting {
  meetings.set(meeting.id, meeting);
  return meeting;
}

export function getMeeting(id: string): Meeting | undefined {
  return meetings.get(id);
}

export function addInvitee(meetingId: string, invitee: MeetingInvitee): Meeting | undefined {
  const meeting = meetings.get(meetingId);
  if (!meeting) return undefined;
  meeting.invitees.push(invitee);
  return meeting;
}

export function updateInviteeStatus(
  meetingId: string,
  userId: string,
  status: MeetingInvitee["status"]
): Meeting | undefined {
  const meeting = meetings.get(meetingId);
  if (!meeting) return undefined;
  const invitee = meeting.invitees.find((i) => i.userId === userId);
  if (invitee) {
    invitee.status = status;
  }
  return meeting;
}

export function listMeetings(): Meeting[] {
  return Array.from(meetings.values()).sort((a, b) => b.createdAt - a.createdAt);
}
