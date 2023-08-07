import Logo from '@/components/Logo'
import Modal from '@/components/Modal'
import useWebRTC, { ConnectionState } from '@/hooks/useWebrtc'
import { useEffect, useId, useRef, useState } from 'react'
import {v4 as uuidV4} from 'uuid'
import DropFile from '@/models/DropFile'
import { uniqueNamesGenerator, adjectives, colors, animals } from 'unique-names-generator';
import { AuthState } from '@/context/AuthContextProvider'
import useAuth from '@/hooks/useAuth'
import { LOCAL_URL } from '@/utils/constants'
import Image from 'next/image'
import Link from 'next/link'
import Head from 'next/head'

export default function Home() {
  const { user, authState } = useAuth()
  const { createOffer, joinSession, sendMessage, connectionState, sendFile, filesReceived, chatMessages, sessionId, users } = useWebRTC(user)
  const inputId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [files, setFiles] = useState<DropFile[]>([])
  const [showModal, setShowModal] = useState<boolean>(false)
  const [showDownloadingModal, setShowDownloadingModal] = useState<boolean>(false)
  const messageRef = useRef<HTMLTextAreaElement>(null)
  const messageContainerRef = useRef<HTMLDivElement>(null)
  const filesDownloading = filesReceived.filter((file) => !Boolean(file.data))

  const parseMessage = (message: string) => {
    //verify if message is a blob url
    const isBlobUrl = message.startsWith('blob:')
    if (isBlobUrl) {
      //extract #filename from blob url
      const filename = message.split('#filename=')[1]
      return <a className='text-blue-400' href={message} download={filename}>{filename}</a>
    }
    return message
  }

  useEffect(() => {
    if (messageContainerRef.current) {
      //scroll to bottom
      messageContainerRef.current.scrollTop = messageContainerRef.current.scrollHeight
    }
  }, [chatMessages])

  const handleSendMessage = () => {
    if (messageRef.current) {
      sendMessage(messageRef.current.value)
      messageRef.current.value = ''
    }
  }

  const handleSendMessageKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const generateRandomName = () => {
    const randomName = uniqueNamesGenerator({ 
      dictionaries: [adjectives, animals, colors],
      separator: ' ',
    });
    return randomName
  }
  
  const [mockUsers, setMockUsers] = useState<string[]>([])

  useEffect(() => {
    setMockUsers([generateRandomName(), generateRandomName(), generateRandomName()])
  }, [])

  const parseFileList = (files: FileList):DropFile[] => {
    const arrayFiles = Array.from(files)
    console.log("arrayFiles", arrayFiles)
    const newFiles = arrayFiles.map((file) => {
      return new DropFile(file, uuidV4())
    })
    return newFiles
  }

  const handleDrop = async (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    if (inputRef.current) {
      setFiles((currentFiles) => {
        if (currentFiles) {
          return [...currentFiles, ...parseFileList(e.dataTransfer.files)]
        }
        return parseFileList(e.dataTransfer.files)
      });
      if(!sessionId && connectionState !== ConnectionState.CreatingOffer) {
        await createOffer()
        setShowModal(true)
      }
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault()
  }

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files !== null) {
      setFiles((currentFiles) => {
        if (currentFiles) {
          return [...currentFiles, ...parseFileList(e.target.files as FileList)]
        }
        return parseFileList(e.target.files as FileList)
      });
    }
    if(!sessionId && connectionState !== ConnectionState.CreatingOffer) {
      await createOffer()
      setShowModal(true)
    }
  }

  const handleCopy = async () => {
    await navigator.clipboard.writeText(`${LOCAL_URL}/${sessionId}`)
    setShowModal(false)
  }

  const parseBytes = (bytes: number) => {
    const sizes = ["Bytes", "KB", "MB", "GB", "TB"]
    if (bytes === 0) return "0 Byte"
    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    //size with 2 decimals
    return Math.round(bytes*100 / Math.pow(1024, i))/100 + " " + sizes[i]
  }

  const handleDeleteFile = (id: string) => {
    setFiles((currentFiles) => currentFiles.filter((file) => file.id !== id))
  }

  return (
    <>
      <Head>
        <title>DROP | File Sharing</title>
        <meta name="description" content="Drop is a file sharing app that allows you to share files with your friends in a peer-to-peer connection." />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <header className='p-4 flex justify-center'>
        <Logo width={300}/>
      </header>
      {authState === AuthState.Authenticated && (
        <main className='flex justify-center flex-col p-4'>
          <section className='max-w-6xl m-auto w-full md:my-10 mb-20 flex flex-col-reverse md:flex-row flex-wrap gap-4'>
            <div className='flex-1'>
              <label htmlFor={inputId} onDrop={handleDrop} onDragOver={handleDragOver} className='flex-1'>
                <div className='border-4 border-black h-[100px] md:h-[200px] border-dashed rounded-md flex items-center justify-center'>
                Drop file or click here
                </div>
                <input ref={inputRef} className="hidden" type="file" id={inputId} onChange={onFileChange} multiple/>
              </label>
              {
                files.slice().reverse().map(file => (
                  <div key={file.id} className='flex items-center p-2 border rounded-md mt-4 justify-between'>
                    <span>{file.name} ({parseBytes(file.size)})</span>
                    <div>
                      <button
                        disabled={users.length === 0}
                        className='text-blue-500 text-sm hover:bg-slate-100 p-1 px-2 rounded-md'
                        onClick={() => sendFile(file)}
                      >
                        Transfer
                      </button>
                      <button 
                        className='text-red-500 text-sm hover:bg-slate-100 p-1 px-2 rounded-md'
                        onClick={() => handleDeleteFile(file.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))
              }
            </div>
            {
              sessionId && (
                <aside className='w-full md:max-w-[300px]'>
                  <header className='font-bold'>
                    Friends
                  </header>
                  <main>
                    <section className='pb-2 border-b h-[72px] overflow-y-auto'>
                      <ul>
                        {
                          users.length === 0 && (
                            <li className='capitalize'>No friends connected</li>
                          )
                        }
                        {
                          users?.map(user => (
                            <li key={user.id} className='capitalize'>{user.name}</li>
                          ))
                        }
                      </ul>
                    </section>
                    <section className='flex flex-col gap-2 mt-4'>
                      <div className='h-32 overflow-y-auto' ref={messageContainerRef}>
                        {
                          chatMessages.map((message, index) => (
                            <div key={index} className='flex flex-col'>
                              <span className='font-bold capitalize'>{message.username}</span>
                              <span>{parseMessage(message.data)}</span>
                            </div>
                          ))
                        }
                      </div>
                      <textarea ref={messageRef} className='border-2 border-black rounded-sm' name="inputchat" id="inputchat" onKeyDown={handleSendMessageKeyPress}></textarea>
                      <button className='w-full bg-black text-white rounded py-2' onClick={handleSendMessage}>SEND</button>
                    </section>
                  </main>
                </aside>
              )
            }
            {
              connectionState === ConnectionState.CreatingOffer && (
                <aside className='w-full md:max-w-[300px] flex justify-center items-center flex-col'>
                  <p>Creating Room</p>
                  <div className='spinner'></div>
                </aside>
              )
            }
          </section>
          <Modal open={showModal} title='Share this file with your friends' onClose={()=>{
            setShowModal(false)
          }}>
            <input className='border border-black mr-4' type="text" value={`${LOCAL_URL}/${sessionId}`} readOnly />
            <button className='hover:text-blue-500' onClick={handleCopy}>Copy URL</button>
          </Modal>
          <Modal open={showDownloadingModal} title='Downloading files' onClose={()=>{ setShowDownloadingModal(false) }}>
            <ul className='h-64 overflow-y-auto min-w-[250px] md:min-w-[350px]'>
              {
                filesDownloading.map(file => (
                  <li key={file.id} className='flex items-center p-2 border rounded-md mt-4 justify-between'>
                    <span>{file.name} ({parseBytes(file.size)})</span>
                    <progress className='w-1/2' value={file.progress} max={100}></progress>
                  </li>
                ))
              }
            </ul>
          </Modal>
          {filesDownloading.length>0 && (<div className='rounded-full fixed bottom-4 right-4 w-16 h-16 shadow-md flex justify-center items-center bg-white' onClick={()=>{ setShowDownloadingModal(true) }}>
            <Image src="/images/download_icon.gif" alt="download icon" width={24} height={24}/>
            <span className='absolute bottom-0 right-0 rounded-full bg-red-400 text-white w-6 h-6 flex justify-center items-center'>{filesDownloading.length}</span>
          </div>)}
        </main>
      )}
    </>
  )
}

