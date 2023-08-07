import User from "@/models/User"
import { createContext, useEffect, useState } from "react"
import { getAuth, signInAnonymously } from 'firebase/auth'
import app from "@/lib/firebase/app";
import generateRandomName from "@/utils/generateRandomName";
import getRandomEmoji from "@/utils/getRandomEmoji";

export enum AuthState {
  Unauthenticated,
  Authenticating,
  Authenticated,
}

interface AuthContextType {
  user: User;
  authState: AuthState;
}

export const AuthContext = createContext<AuthContextType>({} as AuthContextType);

const AuthContextProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User>(new User("", ""))
  const [authState, setAuthState] = useState<AuthState>(AuthState.Unauthenticated)
  useEffect(() => {
    setAuthState(AuthState.Authenticating)
    const auth = getAuth(app)
    if (auth.currentUser) {
      setUser(new User(auth.currentUser.uid,[getRandomEmoji(), generateRandomName()].join(" ")))
      setAuthState(AuthState.Authenticated)
      return
    }
    signInAnonymously(auth)
      .then((userCredential) => {
        // Signed in..
        const user = userCredential.user;
        if (user) {
          setUser(new User(user.uid, [getRandomEmoji(), generateRandomName()].join(" ")))
          setAuthState(AuthState.Authenticated)
        }
      })
      .catch((error) => {
        const errorCode = error.code;
        const errorMessage = error.message;
        console.log("error", errorCode, errorMessage)
      });
  },[])

  return (
    <AuthContext.Provider value={{ user: user, authState: authState }}>
      {children}
    </AuthContext.Provider>
  );
}

export default AuthContextProvider