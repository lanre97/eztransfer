import { Unsubscribe } from "firebase/firestore";
import SessionRepository, { Offer, Answer } from "./session.repository";
import { collection, doc, addDoc, updateDoc, onSnapshot, arrayUnion } from "firebase/firestore";
import { getFirestore } from "firebase/firestore";
import app from "@/lib/firebase/app";

export default class SessionRepositoryFirestore implements SessionRepository<Unsubscribe> {
  private firestore = getFirestore(app);
  private sessionsRef = collection(this.firestore, 'sessions');

  createSession = async (offer: Offer) => {
    console.log(offer);
    const sessionRef = await addDoc(this.sessionsRef, { 
      offer: {
        type: offer.type,
        sdp: offer.sdp,
        user: offer.user.toJSON(),
      },
    });
    return sessionRef.id;
  };

  createAnswer = (sessionId: string, answer: Answer) => {
    const sessionRef = doc(this.firestore, 'sessions', sessionId);
    return updateDoc(sessionRef, { 
      answer: {
        type: answer.type,
        sdp: answer.sdp,
        user: answer.user.toJSON(),
      }
     });
  };

  listenForAnswer = (sessionId: string, callback: (answer: Answer) => void) => {
    const sessionRef = doc(this.firestore, 'sessions', sessionId);
    return onSnapshot(sessionRef, (snapshot) => {
      const session = snapshot.data();
      if (session?.answer) {
        callback(session.answer);
      }
    });
  };

  listenForOffer = (sessionId: string, callback: (offer: Offer) => void) => {
    const sessionRef = doc(this.firestore, 'sessions', sessionId);
    return onSnapshot(sessionRef, (snapshot) => {
      const session = snapshot.data();
      if (session?.offer) {
        callback(session.offer);
      }
    });
  };
  

  createCandidate = async (sessionId: string, candidate: RTCIceCandidate) => {
    const sessionsRef = collection(this.firestore, 'sessions', sessionId, 'candidates');
    await addDoc(sessionsRef, candidate.toJSON());
  }

  listenForCandidate = (sessionId: string, callback: (candidate: RTCIceCandidate) => void) => {
    const sessionsRef = collection(this.firestore, 'sessions', sessionId, 'candidates');
    return onSnapshot(sessionsRef, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          callback(new RTCIceCandidate(change.doc.data()));
        }
      })
    })
  }
}
