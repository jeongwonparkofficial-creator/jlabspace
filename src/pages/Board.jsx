import { useState, useEffect } from "react";
import { getDatabase, ref, push, onValue, serverTimestamp } from "firebase/database";
import { useAuth } from "../context/AuthContext";

export default function Board() {
    const { user } = useAuth();
    const [posts, setPosts] = useState([]);
    const [title, setTitle] = useState("");
    const [content, setContent] = useState("");
    const [isWriting, setIsWriting] = useState(false);
    const db = getDatabase();

    useEffect(() => {
        const postsRef = ref(db, "posts");
        onValue(postsRef, (snapshot) => {
            const data = snapshot.val();
            if (data) {
                setPosts(Object.entries(data).map(([key, val]) => ({ id: key, ...val })).reverse());
            } else {
                setPosts([]);
            }
        });
    }, [db]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!title || !content) return;

        try {
            await push(ref(db, "posts"), {
                title,
                content,
                author: user.displayName || user.email,
                uid: user.uid,
                createdAt: new Date().toISOString()
            });
            setTitle("");
            setContent("");
            setIsWriting(false);
        } catch (error) {
            alert("글 작성 실패: " + error.message);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-gray-800">📋 게시판</h2>
                <button
                    onClick={() => setIsWriting(!isWriting)}
                    className="bg-indigo-600 text-white px-4 py-2 rounded-xl hover:bg-indigo-500 transition-colors"
                >
                    {isWriting ? "목록으로" : "글쓰기"}
                </button>
            </div>

            {isWriting ? (
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 animate-fade-in-up">
                    <h3 className="text-lg font-bold mb-4">새 게시글 작성</h3>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <input
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="제목 (Title)"
                            className="w-full rounded-xl border border-gray-200 p-3 outline-none focus:ring-2 focus:ring-indigo-500"
                            required
                        />
                        <textarea
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                            placeholder="내용을 입력하세요..."
                            className="w-full h-64 rounded-xl border border-gray-200 p-3 outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                            required
                        />
                        <button className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-500">
                            작성 완료
                        </button>
                    </form>
                </div>
            ) : (
                <div className="space-y-4">
                    {posts.length === 0 ? (
                        <div className="text-center py-20 bg-white rounded-2xl border border-dashed text-gray-400">
                            게시글이 없습니다. 첫 글을 작성해보세요!
                        </div>
                    ) : (
                        posts.map(post => (
                            <div key={post.id} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-all">
                                <div className="flex justify-between items-start mb-2">
                                    <h3 className="text-lg font-bold text-gray-800">{post.title}</h3>
                                    <span className="text-xs text-gray-400">{new Date(post.createdAt).toLocaleDateString()}</span>
                                </div>
                                <p className="text-gray-600 whitespace-pre-wrap mb-4 line-clamp-3">{post.content}</p>
                                <div className="text-xs text-gray-500 font-medium">
                                    작성자: {post.author}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}
        </div>
    );
}
