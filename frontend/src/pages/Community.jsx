import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import CommunityFeed from "../components/community/CommunityFeed";
import { getStoredRole, hasAuthFor } from "../utils/authState";

export default function Community() {
  const navigate = useNavigate();
  const role = getStoredRole();

  useEffect(() => {
    if (!hasAuthFor(["ANO", "SUO", "CADET", "ALUMNI"])) {
      navigate("/", { replace: true });
    }
  }, [navigate]);

  const handleBackToDashboard = () => {
    const dashboardByRole = {
      ANO: "/ano",
      SUO: "/suo-dashboard",
      CADET: "/dashboard",
      ALUMNI: "/alumni-dashboard",
    };
    const target = dashboardByRole[role];
    if (target) {
      navigate(target);
      return;
    }
    navigate(-1);
  };

  return (
    <div className="community-page-shell">
      <div className="community-topbar">
        <button type="button" className="community-back-btn" onClick={handleBackToDashboard}>
          <ArrowLeft size={16} />
          Back to Dashboard
        </button>
      </div>
      <CommunityFeed />
    </div>
  );
}
