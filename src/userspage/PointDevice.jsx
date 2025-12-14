import { useState, useEffect } from "react";
import { getDatabase, ref, onValue, update, get } from "firebase/database";
import { useAuth } from "../context/AuthContext";
import { useSearchParams } from "react-router-dom";

export default function PointDevice() {
    const { currentUser: user } = useAuth();
    const [searchParams] = useSearchParams();
    const db = getDatabase();

    // Auth Logic
    const [targetUid, setTargetUid] = useState(searchParams.get("uid") || user?.uid || "");
    const [inputCode, setInputCode] = useState("");
    const [isConnected, setIsConnected] = useState(false);
    const [loading, setLoading] = useState(false);

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
        // If query param 'code' is present, try to resolve it immediately
        const code = searchParams.get("code");
        if (code) {
            handleConnectWithCode(code);
        }
    }, [searchParams]);

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
                setIsConnected(true);
                setView("IDLE");
            }
        });
        return () => unsubscribe();
    }, [targetUid]);

    const handleConnectWithCode = async (code) => {
        setLoading(true);
        try {
            const snap = await get(ref(db, `pos_codes/${code}`));
            if (snap.exists()) {
                const uid = snap.val().uid;
                setTargetUid(uid);
            } else {
                alert("유효하지 않은 코드입니다.");
            }
        } catch (e) {
            console.error(e);
            alert("연결 오류");
        } finally {
            setLoading(false);
        }
    }

    const handleConnect = () => {
        if (inputCode.length === 5) {
            handleConnectWithCode(inputCode);
        } else {
            alert("5자리 코드를 입력해주세요");
        }
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
        return name[0] + "*".repeat(name.length - 1);
    }

    const maskPhone = (phone) => {
        if (!phone) return "";
        const clean = phone.replace(/-/g, "");
        if (clean.length < 10) return phone;
        // 010-**XX-XX**
        return `${clean.slice(0, 3)}-**${clean.slice(5, 7)}-${clean.slice(7, 10)}*`;
    }

    const getTotalDiscount = () => {
        return data.cart.reduce((sum, item) => sum + (item.discount || 0), 0);
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
        <div className="flex flex-col h-full bg-white items-center justify-center p-6 text-gray-900 font-sans">
            <h1 className="text-3xl font-bold mb-8 text-gray-900">Device Connect</h1>
            <div className="bg-gray-50 p-8 rounded-3xl w-full max-w-sm border border-gray-200 shadow-xl">
                <label className="text-xs font-bold text-gray-400 block mb-3 pl-1">연결 코드 (5자리)</label>
                <div className="flex flex-col gap-3">
                    <input
                        type="text"
                        maxLength={5}
                        value={inputCode}
                        onChange={(e) => setInputCode(e.target.value)}
                        placeholder="12345"
                        className="bg-white border border-gray-300 rounded-2xl px-6 py-4 text-center text-3xl tracking-widest outline-none text-gray-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all placeholder-gray-400 shadow-inner"
                    />
                    <button
                        onClick={handleConnect}
                        disabled={loading}
                        className="bg-blue-600 text-white py-4 rounded-2xl font-bold text-lg hover:bg-blue-500 transition-colors disabled:opacity-50 mt-2 shadow-lg shadow-blue-900/20"
                    >
                        {loading ? "연결 중..." : "연결하기"}
                    </button>
                </div>
            </div>
        </div>
    );

    const renderIdle = () => (
        <div className="flex flex-col h-full bg-white items-center justify-center p-10 relative text-gray-900 font-sans">
            {renderHeader()}

            <div className="w-full max-w-lg aspect-video bg-gray-50 rounded-[2rem] flex items-center justify-center border border-gray-100 mb-12 shadow-xl">
                <div className="text-center">
                    <div className="text-6xl mb-6">👋</div>
                    <div className="text-3xl font-bold text-gray-900 mb-2">환영합니다</div>
                    <div className="text-xl text-gray-500 font-medium">{data.storeName}</div>
                </div>
            </div>

            <div className="flex gap-4">
                <div className="text-center group cursor-pointer" onClick={() => setView("PHONE_INPUT")}>
                    <div className="w-24 h-24 bg-gray-800/50 rounded-full flex items-center justify-center border border-gray-700 group-hover:border-blue-500 group-hover:bg-blue-500/10 transition-all mb-3 text-gray-400 group-hover:text-blue-500">
                        <span className="text-4xl font-light">+</span>
                    </div>
                    <div className="text-sm font-bold text-gray-500 group-hover:text-blue-400 transition-colors">고객 추가</div>
                </div>
            </div>
        </div>
    );

    const renderPhoneInput = () => (
        <div className="flex flex-col h-full bg-white text-gray-900 font-sans">
            {/* Keeping header for non-cart views if needed, or remove globally? 
            User said "Below table" implying Cart view. 
            For PhoneInput, maybe keep it or move it? 
            Let's keep renderHeader available for other views but not Cart.
            */}
            {renderHeader()}
            <div className="p-10 pb-6 flex flex-col items-center flex-1 justify-center">
                <div className="text-sm font-bold text-gray-400 mb-2">{data.storeName}</div>
                <h2 className="text-5xl font-bold mb-8 text-blue-600 tracking-tight">
                    {data.total?.toLocaleString()} P
                </h2>
                <p className="text-gray-400 font-medium mb-8 text-lg">전화번호 뒷자리를 입력해주세요</p>

                <div className="text-center mb-8 w-full max-w-sm">
                    <div className="text-gray-900 text-5xl font-mono font-bold tracking-[0.2em] h-20 border-b-2 border-blue-500 flex items-center justify-center bg-transparent">
                        {phoneInput || <span className="text-gray-300 text-4xl tracking-normal opacity-50">010-0000-0000</span>}
                    </div>
                </div>
            </div>

            <div className="bg-gray-100 grid grid-cols-3 gap-[1px] p-[1px] border-t border-gray-200">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                    <button key={num} onClick={() => handleKeypad(num)} className="bg-white h-24 text-3xl font-medium text-gray-900 active:bg-gray-100 transition-colors">
                        {num}
                    </button>
                ))}
                <button onClick={handleClear} className="bg-white h-24 text-xl text-red-500 font-bold active:bg-gray-100">초기화</button>
                <button onClick={() => handleKeypad(0)} className="bg-white h-24 text-3xl font-medium text-gray-900 active:bg-gray-100">0</button>
                <button onClick={handleBackspace} className="bg-white h-24 text-2xl text-gray-400 font-bold active:bg-gray-100">←</button>
            </div>
            <div className="p-6 bg-gray-50">
                <button onClick={submitPhone} className="w-full bg-blue-600 text-white py-5 rounded-2xl text-xl font-bold shadow-lg shadow-blue-900/30 hover:bg-blue-500 transition-all active:scale-95">
                    입력 완료
                </button>
            </div>
        </div>
    );

    const renderCart = () => (
        <div className="flex flex-col h-full bg-white text-gray-900 font-sans">
            {/* Removed Header Overlay */}

            {/* Header: Item / Qty / Total */}
            <div className="bg-blue-600 px-6 py-4 grid grid-cols-12 gap-4 text-xs font-bold text-white uppercase tracking-widest shadow-md">
                <div className="col-span-6">상품</div>
                <div className="col-span-2 text-center">수량</div>
                <div className="col-span-4 text-right">금액</div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto bg-white">
                {data.cart.map((item, i) => (
                    <div key={i} className={`p-4 grid grid-cols-12 gap-4 border-b border-gray-100 items-center ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                        <div className="col-span-6 flex flex-col">
                            <span className="font-bold text-lg text-gray-800">{item.name}</span>
                            {item.remark && <span className="text-xs text-blue-500 mt-1 font-medium">{item.remark}</span>}
                        </div>
                        <div className="col-span-2 text-center text-lg font-medium text-gray-600">{item.qty}</div>
                        <div className="col-span-4 text-right text-lg font-bold text-gray-900">
                            {((item.price * item.qty) - (item.discount || 0)).toLocaleString()} P
                        </div>
                    </div>
                ))}
            </div>

            {/* Message Display Area (Below Table) */}
            {data.memo && (
                <div
                    className="mx-6 mb-2 p-3 rounded-xl text-center font-bold text-lg animate-pulse bg-yellow-50 border border-yellow-200"
                    style={{ color: data.memoColor || "black" }}
                >
                    📢 {data.memo}
                </div>
            )}

            {/* Bottom Footer Area */}
            <div className="bg-gray-50 p-6 grid grid-cols-2 gap-6 border-t border-gray-200 pb-10">
                {/* Left: Customer Info */}
                <div className="flex items-center justify-center bg-white rounded-3xl border border-gray-200 shadow-sm">
                    {data.member ? (
                        <div className="text-center p-6 w-full">
                            <div className="text-gray-500 text-sm mb-2 flex items-center justify-center gap-2">
                                <span className="font-bold text-gray-700 text-lg">{data.storeName}</span>
                                <span className="w-1 h-1 bg-gray-300 rounded-full"></span>
                                <span className="text-gray-800 text-lg">{maskName(data.member.name)} 님</span>
                            </div>
                            <div className="text-3xl font-mono text-blue-600 font-bold tracking-widest">
                                {maskPhone(data.member.phone)}
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-32 w-full text-gray-400 gap-2">
                            <div className="w-12 h-12 rounded-full border-2 border-dashed border-gray-300 flex items-center justify-center">
                                <span className="text-2xl pt-1 text-gray-300 px-2">+</span>
                            </div>
                            <span className="text-sm font-bold">고객 정보 없음</span>
                        </div>
                    )}
                </div>

                {/* Right: Totals */}
                <div className="flex flex-col justify-end space-y-3 px-2">
                    <div className="flex justify-between text-gray-500 text-sm font-medium">
                        <span>주문 상품 수</span>
                        <span>{data.cart.length}개</span>
                    </div>
                    {/* Discount Visualization */}
                    {getTotalDiscount() > 0 && (
                        <div className="flex justify-between text-red-500 text-sm font-bold">
                            <span>총 할인 금액</span>
                            <span>-{getTotalDiscount().toLocaleString()} P</span>
                        </div>
                    )}

                    <div className="flex justify-between items-center pt-4 border-t border-gray-200 mt-2">
                        <span className="text-gray-600 font-bold">결제하실 금액</span>
                        <span className="text-5xl font-extrabold text-blue-600 tracking-tight">
                            {data.total.toLocaleString()} P
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );

    const renderProcessing = () => (
        <div className="h-full bg-white flex flex-col items-center justify-center p-10 text-gray-900 font-sans">
            {renderHeader()}
            <div className="animate-spin rounded-full h-20 w-20 border-4 border-gray-200 border-t-blue-600 mb-8"></div>
            <h2 className="text-3xl font-bold mb-3 text-gray-900">결제 처리 중입니다</h2>
            <p className="text-gray-500 text-lg">잠시만 기다려주세요</p>
        </div>
    );

    const renderError = () => (
        <div className="h-full bg-white flex flex-col items-center justify-center p-10 text-gray-900 font-sans">
            {renderHeader()}
            <div className="text-7xl mb-8">⚠️</div>
            <h2 className="text-3xl font-bold mb-4">결제 실패</h2>
            <p className="text-red-500 font-bold text-xl text-center max-w-md leading-relaxed">{data.errorMsg}</p>
        </div>
    );

    const renderSuccess = () => (
        <div className="h-full bg-blue-600 flex flex-col items-center justify-center text-white p-10 relative font-sans">
            {renderHeader()}
            <div className="bg-white/20 p-10 rounded-full mb-8 backdrop-blur-sm animate-scale-in shadow-2xl">
                <div className="text-7xl">✅</div>
            </div>
            <h2 className="text-5xl font-bold mb-6">결제 성공!</h2>
            <p className="opacity-90 mb-12 text-2xl font-medium">{data.lastResult?.msg || "이용해주셔서 감사합니다"}</p>
            {data.lastResult?.balance !== undefined && (
                <div className="bg-black/20 px-10 py-6 rounded-3xl backdrop-blur-md border border-white/10">
                    <span className="opacity-80 text-sm mr-2 block text-center mb-2 font-bold tracking-widest uppercase">남은 포인트</span>
                    <span className="font-bold text-4xl">{data.lastResult.balance.toLocaleString()} P</span>
                </div>
            )}
        </div>
    );

    if (!isConnected && !targetUid) return renderConnect();

    return (
        <div className="h-screen w-screen overflow-hidden font-sans select-none bg-white text-gray-900">
            {view === "IDLE" && renderIdle()}
            {view === "PHONE_INPUT" && renderPhoneInput()}
            {view === "CART" && renderCart()}
            {view === "MEMBER_CONFIRM" && renderCart()}
            {(view === "PROCESSING" || view === "SIGNATURE") && renderProcessing()}
            {view === "SUCCESS" && renderSuccess()}
            {view === "ERROR" && renderError()}
        </div>
    );
}
