import { useState, useEffect } from "react";
import { getDatabase, ref, push, onValue } from "firebase/database";

export default function Records() {
    const [title, setTitle] = useState("");
    const [content, setContent] = useState("");
    const [extra, setExtra] = useState("");
    const [records, setRecords] = useState([]);
    const db = getDatabase();

    useEffect(() => {
        const recordsRef = ref(db, "records");
        onValue(recordsRef, (snapshot) => {
            const data = snapshot.val();
            if (data) {
                setRecords(Object.entries(data).map(([key, val]) => ({ id: key, ...val })));
            } else {
                setRecords([]);
            }
        });
    }, [db]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!title || !content) return;

        await push(ref(db, "records"), {
            title,
            content,
            extra,
            createdAt: new Date().toISOString()
        });

        setTitle("");
        setContent("");
        setExtra("");
        alert("기록이 저장되었습니다.");
    };

    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold text-gray-800">📝 기록 관리</h2>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Input Form */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 h-fit">
                    <h3 className="text-lg font-semibold mb-4 text-gray-700">새 기록 작성</h3>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">제목</label>
                            <input
                                type="text"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                className="w-full rounded-xl border border-gray-200 p-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                placeholder="제목을 입력하세요"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">내용</label>
                            <textarea
                                value={content}
                                onChange={(e) => setContent(e.target.value)}
                                className="w-full rounded-xl border border-gray-200 p-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none h-32 resize-none"
                                placeholder="내용을 입력하세요"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">추가 내용</label>
                            <input
                                type="text"
                                value={extra}
                                onChange={(e) => setExtra(e.target.value)}
                                className="w-full rounded-xl border border-gray-200 p-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                placeholder="선택 사항"
                            />
                        </div>
                        <button type="submit" className="w-full bg-indigo-600 text-white py-3 rounded-xl font-medium hover:bg-indigo-500 transition-all">
                            저장하기
                        </button>
                    </form>
                </div>

                {/* List View */}
                <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-gray-700">기록 목록</h3>
                    {records.length === 0 ? (
                        <div className="text-center py-10 text-gray-400 bg-white rounded-2xl border border-dashed border-gray-200">
                            기록이 없습니다.
                        </div>
                    ) : (
                        records.map((rec) => (
                            <div key={rec.id} className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                                <h4 className="font-bold text-gray-800 text-lg mb-2">{rec.title}</h4>
                                <p className="text-gray-600 text-sm mb-3 whitespace-pre-wrap">{rec.content}</p>
                                {rec.extra && (
                                    <div className="bg-gray-50 px-3 py-2 rounded-lg text-xs text-gray-500">
                                        💡 추가: {rec.extra}
                                    </div>
                                )}
                                <div className="mt-3 text-right text-xs text-gray-400">
                                    {new Date(rec.createdAt).toLocaleString()}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
