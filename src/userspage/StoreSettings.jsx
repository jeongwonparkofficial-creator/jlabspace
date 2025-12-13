import { useState, useEffect } from "react";
import { getDatabase, ref, onValue, set } from "firebase/database";

export default function StoreSettings({ onClose }) {
    const [storeName, setStoreName] = useState("");
    const db = getDatabase();

    useEffect(() => {
        const storeRef = ref(db, "store/settings");
        onValue(storeRef, (snapshot) => {
            const data = snapshot.val();
            if (data && data.name) {
                setStoreName(data.name);
            }
        }, { onlyOnce: true });
    }, []);

    const handleSave = async () => {
        if (!storeName.trim()) return alert("가맹점 이름을 입력해주세요.");
        try {
            await set(ref(db, "store/settings"), { name: storeName });
            alert("저장되었습니다.");
            onClose();
        } catch (err) {
            alert("저장 실패: " + err.message);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded-2xl shadow-xl w-96 animate-fade-in-up">
                <h2 className="text-xl font-bold mb-4">가맹점 설정</h2>

                <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">가맹점 이름</label>
                    <input
                        type="text"
                        value={storeName}
                        onChange={(e) => setStoreName(e.target.value)}
                        className="w-full border rounded-xl p-3 focus:ring-2 focus:ring-indigo-500 outline-none"
                        placeholder="예: 정원랩 본점"
                    />
                    <p className="text-xs text-gray-400 mt-1">이 이름은 결제 메시지에 표시됩니다.</p>
                </div>

                <div className="flex justify-end gap-2">
                    <button onClick={onClose} className="px-4 py-2 text-gray-500 hover:bg-gray-100 rounded-lg">취소</button>
                    <button onClick={handleSave} className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-500">저장</button>
                </div>
            </div>
        </div>
    );
}
