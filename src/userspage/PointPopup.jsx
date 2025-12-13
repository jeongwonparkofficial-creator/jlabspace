import { useState, useEffect, useRef } from "react";
import SignatureCanvas from 'react-signature-canvas';

export default function PointPopup() {
    const [channel, setChannel] = useState(null);
    const [view, setView] = useState("IDLE"); // IDLE, MEMBER_CONFIRM, CART, SIGNATURE, SUCCESS

    // Data
    const [phone, setPhone] = useState("");
    const [member, setMember] = useState(null);
    const [cartData, setCartData] = useState({ cart: [], total: 0 });
    const [confirmData, setConfirmData] = useState(null);
    const [memo, setMemo] = useState("");
    const sigCanvas = useRef({});

    useEffect(() => {
        const bc = new BroadcastChannel("point_system_channel");
        bc.onmessage = (event) => {
            const { type, payload } = event.data;

            if (type === "PHONE_INPUT") {
                // Sync phone input but stay in IDLE if not specialized
                setPhone(payload);
                if (view !== "IDLE" && view !== "MEMBER_CONFIRM") setView("IDLE");
            } else if (type === "MEMBER_FOUND") {
                setMember(payload);
                // Optionally move to MEMBER_CONFIRM
            } else if (type === "MEMBER_CONFIRM") {
                setMember(payload);
                setView("MEMBER_CONFIRM");
            } else if (type === "MEMBER_NOT_FOUND") {
                setMember(null);
            } else if (type === "CART_UPDATE") {
                setCartData(payload);
                // If we are in IDLE/MEMBER_CONFIRM and things are added, switch to CART
                if (payload.cart.length > 0 && view !== "SIGNATURE") setView("CART");
                if (payload.cart.length === 0 && view !== "SUCCESS") setView("IDLE");
            } else if (type === "REQUEST_SIGNATURE") {
                setConfirmData(payload);
                setView("SIGNATURE");
            } else if (type === "SHOW_MEMO") {
                setMemo(payload.memo);
            } else if (type === "SUCCESS") {
                setView("SUCCESS");
                setTimeout(() => {
                    resetState();
                }, 3000);
            }
        };
        setChannel(bc);
        return () => bc.close();
    }, [view]);

    const resetState = () => {
        setView("IDLE");
        setPhone("");
        setMember(null);
        setCartData({ cart: [], total: 0 });
        setConfirmData(null);
        setMemo(""); // Clear memo on reset
        channel?.postMessage({ type: "PHONE_INPUT", payload: "" });
    };

    const handleKeypad = (num) => {
        const newPhone = phone + num;
        setPhone(newPhone);
        channel?.postMessage({ type: "PHONE_INPUT", payload: newPhone });
    };

    const handleClear = () => {
        setPhone("");
        channel?.postMessage({ type: "PHONE_INPUT", payload: "" });
    };

    const handleBackspace = () => {
        const newPhone = phone.slice(0, -1);
        setPhone(newPhone);
        channel?.postMessage({ type: "PHONE_INPUT", payload: newPhone });
    }

    const submitSignature = () => {
        if (sigCanvas.current.isEmpty()) {
            alert("서명을 해주세요");
            return;
        }
        // Trim allows checking emptiness and gets better data
        const signatureData = sigCanvas.current.getTrimmedCanvas().toDataURL('image/png');
        channel?.postMessage({ type: "SIGNATURE_SUBMIT", payload: { signature: signatureData } });
    };

    // --- RENDERERS ---

    const renderHeader = () => (
        <>
            {memo && (
                <div className="bg-red-600 text-white text-center py-2 font-bold animate-pulse absolute top-0 w-full z-50 shadow-md">
                    📢 {memo}
                </div>
            )}
        </>
    );

    const renderIdle = () => (
        <div className="flex flex-col h-full relative">
            {renderHeader()}
            <div className="flex-1 flex flex-col justify-center items-center bg-gray-900 p-10 pt-16">
                <img src="/logos/memu.png" className="h-12 w-auto mb-10 opacity-80" alt="Logo" />
                <h2 className="text-gray-500 mb-6 text-xl tracking-widest uppercase">Member Login</h2>
                <div className="text-6xl font-bold tracking-[0.5em] text-white border-b-2 border-indigo-500 pb-4 mb-4 min-h-[100px] flex items-center justify-center">
                    {phone}
                    <span className="animate-pulse text-indigo-500 ml-2">_</span>
                </div>
                <div className="h-8 text-indigo-400 font-bold text-xl">
                    전화번호를 입력해주세요
                </div>
            </div>
            {/* Keypad */}
            <div className="flex-[1.2] grid grid-cols-3 bg-black">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                    <button
                        key={num}
                        onClick={() => handleKeypad(num)}
                        className="text-4xl text-white font-thin hover:bg-gray-800 active:bg-indigo-900 transition-colors border-r border-b border-gray-800"
                    >
                        {num}
                    </button>
                ))}
                <button onClick={handleClear} className="text-2xl text-red-400 font-bold hover:bg-gray-800 border-r border-gray-800">CLR</button>
                <button onClick={() => handleKeypad(0)} className="text-4xl text-white font-thin hover:bg-gray-800 border-r border-gray-800">0</button>
                <button onClick={handleBackspace} className="text-3xl text-white font-bold hover:bg-gray-800">←</button>
            </div>
        </div>
    );

    const renderMemberConfirm = () => (
        <div className="h-full bg-indigo-900 flex flex-col items-center justify-center text-white relative">
            {renderHeader()}
            <div className="w-32 h-32 bg-indigo-700 rounded-full flex items-center justify-center text-5xl mb-6 shadow-xl border-4 border-indigo-500">
                👤
            </div>
            <h2 className="text-2xl text-indigo-200 mb-2">회원 확인</h2>
            <div className="text-6xl font-bold mb-4">{member?.name} 님</div>
            <div className="text-3xl opacity-60 tracking-widest">{member?.phone}</div>
            <div className="mt-10 text-xl animate-bounce">
                반갑습니다!
            </div>
        </div>
    );

    const renderCart = () => (
        <div className="h-full bg-white flex flex-col relative">
            {renderHeader()}
            <div className="bg-gray-900 text-white p-6 flex justify-between items-end shadow-md z-10 pt-16">
                <div>
                    <h2 className="text-xs opacity-70 mb-1 tracking-widest">ORDER SUMMARY</h2>
                    <div className="text-3xl font-bold">{member?.name || "고객"}님</div>
                </div>
                <div className="text-right">
                    <div className="text-xs opacity-70">결제 예정 금액</div>
                    {cartData.total !== undefined && (
                        <div className="text-4xl font-bold">
                            {(cartData.total + Math.floor(cartData.total * 0.2)).toLocaleString()}
                        </div>
                    )}
                </div>
            </div>

            <div className="flex-1 p-6 overflow-y-auto bg-gray-50 text-black">
                {cartData.cart.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-gray-400">장바구니가 비었습니다</div>
                ) : (
                    <div className="space-y-3">
                        {cartData.cart.map((item, i) => (
                            <div key={i} className="bg-white p-5 rounded-xl shadow-sm flex justify-between items-center border border-gray-100">
                                <div>
                                    <div className="text-xl font-bold text-gray-800 mb-1">{item.name}</div>
                                    <div className="text-sm text-gray-500">
                                        {item.price?.toLocaleString()} x {item.qty}
                                        {item.discount > 0 && <span className="text-red-500 ml-2">(-{item.discount.toLocaleString()})</span>}
                                    </div>
                                </div>
                                <div className="text-2xl font-bold text-gray-900">
                                    {((item.price * item.qty) - (item.discount || 0)).toLocaleString()}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div className="p-8 bg-white border-t space-y-3 text-lg">
                <div className="flex justify-between text-gray-500">
                    <span>주문 금액</span>
                    <span>{cartData.total?.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-gray-500">
                    <span>VAT (20%)</span>
                    {cartData.total !== undefined && <span>{Math.floor(cartData.total * 0.2).toLocaleString()}</span>}
                </div>
            </div>
        </div>
    );

    const renderSignature = () => (
        <div className="h-full bg-white flex flex-col relative">
            {renderHeader()}
            <div className="flex-1 flex flex-col items-center justify-center p-10 pt-16">
                <div className="text-center mb-8">
                    <h2 className="text-3xl font-bold text-gray-800 mb-6 leading-relaxed whitespace-pre-wrap">
                        {confirmData?.message || "결제하시겠습니까?"}
                    </h2>
                </div>

                <div className="border-4 border-gray-200 rounded-3xl overflow-hidden shadow-inner bg-gray-50 w-full max-w-3xl h-[400px] relative">
                    <SignatureCanvas
                        ref={sigCanvas}
                        penColor="black"
                        canvasProps={{ className: 'sigCanvas w-full h-full' }}
                    />
                    <div className="absolute right-4 bottom-4 text-gray-300 pointer-events-none select-none">
                        서명 입력란
                    </div>
                </div>
            </div>

            <div className="p-6 bg-gray-100 border-t">
                <button onClick={submitSignature} className="w-full bg-indigo-600 text-white py-6 rounded-2xl text-3xl font-bold shadow-lg hover:bg-indigo-500 transform active:scale-[0.98] transition-all">
                    서명 완료 (확인)
                </button>
            </div>
        </div>
    );

    const renderSuccess = () => (
        <div className="h-full bg-green-500 flex flex-col items-center justify-center text-white p-10 relative">
            {renderHeader()}
            <div className="text-9xl mb-8 animate-bounce">✅</div>
            <h2 className="text-6xl font-bold mb-6">결제 완료!</h2>
            <p className="text-3xl opacity-90 font-light">이용해 주셔서 감사합니다.</p>
        </div>
    );

    return (
        <div className="h-screen w-screen overflow-hidden font-sans select-none">
            {view === "IDLE" && renderIdle()}
            {view === "MEMBER_CONFIRM" && renderMemberConfirm()}
            {view === "CART" && renderCart()}
            {view === "SIGNATURE" && renderSignature()}
            {view === "SUCCESS" && renderSuccess()}
        </div>
    );
}
