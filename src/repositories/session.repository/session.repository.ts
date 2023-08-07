import User from "@/models/User";

export type SessionId = string;
export interface Answer extends RTCSessionDescriptionInit {
  user: User;
}
export interface Offer extends RTCSessionDescriptionInit {
  user: User;
}

export default interface SessionRepository<Unsusbscribe = any> {
  createSession: (offer: Offer) => Promise<string>;
  createAnswer: (sessionId: string, answer: Answer) => Promise<void>;
  listenForAnswer: (sessionId: SessionId, callback: (answer: Answer) => void) => Unsusbscribe;
  listenForOffer: (sessionId: SessionId, callback: (offer: Offer) => void) => Unsusbscribe;
  createCandidate: (sessionId: SessionId, candidate: RTCIceCandidate) => Promise<void>;
  listenForCandidate: (sessionId: SessionId, callback: (candidate: RTCIceCandidate) => void) => Unsusbscribe;
}