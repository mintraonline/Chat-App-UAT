import { useEffect, useRef } from "react";
import { signOut } from "firebase/auth";
import { auth } from "../firebase";

export const useAutoLogout = () => {
  const timeoutRef = useRef(null);

  const startLogoutTimer = () => {
    clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      signOut(auth);
      console.log("Logged out due to inactivity.");
    }, 2 * 60 * 1000);
  };
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        startLogoutTimer();
      } else {
        clearTimeout(timeoutRef.current);
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      clearTimeout(timeoutRef.current);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);
};
