import { useState, useEffect } from "react";
import { getDatabase, ref, onValue, push, remove, set } from "firebase/database";

export default function ProductManagement({ onClose }) {
    const [products, setProducts] = useState([]);
    const [newName, setNewName] = useState("");
    const [newPrice, setNewPrice] = useState("");

    const db = getDatabase();

    useEffect(() => {
        const productsRef = ref(db, "store/products");
        onValue(productsRef, (snapshot) => {
            const data = snapshot.val();
            if (data) {
                setProducts(Object.entries(data).map(([id, val]) => ({ id, ...val })));
            } else {
                setProducts([]);
            }
        });
    }, []);

    const handleAdd = async () => {
        if (!newName || !newPrice) return alert("상품명과 가격을 입력해주세요.");
        try {
            const newRef = push(ref(db, "store/products"));
            await set(newRef, {
                name: newName,
                price: parseInt(newPrice)
            });
            setNewName("");
            setNewPrice("");
        } catch (err) {
            alert("추가 실패: " + err.message);
        }
    };

    const handleDelete = async (id) => {
        if (!confirm("삭제하시겠습니까?")) return;
        try {
            await remove(ref(db, `store/products/${id}`));
        } catch (err) {
            alert("삭제 실패");
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded-2xl shadow-xl w-[600px] h-[600px] flex flex-col animate-fade-in-up">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-bold">상품 관리</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
                </div>

                <div className="flex gap-2 mb-6 bg-gray-50 p-4 rounded-xl">
                    <input
                        type="text"
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        className="flex-1 border rounded-lg p-2 text-sm"
                        placeholder="상품명 (예: 아메리카노)"
                    />
                    <input
                        type="number"
                        value={newPrice}
                        onChange={(e) => setNewPrice(e.target.value)}
                        className="w-32 border rounded-lg p-2 text-sm"
                        placeholder="가격"
                    />
                    <button onClick={handleAdd} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-indigo-500">추가</button>
                </div>

                <div className="flex-1 overflow-y-auto space-y-2 pr-2">
                    {products.length === 0 && <div className="text-center text-gray-400 mt-20">등록된 상품이 없습니다.</div>}
                    {products.map(p => (
                        <div key={p.id} className="flex justify-between items-center bg-white border border-gray-100 p-3 rounded-lg shadow-sm hover:bg-gray-50">
                            <div>
                                <div className="font-bold text-gray-800">{p.name}</div>
                                <div className="text-sm text-gray-500">{p.price.toLocaleString()}원</div>
                            </div>
                            <button onClick={() => handleDelete(p.id)} className="text-red-400 hover:text-red-600 text-sm">삭제</button>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
