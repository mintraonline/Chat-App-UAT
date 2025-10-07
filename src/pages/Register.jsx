import { useState } from "react";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { auth, db } from "../../src/firebase";
import { doc, setDoc } from "firebase/firestore";
import { useNavigate, Link } from "react-router-dom";
import "./Register.css";

const Register = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");

  const navigate = useNavigate();
  const isValidUsername = (name) => /^[a-zA-Z0-9]{7}$/.test(name);

  const handleRegister = async () => {
    try {
      let isValid = !firstName || !lastName || !username || !email || !password
      if(isValid){
        alert('All Fields are mandatory')
        return
      }
      
      if (!isValidUsername(username)) {
        alert("Username must be exactly 7 alphanumeric characters.");
        return;
      }
      const res = await createUserWithEmailAndPassword(auth, email, password);
      const displayName = `${firstName} ${lastName}`;

      await updateProfile(res.user, {
        displayName: displayName,
      });
      await setDoc(doc(db, "users", res.user.uid), {
        uid: res.user.uid,
        firstName,
        lastName,
        username,
        displayName,
        email: res.user.email,
      });
      navigate("/");
    } catch (err) {
      console.error(err);
      alert("Registration failed. Try again.");
    }
  };

  return (
    <div className="register-container">
      <div className="dots-layer">
        {[...Array(80)].map((_, i) => (
          <span key={i} className={`dot dot-${i % 9}`} />
        ))}
      </div>
      <div className="register-box">
        <h2 className="register-title">Create an Account</h2>
        <input
          type="text"
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="register-input"
        />
        <input
          type="text"
          placeholder="First Name"
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
          className="register-input"
        />

        <input
          type="text"
          placeholder="Last Name"
          value={lastName}
          onChange={(e) => setLastName(e.target.value)}
          className="register-input"
        />
        
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="register-input"
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="register-input"
        />
        <button onClick={handleRegister} className="register-button">
          Register
        </button>
        <p className="register-footer">
          Already have an account?{" "}
          <Link to="/login" className="login-link">
            Login here
          </Link>
        </p>
      </div>
    </div>
  );
};

export default Register;
