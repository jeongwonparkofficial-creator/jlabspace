import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Sidebar() {
    const { user, logout } = useAuth();
    const location = useLocation();

    const menuItems = [
        { name: "오피스톡", path: "/main/office-talk", icon: "💬" },
        { name: "기록", path: "/main/records", icon: "📝" },
        { name: "적립", path: "/main/point", icon: "💰" },
        { name: "게시판", path: "/main/board", icon: "📋" },
        { name: "멀티디바이스 모드", path: "/main/multi-device", icon: "🖥️" },
        { name: "마이데스크", path: "/main/mydesk", icon: "👤" },
        { name: "문서관리", path: "/main/docs", icon: "📂" },
        { name: "모드", path: "/main/mode", icon: "⚙️" },
    ];

    const isActive = (path) => location.pathname === path;

    return (
        <div className="flex flex-col h-screen w-64 bg-[#1a1c23] text-white flex-shrink-0 transition-all duration-300">
            {/* Top Logo */}
            <div className="p-6 flex items-center justify-center">
                <img
                    src="/logos/memu.png"
                    alt="Eden Logo"
                    className="h-5 w-auto object-contain"
                    onError={(e) => { e.target.onerror = null; e.target.src = "/logos/logo.png" }}
                />
            </div>

            {/* Menu Items */}
            <nav className="flex-1 px-4 space-y-2 overflow-y-auto">
                <div className="mb-6 relative">
                    <input type="text" placeholder="Search..." className="w-full bg-[#252836] text-sm text-gray-300 rounded-lg px-4 py-3 pl-10 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all" />
                    <span className="absolute left-3 top-3.5 text-gray-500">🔍</span>
                </div>

                {menuItems.map((item) => (
                    <Link
                        key={item.path}
                        to={item.path}
                        className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${isActive(item.path)
                            ? "bg-indigo-600 text-white shadow-lg shadow-indigo-900/50 translate-x-1"
                            : "text-gray-400 hover:bg-[#252836] hover:text-gray-100 hover:translate-x-1"
                            }`}
                    >
                        <span className="text-lg">{item.icon}</span>
                        {item.name}
                    </Link>
                ))}
            </nav>

            {/* User Profile (Bottom) */}
            <div className="p-4 border-t border-[#2d303e]">
                <div className="flex items-center gap-3 p-2 rounded-xl hover:bg-[#252836] transition-colors cursor-pointer group">
                    <div className="h-10 w-10 rounded-full bg-indigo-500 flex items-center justify-center text-white font-bold text-lg">
                        {user?.displayName ? user.displayName[0].toUpperCase() : (user?.email ? user.email[0].toUpperCase() : 'U')}
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate group-hover:text-white transition-colors">
                            {user?.displayName || "사용자"}
                        </p>
                        <Link to="/main/mode" className="block text-gray-700 font-bold mb-2 p-2 hover:bg-gray-100 rounded flex items-center gap-2">
                            <span className="text-xl">👥</span>
                            회원
                        </Link>
                        {user?.uid && (
                            <Link to={`/point-device?uid=${user.uid}`} target="_blank" className="block text-gray-500 font-medium mb-2 p-2 hover:bg-gray-100 rounded flex items-center gap-2 ml-4">
                                <span className="text-lg">📱</span>
                                디바이스 모드
                            </Link>
                        )}    </div>
                    <button onClick={logout} className="text-gray-500 hover:text-red-400 p-1" title="로그아웃">
                        🚪
                    </button>
                </div>
            </div>
        </div>
    );
}
