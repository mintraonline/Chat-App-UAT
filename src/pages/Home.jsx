import { useContext, useEffect, useState } from "react";
import { AuthContext } from "../context/AuthContext";
import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
  getDoc,
} from "firebase/firestore";
import { db, auth } from "../firebase";
import "./Home.css";
import { signOut } from "firebase/auth";
import { FaArrowLeft, FaUserCircle } from "react-icons/fa";
import { BsPersonCircle } from "react-icons/bs";
import { MdDeleteOutline, MdOutlinePersonOutline } from "react-icons/md";
import { FiLogOut } from "react-icons/fi";
import { IoMdSend } from "react-icons/io";

const isMobile = () => window.innerWidth <= 768;

const Home = () => {
  const { currentUser } = useContext(AuthContext);
  const [allUsers, setAllUsers] = useState([]);
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [chats, setChats] = useState([]);
  const [text, setText] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [menuMessageId, setMenuMessageId] = useState(null);
  const [unreadMap, setUnreadMap] = useState({});
  const [lastMessageMap, setLastMessageMap] = useState({});
  const [showSidebar, setShowSidebar] = useState(false);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, "users"));
        const fetchedUsers = querySnapshot.docs
          .map((doc) => doc.data())
          .filter((user) => user.uid !== currentUser?.uid);
        const sortedUsers = [...fetchedUsers].sort((a, b) => {
          const aUnread = unreadMap[a.uid] || 0;
          const bUnread = unreadMap[b.uid] || 0;
          return bUnread - aUnread;
        });
        setAllUsers(sortedUsers);
      } catch (err) {
        console.error("Error fetching users:", err);
      }
    };
    fetchUsers();
    if (isMobile()) {
      setShowSidebar(true);
    }
  }, [currentUser]);

  useEffect(() => {
    const filtered = allUsers.filter((user) =>
      user.displayName.toLowerCase().includes(searchTerm.toLowerCase())
    );
    const sorted = filtered.sort((a, b) => {
      const aLast = lastMessageMap[a.uid] || 0;
      const bLast = lastMessageMap[b.uid] || 0;
      return bLast - aLast;
    });
    setUsers(sorted);
  }, [searchTerm, allUsers, lastMessageMap]);

  useEffect(() => {
    const unsubscribes = [];
    allUsers.forEach((user) => {
      const combinedId =
        currentUser.uid > user.uid
          ? currentUser.uid + user.uid
          : user.uid + currentUser.uid;

      const unsub = onSnapshot(doc(db, "chats", combinedId), (docSnap) => {
        if (!docSnap.exists()) return;

        const messages = docSnap.data().messages || [];
        let unreadCount = 0;
        let lastTimestamp = 0;

        messages.forEach((msg) => {
          if (msg.date) {
            const timestamp = new Date(msg.date.seconds * 1000).getTime();
            lastTimestamp = Math.max(lastTimestamp, timestamp);
          }
          if (
            msg.senderId !== currentUser.uid &&
            (!msg.readBy || !msg.readBy.includes(currentUser.uid))
          ) {
            unreadCount++;
          }
        });

        setUnreadMap((prev) => ({
          ...prev,
          [user.uid]: user.uid === selectedUser?.uid ? 0 : unreadCount,
        }));

        setLastMessageMap((prev) => ({
          ...prev,
          [user.uid]: lastTimestamp,
        }));
      });

      unsubscribes.push(unsub);
    });

    return () => unsubscribes.forEach((unsub) => unsub());
  }, [allUsers, currentUser.uid, selectedUser?.uid]);

  const handleLogout = () => {
    signOut(auth).catch((err) => console.error("Logout failed:", err));
    localStorage.removeItem("selectedUser");
  };
  useEffect(() => {
    if (!selectedUser) return;
    const combinedId =
      currentUser.uid > selectedUser.uid
        ? currentUser.uid + selectedUser.uid
        : selectedUser.uid + currentUser.uid;

    const unsub = onSnapshot(doc(db, "chats", combinedId), (docSnap) => {
      docSnap.exists() && setChats(docSnap.data().messages || []);
    });
    return () => unsub();
  }, [selectedUser?.uid, currentUser.uid]);

  const handleSelectUser = async (user) => {
    setSelectedUser(user);
    localStorage.setItem("selectedUser", JSON.stringify(user));
    if (isMobile()) setShowSidebar(false);

    const combinedId =
      currentUser.uid > user.uid
        ? currentUser.uid + user.uid
        : user.uid + currentUser.uid;

    const chatRef = doc(db, "chats", combinedId);
    try {
      const chatSnap = await getDoc(chatRef);
      if (!chatSnap.exists()) {
        await setDoc(chatRef, {
          participants: [currentUser.uid, user.uid],
          messages: [],
        });
      } else {
        const chatData = chatSnap.data();
        const updatedMessages = chatData.messages.map((msg) => {
          if (
            msg.senderId !== currentUser.uid &&
            (!msg.readBy || !msg.readBy.includes(currentUser.uid))
          ) {
            return {
              ...msg,
              readBy: [...(msg.readBy || []), currentUser.uid],
            };
          }
          return msg;
        });

        await updateDoc(chatRef, {
          messages: updatedMessages,
        });

        setUnreadMap((prev) => ({ ...prev, [user.uid]: 0 }));
      }

      await setDoc(
        doc(db, "userChats", currentUser.uid),
        {
          [combinedId + ".userInfo"]: {
            uid: user.uid,
            displayName: user.displayName,
          },
          [combinedId + ".date"]: serverTimestamp(),
        },
        { merge: true }
      );

      await setDoc(
        doc(db, "userChats", user.uid),
        {
          [combinedId + ".userInfo"]: {
            uid: currentUser.uid,
            displayName: currentUser.displayName,
          },
          [combinedId + ".date"]: serverTimestamp(),
        },
        { merge: true }
      );
    } catch (err) {
      console.error("Failed to create/select chat:", err);
    }
  };

  const ensureParticipantsExist = async (chatRef, participants) => {
    const chatSnap = await getDoc(chatRef);
    if (chatSnap.exists()) {
      const data = chatSnap.data();
      if (!data.participants) {
        await updateDoc(chatRef, { participants });
      }
    }
  };

  const handleSend = async () => {
    if (!text.trim()) return;

    const combinedId =
      currentUser.uid > selectedUser.uid
        ? currentUser.uid + selectedUser.uid
        : selectedUser.uid + currentUser.uid;

    const newMessage = {
      id: Date.now(),
      text,
      senderId: currentUser.uid,
      date: new Date(),
      readBy: [currentUser.uid],
    };

    const participants = [currentUser.uid, selectedUser.uid];
    const chatRef = doc(db, "chats", combinedId);

    try {
      const chatSnap = await getDoc(chatRef);

      if (!chatSnap.exists()) {
        await setDoc(chatRef, {
          participants,
          messages: [newMessage],
        });
      } else {
        await ensureParticipantsExist(chatRef, participants);
        const existingMessages = chatSnap.data().messages || [];

        await updateDoc(chatRef, {
          messages: [...existingMessages, newMessage],
          participants,
        });
      }

      await setDoc(
        doc(db, "userChats", currentUser.uid),
        {
          [combinedId + ".userInfo"]: {
            uid: selectedUser.uid,
            displayName: selectedUser.displayName,
          },
          [combinedId + ".date"]: new Date(),
        },
        { merge: true }
      );

      await setDoc(
        doc(db, "userChats", selectedUser.uid),
        {
          [combinedId + ".userInfo"]: {
            uid: currentUser.uid,
            displayName: currentUser.displayName,
          },
          [combinedId + ".date"]: new Date(),
        },
        { merge: true }
      );

      setText("");
    } catch (err) {
      console.error("❌ Failed to send message:", err);
    }
  };

  const handleDeleteMessage = async (messageId) => {
    const combinedId =
      currentUser.uid > selectedUser.uid
        ? currentUser.uid + selectedUser.uid
        : selectedUser.uid + currentUser.uid;

    try {
      const chatRef = doc(db, "chats", combinedId);
      const chatSnap = await getDoc(chatRef);

      if (chatSnap.exists()) {
        const existingMessages = chatSnap.data().messages || [];

        const updatedMessages = existingMessages.filter(
          (msg) => msg.id !== messageId
        );

        await updateDoc(chatRef, {
          messages: updatedMessages,
        });
      }
    } catch (err) {
      console.error("Failed to delete message:", err);
    }
  };

  const handleDeleteAllMessages = async () => {
    if (!selectedUser) return;

    const confirm = window.confirm(
      "Are you sure you want to delete all messages?"
    );
    if (!confirm) return;

    const combinedId =
      currentUser.uid > selectedUser.uid
        ? currentUser.uid + selectedUser.uid
        : selectedUser.uid + currentUser.uid;

    try {
      const chatRef = doc(db, "chats", combinedId);
      const chatSnap = await getDoc(chatRef);

      if (chatSnap.exists()) {
        await updateDoc(chatRef, {
          messages: [],
        });
        setChats([]);
      }
    } catch (err) {
      console.error("Failed to delete all messages:", err);
    }
  };

  const getFormattedTime = (timestamp) => {
    const now = new Date();
    const msgDate = new Date(timestamp.seconds * 1000);
    const diffInMs = now - msgDate;
    const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
    const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
    const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));
    if (diffInDays >= 1) {
      return `${diffInDays} day${diffInDays > 1 ? "s" : ""} ago`;
    }
    if (diffInHours >= 1) {
      return `${diffInHours} hour${diffInHours > 1 ? "s" : ""} ago`;
    }
    if (diffInMinutes >= 1) {
      return `${diffInMinutes} min${diffInMinutes > 1 ? "s" : ""} ago`;
    }
    return "just now";
  };

  return (
    <div className="chat-app">
      {!isMobile() && (
        <div className="sidebar">
          <div className="sidebar-header">
            <h2>Chats</h2>
          </div>
          <div className="logged-in-user">
            <div className="user-info">
              <div className="avatar">
                {currentUser?.displayName?.[0]?.toUpperCase() || "U"}
              </div>
              <div className="user-details">
                <div className="user-names">
                  {currentUser?.displayName || currentUser?.email}
                </div>
                <div className="user-status">🟢 Online</div>
              </div>
            </div>
            <button className="logout-button" onClick={handleLogout}>
              Logout
            </button>
          </div>
          <input
            type="text"
            placeholder="Search user..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <div className="user-list">
            {users.length === 0 ? (
              <p style={{ padding: "1rem" }}>No users found to chat with.</p>
            ) : (
              users.map((user) => (
                <div
                  key={user.uid}
                  className={`user-item ${
                    selectedUser?.uid === user.uid ? "active" : ""
                  }`}
                  onClick={() => handleSelectUser(user)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    width: "100%",
                  }}
                >
                  <div
                    style={{ display: "flex", alignItems: "center", gap: 10 }}
                  >
                    <div className="user-avatar">
                      {user.displayName?.charAt(0).toUpperCase()}
                    </div>
                    <div className="user-name">{user.displayName}</div>
                  </div>
                  {unreadMap[user.uid] > 0 && (
                    <div className="unread-badge">
                      {unreadMap[user.uid] > 99 ? "99+" : unreadMap[user.uid]}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
      {isMobile() && showSidebar && (
        <div className="mobile-modal">
          <div className="mobile-header">
            <button
              className="back-button"
              onClick={() => setShowSidebar(false)}
            ></button>
            <div className="header-profile">
              <div className="header-avatar">
                <FaUserCircle size={28} />
              </div>
              <div
                className="header-title"
                style={{
                  display: "flex",
                  flexDirection: "column",
                  lineHeight: 1.2,
                }}
              >
                <div
                  style={{
                    fontWeight: "bold",
                    color: "#fff",
                    fontSize: "15px",
                  }}
                >
                  {currentUser?.displayName}
                </div>
                <small
                  style={{
                    fontSize: "11px",
                    color: "#ddd",
                    fontStyle: "italic",
                  }}
                >
                  {currentUser?.email}
                </small>
              </div>
            </div>
            <button className="logout-button-phone" onClick={handleLogout}>
              <FiLogOut size={22} />
            </button>
          </div>
          <div className="search-wrapper">
            <input
              type="text"
              className="search-bar"
              placeholder="Search"
              value={searchTerm}
              onFocus={(e) => {
                setTimeout(() => {
                  e.target.scrollIntoView({
                    behavior: "smooth",
                    block: "center", 
                  });
                }, 300);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <span className="search-icon">🔍</span>
          </div>

          <div className="user-list-mobile">
            {users.map((user) => (
              <div
                key={user.uid}
                className="user-row"
                onClick={() => handleSelectUser(user)}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "8px 12px",
                }}
              >
                <div
                  className="left-user"
                  style={{ display: "flex", alignItems: "center", gap: 10 }}
                >
                  <div className="header-avatar-phone">
                    <MdOutlinePersonOutline color="white" size={28} />
                  </div>
                  <div className="user-text" style={{ fontWeight: 500 }}>
                    {user.displayName}
                  </div>
                </div>
                <div
                  className="right-info"
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "flex-end",
                    gap: 2,
                  }}
                >
                  <div
                    className="status-section"
                    style={{ display: "flex", alignItems: "center", gap: 4 }}
                  >
                    <div
                      className="status-section"
                      style={{ display: "flex", alignItems: "center", gap: 4 }}
                    >
                      <span
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: "50%",
                          backgroundColor: user.isOnline
                            ? "#4caf50"
                            : "#9e9e9e",
                          display: "inline-block",
                        }}
                      ></span>
                      <span
                        style={{
                          fontSize: "12px",
                          color: user.isOnline ? "#4caf50" : "#9e9e9e",
                        }}
                      >
                        {user.isOnline ? "Online" : "Offline"}
                      </span>
                    </div>
                  </div>
                  <div className="user-time" style={{ fontSize: "11px" }}>
                    {lastMessageMap[user.uid]
                      ? new Date(lastMessageMap[user.uid]).toLocaleTimeString(
                          [],
                          {
                            hour: "2-digit",
                            minute: "2-digit",
                            hour12: true,
                          }
                        )
                      : ""}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="chat-window">
        <div className="chat-header">
          {selectedUser ? (
            <div
              className="chat-header-content"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "10px 16px",
              }}
            >
              {isMobile() && (
                <FaArrowLeft
                  onClick={() => setShowSidebar(true)}
                  style={{ color: "#fff", fontSize: 18, cursor: "pointer" }}
                />
              )}

              {/* User Info */}
              <div
                className="chat-user-name"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  marginLeft: "20px",
                  flex: 1,
                  overflow: "hidden",
                }}
              >
                <FaUserCircle size={22} color="#ddd" />
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    overflow: "hidden",
                    gap: "2px",
                  }}
                >
                  <h3
                    style={{
                      margin: 0,
                      fontSize: "15px",
                      color: "#fff",

                      whiteSpace: "nowrap",
                      textOverflow: "ellipsis",
                      overflow: "hidden",
                    }}
                  >
                    {selectedUser.displayName}
                  </h3>
                  <small style={{ color: "#aaa", fontSize: "11px" }}>
                    {selectedUser.isOnline ? "Online" : "Offline"}
                  </small>
                </div>
              </div>

              <div
                className="chat-actions"
                style={{
                  display: "flex",
                  alignItems: "center",
                }}
              >
                <button
                  className="clear-chat-button"
                  onClick={handleDeleteAllMessages}
                  style={{
                    backgroundColor: "#e53935",
                    color: "#fff",
                    border: "none",
                    borderRadius: "6px",
                    padding: "6px 10px",
                    fontSize: "12px",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    cursor: "pointer",
                  }}
                >
                  <MdDeleteOutline size={16} />
                  Clear
                </button>
              </div>
            </div>
          ) : (
            <h3
              className="chat-select-title"
              style={{
                textAlign: "center",
                padding: "20px",
                color: "#888",
                fontSize: "16px",
              }}
            >
              Select a user to chat
            </h3>
          )}
        </div>

        <div
          className="mobile-chat-container"
          style={{ display: "flex", flexDirection: "column", height: "85%" }}
        >
          <div className="chat-body scrollable-chat-body">
            {chats.map((msg) => (
              <div
                key={msg.id}
                className={`chat-message ${
                  msg.senderId === currentUser.uid ? "sent" : "received"
                }`}
              >
                <div className="message-content">
                  <div className="message-header">
                    <span className="message-sender">
                      {msg.senderId === currentUser.uid
                        ? currentUser.displayName || "You"
                        : selectedUser?.displayName || ""}
                    </span>
                    <span className="message-time">
                      {msg.date &&
                        (new Date().getTime() - msg.date.seconds * 1000 >
                        24 * 60 * 60 * 1000
                          ? getFormattedTime(msg.date)
                          : new Date(
                              msg.date.seconds * 1000
                            ).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                              hour12: true,
                            }))}
                    </span>
                  </div>
                  <div className="message-text">{msg.text}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
        {selectedUser && (
          <div className="chat-input-wrapper">
            <div className="chat-input-field">
              <input
                type="text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder="Type a message..."
              />
              {text.length > 0 && (
                <span
                  className="send-icon-inside"
                  title="Send"
                  onClick={handleSend}
                >
                  <IoMdSend size={20} color="#fff" />
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Home;
