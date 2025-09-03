import { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../firebase";
import { useNavigate } from "react-router-dom";
import "./Login.css";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPinPrompt, setShowPinPrompt] = useState(false);
  const [enteredPin, setEnteredPin] = useState("");
  const navigate = useNavigate();

  const ADMIN_PIN = process.env.REACT_APP_ADMIN_PIN


  const handleLogin = async () => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
      navigate("/");
    } catch (err) {
      console.log(err);
      alert("Invalid credentials");
    }
  };

  const handleAskAdminPin = () => {
    setShowPinPrompt(true);
  };

  const handleVerifyPin = () => {
    if (enteredPin === ADMIN_PIN) {
      navigate("/register");
    } else {
      alert("❌ Incorrect PIN. Only admins can register.");
      setEnteredPin("");
    }
  };

  return (
    <div className="login-background">
      <div className="dots-layer">
        {[...Array(80)].map((_, i) => (
          <span key={i} className={`dot dot-${i % 9}`} />
        ))}
      </div>
      <div className="login-container">
        <div className="login-box">
          <h2 className="login-title">Login</h2>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="login-input"
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="login-input"
          />

          <button onClick={handleLogin} className="login-button">
            Login
          </button>

          <p className="login-footer">
            New user?{" "}
            <span className="register-link" onClick={handleAskAdminPin}>
              Register here
            </span>
          </p>
        </div>

        {/* Admin PIN Modal */}
        {showPinPrompt && (
          <div className="pin-modal">
            <div className="pin-box">
              <h3>Admin Access</h3>
              <p>Enter 4-digit admin PIN</p>
              <input
                type="password"
                maxLength={4}
                value={enteredPin}
                onChange={(e) => setEnteredPin(e.target.value)}
                className="pin-input"
              />
              <div className="pin-actions">
                <button onClick={handleVerifyPin}>Submit</button>
                <button onClick={() => setShowPinPrompt(false)}>Cancel</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Login;
