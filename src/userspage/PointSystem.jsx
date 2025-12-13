import { useState, useEffect, useRef } from "react";
import { getDatabase, ref, onValue, push, set, update, get } from "firebase/database";
import { useAuth } from "../context/AuthContext";
import StoreSettings from "./StoreSettings";
import ProductManagement from "./ProductManagement";

export default function PointSystem() {
    // --- State ---
    const { currentUser: user } = useAuth();
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
    const [vatEnabled, setVatEnabled] = useState(true);

    // Refund / History
    const [transactions, setTransactions] = useState([]);
    const [selectedTxn, setSelectedTxn] = useState(null);

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
            // Flow: Customer entered phone on device -> Manager receives -> Finds Member -> Pay
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
            } else if (type === "REQUEST_SIGNATURE") {
                updates["view"] = "SIGNATURE";
                updates["confirmData"] = payload;
            } else if (type === "SHOW_MEMO") {
                updates["memo"] = payload.memo;
            } else if (type === "SUCCESS") {
                updates["view"] = "SUCCESS";
                updates["lastResult"] = payload;
            } else if (type === "MEMBER_CONFIRM") {
                updates["view"] = "MEMBER_CONFIRM";
                updates["member"] = payload;
            } else if (type === "MEMBER_NOT_FOUND") {
                // Do nothing specific or reset member
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
                const uid = Object.keys(data).find(key => data[key].phone === phone);
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
        // V3: Allow adding without member
        setCart(prev => {
            const existing = prev.find(i => i.id === item.id);
            if (existing) {
                return prev.map(i => i.id === item.id ? { ...i, qty: i.qty + 1 } : i);
            }
            return [...prev, { ...item, qty: 1, discount: 0 }];
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
        const vat = Math.floor(subtotal * 0.2);
        return { subtotal, vat, final: subtotal + vat };
    };

    // --- Logic: Flow with Device ---
    const handleDevicePhoneSubmit = (phone) => {
        setPhoneInput(phone);
        // Search member
        const usersRef = ref(db, "users");
        get(usersRef).then((snapshot) => {
            const data = snapshot.val();
            let foundUser = null;
            if (data) {
                const uid = Object.keys(data).find(key => data[key].phone === phone);
                if (uid) {
                    foundUser = { uid, ...data[uid] };
                    setMember(foundUser);
                    setStatus("승인 대기"); // Changed status to indicate waiting for Manager Approval

                    // STOP Auto-payment
                    // attemptPaymentWithMember(foundUser); 

                    // Notify Customer Screen to wait? Or just stay on "Phone Input" but maybe show "Waiting for Manager"?
                    // For now, let's keep customer on Input screen or switch to a "Waiting" view?
                    // User just said "Approval needed".
                }
            }
            if (!foundUser) {
                alert("회원을 찾을 수 없습니다.");
                syncToCustomer("ERROR", { msg: "회원을 찾을 수 없습니다." });
            }
        });
    };

    const attemptPaymentWithMember = async (targetMember) => {
        const { final } = getFinalValues();

        // Check Points
        if ((targetMember.points || 0) < final) {
            alert(`포인트 부족!\n보유: ${targetMember.points}\n필요: ${final}`);
            syncToCustomer("ERROR", { msg: "포인트가 부족합니다." });
            return;
        }

        // Confirm? 
        if (!confirm(`${targetMember.name}님으로 결제 진행하시겠습니까?\n잔액: ${targetMember.points} -> ${targetMember.points - final}`)) return;

        // Execute
        await completeTransaction(targetMember);
    };

    // --- Logic: Payment ---
    const handlePaymentRequest = () => {
        if (cart.length === 0) return alert("장바구니가 비어있습니다.");

        // Scenario 1: Member already selected -> Proceed to Payment
        if (member) {
            attemptPaymentWithMember(member);
            return;
        }

        // Scenario 2: No member -> Request Input on Device
        if (isDeviceMode) {
            const { final } = getFinalValues();
            // Pass storeName and amount
            syncToCustomer("REQUEST_PHONE_INPUT", { amount: final, storeName: storeName });
            setStatus("고객 번호 입력 대기중...");
        } else {
            alert("회원을 선택하거나 디바이스 모드를 활성화해주세요.");
        }
    };

    const completeTransaction = async (targetMember = member) => {
        if (!targetMember) return;
        const { subtotal, vat, final } = getFinalValues();

        // Check Points again before final transaction
        if ((targetMember.points || 0) < final) {
            alert(`포인트 부족!\n보유: ${targetMember.points}\n필요: ${final}`);
            syncToCustomer("ERROR", { msg: "포인트가 부족합니다." });
            return;
        }

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

            // Deduct Points
            const newPointBalance = (targetMember.points || 0) - final;
            await update(ref(db, `users/${targetMember.uid}`), { points: newPointBalance });

            setStatus("완료");
            setMember({ ...targetMember, points: newPointBalance });
            setCart([]);
            setMemo("");

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
            // Refund = Add points back
            // Warning: transactions store 'finalAmount' as positive, but for refund logic we usually treat it as giving back money.
            // If we deducted points earlier, here we add them back.
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

    // --- UI Helpers ---
    const handleOpenWindow = () => {
        if (!user?.uid) return alert("로그인이 필요합니다.");
        setIsDeviceMode(true); // Auto-enable sync
        window.open(`/point-device?uid=${user.uid}`, "CustomerView", "width=800,height=600");
    };

    const handleOutputMemo = () => {
        syncToCustomer("SHOW_MEMO", { memo });
    };

    const handleOutputMember = () => {
        if (member) {
            syncToCustomer("MEMBER_CONFIRM", { name: member.name, phone: member.phone });
        }
    }

    // Force Sync Button
    const handleForceSync = () => {
        // Force current state to Sync
        if (isDeviceMode && user) {
            const updates = {
                view: "IDLE",
                lastUpdated: Date.now()
            };
            if (cart.length > 0) {
                updates.view = "CART";
                updates.cart = cart;
                updates.total = calculateSubtotal();
            }
            if (member) {
                updates.member = { name: member.name, phone: member.phone };
                // If specific view was "MEMBER_CONFIRM", we might want to manually trigger that?
                // But Force Sync likely means "Reset to Current State".
            }
            update(ref(db, `pos_sessions/${user.uid}`), updates);
        }
    }

    return (
        <div className="h-full flex flex-col space-y-4">
            {/* Modals */}
            {settingsOpen && <StoreSettings onClose={() => setSettingsOpen(false)} />}
            {productsOpen && <ProductManagement onClose={() => setProductsOpen(false)} />}

            {/* Header */}
            <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                <div className="flex items-center gap-4">
                    <h2 className="text-xl font-bold flex items-center gap-2">
                        <img src="/logos/memu.png" className="h-6 w-auto" alt="" />
                        Jeongwon POS
                    </h2>
                    <div className="flex bg-gray-100 rounded-lg p-1 text-sm">
                        <button onClick={() => setMode("POS")} className={`px-3 py-1 rounded-md transition-colors ${mode === "POS" ? "bg-white shadow text-indigo-600 font-bold" : "text-gray-500"}`}>POS 결제</button>
                        <button onClick={() => setMode("REFUND")} className={`px-3 py-1 rounded-md transition-colors ${mode === "REFUND" ? "bg-white shadow text-red-600 font-bold" : "text-gray-500"}`}>환불/내역</button>
                    </div>
                </div>
                <div className="flex gap-2 items-center">
                    <button onClick={() => setProductsOpen(true)} className="bg-white border text-gray-700 px-3 py-2 rounded-lg text-sm hover:bg-gray-50">📦 상품관리</button>
                    <button onClick={() => setSettingsOpen(true)} className="bg-white border text-gray-700 px-3 py-2 rounded-lg text-sm hover:bg-gray-50">⚙️ 가맹점설정</button>
                    <button onClick={handleOpenWindow} className="bg-gray-800 text-white px-3 py-2 rounded-lg text-sm hover:bg-gray-700">🖥️ 고객창 열기</button>
                </div>
            </div>

            <div className="flex-1 grid grid-cols-12 gap-4">
                {/* COL 1: Member Info (3/12) */}
                <div className="col-span-3 bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex flex-col">
                    <h3 className="font-bold text-gray-700 mb-4 border-b pb-2">회원 조회</h3>
                    <div className="mb-4">
                        <input
                            type="text"
                            value={phoneInput}
                            onChange={(e) => {
                                setPhoneInput(e.target.value);
                                setStatus("입력중");
                                searchMember(e.target.value);
                            }}
                            placeholder="전화번호 뒷자리 입력"
                            className="w-full text-2xl font-mono p-3 border rounded-lg bg-gray-50 text-center focus:ring-2 focus:ring-indigo-500 outline-none"
                        />
                    </div>

                    {member ? (
                        <div className="flex-1 bg-indigo-50 rounded-xl p-4 flex flex-col items-center text-center space-y-2 animate-fade-in relative">
                            <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center text-2xl shadow-sm mb-2">👤</div>
                            <h4 className="text-xl font-bold text-indigo-900">{member.name}</h4>
                            <p className="text-indigo-600 font-mono">{member.phone}</p>
                            <div className="mt-4 bg-white px-6 py-2 rounded-full shadow-sm w-full">
                                <span className="text-sm text-gray-500 mr-2">보유 포인트</span>
                                <span className="font-bold text-lg text-indigo-600">{member.points?.toLocaleString()} P</span>
                            </div>
                            <button onClick={handleOutputMember} className="mt-4 text-xs bg-indigo-600 text-white py-2 px-4 rounded-full shadow-sm hover:bg-indigo-500 w-full">
                                📢 고객에게 회원정보 출력
                            </button>
                        </div>
                    ) : (
                        <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
                            회원 정보가 없습니다
                        </div>
                    )}
                </div>

                {/* COL 2: Middle - Product/Refund (5/12) */}
                <div className="col-span-5 bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex flex-col">
                    {mode === "POS" ? (
                        <>
                            <h3 className="font-bold text-gray-700 mb-4 border-b pb-2">상품/금액 입력</h3>
                            <div className="grid grid-cols-2 gap-3 mb-4 max-h-[400px] overflow-y-auto">
                                {products.map((item) => (
                                    <button
                                        key={item.id}
                                        onClick={() => addToCart(item)}
                                        className="p-4 bg-gray-50 rounded-xl hover:bg-indigo-50 hover:text-indigo-600 transition-colors font-medium border border-gray-100 text-left"
                                    >
                                        <div className="text-sm">{item.name}</div>
                                        <div className="font-bold">{item.price?.toLocaleString()}원</div>
                                    </button>
                                ))}
                                <button onClick={() => {
                                    const name = prompt("상품명");
                                    const price = prompt("금액");
                                    if (name && price) addToCart({ id: Date.now(), name, price: parseInt(price) });
                                }} className="p-4 border-2 border-dashed border-gray-200 rounded-xl text-gray-400 hover:border-indigo-300 hover:text-indigo-500">
                                    + 직접 입력
                                </button>
                                <button onClick={() => {
                                    if (!member) return alert("회원 선택 필요");
                                    const usageAmount = prompt("사용할 포인트를 입력하세요");
                                    if (!usageAmount) return;
                                    if (parseInt(usageAmount) > member.points) return alert("포인트 부족");
                                    addToCart({ id: "use_point", name: "포인트 사용", price: -parseInt(usageAmount), isPoint: true });
                                }} className="p-4 bg-red-50 text-red-600 border border-red-100 rounded-xl hover:bg-red-100 font-bold">
                                    - 포인트 사용
                                </button>
                            </div>

                            <div className="mt-auto">
                                <label className="text-xs font-bold text-gray-500 mb-1 block">비고 / 메모 (출력 가능)</label>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={memo}
                                        onChange={e => setMemo(e.target.value)}
                                        className="flex-1 border rounded-lg px-3 py-2 text-sm"
                                        placeholder="고객에게 보여줄 메시지나 메모"
                                    />
                                    <button onClick={handleOutputMemo} className="bg-gray-800 text-white px-3 py-2 rounded-lg text-xs whitespace-nowrap">
                                        출력
                                    </button>
                                </div>
                            </div>
                        </>
                    ) : (
                        // REFUND MODE reused
                        <>
                            <h3 className="font-bold text-gray-700 mb-4 border-b pb-2">최근 거래 내역</h3>
                            <div className="flex-1 overflow-y-auto space-y-2 pr-2">
                                {transactions.length === 0 && <div className="text-center text-gray-400 mt-10">거래 내역이 없습니다</div>}
                                {transactions.map(txn => (
                                    <div
                                        key={txn.id}
                                        onClick={() => setSelectedTxn(txn)}
                                        className={`p-3 rounded-lg border cursor-pointer flex justify-between items-center ${selectedTxn?.id === txn.id ? "bg-red-50 border-red-200" : "bg-gray-50 border-gray-100 hover:bg-gray-100"}`}
                                    >
                                        <div>
                                            <div className="text-xs text-gray-500">{new Date(txn.timestamp).toLocaleString()}</div>
                                            <div className={`font-bold ${txn.type === 'REFUND' ? 'text-red-500' : 'text-gray-800'}`}>
                                                {txn.type === 'REFUND' ? '환불됨' : `${txn.finalAmount?.toLocaleString()}원`}
                                            </div>
                                            <div className="text-xs text-gray-400">{txn.storeName}</div>
                                        </div>
                                        {txn.type !== 'REFUND' && <div className="text-xs bg-white border px-2 py-1 rounded">선택</div>}
                                    </div>
                                ))}
                            </div>
                            {selectedTxn && selectedTxn.type !== 'REFUND' && (
                                <button onClick={handleRefund} className="mt-4 w-full bg-red-500 text-white py-3 rounded-xl font-bold hover:bg-red-600 shadow-md">
                                    선택한 거래 환불하기
                                </button>
                            )}
                        </>
                    )}
                </div>

                {/* COL 3: Cart & Pay (4/12) */}
                <div className="col-span-4 bg-gray-50 rounded-xl shadow-inner border border-gray-200 p-4 flex flex-col">
                    <h3 className="font-bold text-gray-700 mb-4 flex justify-between items-center">
                        <span>장바구니</span>
                        <span className="text-xs bg-white px-2 py-1 rounded border">항목 {cart.length}</span>
                    </h3>

                    <div className="flex-1 overflow-y-auto space-y-2 mb-4 pr-2">
                        {cart.map((item, idx) => (
                            <div key={idx} className="bg-white p-3 rounded-lg shadow-sm border border-gray-100">
                                <div className="flex justify-between items-start mb-2">
                                    <div className="font-medium text-sm text-gray-800 break-words w-2/3">{item.name}</div>
                                    <button onClick={() => removeFromCart(item.id)} className="text-red-400 hover:text-red-600 text-xs">삭제</button>
                                </div>
                                <div className="flex items-center gap-2 text-xs text-gray-600 bg-gray-50 p-2 rounded">
                                    <input type="number" value={item.qty} min="1" onChange={(e) => updateItemQty(item.id, e.target.value)} className="w-10 p-1 border rounded text-center" />
                                    <span>개 x {item.price.toLocaleString()}</span>
                                    <span className="text-gray-300">|</span>
                                    <span>할인</span>
                                    <input type="number" value={item.discount || 0} onChange={(e) => updateItemDiscount(item.id, e.target.value)} className="w-16 p-1 border rounded text-right text-red-500" placeholder="0" />
                                </div>
                                <div className="text-right font-bold text-indigo-600 mt-1">
                                    {((item.price * item.qty) - (item.discount || 0)).toLocaleString()}원
                                </div>
                            </div>
                        ))}
                        {cart.length === 0 && <div className="text-center text-gray-400 text-sm mt-10">상품을 담아주세요</div>}
                    </div>

                    <div className="bg-white p-4 rounded-xl shadow-sm space-y-1">
                        <div className="flex justify-between text-xs text-gray-400">
                            <span>공급가액</span>
                            <span>{calculateSubtotal().toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between text-xs text-gray-400">
                            <span>부가세(20%)</span>
                            <span>{Math.floor(calculateSubtotal() * 0.2).toLocaleString()}</span>
                        </div>
                        <div className="border-t pt-2 mt-2 flex justify-between items-center">
                            <span className="font-bold text-lg text-gray-800">최종 결제</span>
                            <span className="font-bold text-2xl text-indigo-600">
                                {(calculateSubtotal() + Math.floor(calculateSubtotal() * 0.2)).toLocaleString()}원
                            </span>
                        </div>
                    </div>

                    {/* Checkbox for Device Mode */}
                    <div className="mt-4 flex flex-col space-y-2 px-2">
                        <label className="flex items-center space-x-2 text-sm text-gray-600 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={isDeviceMode}
                                onChange={(e) => setIsDeviceMode(e.target.checked)}
                                className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-gray-300"
                            />
                            <span className="font-bold">디바이스 모드 사용</span>
                        </label>

                        {isDeviceMode && (
                            <div className="bg-indigo-50 p-2 rounded-lg border border-indigo-100 flex flex-col gap-1">
                                <div className="flex justify-between items-center">
                                    <span className="text-xs text-indigo-800 font-bold">기기 연결 ID (UID)</span>
                                    <button onClick={handleForceSync} className="text-xs bg-indigo-200 text-indigo-700 px-2 py-0.5 rounded hover:bg-indigo-300">
                                        동기화
                                    </button>
                                </div>
                                <div className="flex gap-1">
                                    <input
                                        type="text"
                                        readOnly
                                        value={user?.uid || ""}
                                        className="flex-1 text-xs bg-white border border-indigo-200 rounded px-2 py-1 text-gray-500 select-all"
                                    />
                                    <button
                                        onClick={() => {
                                            navigator.clipboard.writeText(user?.uid);
                                            alert("UID가 복사되었습니다.");
                                        }}
                                        className="bg-indigo-600 text-white text-xs px-2 rounded hover:bg-indigo-700"
                                    >
                                        복사
                                    </button>
                                </div>
                                <div className="text-[10px] text-gray-400">
                                    * 연결 URL: /point-device?uid={user?.uid?.slice(0, 5)}...
                                </div>
                            </div>
                        )}
                    </div>

                    <button
                        onClick={handlePaymentRequest}
                        disabled={cart.length === 0}
                        className={`w-full mt-4 text-white py-4 rounded-xl font-bold text-lg shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed ${status === "승인 대기" ? "bg-indigo-600 hover:bg-indigo-700 animate-pulse" : "bg-gray-900 hover:bg-gray-800"}`}
                    >
                        {status === "서명대기" ? "서명 대기중..." : (status === "처리중..." ? "결제 처리중..." : (status === "승인 대기" ? "승인 및 결제 (회원확인됨)" : "결제 및 서명 요청"))}
                    </button>
                </div>
            </div>
        </div>
    );
}
