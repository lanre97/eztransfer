import Link from "next/link";
import { FC } from "react";
import Image from "next/image";

interface Props {
  className?: string;
  height?: number;
  width?: number;
}

const Logo:FC<Props> = ({className, width, height})=>{
  return (
    <Link href="/" className={className} passHref>
      <Image alt="Drop LOGO" src="/images/drop_logo.png" width={width??200} height={height??200}/>
    </Link>
  )
}

export default Logo;