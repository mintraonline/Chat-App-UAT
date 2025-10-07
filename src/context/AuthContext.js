import { createContext, useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "../../src/firebase";
import { doc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { onDisconnect, ref, set, getDatabase } from "firebase/database";

export const AuthContext = createContext();

export const AuthContextProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      try {
        if (user) {
          const userRef = doc(db, "users", user.uid);

          // 🔹 Try to fetch user document
          let userSnap = await getDoc(userRef);

          // 🔹 If it doesn't exist yet, wait & retry a few times (for just-registered users)
          let retries = 3;
          while (!userSnap.exists() && retries > 0) {
            await new Promise((res) => setTimeout(res, 500)); // wait 0.5s
            userSnap = await getDoc(userRef);
            retries--;
          }

          if (userSnap.exists()) {
            setCurrentUser({ ...user, ...userSnap.data() });
          } else {
            // fallback (should rarely happen)
            setCurrentUser(user);
          }

          // 🔹 Mark online
          await updateDoc(userRef, {
            isOnline: true,
            lastActive: new Date(),
          });

          // 🔹 Handle going offline
          const handleOffline = async () => {
            try {
              await updateDoc(userRef, {
                isOnline: false,
                lastActive: new Date(),
              });
            } catch (err) {
              console.warn("Failed to mark offline:", err);
            }
          };

          window.addEventListener("beforeunload", handleOffline);
          window.addEventListener("visibilitychange", async () => {
            try {
              if (document.visibilityState === "hidden") {
                await updateDoc(userRef, {
                  isOnline: false,
                  lastActive: new Date(),
                });
              } else {
                await updateDoc(userRef, {
                  isOnline: true,
                  lastActive: new Date(),
                });
              }
            } catch (err) {
              console.warn("Visibility change update failed:", err);
            }
          });
        } else {
          setCurrentUser(null);
        }
      } catch (err) {
        console.error("Auth state handling failed:", err);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  if (loading)
    return (
      <div
        style={{
          height: "100vh",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          background: "#f5f7fb",
          fontFamily: "Inter, sans-serif",
          color: "#555",
        }}
      >
        <div
          style={{
            border: "6px solid #e0e0e0",
            borderTop: "6px solid #1e90ff",
            borderRadius: "50%",
            width: "48px",
            height: "48px",
            animation: "spin 1s linear infinite",
            marginBottom: "12px",
          }}
        />
        <p style={{ fontSize: "16px" }}>Authenticating...</p>

        <style>
          {`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}
        </style>
      </div>
    );

  return (
    <AuthContext.Provider value={{ currentUser }}>
      {children}
    </AuthContext.Provider>
  );
};
