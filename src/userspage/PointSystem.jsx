import { useState, useEffect, useRef } from "react";
import { getDatabase, ref, onValue, push, set, update, get, remove } from "firebase/database";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import StoreSettings from "./StoreSettings";
import ProductManagement from "./ProductManagement";

export default function PointSystem() {
    // --- State ---
    const { currentUser: user } = useAuth();
    const navigate = useNavigate();
    const [channel, setChannel] = useState(null);
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [productsOpen, setProductsOpen] = useState(false);

    // Device Mode State
    const [isDeviceMode, setIsDeviceMode] = useState(false);
    const [shortCode, setShortCode] = useState("");

    // Data
    const [storeName, setStoreName] = useState("정원랩");
    const [products, setProducts] = useState([]);
    const [currentTime, setCurrentTime] = useState("");

    // Member & Input
    const [phoneInput, setPhoneInput] = useState("");
    const [member, setMember] = useState(null);
    const [status, setStatus] = useState("대기중");

    // Cart & Transaction
    const [cart, setCart] = useState([]);
    const [memo, setMemo] = useState("");
    const [memoColor, setMemoColor] = useState("black"); // black, red, blue, green

    // Gift Card State
    const [giftCardCodeInput, setGiftCardCodeInput] = useState("");

    // Refund / History
    // (Collapsed into Product/History section if needed, but for now we focus on POS logic)

    const db = getDatabase();

    // --- Effects ---
    useEffect(() => {
        // Time Clock
        const timer = setInterval(() => {
            const now = new Date();
            const hours = now.getHours();
            const minutes = now.getMinutes();
            const ampm = hours >= 12 ? 'PM' : 'AM';
            const h = hours % 12 || 12;
            const m = minutes < 10 ? `0${minutes}` : minutes;
            setCurrentTime(`${ampm} ${h}:${m}`);
        }, 1000);
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        const bc = new BroadcastChannel("point_system_channel");
        bc.onmessage = handleBroadcastMessage;
        setChannel(bc);
        return () => bc.close();
    }, []);

    useEffect(() => {
        if (!user) return;

        // Generate or Fetch Short Code
        const checkShortCode = async () => {
            // We can store the shortcode in user's profile to persist it, or generated unique every time?
            // Ideally persistent so they can print it? 
            // Let's store in `users/{uid}/posCode`
            const userRef = ref(db, `users/${user.uid}/posCode`);
            const snap = await get(userRef);
            if (snap.exists()) {
                setShortCode(snap.val());
                // Ensure mapping exists
                update(ref(db, `pos_codes/${snap.val()}`), { uid: user.uid });
            } else {
                // Generate new
                let code = "";
                let exists = true;
                while (exists) {
                    code = Math.floor(10000 + Math.random() * 90000).toString(); // 5 digits
                    const check = await get(ref(db, `pos_codes/${code}`));
                    if (!check.exists()) exists = false;
                }
                await set(ref(db, `pos_codes/${code}`), { uid: user.uid });
                await set(ref(db, `users/${user.uid}/posCode`), code);
                setShortCode(code);
            }
        };
        checkShortCode();
    }, [user]);

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
            } else if (type === "RESET") {
                updates["view"] = "IDLE";
                updates["cart"] = [];
                updates["member"] = null;
                updates["total"] = 0;
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
                    channel?.postMessage({ type: "MEMBER_FOUND", payload: { name: foundUser.name } });
                }
            }
            if (!foundUser) {
                // Keep member null but don't clear cart
                setMember(null);
                channel?.postMessage({ type: "MEMBER_NOT_FOUND" });
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
            return [...prev, { ...item, qty: 1, discount: 0, remark: item.remark || "", giftCardCode: item.giftCardCode || null }];
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

            // Also update any used gift cards to 'used'? 
            // For logic simplicity, we assume they are multi-use or simple generic codes unless specified.
            // But if we generated unique codes, we might want to mark them.
            // Check items for GiftCardUsage? Not implemented complexity yet.

        } catch (err) {
            console.error(err);
            alert("거래 처리 오류");
            setStatus("오류");
        }
    };

    // --- Logic: Gift Card ---
    const generateGiftCard = async () => {
        // Random 7 digit number + 2 char (1 upper, 1 lower) + 1 special
        const num = Math.floor(1000000 + Math.random() * 9000000);
        const upper = String.fromCharCode(65 + Math.floor(Math.random() * 26));
        const lower = String.fromCharCode(97 + Math.floor(Math.random() * 26));
        const specials = "!@#$%^&*()_+-";
        const special = specials[Math.floor(Math.random() * specials.length)];
        const code = `${num}${upper}${lower}${special}`;

        if (confirm(`기프트카드가 생성되었습니다: ${code}\n장바구니에 추가하시겠습니까?`)) {
            const discountRate = prompt("할인율(%)을 입력하세요", "10");
            if (!discountRate) return;

            // Save to DB
            await set(ref(db, `gift_cards/${code}`), {
                code,
                rate: parseInt(discountRate),
                status: 'active',
                createdAt: Date.now(),
                createdBy: user.uid
            });

            addToCart({
                id: `GC-${Date.now()}`,
                name: "기프트카드",
                price: 0,
                remark: "할인적용불가",
                giftCardCode: code,
                giftCardRate: parseInt(discountRate)
            });
        }
    };

    const applyGiftCard = async () => {
        if (!giftCardCodeInput) return alert("기프트카드 번호를 입력하세요");

        // Verify against DB
        try {
            const snap = await get(ref(db, `gift_cards/${giftCardCodeInput}`));
            if (!snap.exists()) {
                alert("유효하지 않은 기프트카드입니다.");
                return;
            }
            const gc = snap.val();
            if (gc.status !== 'active') {
                alert("이미 사용되었거나 만료된 기프트카드입니다.");
                return;
            }

            // Apply Discount
            // Apply % to all items? Or logical rule? 
            // "Discount as much as allocated" -> Rate %
            const rate = gc.rate;
            setCart(prev => prev.map(item => ({
                ...item,
                discount: Math.floor(item.price * (rate / 100))
            })));
            alert(`기프트카드 적용: ${rate}% 할인됨`);
            setGiftCardCodeInput("");

        } catch (e) {
            console.error(e);
            alert("기프트카드 조회 오류");
        }
    };

    // --- UI Helpers ---
    const handleOpenWindow = () => {
        if (!user?.uid) return alert("로그인이 필요합니다.");
        setIsDeviceMode(true);
        // We can pass shortCode as param too for easier debug
        window.open(`/point-device?code=${shortCode}`, "CustomerView", "width=800,height=600");
    };

    const handleOutputMemo = () => {
        syncToCustomer("SHOW_MEMO", { memo, color: memoColor });
    };

    const handleOutputMember = () => {
        if (member) {
            syncToCustomer("MEMBER_CONFIRM", { name: member.name, phone: member.phone });
        }
    }

    const handleInitialize = () => {
        if (!confirm("모든 상태를 초기화하시겠습니까? (장바구니, 회원정보 삭제)")) return;
        setCart([]);
        setMember(null);
        setPhoneInput("");
        setMemo("");
        syncToCustomer("RESET", {});
    }

    const handleReSync = () => {
        // Re-send current state
        if (cart.length > 0 || member) {
            syncToCustomer("CART_UPDATE", { cart, total: calculateSubtotal(), memberName: member?.name });
        } else {
            syncToCustomer("RESET", {});
        }
        alert("디바이스와 동기화를 시도했습니다.");
    }

    return (
        <div className="h-screen flex flex-col bg-gray-50 overflow-hidden font-sans">
            {/* Modals & Popups */}
            {settingsOpen && <StoreSettings onClose={() => setSettingsOpen(false)} />}
            {productsOpen && <ProductManagement onClose={() => setProductsOpen(false)} />}

            {/* HEADER - Toss Style (Dark Gray) */}
            <div className="bg-[#333D4B] text-white p-3 flex justify-between items-center shadow-md z-10 px-6">
                <div className="flex items-center gap-4">
                    <button onClick={() => navigate("/main")} className="p-2 hover:bg-white/10 rounded-full transition-colors text-gray-300 hover:text-white">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
                        </svg>
                    </button>
                    <div>
                        <h1 className="text-lg font-bold flex items-center gap-2">
                            {storeName}
                            <span className="text-xs bg-blue-500 px-2 py-0.5 rounded-full font-mono">CODE: {shortCode}</span>
                        </h1>
                    </div>
                </div>

                {/* Center Time */}
                <div className="absolute left-1/2 transform -translate-x-1/2 font-medium text-lg text-gray-200">
                    {currentTime}
                </div>

                <div className="flex gap-2">
                    <button onClick={() => setProductsOpen(true)} className="px-4 py-2 text-sm bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-bold transition-colors shadow-sm">상품관리</button>
                    <button onClick={() => setSettingsOpen(true)} className="px-4 py-2 text-sm bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-bold transition-colors shadow-sm">설정</button>
                    <button onClick={handleOpenWindow} className="px-4 py-2 text-sm bg-gray-600 hover:bg-gray-500 text-white rounded-lg font-bold transition-colors shadow-sm">🖥️ 고객창</button>
                </div>
            </div>

            {/* MAIN GRID LAYOUT (3 Columns x 2 Rows effectively) - prettified */}
            <div className="flex-1 grid grid-cols-12 gap-6 p-6 bg-[#F2F4F6]">

                {/* --- LEFT COLUMN (3/12) --- */}
                <div className="col-span-3 flex flex-col gap-6">
                    {/* Top Left: Member Search */}
                    <div className="bg-white rounded-3xl p-6 shadow-sm flex-1 flex flex-col border border-gray-100">
                        <h2 className="font-bold text-gray-800 mb-4 text-lg">회원 조회</h2>
                        <input
                            type="text"
                            placeholder="전화번호 뒤 4자리"
                            className="w-full text-3xl font-bold p-4 border-b-2 border-gray-200 text-center bg-transparent focus:border-blue-500 outline-none mb-4 transition-colors placeholder-gray-300"
                            value={phoneInput}
                            onChange={e => {
                                setPhoneInput(e.target.value);
                                if (e.target.value.length >= 4) searchMember(e.target.value);
                            }}
                        />
                        {member ? (
                            <div className="bg-blue-50 rounded-2xl p-5 text-center flex-1 animate-fade-in border border-blue-100">
                                <div className="text-4xl mb-3">👤</div>
                                <div className="font-bold text-xl text-gray-900">{member.name}</div>
                                <div className="text-gray-500 font-mono mb-2">{member.phone}</div>
                                <div className="font-bold text-blue-600 text-2xl">{member.points?.toLocaleString()} P</div>
                            </div>
                        ) : (
                            <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
                                회원 정보를 입력해주세요
                            </div>
                        )}
                    </div>

                    {/* Bottom Left: Payment & Device & Controls */}
                    <div className="bg-white rounded-3xl p-6 shadow-sm h-auto flex flex-col gap-4 border border-gray-100">
                        {/* Control Buttons */}
                        <div className="grid grid-cols-2 gap-2 text-xs font-bold text-gray-600 mb-2">
                            <button onClick={handleInitialize} className="py-2 bg-gray-100 hover:bg-gray-200 rounded-xl">🔄 초기화</button>
                            <button onClick={handleReSync} className="py-2 bg-gray-100 hover:bg-gray-200 rounded-xl">⚡️ 재설정</button>
                        </div>

                        <div className="flex flex-col gap-2">
                            <div className="flex justify-between items-center">
                                <h2 className="font-bold text-gray-800">결제 요청</h2>
                                {/* Device Mode Toggle */}
                                <label className="flex items-center gap-2 cursor-pointer bg-gray-50 px-2 py-1 rounded-lg">
                                    <span className="text-xs font-bold text-gray-500">Device Link</span>
                                    <div className={`w-8 h-4 rounded-full p-0.5 transition-colors ${isDeviceMode ? 'bg-blue-500' : 'bg-gray-300'}`}>
                                        <div className={`w-3 h-3 bg-white rounded-full shadow-sm transform transition-transform ${isDeviceMode ? 'translate-x-4' : ''}`} />
                                    </div>
                                    <input type="checkbox" checked={isDeviceMode} onChange={e => setIsDeviceMode(e.target.checked)} className="hidden" />
                                </label>
                            </div>

                            {/* Final Amount */}
                            <div className="text-right py-2">
                                <div className="text-xs text-gray-400 mb-1">최종 결제 금액</div>
                                <div className="text-3xl font-extrabold text-blue-600">
                                    {(calculateSubtotal()).toLocaleString()}원
                                </div>
                            </div>
                        </div>

                        <div className="flex flex-col gap-2">
                            {/* Customer Display Info Output */}
                            {member && (
                                <button onClick={handleOutputMember} className="w-full bg-white border border-gray-200 shadow-sm py-2 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-50">
                                    고객에게 번호 출력
                                </button>
                            )}

                            <button
                                onClick={handlePaymentRequest}
                                className="w-full bg-blue-500 text-white py-4 rounded-2xl font-bold text-lg hover:bg-blue-600 shadow-lg shadow-blue-200 transition-all active:scale-95"
                            >
                                {status === "승인 대기" ? "승인 및 결제" : "결제하기"}
                            </button>
                        </div>
                    </div>
                </div>


                {/* --- CENTER COLUMN (5/12) --- */}
                <div className="col-span-5 flex flex-col gap-6">
                    {/* Top Center: Products */}
                    <div className="bg-white rounded-3xl p-6 shadow-sm flex-1 flex flex-col overflow-hidden border border-gray-100">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="font-bold text-gray-800 text-lg">상품 선택</h2>
                            <div className="space-x-2">
                                <button
                                    onClick={() => {
                                        const n = prompt("상품명"); const p = prompt("금액");
                                        if (n && p) addToCart({ id: Date.now(), name: n, price: parseInt(p) });
                                    }}
                                    className="text-xs bg-gray-100 px-3 py-1.5 rounded-lg font-bold text-gray-600 hover:bg-gray-200"
                                >
                                    직접입력
                                </button>
                                <button
                                    onClick={() => {
                                        const p = prompt("차감(사용)할 포인트");
                                        if (p && member && parseInt(p) <= member.points) addToCart({ id: "use", name: "포인트사용", price: -parseInt(p), isPoint: true });
                                    }}
                                    className="text-xs bg-red-50 text-red-500 px-3 py-1.5 rounded-lg font-bold hover:bg-red-100 border border-red-100"
                                >
                                    포인트빼기
                                </button>
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto grid grid-cols-2 lg:grid-cols-3 gap-3 content-start pr-1">
                            {products.map(p => (
                                <button
                                    key={p.id}
                                    onClick={() => addToCart(p)}
                                    className="p-4 bg-gray-50 rounded-2xl hover:bg-blue-50 border border-transparent hover:border-blue-200 transition-all text-left flex flex-col justify-between h-24 shadow-sm"
                                >
                                    <span className="font-bold text-md leading-tight text-gray-700">{p.name}</span>
                                    <span className="text-blue-600 font-bold mt-1 text-md">{p.price?.toLocaleString()}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Bottom Center: Gift Card Controls */}
                    <div className="bg-white rounded-3xl p-6 shadow-sm h-auto flex flex-col gap-4 border border-gray-100">
                        <div className="flex gap-3">
                            <div className="flex-1 p-4 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200 flex items-center justify-center cursor-pointer hover:bg-gray-100 hover:border-gray-300 transition-colors group" onClick={generateGiftCard}>
                                <span className="text-sm font-bold text-gray-500 group-hover:text-gray-700">🎟️ 기프트카드 생성</span>
                            </div>
                            <button onClick={generateGiftCard} className="bg-indigo-500 hover:bg-indigo-600 text-white px-6 rounded-2xl font-bold text-sm shadow-md transition-shadow">추가</button>
                        </div>

                        <div className="bg-gray-50 rounded-2xl p-4">
                            <h3 className="text-xs font-bold text-gray-500 mb-2 ml-1">할인 기프트카드 사용</h3>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    className="flex-1 border-gray-200 border rounded-xl px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                                    placeholder="기프트카드 번호 입력"
                                    value={giftCardCodeInput}
                                    onChange={e => setGiftCardCodeInput(e.target.value)}
                                />
                                <button onClick={applyGiftCard} className="bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded-xl text-xs font-bold transition-colors">적용</button>
                            </div>
                        </div>
                    </div>
                </div>


                {/* --- RIGHT COLUMN (4/12) --- */}
                <div className="col-span-4 bg-white rounded-3xl p-6 shadow-sm flex flex-col h-full border border-gray-100">
                    <h2 className="font-bold text-lg text-gray-800 mb-6 flex justify-between items-center">
                        장바구니
                        <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-xs font-bold">{cart.length} items</span>
                    </h2>

                    <div className="flex-1 overflow-y-auto space-y-4 pr-1">
                        {cart.length === 0 && (
                            <div className="text-center text-gray-300 mt-20 text-sm">
                                상품을 선택해주세요
                            </div>
                        )}
                        {cart.map((item, i) => (
                            <div key={i} className="relative bg-white border border-gray-100 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all group">
                                <div className="flex justify-between items-start mb-2">
                                    <div>
                                        <h4 className="font-bold text-gray-800 text-md">{item.name}</h4>
                                        {item.giftCardCode && (
                                            <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 rounded py-0.5">CODE: {item.giftCardCode}</span>
                                        )}
                                    </div>
                                    <button onClick={() => removeFromCart(item.id)} className="text-gray-300 hover:text-red-500 p-1 opacity-0 group-hover:opacity-100 transition-opacity">×</button>
                                </div>
                                <div className="flex justify-between items-center text-sm text-gray-600">
                                    <div className="flex items-center gap-1 bg-gray-50 rounded-lg px-2 py-1">
                                        <input
                                            type="number"
                                            value={item.qty}
                                            onChange={e => updateItemQty(item.id, e.target.value)}
                                            className="w-8 text-center bg-transparent outline-none font-bold"
                                        />
                                        <span className="text-xs text-gray-400">x {item.price.toLocaleString()}</span>
                                    </div>
                                    <div className="font-bold text-blue-600 text-md">
                                        {((item.price * item.qty) - (item.discount || 0)).toLocaleString()}원
                                    </div>
                                </div>
                                {/* Discount UI */}
                                <div className="mt-2 flex items-center justify-end gap-2 text-xs">
                                    {item.discount > 0 && <span className="text-red-500 font-bold bg-red-50 px-2 py-0.5 rounded-full">-{item.discount.toLocaleString()}원</span>}
                                    {/* Hidden percent input for manager tweak? */}
                                </div>
                                {item.remark && <div className="mt-2 text-xs text-red-500 font-bold bg-red-50 p-1 rounded text-center">{item.remark}</div>}
                            </div>
                        ))}
                    </div>

                    <div className="mt-4 pt-4 border-t border-gray-100">
                        <div className="mb-3">
                            <label className="text-xs font-bold text-gray-500 mb-2 block ml-1">화면 출력 메모</label>
                            <div className="flex gap-3 mb-3 justify-center">
                                {['black', 'red', 'blue', 'green'].map(c => (
                                    <button
                                        key={c}
                                        onClick={() => setMemoColor(c)}
                                        className={`w-6 h-6 rounded-full border-2 transition-transform ${memoColor === c ? 'border-gray-800 scale-125 ring-2 ring-gray-100' : 'border-transparent'}`}
                                        style={{ backgroundColor: c }}
                                    />
                                ))}
                            </div>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    className="flex-1 border-gray-200 border rounded-xl px-3 py-2 text-sm focus:border-blue-500 outline-none"
                                    placeholder="고객에게 보여줄 메시지"
                                    value={memo}
                                    onChange={e => setMemo(e.target.value)}
                                    style={{ color: memoColor }}
                                />
                                <button onClick={handleOutputMemo} className="bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded-xl text-xs font-bold transition-colors">출력</button>
                            </div>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
}
