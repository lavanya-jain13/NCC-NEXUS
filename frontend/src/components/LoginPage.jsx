import { useState } from "react";
import {
  FaIdBadge,
  FaMedal,
  FaEnvelope,
  FaLock,
} from "react-icons/fa";
import "/src/index.css";
import nccLogo from "./assets/ncc-logo.png";
import ResetPasswordModal from "./ResetPasswordModal"; // ✅ ADD THIS

const LoginPage = () => {
  const [role, setRole] = useState("SUO");
  const [showReset, setShowReset] = useState(false); // ✅ ADD STATE

  return (
    <div className="login-page">
      <div className="login-card">
        {/* LIGHT OVERLAY FOR RIGHT-SIDE GLOW */}
        <span className="card-glow" />

        {/* LOGO CENTER */}
        <img src={nccLogo} alt="NCC Logo" className="login-logo" />
        <h1 className="login-title">NCC NEXUS</h1>

        <div className="login-form">
          <div className="input-group">
            <FaIdBadge className="input-icon" />
            <input type="text" placeholder="COLLEGE ID" />
          </div>

          <div className="input-group">
            <FaMedal className="input-icon" />
            <input type="text" placeholder="REGIMENTAL NUMBER" />
          </div>

          <div className="input-group">
            <FaEnvelope className="input-icon" />
            <input type="email" placeholder="EMAIL ADDRESS" />
          </div>

          <div className="input-group">
            <FaLock className="input-icon" />
            <input type="password" placeholder="PASSWORD" />
          </div>

          {/* ROLE SWITCH */}
          <div className="role-select">
            {["CADET", "SUO", "ALUMNI"].map((item) => (
              <button
                key={item}
                className={role === item ? "active" : ""}
                onClick={() => setRole(item)}
                type="button"
              >
                {item}
              </button>
            ))}
          </div>

          <button className="login-btn">LOGIN</button>

          {/* ✅ RESET PASSWORD LINK */}
          <p
            className="reset-link"
            onClick={() => setShowReset(true)}
          >
            RESET PASSWORD?
          </p>
        </div>
      </div>

      {/* ✅ RESET PASSWORD POPUP */}
      {showReset && (
        <ResetPasswordModal onClose={() => setShowReset(false)} />
      )}
    </div>
  );
};

export default LoginPage;
