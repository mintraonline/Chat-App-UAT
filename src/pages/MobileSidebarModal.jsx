// components/MobileSidebarModal.jsx
import React from "react";
import "./MobileSidebarModal.css";

const MobileSidebarModal = ({ isOpen, onClose, users = [] }) => {
  if (!isOpen) return null;

  return (
    <div className="mobile-sidebar-overlay">
      <div className="mobile-sidebar">
        <div className="header">
          <button className="back-btn" onClick={onClose}>←</button>
          <div className="user-info">
            <div className="avatar">
              <img src="/default-user.png" alt="User" />
              <span className="online-dot" />
            </div>
            <div className="details">
              <h3>Anil Dixit</h3>
              <p>SAP :70287733</p>
            </div>
          </div>
        </div>

        <div className="search-section">
          <input type="text" placeholder="Search" />
          <span className="search-icon">🔍</span>
        </div>

        <div className="user-list">
          {users.map((user, index) => (
            <div className="user-row" key={index}>
              <div className="user-avatar">
                <img src="/default-user.png" alt="avatar" />
                <span className="online-dot" />
              </div>
              <div className="user-text">
                <p>{user.name}</p>
                <span>{user.time}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default MobileSidebarModal;
