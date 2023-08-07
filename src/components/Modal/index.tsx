import { FC, ReactNode, useState } from "react"

export interface ModalProps {
  className?: string
  title?: string
  children?: ReactNode
  open: boolean
  onClose?: () => void
}

const Modal:FC<ModalProps> = ( {open = false, className, title, children, onClose} ) => {

  const handleOuterClick = () => {
    console.log("handleOuterClick")
    onClose?.()
   };
 
   const handleInnerClick = (e: React.MouseEvent) => {
     e.stopPropagation(); // Detiene la propagación del evento para que no se active el handleOuterClick
   };

  return (
    <div className={'absolute bg-[#0000003a] w-screen h-screen top-0 left-0 flex items-center justify-center z-50'+ className + (open?'':' hidden')} onClick={handleOuterClick}>
      <div className='bg-white p-6 px-10 rounded-md' onClick={handleInnerClick}>
        <h2 className='font-bold mb-4'>{title}</h2>
        {children}
      </div>
    </div>
  )

}

export default Modal