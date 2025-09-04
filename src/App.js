// App.jsx
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login";
import Home from "./pages/Home";
import { AuthContextProvider, AuthContext } from "./context/AuthContext";
import { useContext } from "react";
import Register from "./pages/Register";
import { useAutoLogout } from "./hooks/useAutoLogout";

function App() {
  const { currentUser } = useContext(AuthContext);
  useAutoLogout();

  return (
    <AuthContextProvider>
      <BrowserRouter basename="/Chat-App-Uat">
        <Routes>
          <Route
            path="/"
            element={currentUser ? <Home /> : <Navigate to="/login" />}
          />
          <Route
            path="/login"
            element={!currentUser ? <Login /> : <Navigate to="/" />}
          />
          <Route
            path="/register"
            element={!currentUser ? <Register /> : <Navigate to="/" />}
          />
        </Routes>
      </BrowserRouter>
    </AuthContextProvider>
  );
}

export default App;
