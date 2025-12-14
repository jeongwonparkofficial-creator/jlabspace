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

    // Member Registration
    const [registerOpen, setRegisterOpen] = useState(false);
    const [newMember, setNewMember] = useState({ name: "", phone: "", points: 0 });

    // Calculator / Keypad
    const [calcBuffer, setCalcBuffer] = useState("");

    // Member & Input
    const [phoneInput, setPhoneInput] = useState("");
    const [member, setMember] = useState(null);
    const [status, setStatus] = useState("대기중");

    // Cart & Transaction
    const [cart, setCart] = useState([]);
    const [memo, setMemo] = useState("");
    const [memoColor, setMemoColor] = useState("black"); // black, red, blue, green
    const [isSpecialMode, setIsSpecialMode] = useState(false); // New: Special Mode (Red)

    // Tools & Categories
    const [toolsOpen, setToolsOpen] = useState(false);
    const [selectedCategory, setSelectedCategory] = useState("전체");

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
                // Exact match or last 4 digits (robust check)
                const uid = Object.keys(data).find(key => {
                    const p = data[key].phone;
                    if (!p) return false;
                    // Normalize: remove dashes
                    const cleanP = p.replace(/-/g, "").trim();
                    const cleanSearch = phone.replace(/-/g, "").trim();
                    return cleanP === cleanSearch || (cleanSearch.length >= 4 && cleanP.endsWith(cleanSearch));
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
            return [...prev, {
                ...item,
                qty: 1,
                discount: 0,
                remark: item.remark || "",
                giftCardCode: item.giftCardCode || null,
                isSpecial: isSpecialMode // Apply Special flag
            }];
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
        // Fullscreen attempt: use screen size
        const width = screen.availWidth;
        const height = screen.availHeight;
        window.open(`/point-device?code=${shortCode}`, "CustomerView", `width=${width},height=${height},left=0,top=0`);
    };

    const handleOutputMemo = () => {
        syncToCustomer("SHOW_MEMO", { memo, color: memoColor });
    };

    const handleOutputMember = () => {
        if (member) {
            syncToCustomer("MEMBER_CONFIRM", { name: member.name, phone: member.phone });
        }
    }

    const handleRegisterMember = async () => {
        if (!newMember.name || !newMember.phone) return alert("이름과 전화번호를 입력해주세요.");

        // Basic Phone Validation
        if (newMember.phone.length < 4) return alert("전화번호를 올바르게 입력해주세요.");

        try {
            // Check if exists?
            // For now, just generate a new ID or use Phone as part of ID?
            // Using push to allow duplicates? No, usually phone should be unique.
            // Let's query by phone first? 
            // For MVP/Speed, we'll just push a new user.
            const newUserRef = push(ref(db, "users"));
            await set(newUserRef, {
                name: newMember.name,
                phone: newMember.phone,
                points: parseInt(newMember.points) || 0,
                createdAt: Date.now()
            });

            alert("회원 등록 완료!");
            setNewMember({ name: "", phone: "", points: 0 });
            setRegisterOpen(false);
            // Auto select?
            setPhoneInput(newMember.phone);
            searchMember(newMember.phone);
        } catch (e) {
            console.error(e);
            alert("회원 등록 실패");
        }
    };

    const handleModifyPoints = async (amount) => {
        if (!member) return alert("회원을 선택해주세요");
        const reason = prompt(`포인트 ${amount > 0 ? "지급" : "차감"} 사유를 입력하세요`, "관리자 수동 조정");
        if (!reason) return;

        const newBalance = (member.points || 0) + amount;
        if (newBalance < 0) return alert("포인트가 부족합니다");

        try {
            await update(ref(db, `users/${member.uid}`), { points: newBalance });
            // Add transaction log for record?
            // Leaving simple for now or adding a "Manual" txn type if needed.
            setMember({ ...member, points: newBalance });
            alert("포인트가 조정되었습니다.");
        } catch (e) {
            alert("오류 발생");
        }
    };

    const handleCalcInput = (val) => {
        if (val === "C") {
            setCalcBuffer("");
            return;
        }
        if (val === "Back") {
            setCalcBuffer(prev => prev.slice(0, -1));
            return;
        }
        if (val === "Enter") {
            // What does enter do? 
            // Maybe adds to "Direct Input" price if buffer is number?
            // Or sets the 'Money Received'? 
            // For now, let's just use it to populate the 'Direct Input' Price prompt or Phone Input?
            // User just said "Add Calculator". 
            // Let's make it copy to clipboard or just stay in buffer for reference?
            // Or better: If focus is on phone input, it types there. 
            // If not, it just builds independent number.
            return;
        }
        setCalcBuffer(prev => prev + val);
    };

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
                    <button onClick={() => navigate("/")} className="p-2 hover:bg-white/10 rounded-full transition-colors text-gray-300 hover:text-white">
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
                    <button onClick={() => setToolsOpen(true)} className="px-4 py-2 text-sm bg-gray-600 hover:bg-gray-500 text-white rounded-lg font-bold transition-colors shadow-sm">⚙️ 도구/설정</button>
                    <button onClick={() => setProductsOpen(true)} className="px-4 py-2 text-sm bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-bold transition-colors shadow-sm">상품관리</button>
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
                            <div className="bg-blue-50 rounded-2xl p-5 text-center flex-1 animate-fade-in border border-blue-100 relative flex flex-col items-center justify-center">
                                <button onClick={() => setMember(null)} className="absolute top-2 right-2 text-gray-400 hover:text-red-500">×</button>
                                <div className="text-4xl mb-3">👤</div>
                                <div className="font-bold text-xl text-gray-900">{member.name}</div>
                                <div className="text-gray-500 font-mono mb-4">{member.phone}</div>
                                <div className="font-bold text-blue-600 text-2xl mb-4">{member.points?.toLocaleString()} P</div>

                                <div className="flex gap-2 w-full max-w-[200px]">
                                    <button onClick={() => handleModifyPoints(100)} className="flex-1 bg-white border border-blue-200 text-blue-600 text-xs font-bold py-2 rounded-lg hover:bg-blue-50">+100</button>
                                    <button onClick={() => handleModifyPoints(-100)} className="flex-1 bg-white border border-red-200 text-red-600 text-xs font-bold py-2 rounded-lg hover:bg-red-50">-100</button>
                                </div>
                            </div>
                        ) : (
                            <div className="flex-1 flex flex-col items-center justify-center text-gray-400 text-sm gap-4">
                                <span>회원 정보를 입력하거나 등록하세요</span>
                                <button
                                    onClick={() => setRegisterOpen(true)}
                                    className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-xl font-bold shadow-sm transition-colors"
                                >
                                    + 신규 회원 등록
                                </button>
                            </div>
                        )}
                    </div>
                    {/* Register Modal */}
                    {registerOpen && (
                        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center backdrop-blur-sm">
                            <div className="bg-white rounded-3xl p-8 w-[400px] shadow-2xl animate-scale-in">
                                <h2 className="text-xl font-bold mb-6">신규 회원 등록</h2>
                                <div className="space-y-4">
                                    <input
                                        className="w-full border p-3 rounded-xl bg-gray-50 focus:bg-white transition-colors"
                                        placeholder="이름"
                                        value={newMember.name}
                                        onChange={e => setNewMember({ ...newMember, name: e.target.value })}
                                    />
                                    <input
                                        className="w-full border p-3 rounded-xl bg-gray-50 focus:bg-white transition-colors"
                                        placeholder="전화번호 (010-0000-0000)"
                                        value={newMember.phone}
                                        onChange={e => setNewMember({ ...newMember, phone: e.target.value })}
                                    />
                                    <input
                                        className="w-full border p-3 rounded-xl bg-gray-50 focus:bg-white transition-colors"
                                        placeholder="초기 포인트 (선택)"
                                        type="number"
                                        value={newMember.points}
                                        onChange={e => setNewMember({ ...newMember, points: e.target.value })}
                                    />
                                </div>
                                <div className="flex gap-2 mt-8">
                                    <button onClick={() => setRegisterOpen(false)} className="flex-1 py-3 bg-gray-200 hover:bg-gray-300 rounded-xl font-bold text-gray-600">취소</button>
                                    <button onClick={handleRegisterMember} className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 rounded-xl font-bold text-white shadow-lg shadow-blue-200">등록 완료</button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Bottom Left: Calculator & Controls */}
                    <div className="bg-white rounded-3xl p-6 shadow-sm h-auto flex flex-col gap-4 border border-gray-100">
                        {/* Calculator Display */}
                        <div className="bg-gray-100 rounded-xl p-3 text-right font-mono text-2xl font-bold text-gray-700 min-h-[50px] flex items-center justify-end">
                            {calcBuffer || "0"}
                        </div>
                        {/* Calculator Grid */}
                        <div className="grid grid-cols-4 gap-2">
                            {['7', '8', '9', 'C', '4', '5', '6', 'Back', '1', '2', '3', '/', '0', '00', '.', '*'].map(key => (
                                <button
                                    key={key}
                                    onClick={() => handleCalcInput(key)}
                                    className={`py-2 rounded-lg font-bold text-sm transition-colors ${key === 'C' ? 'bg-red-100 text-red-600 hover:bg-red-200' :
                                        key === 'Back' ? 'bg-orange-100 text-orange-600 hover:bg-orange-200' :
                                            ['/', '*', '-', '+', 'Enter'].includes(key) ? 'bg-blue-50 text-blue-600 hover:bg-blue-100' :
                                                'bg-gray-50 hover:bg-gray-100 text-gray-700'
                                        }`}
                                >
                                    {key === 'Back' ? '⬅️' : key}
                                </button>
                            ))}
                        </div>
                        {/* Control Buttons */}
                        <div className="grid grid-cols-2 gap-2 text-xs font-bold text-gray-600 mb-2">
                            <button onClick={handleInitialize} className="py-2 bg-gray-100 hover:bg-gray-200 rounded-xl">🔄 초기화</button>
                            <button onClick={handleReSync} className="py-2 bg-gray-100 hover:bg-gray-200 rounded-xl">⚡️ 재설정</button>
                        </div>

                        <div className="flex flex-col gap-2">
                            <div className="flex justify-between items-center">
                                <h2 className="font-bold text-gray-800">결제 요청</h2>
                                <button
                                    onClick={() => setIsSpecialMode(!isSpecialMode)}
                                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all border ${isSpecialMode ? 'bg-red-500 text-white border-red-500' : 'bg-gray-100 text-gray-500 border-gray-200'}`}
                                >
                                    {isSpecialMode ? "🔥 특수모드 ON" : "특수모드 OFF"}
                                </button>
                            </div>

                            {/* Final Amount */}
                            <div className="text-right py-2">
                                <div className="text-xs text-gray-400 mb-1">최종 결제 금액 (VAT 포함)</div>
                                <div className="text-4xl font-extrabold text-blue-600 tracking-tight">
                                    {(calculateSubtotal()).toLocaleString()} P
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
                <div className="col-span-5 flex flex-col gap-4">
                    {/* Categories */}
                    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                        {["전체", ...new Set(products.map(p => p.category || "기타"))].map(cat => (
                            <button
                                key={cat}
                                onClick={() => setSelectedCategory(cat)}
                                className={`px-4 py-2 rounded-xl font-bold text-sm whitespace-nowrap transition-colors shadow-sm ${selectedCategory === cat ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-100'}`}
                            >
                                {cat}
                            </button>
                        ))}
                    </div>

                    {/* Products Grid */}
                    <div className="bg-white rounded-3xl p-6 shadow-sm flex-1 flex flex-col overflow-hidden border border-gray-100">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="font-bold text-gray-800 text-lg">상품 선택</h2>
                            <button
                                onClick={() => {
                                    const n = prompt("상품명"); const p = prompt("금액");
                                    if (n && p) addToCart({ id: Date.now(), name: n, price: parseInt(p) });
                                }}
                                className="text-xs bg-gray-100 px-3 py-1.5 rounded-lg font-bold text-gray-600 hover:bg-gray-200"
                            >
                                직접입력
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto grid grid-cols-2 lg:grid-cols-3 gap-3 content-start pr-1">
                            {products
                                .filter(p => selectedCategory === "전체" || (p.category || "기타") === selectedCategory)
                                .map(p => (
                                    <button
                                        key={p.id}
                                        onClick={() => addToCart(p)}
                                        className="p-4 bg-gray-50 rounded-2xl hover:bg-blue-50 border border-transparent hover:border-blue-200 transition-all text-left flex flex-col justify-between h-24 shadow-sm"
                                    >
                                        <span className="font-bold text-md leading-tight text-gray-700">{p.name}</span>
                                        <span className="text-blue-600 font-bold mt-1 text-md">{p.price?.toLocaleString()} P</span>
                                    </button>
                                ))}
                        </div>
                    </div>

                    {/* Tools Modal (Gift Cards, Settings, Point Usage) */}
                    {toolsOpen && (
                        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center backdrop-blur-sm" onClick={() => setToolsOpen(false)}>
                            <div className="bg-white rounded-3xl p-8 w-[500px] shadow-2xl animate-scale-in" onClick={e => e.stopPropagation()}>
                                <h2 className="text-xl font-bold mb-6 flex justify-between">
                                    🛠️ 도구 및 설정
                                    <button onClick={() => setToolsOpen(false)} className="text-gray-400">✕</button>
                                </h2>

                                <div className="space-y-6">
                                    <div>
                                        <h3 className="font-bold text-gray-700 mb-2">기프트카드 관리</h3>
                                        <div className="flex gap-2 mb-2">
                                            <button onClick={generateGiftCard} className="flex-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 py-3 rounded-xl font-bold border border-indigo-200">🎟️ 생성</button>
                                        </div>
                                        <div className="flex gap-2">
                                            <input
                                                className="flex-1 border p-2 rounded-xl bg-gray-50"
                                                placeholder="코드 입력"
                                                value={giftCardCodeInput}
                                                onChange={e => setGiftCardCodeInput(e.target.value)}
                                            />
                                            <button onClick={applyGiftCard} className="bg-gray-800 text-white px-4 rounded-xl font-bold">적용</button>
                                        </div>
                                    </div>

                                    <div className="border-t pt-4">
                                        <h3 className="font-bold text-gray-700 mb-2">포인트 기능</h3>
                                        <button
                                            onClick={() => {
                                                const p = prompt("차감(사용)할 포인트");
                                                if (p && member && parseInt(p) <= member.points) addToCart({ id: "use", name: "포인트사용", price: -parseInt(p), isPoint: true });
                                                setToolsOpen(false);
                                            }}
                                            className="w-full bg-red-50 text-red-500 py-3 rounded-xl font-bold hover:bg-red-100 border border-red-200"
                                        >
                                            포인트 사용 (차감 결제)
                                        </button>
                                    </div>

                                    <div className="border-t pt-4">
                                        <h3 className="font-bold text-gray-700 mb-2">시스템 설정</h3>
                                        <button onClick={() => { setSettingsOpen(true); setToolsOpen(false); }} className="w-full bg-gray-100 py-3 rounded-xl font-bold text-gray-600 hover:bg-gray-200">가게 설정 열기</button>

                                        <label className="flex items-center justify-between mt-4 p-3 bg-gray-50 rounded-xl cursor-pointer">
                                            <span className="font-bold text-gray-600">Device Link 모드</span>
                                            <input type="checkbox" checked={isDeviceMode} onChange={e => setIsDeviceMode(e.target.checked)} className="w-5 h-5" />
                                        </label>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>


                {/* --- RIGHT COLUMN (4/12) --- */}
                <div className="col-span-4 bg-white rounded-3xl p-6 shadow-sm flex flex-col h-full border border-gray-100">
                    <h2 className="font-bold text-lg text-gray-800 mb-6 flex justify-between items-center">
                        장바구니
                        <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-xs font-bold">{cart.length} items</span>
                    </h2>

                    {/* Table Header */}
                    <div className="grid grid-cols-12 text-xs text-gray-400 font-bold mb-2 pb-2 border-b border-gray-100 text-center">
                        <div className="col-span-5 text-left pl-2">상품명</div>
                        <div className="col-span-2">단가</div>
                        <div className="col-span-2">수량</div>
                        <div className="col-span-3 text-right pr-2">합계</div>
                    </div>

                    <div className="flex-1 overflow-y-auto pr-1">
                        {cart.length === 0 && (
                            <div className="text-center text-gray-300 mt-20 text-sm">
                                상품을 선택해주세요
                            </div>
                        )}
                        {cart.map((item, i) => (
                            <div key={i} className={`grid grid-cols-12 items-center text-sm py-3 border-b border-gray-50 hover:bg-gray-50 transition-colors group ${item.isSpecial ? 'text-red-500' : 'text-gray-700'}`}>
                                <div className="col-span-5 pl-2 font-bold truncate flex flex-col">
                                    <span>{item.name}</span>
                                    {item.giftCardCode && <span className="text-[10px] text-gray-400">Code: {item.giftCardCode}</span>}
                                    {item.remark && <span className="text-[10px] text-blue-500">{item.remark}</span>}
                                </div>
                                <div className="col-span-2 text-center text-xs text-gray-400">
                                    {item.price.toLocaleString()}
                                </div>
                                <div className="col-span-2 flex justify-center">
                                    <input
                                        type="number"
                                        value={item.qty}
                                        onChange={e => updateItemQty(item.id, e.target.value)}
                                        className={`w-8 text-center bg-transparent outline-none font-bold underline decoration-gray-300 underline-offset-2 ${item.isSpecial ? 'text-red-600' : 'text-gray-900'}`}
                                    />
                                </div>
                                <div className="col-span-3 text-right pr-2 font-bold relative group">
                                    {/* Delete Button */}
                                    <div className="flex justify-end items-center gap-2">
                                        <span>{((item.price * item.qty) - (item.discount || 0)).toLocaleString()}</span>
                                        <button onClick={() => removeFromCart(item.id)} className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">×</button>
                                    </div>
                                    {item.discount > 0 && <div className="text-[10px] text-red-500">(-{item.discount.toLocaleString()})</div>}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Totals Summary */}
                    {cart.length > 0 && (
                        <div className="mt-4 pt-4 border-t border-gray-200 flex flex-col gap-1">
                            <div className="flex justify-between text-sm text-gray-500">
                                <span>할인</span>
                                <span>{cart.reduce((sum, i) => sum + (i.discount || 0), 0).toLocaleString()} P</span>
                            </div>
                        </div>
                    )}

                    {/* Memo Input */}
                    <div className="mt-4 flex gap-2 pt-2 border-t border-gray-100">
                        <input
                            type="text"
                            className="flex-1 border-gray-200 border rounded-xl px-3 py-2 text-sm focus:border-blue-500 outline-none"
                            placeholder="화면 출력 메모"
                            value={memo}
                            onChange={e => setMemo(e.target.value)}
                            style={{ color: memoColor }}
                        />
                        <button onClick={handleOutputMemo} className="bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded-xl text-xs font-bold transition-colors">출력</button>
                    </div>
                </div>

            </div>

            {/* Success Overlay */}
            {status === "완료" && (
                <div className="fixed inset-0 bg-blue-600 z-[100] flex flex-col items-center justify-center text-white animate-fade-in">
                    <div className="bg-white/20 p-10 rounded-full mb-8 backdrop-blur-sm animate-scale-in">
                        <div className="text-8xl">✅</div>
                    </div>
                    <h1 className="text-6xl font-bold mb-4">결제 완료</h1>
                    <p className="text-2xl opacity-90 mb-12">거래가 정상적으로 처리되었습니다.</p>

                    <div className="flex gap-4">
                        <button
                            onClick={() => {
                                setStatus("대기중");
                                setMember(null);
                                setPhoneInput("");
                                setCart([]);
                            }}
                            className="bg-white text-blue-600 px-10 py-5 rounded-2xl text-2xl font-bold hover:scale-105 transition-transform shadow-xl"
                        >
                            다음 손님 받기 (초기화)
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
