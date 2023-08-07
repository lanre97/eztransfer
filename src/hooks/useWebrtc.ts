import DropFile from '@/models/DropFile';
import User from '@/models/User';
import SessionRepositoryFirebase from '@/repositories/session.repository/session.repository.firebase';
import { Unsubscribe } from 'firebase/firestore';
import { useState, useEffect, useRef } from 'react';

export enum ConnectionState {
  Disconnected = 'Disconnected',
  CreatingOffer = 'Creating offer',
  WaitingForCadidate = 'Waiting for candidate',
  Connecting = 'Connecting',
  Connected = 'Connected',
}

export interface ChatMessage {
  type: 'message';
  data: string;
  username: string;
  date: Date;
}

interface ChunkMessage {
  type: 'chunk';
  idFile: string;
  chunk: string;
  percentage: number;
  segmentNumber: number;
}


interface FileEndMessage {
  type: 'file-end';
  idFile: string;
  filename: string;
}

interface FileStartMessage {
  type: 'file-start';
  name: string;
  size: number;
  id: string;
}

interface FileReceived {
  id: string;
  name: string;
  size: number;
  progress: number;
  data?: Blob
}

interface ChunkAckMessage {
  type: 'chunk-ack'; // Tipo de mensaje para distinguirlo
  idFile: string;    // Identificador del archivo que se está transfiriendo
  segmentNumber: number; // Opcional, puede contener el número de segmento o chunk que ha sido reconocido
}



const useWebRTC = (user: User) => {
  const [connectionState, setConnectionState] = useState(ConnectionState.Disconnected);
  const [peerConnection, setPeerConnection] = useState<RTCPeerConnection>();
  const [sessionId, setSessionId] = useState<string>();
  const unsubscribeOffer = useRef<Unsubscribe>();
  const unsubscribeAnswer = useRef<Unsubscribe>();
  const dataChannel = useRef<RTCDataChannel>();
  const receivedFiles = useRef<{ [fileId: string]: Uint8Array[] }>({}).current;
  const [filesReceived, setFilesReceived] = useState<FileReceived[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const pendingChunkAcks = useRef<{ [fileId: string]: { [segmentNumber: number]: { resolve: () => void, reject: () => void } } }>({});

  const createOffer = async () => {
    setConnectionState(ConnectionState.CreatingOffer);
    dataChannel.current = peerConnection?.createDataChannel("myDataChannel");
    dataChannel.current!.onmessage = (event) => {
      const parsedMessage = JSON.parse(event.data);
      switch (parsedMessage.type) {
        case 'message': handleChatMessage(parsedMessage); break;
        case 'file-start': handleFileMessage(parsedMessage); break;
        case 'chunk': handleChunkMessage(parsedMessage); break;
        case 'file-end': handleFileEndMessage(parsedMessage); break;
        case 'chunk-ack': handleChunkAckMessage(parsedMessage); break;
      }
    };
    const repository = new SessionRepositoryFirebase();
    const offer = await peerConnection?.createOffer();
    if (offer) {
      const sessionId = await repository.createSession({sdp:offer.sdp, type: offer.type, user});
      setSessionId(sessionId);
      setConnectionState(ConnectionState.Connecting)
      const unsubscribe = repository.listenForAnswer(sessionId, async (answer) => {
        console.log('Answer received');
        unsubscribe();
        await peerConnection?.setLocalDescription(offer);
        await peerConnection?.setRemoteDescription({sdp:answer.sdp, type: answer.type});
        setUsers((users) => [...users, answer.user]);
      })
      unsubscribeAnswer.current = unsubscribe;
    } else {
      console.log('No offer');
    }
  }

  const createAnswer = async (sessionId: string) => {
    const repository = new SessionRepositoryFirebase();
    const answer = await peerConnection?.createAnswer();
    if (answer) {
      await repository.createAnswer(sessionId, {sdp:answer.sdp, type:answer.type, user});
      await peerConnection?.setLocalDescription(answer);
      console.log('Answer created');
    }
    
  }

  const handleChatMessage = (message: ChatMessage) => {
    setChatMessages((messages) => [...messages, message]);
  }

  const handleFileMessage = (message: FileStartMessage) => {
    console.log('File received', message);
    setFilesReceived((files) => [...files, { id: message.id, name: message.name, size: message.size, progress: 0 }]);
  }

  const handleChunkMessage = (message: ChunkMessage) => {
    console.log('Chunk received');
    const rawString = atob(message.chunk);
    const chunkArray = new Uint8Array(rawString.length);
    for (let i = 0; i < rawString.length; i++) {
      chunkArray[i] = rawString.charCodeAt(i);
    }
    receivedFiles[message.idFile] = receivedFiles[message.idFile] || [];
    receivedFiles[message.idFile].push(chunkArray);
    setFilesReceived((files) => files.map((file) => {
      if (file.id === message.idFile) {
        return { ...file, progress: message.percentage };
      }
      return file;
    }));
    dataChannel.current?.send(JSON.stringify({ type: 'chunk-ack', idFile: message.idFile, segmentNumber: message.segmentNumber }));
  }

  const handleFileEndMessage = (message: FileEndMessage) => {
    const fileData = new Blob(receivedFiles[message.idFile]);
    const url = URL.createObjectURL(fileData) + '#filename=' + message.filename;
    setChatMessages((messages) => [...messages, { type: 'message', data: url, username: 'Downloads', date: new Date() }]);
  
    setFilesReceived((files)=> {
      return files.map((file) => {
        if (file.id === message.idFile) {
          return { ...file, data: fileData, progress: 100 };
        }
        return file;
      })
    });
  }

  const handleChunkAckMessage = (message:ChunkAckMessage) => {
    const pendingAck = pendingChunkAcks.current[message.idFile] && pendingChunkAcks.current[message.idFile][message.segmentNumber];
    if (pendingAck) {
      pendingAck.resolve();
      delete pendingChunkAcks.current[message.idFile][message.segmentNumber];
    }
  };

  const joinSession = async (sessionId: string) => {
    console.log('Joining session');
    setSessionId(sessionId);
    peerConnection!.ondatachannel = (event) => {
      const receiveChannel = event.channel;
      receiveChannel.onmessage = (event) => {
        const parsedMessage = JSON.parse(event.data);
        switch (parsedMessage.type) {
          case 'message': handleChatMessage(parsedMessage); break;
          case 'file-start': handleFileMessage(parsedMessage); break;
          case 'chunk': handleChunkMessage(parsedMessage); break;
          case 'chunk-ack': handleChunkAckMessage(parsedMessage); break;
          case 'file-end': handleFileEndMessage(parsedMessage); break;
        }
      };
      receiveChannel.onopen = () => {
        console.log("Canal de datos abierto");
      };
      receiveChannel.onclose = () => {
        console.log("Canal de datos cerrado");
      };
      // Puedes asignar el canal a una variable si necesitas acceder a él más tarde
      dataChannel.current = receiveChannel;
    };
    const repository = new SessionRepositoryFirebase();
    const unsubscribe = repository.listenForOffer(sessionId, async (offer) => {
      console.log('Offer received');
      unsubscribe();
      await peerConnection?.setRemoteDescription({sdp:offer.sdp, type: offer.type});
      setUsers(() => [...users, offer.user]);
      await createAnswer(sessionId);
      setConnectionState(ConnectionState.Connecting);
    });
    unsubscribeOffer.current = unsubscribe;
  }

  useEffect(() => {
    // Verifica si WebRTC es soportado en el navegador
    if (!window.RTCPeerConnection) {
      alert('Tu navegador no soporta WebRTC');
      return;
    }
    
    // Crea la conexión WebRTC
    const pc = new RTCPeerConnection({
      'iceServers': [
        { 'urls': "stun:stun.l.google.com:19302" },
        { "urls": "stun:stun1.l.google.com:19302"},
        { "urls": "stun:stun2.l.google.com:19302"},
        { "urls": "stun:stun3.l.google.com:19302"},
        { "urls": "stun:stun4.l.google.com:19302"},
        { "urls": "stun:stunserver.stunprotocol.org:3478"}
      ],
    });

    setPeerConnection(pc);

    // Limpia los recursos al desmontar el componente
    return () => {
      if (pc) {
        pc.close();
        unsubscribeAnswer?.current?.();
        unsubscribeOffer?.current?.();
      }
    };
  }, []);


  useEffect(() => {
    if (sessionId && peerConnection) {
      console.log('Waiting for candidate');
      const repository = new SessionRepositoryFirebase();
      peerConnection.onicecandidate = (event) => {
        console.log('Candidate created');
        if (event.candidate) {
          repository.createCandidate(sessionId, event.candidate);
        }
      }
    }
  }, [sessionId, peerConnection, peerConnection?.remoteDescription]);

  useEffect(() => {
    if (sessionId && peerConnection) {
      console.log('Listening for candidate');
      const repository = new SessionRepositoryFirebase();
      const unsubscribe = repository.listenForCandidate(sessionId, (candidate) => {
        console.log('Candidate received:', candidate);
        peerConnection.addIceCandidate(candidate);
      });

      return () => {
        unsubscribe();
      }
    }
  }, [sessionId, peerConnection]);


  useEffect(() => {
    if (peerConnection) {
      peerConnection.onconnectionstatechange = () => {
        console.log('PEER Connection state:', peerConnection.connectionState);
        if (peerConnection.connectionState === 'connected') {
          setConnectionState(ConnectionState.Connected);
        }
      };
    }
  }, [peerConnection]);


  useEffect(() => {
    console.log("UPDATE CONNECTION STATE:", connectionState);
  }, [connectionState]);

  const sendMessage = (message:string) => {
    console.log('Sending message:', message);
    if (dataChannel.current) {
      const messageObject = { type: 'message', data: message, username: user?.name, date: new Date() } as ChatMessage;
      dataChannel.current.send(JSON.stringify(messageObject));
      setChatMessages((messages) => [...messages, messageObject]);
    }
  }

  const CHUNK_SIZE = 16384;
  const sendChunk = (chunk: ChunkMessage) => {
    return new Promise<void>((resolve, reject) => {
      dataChannel.current?.send(JSON.stringify(chunk));
      // Almacenar la promesa pendiente con el ID del archivo y el número de segmento.
      pendingChunkAcks.current[chunk.idFile] = pendingChunkAcks.current[chunk.idFile] || {};
      pendingChunkAcks.current[chunk.idFile][chunk.segmentNumber] = { resolve, reject };
    });
  }

  const sendFile = (file: DropFile) => {
    dataChannel.current?.send(JSON.stringify({ type: 'file-start', name: file.name, size: file.size, id: file.id } as FileStartMessage));
    const reader = new FileReader();
    reader.onload = async () => {
      const arrayBuffer = reader.result as ArrayBuffer;
      const data = new Uint8Array(arrayBuffer);
      const numberOfChunks = Math.ceil(data.byteLength / CHUNK_SIZE);
      console.log('Number of chunks:', numberOfChunks);
      let percentage = 0;
      for (let i = 0; i < numberOfChunks; i++) {
        const start = i * CHUNK_SIZE;
        const end = Math.min(data.byteLength, (i + 1) * CHUNK_SIZE);
        const chunk = data.slice(start, end);
        const chunkArray = Array.from(chunk);
        const base64Chunk = btoa(chunkArray.map(c => String.fromCharCode(c)).join(''));
        percentage = Math.round((100 * i) / numberOfChunks);
        await sendChunk({ type: 'chunk', idFile: file.id, chunk: base64Chunk, percentage, segmentNumber: i } as ChunkMessage);
      }
      const message = { type: 'file-end', name: file.name, idFile: file.id, filename: file.name } as FileEndMessage;
      dataChannel.current?.send(JSON.stringify(message));
    };
    reader.readAsArrayBuffer(file.file);
  }

  return { peerConnection, createOffer, connectionState, joinSession, sendMessage, sendFile, filesReceived, chatMessages, sessionId, users};
};

export default useWebRTC;
