import { useState, useEffect } from "react";
import { getDatabase, ref, onValue, update } from "firebase/database";
import { useAuth } from "../context/AuthContext";
import { useSearchParams } from "react-router-dom";

export default function PointDevice() {
    const { currentUser: user } = useAuth();
    const [searchParams] = useSearchParams();
    const db = getDatabase();

    // Auth Logic
    const [targetUid, setTargetUid] = useState(searchParams.get("uid") || user?.uid || "");
    const [inputUid, setInputUid] = useState("");
    const [isConnected, setIsConnected] = useState(false);

    // Data State
    const [view, setView] = useState("IDLE");
    const [data, setData] = useState({
        member: null,
        cart: [],
        total: 0,
        storeName: "정원랩", // Default
        confirmData: null,
        memo: "",
        memoColor: "black",
        lastResult: null,
        errorMsg: ""
    });

    // Keypad Input
    const [phoneInput, setPhoneInput] = useState("");

    useEffect(() => {
        if (!targetUid) return;

        const sessionRef = ref(db, `pos_sessions/${targetUid}`);
        const unsubscribe = onValue(sessionRef, (snapshot) => {
            const session = snapshot.val();
            if (session) {
                setIsConnected(true);
                // Sync
                setView(session.view || "IDLE");
                setData({
                    member: session.member || null,
                    cart: session.cart || [],
                    total: session.total || 0,
                    storeName: session.storeName || "정원랩",
                    confirmData: session.confirmData || null,
                    memo: session.memo || "",
                    memoColor: session.memoColor || "black",
                    lastResult: session.lastResult || null,
                    errorMsg: session.errorMsg || ""
                });
            } else {
                // If session is null, it might be that manager hasn't opened page yet or cleared it.
                // But we should consider it connected if we are listening? 
                // No, if session data is null, wait.
                // But avoid white screen.
                setIsConnected(true);
                setView("IDLE"); // Default to IDLE if no data
            }
        });
        return () => unsubscribe();
    }, [targetUid]);

    const handleConnect = () => {
        if (inputUid.trim().length > 0) setTargetUid(inputUid.trim());
    }

    const handleKeypad = (num) => {
        if (phoneInput.length >= 11) return;
        setPhoneInput(prev => prev + num);
    };

    const handleBackspace = () => setPhoneInput(prev => prev.slice(0, -1));
    const handleClear = () => setPhoneInput("");

    const submitPhone = () => {
        if (phoneInput.length < 4) return alert("전화번호를 입력해주세요");

        // Send to Manager
        if (targetUid) {
            update(ref(db, `pos_sessions/${targetUid}/action`), {
                type: "PHONE_SUBMIT",
                payload: { phone: phoneInput },
                timestamp: Date.now()
            });
        }
        setPhoneInput("");
    };

    // --- Helpers ---
    const maskName = (name) => {
        if (!name) return "";
        if (name.length <= 2) return name[0] + "*";
        return name[0] + "*".repeat(name.length - 2) + name[name.length - 1]; // Or just Kim** as requested? Request: "김** 님 처럼 되고 2글자 인 경우 성만" -> "Kim**" 
        // User example: "김** 님 처럼 되고 2글자 인 경우 성만 보이게"
        // 3 chars "홍길동" -> "홍**" ? Or "홍*동"? 
        // Let's go with "Name"[0] + "**"
        return name[0] + "**";
    }

    const maskPhone = (phone) => {
        // Request: "010-**00-000*"
        if (!phone) return "";
        // Assuming 01012345678 or 010-1234-5678 format
        const clean = phone.replace(/-/g, "");
        if (clean.length < 10) return phone;
        // 010 - XXXX - XXXX
        // User want: 010-**00-000*
        // It's a bit specific: 3rd,4th of 2nd block masked? 
        // Let's standard mask: 010-**XX-XX** ? 
        // User example: 010-**00-000* -> indices 4,5 masked? 
        // Let's just do: 010-****-**** for safety or following the visual instructions?
        // User said: "010-**00-000*" -> seems specific masking.
        // Let's try to match: 010-1234-5678 -> 010-**34-567*
        return `${clean.slice(0, 3)}-**${clean.slice(5, 7)}-${clean.slice(7, 10)}*`;
    }

    // --- RENDERERS ---
    const renderHeader = () => (
        <>
            {data.memo && (
                <div
                    className="text-center py-4 font-bold animate-pulse absolute top-0 w-full z-50 shadow-md bg-white/90 backdrop-blur"
                    style={{ color: data.memoColor || "black", fontSize: "1.5rem" }}
                >
                    📢 {data.memo}
                </div>
            )}
        </>
    );

    const renderConnect = () => (
        <div className="flex flex-col h-full bg-gray-900 items-center justify-center p-6 text-white">
            <h1 className="text-2xl font-bold mb-6 text-indigo-400">POS 연결 설정</h1>
            <div className="bg-white/10 p-6 rounded-2xl shadow-lg w-full max-w-sm border border-white/20 backdrop-blur-md">
                <label className="text-xs font-bold text-gray-400 block mb-2">UID 입력</label>
                <div className="flex gap-2">
                    <input
                        type="text"
                        value={inputUid}
                        onChange={(e) => setInputUid(e.target.value)}
                        placeholder="UID"
                        className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 outline-none text-white"
                    />
                    <button onClick={handleConnect} className="bg-indigo-600 text-white px-5 rounded-lg font-bold">
                        연결
                    </button>
                </div>
            </div>
        </div>
    );

    const renderIdle = () => (
        <div className="flex flex-col h-full bg-[#1a1a1a] items-center justify-center p-10 relative text-white">
            {renderHeader()}

            {/* Dark Theme aesthetics as per image */}
            <div className="w-full max-w-md aspect-video bg-gray-800/50 rounded-3xl flex items-center justify-center border border-gray-700/50 mb-8">
                {/* Placeholder for Ads or Logo */}
                <div className="text-center">
                    <div className="text-4xl mb-4">👋</div>
                    <div className="text-2xl font-bold">환영합니다</div>
                    <div className="text-gray-400">{data.storeName}</div>
                </div>
            </div>

            <div className="flex gap-4">
                <div className="text-center">
                    <div className="w-32 h-32 bg-gray-800 rounded-2xl flex items-center justify-center border-2 border-dashed border-gray-600 hover:border-indigo-500 cursor-pointer transition-colors"
                        onClick={() => setView("PHONE_INPUT")} /* Self-trigger input if needed? usually manager triggers */
                    >
                        <span className="text-4xl text-gray-500">+</span>
                    </div>
                    <div className="mt-2 font-bold text-gray-400">Add customer</div>
                </div>
            </div>
        </div>
    );

    const renderPhoneInput = () => (
        <div className="flex flex-col h-full bg-[#1a1a1a] text-white">
            {renderHeader()}
            <div className="p-8 pb-4 flex flex-col items-center">
                <div className="text-sm font-bold text-gray-400 mb-1">{data.storeName}</div>
                <h2 className="text-3xl font-bold mb-6 text-indigo-400">
                    {data.total?.toLocaleString()}원
                </h2>
                <p className="text-gray-300 font-medium mb-6">적립/사용할 번호를 입력해주세요</p>

                <div className="text-center mb-6 w-full max-w-xs">
                    <div className="text-white text-4xl font-mono font-bold tracking-widest h-16 border-b-2 border-indigo-500 flex items-center justify-center bg-transparent rounded-t-xl">
                        {phoneInput || <span className="text-gray-600 text-3xl">010-0000-0000</span>}
                    </div>
                </div>
            </div>

            <div className="flex-1 bg-gray-900 grid grid-cols-3 gap-0.5 p-0.5 border-t border-gray-800">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                    <button key={num} onClick={() => handleKeypad(num)} className="bg-[#1a1a1a] text-3xl font-medium text-white active:bg-gray-800 transition-colors py-4">
                        {num}
                    </button>
                ))}
                <button onClick={handleClear} className="bg-[#1a1a1a] text-2xl text-red-500 font-bold active:bg-gray-800">C</button>
                <button onClick={() => handleKeypad(0)} className="bg-[#1a1a1a] text-3xl font-medium text-white active:bg-gray-800">0</button>
                <button onClick={handleBackspace} className="bg-[#1a1a1a] text-2xl text-gray-500 font-bold active:bg-gray-800">←</button>
            </div>
            <div className="p-4 bg-gray-900">
                <button onClick={submitPhone} className="w-full bg-indigo-600 text-white py-5 rounded-2xl text-xl font-bold shadow-lg hover:bg-indigo-500 transition-colors">
                    입력 완료
                </button>
            </div>
        </div>
    );

    const renderCart = () => (
        <div className="flex flex-col h-full bg-[#121212] text-white">
            {renderHeader()}

            {/* Header: Item / Qty / Sales Rep / Total */}
            <div className="bg-black/50 p-4 grid grid-cols-12 gap-2 text-xs font-bold text-gray-400 uppercase tracking-wider">
                <div className="col-span-6">ITEM</div>
                <div className="col-span-2 text-center">QTY</div>
                <div className="col-span-4 text-right">TOTAL</div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto">
                {data.cart.map((item, i) => (
                    <div key={i} className={`p-4 grid grid-cols-12 gap-2 border-b border-gray-800 ${i === 0 ? 'bg-blue-900/20 border-l-4 border-l-blue-500' : ''}`}>
                        <div className="col-span-6 flex flex-col">
                            <span className="font-bold text-lg">{item.name}</span>
                            {item.remark && <span className="text-xs text-blue-400">{item.remark}</span>}
                        </div>
                        <div className="col-span-2 text-center text-lg">{item.qty}</div>
                        <div className="col-span-4 text-right text-lg font-mono">
                            {((item.price * item.qty) - (item.discount || 0)).toLocaleString()}
                        </div>
                    </div>
                ))}
            </div>

            {/* Bottom Footer Area */}
            <div className="bg-[#1a1a1a] p-6 grid grid-cols-2 gap-8 border-t border-gray-800">
                {/* Left: Customer Info or Add Customer Placeholder */}
                <div className="flex items-center justify-center bg-gray-800/50 rounded-2xl border border-gray-700/50">
                    {data.member ? (
                        <div className="text-center p-4">
                            {/* "Store Name (Bold) Name (Normal)" */}
                            <div className="text-gray-400 text-sm mb-1">
                                <span className="font-bold text-white text-lg mr-2">{data.storeName}</span>
                                <span className="text-white text-lg">{maskName(data.member.name)} 님</span>
                            </div>
                            <div className="text-2xl font-mono text-indigo-400 font-bold tracking-widest">
                                {maskPhone(data.member.phone)}
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-32 w-full text-gray-500">
                            <span className="text-4xl mb-2">+</span>
                            <span>Add customer</span>
                        </div>
                    )}
                </div>

                {/* Right: Totals */}
                <div className="flex flex-col justify-end space-y-2">
                    <div className="flex justify-between text-gray-400 text-sm">
                        <span>LINES</span>
                        <span>{data.cart.length}</span>
                    </div>
                    {/* Removed VAT display as requested */}
                    <div className="flex justify-between text-gray-400 text-sm border-b border-gray-700 pb-2 mb-2">
                        <span>DISCOUNTS</span>
                        <span>$0.00</span> {/* Calculate only if passed? data.cart logic */}
                    </div>

                    <div className="flex justify-between items-end mt-2">
                        <span className="text-gray-400 text-sm mb-1">AMOUNT DUE</span>
                        <span className="text-5xl font-light text-blue-500">
                            {data.total.toLocaleString()}원
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );

    const renderProcessing = () => (
        <div className="h-full bg-[#1a1a1a] flex flex-col items-center justify-center p-10 text-white">
            {renderHeader()}
            <div className="animate-spin rounded-full h-16 w-16 border-4 border-gray-700 border-t-indigo-500 mb-6"></div>
            <h2 className="text-2xl font-bold">결제 처리 중입니다</h2>
            <p className="text-gray-400 mt-2">잠시만 기다려주세요</p>
        </div>
    );

    const renderError = () => (
        <div className="h-full bg-[#1a1a1a] flex flex-col items-center justify-center p-10 text-white">
            {renderHeader()}
            <div className="text-6xl mb-6">⚠️</div>
            <h2 className="text-2xl font-bold mb-2">결제 실패</h2>
            <p className="text-red-400 font-bold text-center">{data.errorMsg}</p>
        </div>
    );

    const renderSuccess = () => (
        <div className="h-full bg-blue-600 flex flex-col items-center justify-center text-white p-10 relative">
            {renderHeader()}
            <div className="bg-white/20 p-8 rounded-full mb-6 backdrop-blur-sm animate-scale-in">
                <div className="text-6xl">✅</div>
            </div>
            <h2 className="text-4xl font-bold mb-4">결제 성공!</h2>
            <p className="opacity-80 mb-8 text-xl">{data.lastResult?.msg || "감사합니다"}</p>
            {data.lastResult?.balance !== undefined && (
                <div className="bg-black/20 px-8 py-4 rounded-2xl backdrop-blur-sm">
                    <span className="opacity-70 text-sm mr-2 block text-center mb-1">남은 포인트</span>
                    <span className="font-bold text-3xl">{data.lastResult.balance.toLocaleString()} P</span>
                </div>
            )}
        </div>
    );

    if (!isConnected && !targetUid) return renderConnect();

    return (
        <div className="h-screen w-screen overflow-hidden font-sans select-none bg-black text-white">
            {view === "IDLE" && renderIdle()}
            {view === "PHONE_INPUT" && renderPhoneInput()}
            {view === "CART" && renderCart()}
            {view === "MEMBER_CONFIRM" && renderCart()} {/* Fallback to Cart with Member */}
            {(view === "PROCESSING" || view === "SIGNATURE") && renderProcessing()}
            {view === "SUCCESS" && renderSuccess()}
            {view === "ERROR" && renderError()}
        </div>
    );
}
