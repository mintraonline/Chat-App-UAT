import { useEffect } from "react";
import { getDatabase, ref, onDisconnect, set, onValue } from "firebase/database";
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase"; // your Firestore instance
import { auth } from "../firebase"; // your Firebase Auth instance

export const usePresence = () => {
  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    const uid = user.uid;
    const rtdb = getDatabase();
    const userStatusDatabaseRef = ref(rtdb, `/status/${uid}`);
    const userDocRef = doc(db, "users", uid);

    // 🔹 Define online/offline payloads for both RTDB and Firestore
    const isOfflineForRTDB = {
      state: "offline",
      lastChanged: serverTimestamp(),
    };
    const isOnlineForRTDB = {
      state: "online",
      lastChanged: serverTimestamp(),
    };

    const isOfflineForFirestore = {
      isOnline: false,
      lastActive: new Date(),
    };
    const isOnlineForFirestore = {
      isOnline: true,
      lastActive: new Date(),
    };

    // 🔹 Realtime Database: detect connection state
    const connectedRef = ref(rtdb, ".info/connected");

    const unsubscribe = onValue(connectedRef, async (snapshot) => {
      if (snapshot.val() === false) return;

      // When browser disconnects or closes → mark offline
      await onDisconnect(userStatusDatabaseRef).set(isOfflineForRTDB);

      // When connected → mark online in both places
      await set(userStatusDatabaseRef, isOnlineForRTDB);
      await updateDoc(userDocRef, isOnlineForFirestore);
    });

    // 🔹 Handle when tab/window is closed
    const handleBeforeUnload = async () => {
      try {
        await updateDoc(userDocRef, isOfflineForFirestore);
        await set(userStatusDatabaseRef, isOfflineForRTDB);
      } catch (e) {
        console.warn("Failed to mark offline on unload:", e);
      }
    };

    // 🔹 Handle tab visibility change (minimize / switch tab)
    const handleVisibilityChange = async () => {
      if (document.visibilityState === "hidden") {
        await updateDoc(userDocRef, isOfflineForFirestore);
        await set(userStatusDatabaseRef, isOfflineForRTDB);
      } else {
        await updateDoc(userDocRef, isOnlineForFirestore);
        await set(userStatusDatabaseRef, isOnlineForRTDB);
      }
    };

    // Add event listeners
    window.addEventListener("beforeunload", handleBeforeUnload);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    // Cleanup
    return () => {
      unsubscribe();
      window.removeEventListener("beforeunload", handleBeforeUnload);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);
};
