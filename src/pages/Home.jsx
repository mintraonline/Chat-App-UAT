import { useContext, useEffect, useState, useRef } from "react";
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
  arrayUnion,
} from "firebase/firestore";
import { db, auth } from "../firebase";
import axios from "axios";
import "./Home.css";
import { signOut } from "firebase/auth";
import { FaArrowLeft, FaMusic, FaUserCircle } from "react-icons/fa";
import {
  MdDeleteOutline,
  MdOutlinePersonOutline,
  MdAttachFile,
} from "react-icons/md";
import { FiLogOut } from "react-icons/fi";
import { IoMdSend, IoMdClose } from "react-icons/io";
import imageCompression from "browser-image-compression";
import { FFmpeg } from "@ffmpeg/ffmpeg";
import {
  FaFilePdf,
  FaFileWord,
  FaFileExcel,
  FaFilePowerpoint,
  FaFileAlt,
  FaFileImage,
  FaFileVideo,
} from "react-icons/fa";
import MediaModal from "../components/MediaModal";

const isMobile = () => window.innerWidth <= 768;
const ffmpeg = new FFmpeg();

const Home = () => {
  const CLOUD_NAME = process.env.REACT_APP_CLOUDINARY_CLOUD_NAME || "demo";
  const UPLOAD_PRESET =
    process.env.REACT_APP_CLOUDINARY_UPLOAD_PRESET || "chat_media";
  const FOLDER_NAME = process.env.REACT_APP_CLOUDINARY_FOLDER;

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
  const [mediaFile, setMediaFile] = useState(null);
  const [mediaPreview, setMediaPreview] = useState(null);
  const [mediaType, setMediaType] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [loadingText, setLoadingText] = useState("");
  const [showFileSizeError, setShowFileSizeError] = useState(false);
  const [showMediaModal, setShowMediaModal] = useState(false);
  const [modalMedia, setModalMedia] = useState(null);
  const [uploadError, setUploadError] = useState(null);

  const fileInputRef = useRef(null);
  const chatBodyRef = useRef(null);

  const scrollToBottom = () => {
    if (chatBodyRef.current) {
      chatBodyRef.current.scrollTop = chatBodyRef.current.scrollHeight;
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [chats, selectedUser]);

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
    const loadFFmpeg = async () => {
      try {
        if (!ffmpeg.loaded) {
          await ffmpeg.load();
          console.log("FFmpeg loaded successfully");
        }
      } catch (err) {
        console.error("Failed to load FFmpeg:", err);
      }
    };

    loadFFmpeg();
  }, []);

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
    setText("");
    setMediaFile(null);
    setMediaPreview(null);
    setMediaType(null);

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

const handleFileSelect = (e) => {
  const file = e.target.files[0];
  if (!file) return;

  if (file.size > 100 * 1024 * 1024) {
    setShowFileSizeError(true);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    return;
  }

  setMediaFile(file);

  if (file.type.startsWith("image/")) {
    setMediaType("image");
    setMediaPreview(URL.createObjectURL(file));
  } else if (file.type.startsWith("video/")) {
    setMediaType("video");
    setMediaPreview(URL.createObjectURL(file));
  } else if (file.type.startsWith("audio/")) {
    setMediaType("audio");
    setMediaPreview(URL.createObjectURL(file));
  } else {
    const ext = file.name.split(".").pop().toLowerCase();
    if (ext === "pdf") {
      setMediaType("pdf");
      setMediaPreview(URL.createObjectURL(file));
    } else if (["doc", "docx", "ppt", "pptx", "xls", "xlsx"].includes(ext)) {
      setMediaType("office");
      setMediaPreview(URL.createObjectURL(file));
    } else {
      setMediaType("file");
      setMediaPreview(null);
    }
  }
};


  const removeMedia = () => {
    setMediaFile(null);
    setMediaPreview(null);
    setMediaType(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

const handleSend = async () => {
  if (!text.trim() && !mediaFile) return;

  const chatId =
    currentUser.uid > selectedUser.uid
      ? currentUser.uid + selectedUser.uid
      : selectedUser.uid + currentUser.uid;

  setUploading(true);
  setLoadingText(mediaType === "video" ? "Compressing..." : "Sending...");

  let processedFile = mediaFile;

  // --- Image compression ---
  if (mediaType === "image" && mediaFile) {
    try {
      const options = { maxSizeMB: 1, maxWidthOrHeight: 1280, useWebWorker: true };
      processedFile = await imageCompression(mediaFile, options);
    } catch (err) {
      console.error("Image compression failed; sending original.", err);
      processedFile = mediaFile;
    }
  }

  // --- Video compression (ffmpeg) ---
  if (mediaType === "video" && mediaFile) {
    try {
      if (!ffmpeg.loaded) {
        setLoadingText("Loading compressor...");
        await ffmpeg.load();
      }
      setLoadingText("Compressing video...");

      const data = await mediaFile.arrayBuffer();
      // write/read using FFmpeg API compatible methods
      // depending on ffmpeg wrapper usage: using writeFile/readFile or FS as in examples
      // if your ffmpeg instance exposes writeFile/readFile use those. Below assumes writeFile/exec/readFile.
      ffmpeg.writeFile("input.mp4", new Uint8Array(data));

      await ffmpeg.exec([
        "-i","input.mp4",
        "-vf","scale='min(640,iw)':-2",
        "-r","15",
        "-c:v","libx264",
        "-preset","fast",
        "-crf","28",
        "-maxrate","1M",
        "-bufsize","2M",
        "-c:a","aac",
        "-b:a","64k",
        "-y","output.mp4",
      ]);

      const output = await ffmpeg.readFile("output.mp4");
      if (output && output.length < mediaFile.size) {
        const blob = new Blob([output.buffer], { type: "video/mp4" });
        processedFile = new File([blob], "compressed.mp4", { type: "video/mp4" });
        console.log("Video compressed successfully");
      } else {
        console.log("Compression didn't reduce size; using original");
        processedFile = mediaFile;
      }

      // optional cleanup
      try {
        ffmpeg.unlink && ffmpeg.unlink("input.mp4");
        ffmpeg.unlink && ffmpeg.unlink("output.mp4");
      } catch {}
    } catch (err) {
      console.error("Video compression failed; sending original.", err);
      processedFile = mediaFile;
    }
  }

  setLoadingText("Uploading...");

  let mediaUrl = null;
  try {
    if (processedFile) {
      const ext = processedFile?.name?.split(".").pop()?.toLowerCase();
      const isPdf = ext === "pdf";

      // pick endpoint based on file type:
      const endpoint = isPdf
        ? `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/raw/upload`
        : `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/auto/upload`;

      const formData = new FormData();
      formData.append("file", processedFile);
      formData.append("upload_preset", UPLOAD_PRESET);
      formData.append("folder", FOLDER_NAME || "uat_chat");

      // For PDFs we use the raw endpoint (above). DO NOT append access_mode for unsigned uploads.
      if (isPdf) {
        // optional: you can append resource_type but calling raw/upload is enough:
        // formData.append('resource_type', 'raw');
      }

      const response = await axios.post(endpoint, formData, {
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total) {
            const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            setLoadingText(`Uploading: ${percent}%`);
          }
        },
      });

      console.log("cloudinary upload response", response.data);
      mediaUrl = response.data.secure_url || response.data.url;
      if (!mediaUrl) throw new Error("No media URL returned by Cloudinary");
    }
  } catch (err) {
    console.error("Upload failed:", err);
    // Show Cloudinary error details if present
    const cloudErr = err?.response?.data?.error?.message || err.message;
    setUploadError(cloudErr);
    setUploading(false);
    setLoadingText("");
    return;
  }

  // Build message and write to Firestore
  const newMessage = {
    id: Date.now(),
    text,
    senderId: currentUser.uid,
    date: new Date(),
    readBy: [currentUser.uid],
    ...(mediaUrl && { mediaUrl, mediaType, fileName: processedFile?.name }),
  };

  try {
    const chatDocRef = doc(db, "chats", chatId);

    await updateDoc(chatDocRef, {
      messages: arrayUnion(newMessage),
      lastMessage: {
        text:
          text ||
          (mediaType === "image"
            ? "📷 Image"
            : mediaType === "video"
            ? "🎥 Video"
            : mediaType === "audio"
            ? "🎵 Audio"
            : "📎 File"),
        senderId: currentUser.uid,
        date: new Date(),
        mediaUrl: mediaUrl || null,
        mediaType: mediaType || null,
      },
    });

    const userChatUpdates = {
      [`${chatId}.lastMessage`]: {
        text: text || (mediaType === "image" ? "📷 Image" : "🎥 Video"),
        senderId: currentUser.uid,
        date: new Date(),
        mediaUrl: mediaUrl || null,
        mediaType: mediaType || null,
      },
    };

    await updateDoc(doc(db, "userChats", currentUser.uid), userChatUpdates);
    await updateDoc(doc(db, "userChats", selectedUser.uid), userChatUpdates);

    // Reset UI
    setText("");
    setMediaFile(null);
    setMediaPreview(null);
    setMediaType(null);
    if (fileInputRef?.current) fileInputRef.current.value = "";
    setUploading(false);
    setLoadingText("");
  } catch (err) {
    console.error("Message send failed:", err);
    setUploading(false);
    setLoadingText("");
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

  const getFileIcon = (fileName = "") => {
    const ext = fileName.split(".").pop().toLowerCase();

    switch (ext) {
      case "pdf":
        return <FaFilePdf size={24} color="#e53935" />;
      case "doc":
      case "docx":
        return <FaFileWord size={24} color="#1e88e5" />;
      case "xls":
      case "xlsx":
        return <FaFileExcel size={24} color="#43a047" />;
      case "ppt":
      case "pptx":
        return <FaFilePowerpoint size={24} color="#e64a19" />;
      case "jpg":
      case "jpeg":
      case "png":
      case "gif":
        return <FaFileImage size={24} color="#fbc02d" />;
      case "mp4":
      case "mov":
      case "avi":
        return <FaFileVideo size={24} color="#8e24aa" />;
      case "mp3":
      case "wav":
      case "aac":
      case "ogg":
        return <FaMusic size={24} color="#ff9800" />; 
      default:
        return <FaFileAlt size={24} color="#757575" />;
    }
  };

const renderMediaContent = (msg) => {
  if (!msg.mediaUrl) return null;

const handleOpenModal = async () => {
  const isMobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);

  if (msg.mediaType === "pdf" && isMobile) {
    try {
      const res = await fetch(msg.mediaUrl, { mode: "cors" });
      if (!res.ok) throw new Error("Failed to fetch PDF");

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = msg.fileName || "download.pdf";
      document.body.appendChild(a);
      a.click();
      a.remove();

      // cleanup
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch (err) {
      console.error("PDF download failed", err);
      // fallback → open in same tab
      window.open(msg.mediaUrl, "_blank");
    }
    return;
  }

  // Desktop → normal preview
  setModalMedia({
    url: msg.mediaUrl,
    type: msg.mediaType,
    fileName: msg.fileName,
  });
  setShowMediaModal(true);
};



  if (msg.mediaType === "image") {
    return (
      <img
        src={msg.mediaUrl}
        alt="Shared media"
        className="chat-media"
        style={{ cursor: "pointer" }}
        onClick={handleOpenModal}
      />
    );
  }

  if (msg.mediaType === "video") {
    return (
      <video
        src={msg.mediaUrl}
        className="chat-media"
        controls
        style={{ cursor: "pointer" }}
      />
    );
  }

  if (msg.mediaType === "audio") {
    return (
      <div className="audio-message" onClick={handleOpenModal}>
        <div className="audio-inner">
          <audio controls>
            <source src={msg.mediaUrl} type="audio/mpeg" />
          </audio>
        </div>
      </div>
    );
  }

  return (
    <div className="file-message" onClick={handleOpenModal}>
      <div className="file-icon">{getFileIcon(msg.fileName)}</div>
      <span className="file-name">{msg.fileName}</span>
    </div>
  );
};

  return (
    <div className="chat-app">
      {uploading && (
        <div className="loader-overlay">
          <div className="loader"></div>
          <p>{loadingText}</p>
          {mediaType === "video" && (
            <p className="compression-note">
              Video compression may take a minute...
            </p>
          )}
        </div>
      )}

      {showFileSizeError && (
        <div className="overlay">
          <div className="overlay-content">
            <div className="overlay-icon">⚠️</div>
            <h2>File Too Large</h2>
            <p>
              The selected file exceeds the 100 MB limit. Please choose a smaller
              file.
            </p>
            <button onClick={() => setShowFileSizeError(false)}>OK</button>
          </div>
        </div>
      )}

      {uploadError && (
        <div className="overlay">
          <div className="overlay-content">
            <div className="overlay-icon">❌</div>
            <h2>Upload Failed</h2>
            <p>{uploadError}</p>
            <button onClick={() => setUploadError(null)}>OK</button>
          </div>
        </div>
      )}
      
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
        <div
          className="mobile-modal"
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "#fff",
            zIndex: 1000,
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* Header */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              padding: "16px",
              backgroundColor: "#9b1c1c",
              color: "white",
              gap: "12px",
            }}
          >
            <button
              onClick={() => setShowSidebar(false)}
              style={{
                background: "none",
                border: "none",
                padding: "0",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <FaArrowLeft size={20} color="#fff" />
            </button>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                flex: 1,
                minWidth: 0,
                overflow: "hidden",
                gap: "12px",
              }}
            >
              <div style={{ flexShrink: 0 }}>
                <FaUserCircle size={36} />
              </div>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  lineHeight: 1.3,
                  overflow: "hidden",
                  flex: 1,
                  minWidth: 0,
                }}
              >
                <div
                  style={{
                    fontWeight: "bold",
                    color: "#fff",
                    fontSize: "16px",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {currentUser?.displayName}
                </div>
                <div
                  style={{
                    fontSize: "13px",
                    color: "#eee",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    marginTop: "2px",
                  }}
                >
                  {currentUser?.email}
                </div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    marginTop: "4px",
                  }}
                >
                  <span
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: "50%",
                      backgroundColor: "#4caf50",
                      display: "inline-block",
                      flexShrink: 0,
                    }}
                  ></span>
                  <span
                    style={{
                      fontSize: "12px",
                      color: "#4caf50",
                      fontWeight: "bold",
                    }}
                  >
                    Online
                  </span>
                </div>
              </div>
            </div>
            <button
              onClick={handleLogout}
              style={{
                background: "none",
                border: "none",
                padding: "0",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <FiLogOut size={22} color="#fff" />
            </button>
          </div>

          {/* Search */}
          <div
            style={{
              padding: "16px",
              position: "relative",
              backgroundColor: "#f5f5f5",
            }}
          >
            <input
              type="text"
              placeholder="Search users..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                width: "100%",
                padding: "12px 45px 12px 16px",
                borderRadius: "25px",
                border: "1px solid #ddd",
                fontSize: "15px",
                outline: "none",
              }}
            />
            <span
              style={{
                position: "absolute",
                right: "30px",
                top: "50%",
                transform: "translateY(-50%)",
                color: "#999",
                fontSize: "18px",
              }}
            >
              🔍
            </span>
          </div>

          {/* User List */}
          <div
            style={{
              overflowY: "auto",
              flex: 1,
              backgroundColor: "#fff",
            }}
          >
            {users.map((user) => (
              <div
                key={user.uid}
                onClick={() => handleSelectUser(user)}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "16px",
                  borderBottom: "1px solid #f0f0f0",
                  cursor: "pointer",
                  backgroundColor: "#fff",
                  counterReset: "none", // Explicitly reset any counters
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "16px",
                    flex: 1,
                    minWidth: 0,
                  }}
                >
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: "50%",
                      backgroundColor: "#9b1c1c",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                      color: "white",
                      fontWeight: "bold",
                      fontSize: "18px",
                    }}
                  >
                    {user.displayName?.charAt(0)?.toUpperCase() || "U"}
                  </div>
                  <div
                    style={{
                      fontWeight: 500,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      flex: 1,
                      minWidth: 0,
                      fontSize: "16px",
                      color: "#333",
                    }}
                  >
                    {user.displayName}
                  </div>
                </div>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "flex-end",
                    gap: "4px",
                    flexShrink: 0,
                    marginLeft: "12px",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                    }}
                  >
                    <span
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: "50%",
                        backgroundColor: user.isOnline ? "#4caf50" : "#9e9e9e",
                        display: "inline-block",
                        flexShrink: 0,
                      }}
                    ></span>
                    <span
                      style={{
                        fontSize: "13px",
                        color: user.isOnline ? "#4caf50" : "#9e9e9e",
                        whiteSpace: "nowrap",
                        fontWeight: "500",
                      }}
                    >
                      {user.isOnline ? "Online" : "Offline"}
                    </span>
                  </div>
                  <div
                    style={{
                      fontSize: "12px",
                      color: "#666",
                      whiteSpace: "nowrap",
                    }}
                  >
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
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                    }}
                  >
                    {selectedUser.displayName}
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        backgroundColor: selectedUser.isOnline
                          ? "#4caf50"
                          : "#9e9e9e",
                        display: "inline-block",
                      }}
                    ></span>
                  </h3>
                  <small
                    style={{
                      color: selectedUser.isOnline ? "#4caf50" : "#9e9e9e",
                      fontSize: "11px",
                    }}
                  >
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
                    color: "white",
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
          <div className="chat-body scrollable-chat-body" ref={chatBodyRef}>
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
                  {renderMediaContent(msg)}
                  {msg.text && <div className="message-text">{msg.text}</div>}
                </div>
              </div>
            ))}
          </div>
        </div>
        {selectedUser && (
          <div className="chat-input-wrapper">
            {mediaPreview && (
              <div className="media-preview">
                {mediaType === "image" && (
                  <img
                    src={mediaPreview}
                    alt="Preview"
                    className="preview-image"
                  />
                )}

                {mediaType === "video" && (
                  <video
                    src={mediaPreview}
                    controls
                    className="preview-video"
                  />
                )}
                {mediaType === "audio" && (
                  <audio src={mediaPreview} controls className="preview-audio" />
                )}
                {["pdf", "office", "file"].includes(mediaType) && (
                  <div className="preview-file">
                    {getFileIcon(mediaFile?.name)}
                    <span className="file-name-preview">
                      {mediaFile?.name?.length > 20
                        ? mediaFile.name.substring(0, 20) + "..."
                        : mediaFile?.name}
                    </span>
                  </div>
                )}

                <button className="remove-media-btn" onClick={removeMedia}>
                  <IoMdClose size={16} />
                </button>
              </div>
            )}

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
                disabled={uploading}
              />
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileSelect}
                accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.txt,.xls,.xlsx,.ppt,.pptx,.mp3,.wav"
                style={{ display: "none" }}
                id="file-input"
                disabled={uploading}
              />
              <label htmlFor="file-input" className="attach-file-btn">
                <MdAttachFile size={24} color="#9b1c1c" />
              </label>
              {(text.length > 0 || mediaFile) && (
                <span
                  className="send-icon-inside"
                  title="Send"
                  onClick={handleSend}
                  style={{ opacity: uploading ? 0.5 : 1 }}
                >
                  <IoMdSend size={20} color="#fff" />
                </span>
              )}
            </div>
          </div>
        )}
      </div>
      <MediaModal
        isOpen={showMediaModal}
        onClose={() => setShowMediaModal(false)}
        mediaUrl={modalMedia?.url}
        mediaType={modalMedia?.type}
        fileName={modalMedia?.fileName}
      />
    </div>
  );
};

export default Home;
