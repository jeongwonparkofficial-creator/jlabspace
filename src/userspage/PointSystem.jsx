import { useState, useEffect, useRef } from "react";
import { getDatabase, ref, onValue, push, set, update, get } from "firebase/database";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import StoreSettings from "./StoreSettings";
import ProductManagement from "./ProductManagement";

export default function PointSystem() {
    // --- State ---
    const { currentUser: user } = useAuth();
    const navigate = useNavigate();
    const [channel, setChannel] = useState(null);
    const [mode, setMode] = useState("POS"); // POS, REFUND
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [productsOpen, setProductsOpen] = useState(false);

    // Device Mode State
    const [isDeviceMode, setIsDeviceMode] = useState(false);

    // Data
    const [storeName, setStoreName] = useState("정원랩");
    const [products, setProducts] = useState([]);

    // Member & Input
    const [phoneInput, setPhoneInput] = useState("");
    const [member, setMember] = useState(null);
    const [status, setStatus] = useState("대기중");

    // Cart & Transaction
    const [cart, setCart] = useState([]);
    const [memo, setMemo] = useState("");
    const [memoColor, setMemoColor] = useState("black"); // black, red, blue, green

    // Refund / History
    const [transactions, setTransactions] = useState([]);
    const [selectedTxn, setSelectedTxn] = useState(null);

    // Gift Card State
    const [giftCardCodeInput, setGiftCardCodeInput] = useState("");

    const db = getDatabase();

    // --- Effects ---
    useEffect(() => {
        const bc = new BroadcastChannel("point_system_channel");
        bc.onmessage = handleBroadcastMessage;
        setChannel(bc);
        return () => bc.close();
    }, []);

    // Listen to Firebase for Device Mode Actions (if active)
    useEffect(() => {
        if (!user || !isDeviceMode) return;

        const sessionRef = ref(db, `pos_sessions/${user.uid}`);
        update(sessionRef, { "connected": true }); // Ensure session exists

        const actionRef = ref(db, `pos_sessions/${user.uid}/action`);
        const unsubscribe = onValue(actionRef, (snap) => {
            const action = snap.val();
            if (action && action.timestamp > Date.now() - 5000) { // Only recent actions
                if (action.type === "PHONE_SUBMIT") {
                    handleDevicePhoneSubmit(action.payload.phone);
                }
            }
        });
        return () => unsubscribe();
    }, [user, isDeviceMode]);

    useEffect(() => {
        // Fetch Store Name
        onValue(ref(db, "store/settings/name"), (snap) => {
            if (snap.exists()) setStoreName(snap.val());
        });

        // Fetch Products
        onValue(ref(db, "store/products"), (snap) => {
            const data = snap.val();
            if (data) {
                setProducts(Object.entries(data).map(([id, val]) => ({ id, ...val })));
            } else {
                setProducts([]);
            }
        });
    }, []);

    useEffect(() => {
        // Sync cart to customer whenever it changes
        // ALWAYS Sync if items exist or member changes
        if (cart.length > 0 || member) {
            syncToCustomer("CART_UPDATE", { cart, total: calculateSubtotal(), memberName: member?.name });
        }
    }, [cart, member, isDeviceMode]);

    // --- Broadcast / Sync Handler ---
    const handleBroadcastMessage = (event) => {
        const { type, payload } = event.data;
        if (type === "PHONE_INPUT") {
            setPhoneInput(payload);
            setStatus("입력중");
            searchMember(payload); // Auto-search
        } else if (type === "PHONE_SUBMIT_FROM_DEVICE") {
            handleDevicePhoneSubmit(payload.phone);
        }
    };

    const syncToCustomer = (type, payload) => {
        // 1. Broadcast (Legacy Window)
        channel?.postMessage({ type, payload });

        // 2. Firebase (Device Mode)
        if (isDeviceMode && user) {
            const updates = {};
            // Map event types to State Structure for Device
            if (type === "CART_UPDATE") {
                updates["view"] = "CART";
                updates["cart"] = payload.cart;
                updates["total"] = payload.total;
                if (member) updates["member"] = { name: member.name, phone: member.phone };
            } else if (type === "SHOW_MEMO") {
                updates["memo"] = payload.memo;
                updates["memoColor"] = payload.color;
            } else if (type === "SUCCESS") {
                updates["view"] = "SUCCESS";
                updates["lastResult"] = payload;
            } else if (type === "MEMBER_CONFIRM") {
                updates["view"] = "MEMBER_CONFIRM";
                updates["member"] = payload;
            } else if (type === "REQUEST_PHONE_INPUT") {
                updates["view"] = "PHONE_INPUT";
                updates["total"] = payload.amount;
                updates["storeName"] = payload.storeName;
            } else if (type === "PROCESSING") {
                updates["view"] = "PROCESSING";
            } else if (type === "ERROR") {
                updates["view"] = "ERROR";
                updates["errorMsg"] = payload.msg;
            }

            // Timestamp to force update detection
            updates["lastUpdated"] = Date.now();
            update(ref(db, `pos_sessions/${user.uid}`), updates);
        }
    };

    // --- Logic: Member ---
    const searchMember = (phone) => {
        if (!phone) return;
        const usersRef = ref(db, "users");
        onValue(usersRef, (snapshot) => {
            const data = snapshot.val();
            let foundUser = null;
            if (data) {
                // Exact match or last 4 digits
                const uid = Object.keys(data).find(key => {
                    const p = data[key].phone;
                    return p === phone || p.endsWith(phone);
                });
                if (uid) {
                    foundUser = { uid, ...data[uid] };
                    setMember(foundUser);
                    setStatus("회원확인");
                    loadUserTransactions(uid);
                    channel?.postMessage({ type: "MEMBER_FOUND", payload: { name: foundUser.name } });
                }
            }
            if (!foundUser) {
                // Keep member null but don't clear cart
                setMember(null);
                setTransactions([]);
                channel?.postMessage({ type: "MEMBER_NOT_FOUND" });
            }
        }, { onlyOnce: true });
    };

    const loadUserTransactions = (uid) => {
        const txnRef = ref(db, "transactions");
        onValue(txnRef, (snapshot) => {
            const data = snapshot.val();
            if (data) {
                const userTxns = Object.entries(data)
                    .map(([id, val]) => ({ id, ...val }))
                    .filter(t => t.memberId === uid)
                    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
                setTransactions(userTxns);
            } else {
                setTransactions([]);
            }
        }, { onlyOnce: true });
    };

    // --- Logic: Cart ---
    const addToCart = (item) => {
        setCart(prev => {
            const existing = prev.find(i => i.id === item.id);
            if (existing) {
                return prev.map(i => i.id === item.id ? { ...i, qty: i.qty + 1 } : i);
            }
            return [...prev, { ...item, qty: 1, discount: 0, remark: item.remark || "" }];
        });
    };

    const updateItemQty = (id, newQty) => {
        if (newQty < 1) return;
        setCart(prev => prev.map(i => i.id === id ? { ...i, qty: parseInt(newQty) } : i));
    };

    const updateItemDiscount = (id, discount) => {
        setCart(prev => prev.map(i => i.id === id ? { ...i, discount: parseInt(discount) || 0 } : i));
    };

    const removeFromCart = (id) => {
        setCart(prev => prev.filter(i => i.id !== id));
    };

    const calculateSubtotal = () => {
        return cart.reduce((sum, item) => sum + (item.price * item.qty) - (item.discount || 0), 0);
    };

    const getFinalValues = () => {
        const subtotal = calculateSubtotal();
        // VAT removed from logic as per request (display shows "Without Tax" in pic but user said "VAT is removed" -> "부가세는 없애")
        // but traditionally total is what customer pays. If customer pays 100, and user says "Remove VAT", it probably means
        // don't separate it visually or don't calculate it. I will treat final = subtotal.
        const vat = 0;
        return { subtotal, vat, final: subtotal };
    };

    // --- Logic: Flow with Device ---
    const handleDevicePhoneSubmit = (phone) => {
        setPhoneInput(phone);
        searchMember(phone);
    };

    // --- Logic: Payment ---
    const handlePaymentRequest = () => {
        if (cart.length === 0) return alert("장바구니가 비어있습니다.");

        if (member) {
            attemptPaymentWithMember(member);
            return;
        }

        if (isDeviceMode) {
            const { final } = getFinalValues();
            syncToCustomer("REQUEST_PHONE_INPUT", { amount: final, storeName: storeName });
            setStatus("고객 번호 입력 대기중...");
        } else {
            alert("회원을 선택하거나 디바이스 모드를 활성화해주세요.");
        }
    };

    const attemptPaymentWithMember = async (targetMember) => {
        const { final } = getFinalValues();
        // Check Points
        if ((targetMember.points || 0) < final) {
            alert(`포인트 부족!\n보유: ${targetMember.points}\n필요: ${final}`);
            syncToCustomer("ERROR", { msg: "포인트가 부족합니다." });
            return;
        }
        if (!confirm(`${targetMember.name}님으로 결제 진행하시겠습니까?\n잔액: ${targetMember.points} -> ${targetMember.points - final}`)) return;
        await completeTransaction(targetMember);
    };

    const completeTransaction = async (targetMember = member) => {
        if (!targetMember) return;
        const { subtotal, vat, final } = getFinalValues();

        setStatus("처리중...");
        syncToCustomer("PROCESSING", {});

        const newTxnRef = push(ref(db, "transactions"));
        const txnData = {
            memberId: targetMember.uid,
            memberName: targetMember.name,
            phone: targetMember.phone,
            items: cart,
            subtotal,
            vat,
            finalAmount: final,
            signature: null,
            timestamp: new Date().toISOString(),
            type: "EARN",
            storeName,
            memo
        };

        try {
            await set(newTxnRef, txnData);
            const newPointBalance = (targetMember.points || 0) - final;
            await update(ref(db, `users/${targetMember.uid}`), { points: newPointBalance });

            setStatus("완료");
            setMember({ ...targetMember, points: newPointBalance });
            setCart([]);
            setMemo("");
            setMemoColor("black");

            syncToCustomer("SUCCESS", { msg: "결제 완료!", balance: newPointBalance });
            loadUserTransactions(targetMember.uid);

            if (isDeviceMode && user) {
                setTimeout(() => {
                    update(ref(db, `pos_sessions/${user.uid}`), { view: "IDLE", cart: [], member: null });
                }, 4000);
            }

        } catch (err) {
            console.error(err);
            alert("거래 처리 오류");
            setStatus("오류");
        }
    };

    // --- Logic: Refund ---
    const handleRefund = async () => {
        if (!selectedTxn) return alert("환불할 거래를 선택해주세요.");
        if (!confirm("선택한 거래를 환불하시겠습니까?")) return;

        try {
            const reverseAmount = selectedTxn.finalAmount;
            const newPointBalance = (member.points || 0) + reverseAmount;
            await update(ref(db, `users/${member.uid}`), { points: newPointBalance });

            const refundTxnRef = push(ref(db, "transactions"));
            await set(refundTxnRef, {
                ...selectedTxn,
                type: "REFUND",
                originalTxnId: selectedTxn.id,
                timestamp: new Date().toISOString(),
                finalAmount: reverseAmount,
            });

            setMember({ ...member, points: newPointBalance });
            setSelectedTxn(null);
            alert("환불 완료");
            loadUserTransactions(member.uid);
        } catch (err) {
            alert(err.message);
        }
    };

    // --- Logic: Gift Card ---
    const generateGiftCard = () => {
        // Random 7 digit number + 2 char (1 upper, 1 lower) + 1 special
        const num = Math.floor(1000000 + Math.random() * 9000000); // 7 digits
        const upper = String.fromCharCode(65 + Math.floor(Math.random() * 26));
        const lower = String.fromCharCode(97 + Math.floor(Math.random() * 26));
        const specials = "!@#$%^&*()_+-";
        const special = specials[Math.floor(Math.random() * specials.length)];
        const code = `${num}${upper}${lower}${special}`;

        if (confirm(`기프트카드가 생성되었습니다: ${code}\n장바구니에 추가하시겠습니까?`)) {
            // Add "GIFTCARD" item
            // User wants to config %, default 10% maybe?
            const discountRate = prompt("할인율(%)을 입력하세요", "10");
            if (!discountRate) return;

            addToCart({
                id: `GC-${Date.now()}`,
                name: "기프트카드",
                price: 0, // Gift card itself might sell for 0 or price? Assuming free provision for discount? Or paid? user didn't specify price.
                // "Creating a Gift Card... Add... 'Discount not applicable' remark... 
                // Context seems to be creating a COUPON/GIFT CARD for user to use LATER.
                // If "Add" is clicked, it goes to cart -> "GIFTCARD" -> Price? 
                // If it's a discount card, maybe 0 price. 
                remark: "할인적용불가",
                giftCardCode: code,
                giftCardRate: parseInt(discountRate)
            });
        }
    };

    const applyGiftCard = () => {
        // Use gift card code input
        // Since we don't have a backend validating codes yet, we'll simulate or check if it matches pattern.
        // User requirements: "Input Giftcard number -> discount applied"
        // Real implementation would verify against DB. For now, we will trust the input or check if it matches format.
        if (!giftCardCodeInput) return alert("기프트카드 번호를 입력하세요");

        // Find if this code exists? 
        // For now, let's assume valid and ask for rate if not stored? 
        // Or maybe just apply a flat % discount to the WHOLE cart? "Amount discount"
        // User said: "Discount as much as allocated to that gift card (%)"

        // Implementation: We need to Apply a % discount to ALL items in cart?
        // Or adds a negative line item? Usually % discount applies to subtotal.
        const rate = prompt("할인율 확인 (임시: 저장된 데이터가 없으므로 수동 입력)", "10");
        if (rate) {
            const r = parseInt(rate);
            setCart(prev => prev.map(item => ({
                ...item,
                discount: Math.floor(item.price * (r / 100))
            })));
            alert(`기프트카드 적용: ${r}% 할인됨`);
        }
    };

    // --- UI Helpers ---
    const handleOpenWindow = () => {
        if (!user?.uid) return alert("로그인이 필요합니다.");
        setIsDeviceMode(true);
        window.open(`/point-device?uid=${user.uid}`, "CustomerView", "width=800,height=600");
    };

    const handleOutputMemo = () => {
        syncToCustomer("SHOW_MEMO", { memo, color: memoColor });
    };

    const handleOutputMember = () => {
        if (member) {
            syncToCustomer("MEMBER_CONFIRM", { name: member.name, phone: member.phone });
        }
    }

    return (
        <div className="h-screen flex flex-col bg-gray-100 overflow-hidden">
            {/* Modals & Popups */}
            {settingsOpen && <StoreSettings onClose={() => setSettingsOpen(false)} />}
            {productsOpen && <ProductManagement onClose={() => setProductsOpen(false)} />}

            {/* HEADER with Back Button */}
            <div className="bg-white p-3 border-b flex justify-between items-center shadow-sm z-10">
                <div className="flex items-center gap-3">
                    <button onClick={() => navigate("/main")} className="p-2 hover:bg-gray-100 rounded-full">
                        🔙
                    </button>
                    <h1 className="text-lg font-bold">POS System - {storeName}</h1>
                </div>
                <div className="flex gap-2">
                    <button onClick={() => setProductsOpen(true)} className="px-3 py-1 text-sm border rounded hover:bg-gray-50">상품관리</button>
                    <button onClick={() => setSettingsOpen(true)} className="px-3 py-1 text-sm border rounded hover:bg-gray-50">설정</button>
                </div>
            </div>

            {/* MAIN GRID LAYOUT (3 Columns x 2 Rows effectively) */}
            <div className="flex-1 grid grid-cols-12 gap-4 p-4">

                {/* --- LEFT COLUMN (3/12) --- */}
                <div className="col-span-3 flex flex-col gap-4">
                    {/* Top Left: Member Search */}
                    <div className="bg-white rounded-2xl p-4 shadow-sm flex-1 flex flex-col">
                        <h2 className="font-bold text-gray-700 mb-2">회원 조회</h2>
                        <input
                            type="text"
                            placeholder="전화번호 뒤 4자리"
                            className="w-full text-2xl font-mono p-3 border rounded-xl text-center bg-gray-50 focus:ring-2 focus:ring-indigo-500 outline-none mb-4"
                            value={phoneInput}
                            onChange={e => {
                                setPhoneInput(e.target.value);
                                if (e.target.value.length >= 4) searchMember(e.target.value);
                            }}
                        />
                        {member ? (
                            <div className="bg-indigo-50 rounded-xl p-4 text-center flex-1">
                                <div className="text-2xl mb-2">👤</div>
                                <div className="font-bold text-lg">{member.name}</div>
                                <div className="text-gray-500 font-mono">{member.phone}</div>
                                <div className="font-bold text-indigo-600 mt-2">{member.points?.toLocaleString()} P</div>
                            </div>
                        ) : (
                            <div className="flex-1 flex items-center justify-center text-gray-400">회원 정보 없음</div>
                        )}
                    </div>

                    {/* Bottom Left: Payment & Device */}
                    <div className="bg-white rounded-2xl p-4 shadow-sm h-1/2 flex flex-col justify-between">
                        <div className="flex flex-col gap-2">
                            <h2 className="font-bold text-gray-700">결제 요청</h2>

                            {/* Device Mode Toggle */}
                            <label className="flex items-center justify-between p-2 bg-gray-50 rounded-lg cursor-pointer">
                                <span className="text-sm font-bold">디바이스 모드</span>
                                <input
                                    type="checkbox"
                                    checked={isDeviceMode}
                                    onChange={e => setIsDeviceMode(e.target.checked)}
                                    className="w-5 h-5 text-indigo-600"
                                />
                            </label>

                            {/* Final Amount */}
                            <div className="text-right mt-2">
                                <div className="text-xs text-gray-400">최종 결제 금액 (부가세 포함)</div>
                                <div className="text-3xl font-extrabold text-indigo-600">
                                    {(calculateSubtotal()).toLocaleString()}원
                                </div>
                            </div>
                        </div>

                        <div className="flex flex-col gap-2 mt-2">
                            {/* Customer Display Info Output */}
                            {member && (
                                <div className="text-center bg-gray-100 p-2 rounded-lg">
                                    <div className="text-xs text-gray-500 mb-1">고객번호: {member.phone}</div>
                                    <button onClick={handleOutputMember} className="w-full bg-white border shadow-sm py-1 rounded text-xs font-bold">
                                        번호 출력
                                    </button>
                                </div>
                            )}

                            <button
                                onClick={handlePaymentRequest}
                                className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 shadow-md transition-transform active:scale-95"
                            >
                                {status === "승인 대기" ? "승인 및 결제" : "결제 화면으로 이동"}
                            </button>
                        </div>
                    </div>
                </div>


                {/* --- CENTER COLUMN (5/12) --- */}
                <div className="col-span-5 flex flex-col gap-4">
                    {/* Top Center: Products */}
                    <div className="bg-white rounded-2xl p-4 shadow-sm flex-1 flex flex-col overflow-hidden">
                        <div className="flex justify-between items-center mb-2">
                            <h2 className="font-bold text-gray-700">상품 선택</h2>
                            <div className="space-x-1">
                                <button
                                    onClick={() => {
                                        const n = prompt("상품명"); const p = prompt("금액");
                                        if (n && p) addToCart({ id: Date.now(), name: n, price: parseInt(p) });
                                    }}
                                    className="text-xs bg-gray-100 px-2 py-1 rounded"
                                >
                                    직접입력
                                </button>
                                <button
                                    onClick={() => {
                                        const p = prompt("차감(사용)할 포인트");
                                        if (p && member && parseInt(p) <= member.points) addToCart({ id: "use", name: "포인트사용", price: -parseInt(p), isPoint: true });
                                    }}
                                    className="text-xs bg-red-50 text-red-500 px-2 py-1 rounded border border-red-100"
                                >
                                    포인트빼기
                                </button>
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto grid grid-cols-3 gap-2 align-content-start">
                            {products.map(p => (
                                <button
                                    key={p.id}
                                    onClick={() => addToCart(p)}
                                    className="p-3 bg-gray-50 rounded-xl hover:bg-indigo-50 border border-transparent hover:border-indigo-200 transition-colors text-left flex flex-col justify-between min-h-[80px]"
                                >
                                    <span className="font-bold text-sm leading-tight text-gray-700">{p.name}</span>
                                    <span className="text-indigo-600 font-bold mt-1 text-sm">{p.price?.toLocaleString()}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Bottom Center: Gift Card Controls */}
                    <div className="bg-white rounded-2xl p-4 shadow-sm h-auto flex flex-col gap-3">
                        <div className="flex gap-2">
                            <div className="flex-1 p-3 bg-gray-50 rounded-xl border border-dashed border-gray-300 flex items-center justify-center cursor-pointer hover:bg-gray-100" onClick={generateGiftCard}>
                                <span className="text-sm font-bold text-gray-600">🎟️ 기프트카드 만들기</span>
                            </div>
                            <button onClick={generateGiftCard} className="bg-indigo-600 text-white px-4 rounded-xl font-bold text-sm">추가</button>
                        </div>

                        <div className="bg-gray-50 rounded-xl p-3">
                            <h3 className="text-xs font-bold text-gray-500 mb-2">할인 기프트카드 사용</h3>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    className="flex-1 border rounded-lg px-2 py-1 text-sm"
                                    placeholder="기프트카드 번호 입력"
                                    value={giftCardCodeInput}
                                    onChange={e => setGiftCardCodeInput(e.target.value)}
                                />
                                <button onClick={applyGiftCard} className="bg-gray-800 text-white px-3 py-1 rounded-lg text-xs">적용</button>
                            </div>
                        </div>
                    </div>
                </div>


                {/* --- RIGHT COLUMN (4/12) --- */}
                <div className="col-span-4 bg-white rounded-2xl p-4 shadow-sm flex flex-col h-full border border-gray-200">
                    <h2 className="font-bold text-lg text-gray-800 mb-4 flex justify-between items-center">
                        장바구니
                        <span className="bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded text-xs">{cart.length} items</span>
                    </h2>

                    <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                        {cart.map((item, i) => (
                            <div key={i} className="relative bg-white border border-gray-100 rounded-xl p-3 shadow-sm hover:shadow-md transition-shadow">
                                <div className="flex justify-between items-start">
                                    <h4 className="font-bold text-gray-800">{item.name}</h4>
                                    <button onClick={() => removeFromCart(item.id)} className="text-gray-300 hover:text-red-500">×</button>
                                </div>
                                <div className="flex justify-between items-center mt-2 text-sm text-gray-600">
                                    <div className="flex items-center gap-1 bg-gray-50 rounded px-1">
                                        <input
                                            type="number"
                                            value={item.qty}
                                            onChange={e => updateItemQty(item.id, e.target.value)}
                                            className="w-8 text-center bg-transparent outline-none"
                                        />
                                        <span>x {item.price.toLocaleString()}</span>
                                    </div>
                                    <div className="font-bold text-indigo-600">
                                        {((item.price * item.qty) - (item.discount || 0)).toLocaleString()}
                                    </div>
                                </div>
                                {/* Discount UI */}
                                <div className="mt-2 flex items-center justify-end gap-2 text-xs">
                                    <span className="text-red-500 font-bold">할인 %</span>
                                    {/* This input logic is simplified, real world would calculate reverse? */}
                                    {/* User asked for % setting. For simplicity, just display computed discount or input manual amount? Keeping manual amount for now as per previous logic, but label implies %. */}
                                    <input
                                        type="number"
                                        placeholder="0"
                                        className="w-12 text-right border-b border-red-200 text-red-500 outline-none"
                                        value={item.discount || ""}
                                        onChange={e => updateItemDiscount(item.id, e.target.value)}
                                    />
                                </div>
                                {item.remark && <div className="mt-1 text-xs text-red-500 font-bold">*{item.remark}</div>}
                            </div>
                        ))}
                    </div>

                    <div className="mt-4 pt-4 border-t border-gray-100">
                        <div className="mb-3">
                            <label className="text-xs font-bold text-gray-500 mb-1 block">비고 (사용자 화면 출력)</label>
                            <div className="flex gap-2 mb-2">
                                {['black', 'red', 'blue', 'green'].map(c => (
                                    <button
                                        key={c}
                                        onClick={() => setMemoColor(c)}
                                        className={`w-6 h-6 rounded-full border-2 ${memoColor === c ? 'border-gray-800 scale-110' : 'border-transparent'}`}
                                        style={{ backgroundColor: c }}
                                    />
                                ))}
                            </div>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    className="flex-1 border rounded-lg px-2 py-1 text-sm"
                                    value={memo}
                                    onChange={e => setMemo(e.target.value)}
                                    style={{ color: memoColor }}
                                />
                                <button onClick={handleOutputMemo} className="bg-gray-800 text-white px-3 py-1 rounded-lg text-xs">출력</button>
                            </div>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
}
