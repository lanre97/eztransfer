import { AuthContext } from "@/context/AuthContextProvider";
import { useContext } from "react";

const useAuth = () => {
  const { user, authState } = useContext(AuthContext);
  return { user, authState };
}

export default useAuth;