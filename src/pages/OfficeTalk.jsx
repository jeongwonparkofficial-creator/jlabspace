import { useState, useEffect, useRef } from "react";
import { getDatabase, ref, push, onValue, serverTimestamp } from "firebase/database";
import { useAuth } from "../context/AuthContext";

export default function OfficeTalk() {
    const { user } = useAuth();
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState("");
    const db = getDatabase();
    const bottomRef = useRef(null);

    useEffect(() => {
        const messagesRef = ref(db, "messages");
        const unsubscribe = onValue(messagesRef, (snapshot) => {
            const data = snapshot.val();
            if (data) {
                const messageList = Object.entries(data).map(([key, value]) => ({
                    id: key,
                    ...value,
                }));
                setMessages(messageList);
            } else {
                setMessages([]);
            }
        });

        return () => unsubscribe();
    }, [db]);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (!newMessage.trim()) return;

        await push(ref(db, "messages"), {
            text: newMessage,
            sender: user.displayName || user.email,
            uid: user.uid,
            createdAt: serverTimestamp(),
        });

        setNewMessage("");
    };

    return (
        <div className="flex flex-col h-[calc(100vh-6rem)] bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
                <h2 className="font-bold text-gray-800 flex items-center gap-2">
                    💬 오피스톡 <span className="text-xs font-normal text-gray-500 bg-white px-2 py-1 rounded-full border">Open Chat</span>
                </h2>
                <div className="text-xs text-green-600 flex items-center gap-1">
                    <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                    실시간 연결됨
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50/50">
                {messages.map((msg) => {
                    const isMyMessage = msg.uid === user.uid;
                    return (
                        <div key={msg.id} className={`flex ${isMyMessage ? "justify-end" : "justify-start"}`}>
                            <div className={`max-w-[70%] rounded-2xl px-4 py-3 shadow-sm ${isMyMessage
                                    ? "bg-indigo-600 text-white rounded-br-none"
                                    : "bg-white border border-gray-100 text-gray-800 rounded-bl-none"
                                }`}>
                                {!isMyMessage && <p className="text-xs text-gray-500 mb-1">{msg.sender}</p>}
                                <p className="text-sm leading-relaxed">{msg.text}</p>
                            </div>
                        </div>
                    );
                })}
                <div ref={bottomRef} />
            </div>

            <form onSubmit={handleSendMessage} className="p-4 bg-white border-t border-gray-100 flex gap-2">
                <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="메시지를 입력하세요..."
                    className="flex-1 rounded-xl border border-gray-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                />
                <button
                    type="submit"
                    className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-medium hover:bg-indigo-500 transition-colors shadow-sm disabled:opacity-50"
                    disabled={!newMessage.trim()}
                >
                    전송
                </button>
            </form>
        </div>
    );
}
