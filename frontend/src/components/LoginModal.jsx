import LoginPage from "./LoginPage";

const LoginModal = ({ onClose }) => {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button className="modal-close1" onClick={onClose}>
          ✕
        </button>

        {/* SAME LOGIN PAGE */}
        <LoginPage />
      </div>
    </div>
  );
};

export default LoginModal;
