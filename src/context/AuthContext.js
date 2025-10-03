import { createContext, useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../firebase";  // adjust path to your firebase.js

export const AuthContext = createContext();

export const AuthContextProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setCurrentUser(user);

        const userRef = doc(db, "users", user.uid);

        // Mark online
        await updateDoc(userRef, {
          isOnline: true,
          lastSeen: serverTimestamp(),
        });

        // Mark offline when browser closes or refreshes
        const handleUnload = async () => {
          await updateDoc(userRef, {
            isOnline: false,
            lastSeen: serverTimestamp(),
          });
        };

        window.addEventListener("beforeunload", handleUnload);

        return () => {
          window.removeEventListener("beforeunload", handleUnload);
        };
      } else {
        setCurrentUser(null);
      }
    });

    return () => unsub();
  }, []);

  return (
    <AuthContext.Provider value={{ currentUser }}>
      {children}
    </AuthContext.Provider>
  );
};
