import { useEffect } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function ProtectedRoute({ children }) {
    const { currentUser } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
        if (!currentUser) {
            alert("현재 로그인 기록이 없습니다. 로그인 후 다시 시도 하세요.");
            navigate("/");
        }
    }, [currentUser, navigate]);

    if (!currentUser) {
        return null; // Render nothing while redirecting
    }

    return children;
}
