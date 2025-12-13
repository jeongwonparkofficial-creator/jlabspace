import { useState, useEffect } from "react";
import { getDatabase, ref, onValue, update, remove, set } from "firebase/database";

export default function Mode() {
    const [users, setUsers] = useState([]);
    const [searchTerm, setSearchTerm] = useState("");
    const db = getDatabase();

    useEffect(() => {
        const usersRef = ref(db, "users");
        onValue(usersRef, (snapshot) => {
            const data = snapshot.val();
            if (data) {
                setUsers(Object.entries(data).map(([key, val]) => ({ uid: key, ...val })));
            } else {
                setUsers([]);
            }
        });
    }, [db]);

    const handlePoints = async (uid, currentPoints, amount) => {
        const newPoints = (currentPoints || 0) + amount;
        try {
            await update(ref(db, `users/${uid}`), { points: newPoints });
        } catch (err) {
            alert("포인트 수정 실패: " + err.message);
        }
    };

    const handleDelete = async (uid) => {
        if (!window.confirm("정말로 이 회원을 삭제하시겠습니까? (DB 데이터만 삭제됩니다)")) return;
        try {
            await remove(ref(db, `users/${uid}`));
        } catch (err) {
            alert("삭제 실패: " + err.message);
        }
    };

    // Simple "Add Member" by creating a DB record (NOT Auth)
    const handleAddMember = async () => {
        const name = prompt("이름을 입력하세요:");
        if (!name) return;
        const id = prompt("아이디를 입력하세요:");
        const phone = prompt("전화번호를 입력하세요:");

        // Create a fake UID for manual entry
        const fakeUid = "manual_" + Date.now();
        try {
            await set(ref(db, `users/${fakeUid}`), {
                name,
                username: id,
                phone,
                points: 0,
                manualEntry: true,
                createdAt: new Date().toISOString()
            });
        } catch (err) {
            alert("추가 실패: " + err.message);
        }
    };

    const filteredUsers = users.filter(u =>
        u.name?.includes(searchTerm) || u.username?.includes(searchTerm) || u.phone?.includes(searchTerm)
    );

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center flex-wrap gap-4">
                <h2 className="text-2xl font-bold text-gray-800">👑 회원 관리 (Mode)</h2>
                <div className="flex gap-2">
                    <input
                        type="text"
                        placeholder="이름/ID 검색..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="px-4 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <button onClick={handleAddMember} className="bg-green-600 text-white px-4 py-2 rounded-xl hover:bg-green-500 text-sm font-bold">
                        + 회원 추가
                    </button>
                </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-gray-600">
                        <thead className="bg-gray-50 text-gray-700 uppercase font-semibold">
                            <tr>
                                <th className="px-6 py-4">이름</th>
                                <th className="px-6 py-4">아이디 (Username)</th>
                                <th className="px-6 py-4">전화번호</th>
                                <th className="px-6 py-4">포인트</th>
                                <th className="px-6 py-4">가입일</th>
                                <th className="px-6 py-4 text-center">관리</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {filteredUsers.length === 0 ? (
                                <tr><td colSpan="6" className="text-center py-10">회원이 없습니다.</td></tr>
                            ) : (
                                filteredUsers.map((u) => (
                                    <tr key={u.uid} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-6 py-4 font-medium text-gray-900">{u.name}</td>
                                        <td className="px-6 py-4">{u.username}</td>
                                        <td className="px-6 py-4">{u.phone}</td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                <span className="font-bold text-indigo-600">{u.points || 0} P</span>
                                                <div className="flex flex-col gap-0.5">
                                                    <button onClick={() => handlePoints(u.uid, u.points, 100)} className="text-[10px] bg-gray-100 px-1.5 rounded hover:bg-gray-200">▲</button>
                                                    <button onClick={() => handlePoints(u.uid, u.points, -100)} className="text-[10px] bg-gray-100 px-1.5 rounded hover:bg-gray-200">▼</button>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-xs">{new Date(u.createdAt).toLocaleDateString()}</td>
                                        <td className="px-6 py-4 text-center">
                                            <button onClick={() => handleDelete(u.uid)} className="text-red-500 hover:text-red-700 font-medium text-xs border border-red-200 bg-red-50 px-3 py-1.5 rounded-lg">
                                                삭제
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
