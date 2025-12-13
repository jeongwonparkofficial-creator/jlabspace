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
        storeName: "",
        confirmData: null,
        memo: "",
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
                    storeName: session.storeName || "",
                    confirmData: session.confirmData || null,
                    memo: session.memo || "",
                    lastResult: session.lastResult || null,
                    errorMsg: session.errorMsg || ""
                });
            } else {
                setIsConnected(true);
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
            // Show loading or wait for status change
            // The manager will update 'view' to PROCESSING or IDLE/SUCCESS
        }
        setPhoneInput("");
    };

    // --- RENDERERS ---
    const renderHeader = () => (
        <>
            {data.memo && (
                <div className="bg-red-500 text-white text-center py-2 font-bold animate-pulse absolute top-0 w-full z-50 shadow-md">
                    📢 {data.memo}
                </div>
            )}
        </>
    );

    const renderConnect = () => (
        <div className="flex flex-col h-full bg-gray-50 items-center justify-center p-6 text-gray-800">
            <h1 className="text-2xl font-bold mb-6 text-indigo-600">POS 연결 설정</h1>
            <div className="bg-white p-6 rounded-2xl shadow-lg w-full max-w-sm border border-gray-100">
                <label className="text-xs font-bold text-gray-500 block mb-2">UID 입력</label>
                <div className="flex gap-2">
                    <input
                        type="text"
                        value={inputUid}
                        onChange={(e) => setInputUid(e.target.value)}
                        placeholder="UID"
                        className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 outline-none"
                    />
                    <button onClick={handleConnect} className="bg-indigo-600 text-white px-5 rounded-lg font-bold">
                        연결
                    </button>
                </div>
            </div>
        </div>
    );

    const renderIdle = () => (
        <div className="flex flex-col h-full bg-[#f9fafb] items-center justify-center p-10 relative">
            {renderHeader()}
            <div className="w-24 h-24 bg-white rounded-3xl shadow-xl flex items-center justify-center mb-8 animate-bounce-slow">
                <img src="/logos/memu.png" className="h-12 w-auto" alt="Logo" />
            </div>
            <h1 className="text-3xl font-extrabold text-gray-800 mb-2">환영합니다</h1>
            <p className="text-gray-400">주문을 도와드리겠습니다</p>
        </div>
    );

    const renderPhoneInput = () => (
        <div className="flex flex-col h-full bg-white">
            {renderHeader()}
            <div className="p-8 pb-4 flex flex-col items-center">
                <div className="text-sm font-bold text-gray-400 mb-1">{data.storeName}</div>
                <h2 className="text-2xl font-bold text-gray-800 mb-2">
                    {data.total?.toLocaleString()}원 결제
                </h2>
                <p className="text-indigo-600 font-medium mb-6">적립/사용할 번호를 입력해주세요</p>

                <div className="text-center mb-6 w-full max-w-xs">
                    <div className="text-indigo-600 text-4xl font-mono font-bold tracking-widest h-16 border-b-2 border-indigo-100 flex items-center justify-center bg-gray-50 rounded-t-xl">
                        {phoneInput || <span className="text-gray-200 text-3xl">010-0000-0000</span>}
                    </div>
                </div>
            </div>

            <div className="flex-1 bg-gray-50 grid grid-cols-3 gap-0.5 p-0.5 border-t border-gray-200">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                    <button key={num} onClick={() => handleKeypad(num)} className="bg-white text-2xl font-medium text-gray-800 active:bg-gray-100 transition-colors py-4">
                        {num}
                    </button>
                ))}
                <button onClick={handleClear} className="bg-white text-xl text-red-500 font-bold active:bg-gray-100">C</button>
                <button onClick={() => handleKeypad(0)} className="bg-white text-2xl font-medium text-gray-800 active:bg-gray-100">0</button>
                <button onClick={handleBackspace} className="bg-white text-xl text-gray-500 font-bold active:bg-gray-100">←</button>
            </div>
            <div className="p-4 bg-gray-50">
                <button onClick={submitPhone} className="w-full bg-indigo-600 text-white py-4 rounded-xl text-xl font-bold shadow-lg hover:bg-indigo-700 transition-colors">
                    입력 완료
                </button>
            </div>
        </div>
    );

    const renderCart = () => (
        <div className="flex flex-col h-full bg-[#f2f4f6]">
            {renderHeader()}
            {/* Toss Style Header */}
            <div className="bg-white p-6 pb-4 rounded-b-3xl shadow-sm z-10">
                <h2 className="text-lg font-bold text-gray-800 mb-1">결제 금액</h2>
                <div className="text-4xl font-extrabold text-indigo-600">
                    {(data.total + Math.floor(data.total * 0.2)).toLocaleString()}원
                </div>
            </div>

            <div className="flex-1 p-4 overflow-y-auto space-y-4">
                <div className="bg-white rounded-2xl p-5 shadow-sm">
                    <h3 className="text-sm font-bold text-gray-400 mb-3">주문 상품</h3>
                    <div className="space-y-4">
                        {data.cart.map((item, i) => (
                            <div key={i} className="flex justify-between items-center">
                                <div>
                                    <div className="text-base font-bold text-gray-800">{item.name}</div>
                                    <div className="text-sm text-gray-400">{item.price.toLocaleString()} x {item.qty}</div>
                                </div>
                                <div className="text-base font-bold text-gray-800">
                                    {((item.price * item.qty) - (item.discount || 0)).toLocaleString()}
                                </div>
                            </div>
                        ))}
                    </div>
                    {/* Member Info "Toss-like" Bottom of Cart */}
                    {data.member && (
                        <div className="mt-6 pt-4 border-t border-gray-100">
                            <h3 className="text-sm font-bold text-gray-400 mb-2">적립 회원</h3>
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-lg">👤</div>
                                <div>
                                    <div className="font-bold text-gray-800">{data.member.name}</div>
                                    <div className="text-sm text-indigo-600 font-bold">{data.member.points?.toLocaleString()} P 보유</div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* If member is NOT found yet, maybe suggest "Phone Input" is coming? 
                Actually, Manager view controls this. If manager clicks "Pay" and no member, view switches to PHONE_INPUT.
            */}
        </div>
    );

    const renderProcessing = () => (
        <div className="h-full bg-white flex flex-col items-center justify-center p-10">
            {renderHeader()}
            <div className="animate-spin rounded-full h-16 w-16 border-4 border-gray-200 border-t-indigo-600 mb-6"></div>
            <h2 className="text-2xl font-bold text-gray-800">결제 처리 중입니다</h2>
            <p className="text-gray-400 mt-2">잠시만 기다려주세요</p>
        </div>
    );

    const renderError = () => (
        <div className="h-full bg-white flex flex-col items-center justify-center p-10">
            {renderHeader()}
            <div className="text-5xl mb-4">⚠️</div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">결제 실패</h2>
            <p className="text-red-500 font-bold text-center">{data.errorMsg}</p>
        </div>
    );

    const renderSuccess = () => (
        <div className="h-full bg-indigo-600 flex flex-col items-center justify-center text-white p-10 relative">
            {renderHeader()}
            <div className="bg-white/20 p-8 rounded-full mb-6 backdrop-blur-sm animate-scale-in">
                <div className="text-6xl">✅</div>
            </div>
            <h2 className="text-3xl font-bold mb-2">결제 성공!</h2>
            <p className="opacity-80 mb-8">{data.lastResult?.msg || "감사합니다"}</p>
            {data.lastResult?.balance !== undefined && (
                <div className="bg-white/10 px-6 py-3 rounded-xl backdrop-blur-sm">
                    <span className="opacity-70 text-sm mr-2">남은 포인트</span>
                    <span className="font-bold text-xl">{data.lastResult.balance.toLocaleString()} P</span>
                </div>
            )}
        </div>
    );

    if (!isConnected && !targetUid) return renderConnect();

    return (
        <div className="h-screen w-screen overflow-hidden font-sans select-none bg-gray-100 text-gray-900">
            {view === "IDLE" && renderIdle()}
            {view === "PHONE_INPUT" && renderPhoneInput()}
            {view === "CART" && renderCart()}
            {(view === "PROCESSING" || view === "SIGNATURE") && renderProcessing()}
            {view === "SUCCESS" && renderSuccess()}
            {view === "ERROR" && renderError()}
            {/* Legacy Fallback */}
            {view === "MEMBER_CONFIRM" && renderCart()}
        </div>
    );
}
