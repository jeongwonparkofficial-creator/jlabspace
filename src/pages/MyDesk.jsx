import { useState } from "react";
import { updateProfile } from "firebase/auth";
import { useAuth } from "../context/AuthContext";

export default function MyDesk() {
    const { user } = useAuth();
    const [name, setName] = useState(user?.displayName || "");
    const [msg, setMsg] = useState("");

    const handleUpdate = async (e) => {
        e.preventDefault();
        if (!user) return;

        try {
            await updateProfile(user, { displayName: name });
            setMsg("프로필이 업데이트되었습니다.");
        } catch (error) {
            console.error(error);
            setMsg("오류가 발생했습니다.");
        }
    };

    return (
        <div className="max-w-2xl mx-auto">
            <h2 className="text-2xl font-bold text-gray-800 mb-6">👤 마이데스크</h2>

            <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
                <div className="flex items-center gap-6 mb-8">
                    <div className="h-24 w-24 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 text-3xl font-bold">
                        {user?.displayName ? user.displayName[0].toUpperCase() : "U"}
                    </div>
                    <div>
                        <h3 className="text-xl font-bold text-gray-900">{user?.displayName || "사용자"}</h3>
                        <p className="text-gray-500">{user?.email}</p>
                    </div>
                </div>

                <form onSubmit={handleUpdate} className="space-y-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">이름 / 닉네임</label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full rounded-xl border border-gray-200 p-3 outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                    </div>

                    <button className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-medium hover:bg-indigo-500 transition-colors">
                        변경사항 저장
                    </button>

                    {msg && <p className="text-green-600 text-sm mt-2">{msg}</p>}
                </form>
            </div>
        </div>
    );
}
