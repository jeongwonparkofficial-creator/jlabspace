import { useState, useEffect } from "react";
import { getDatabase, ref, onValue, push, remove, set } from "firebase/database";

export default function ProductManagement({ onClose }) {
    const [products, setProducts] = useState([]);
    // Add Inputs
    const [newName, setNewName] = useState("");
    const [newPrice, setNewPrice] = useState("");
    const [newCategory, setNewCategory] = useState("전체");

    // Editing State
    const [editingId, setEditingId] = useState(null);
    const [editName, setEditName] = useState("");
    const [editPrice, setEditPrice] = useState("");
    const [editCategory, setEditCategory] = useState("");

    const db = getDatabase();

    // Suggested Categories (Dynamic + Default)
    const [categories, setCategories] = useState(["전체", "커피", "음료", "디저트", "기타"]);

    useEffect(() => {
        const productsRef = ref(db, "store/products");
        onValue(productsRef, (snapshot) => {
            const data = snapshot.val();
            if (data) {
                const list = Object.entries(data).map(([id, val]) => ({ id, ...val }));
                setProducts(list);

                // Extract unique categories
                const usedCats = new Set(list.map(p => p.category).filter(Boolean));
                setCategories(prev => Array.from(new Set([...prev, ...usedCats])));
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
                price: parseInt(newPrice),
                category: newCategory
            });
            setNewName("");
            setNewPrice("");
            // Keep category for rapid entry
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

    const startEdit = (p) => {
        setEditingId(p.id);
        setEditName(p.name);
        setEditPrice(p.price);
        setEditCategory(p.category || "기타");
    };

    const cancelEdit = () => {
        setEditingId(null);
    };

    const saveEdit = async (id) => {
        try {
            await update(ref(db, `store/products/${id}`), {
                name: editName,
                price: parseInt(editPrice),
                category: editCategory
            });
            setEditingId(null);
        } catch (e) {
            alert("수정 실패");
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded-2xl shadow-xl w-[800px] h-[700px] flex flex-col animate-fade-in-up">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-bold">상품 관리</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
                </div>

                {/* Add Form */}
                <div className="flex gap-2 mb-6 bg-gray-50 p-4 rounded-xl items-end">
                    <div className="flex flex-col gap-1">
                        <label className="text-xs font-bold text-gray-500">카테고리</label>
                        <input
                            list="category-options"
                            className="border rounded-lg p-2 text-sm w-32"
                            value={newCategory}
                            onChange={(e) => setNewCategory(e.target.value)}
                            placeholder="카테고리"
                        />
                        <datalist id="category-options">
                            {categories.map(c => <option key={c} value={c} />)}
                        </datalist>
                    </div>
                    <div className="flex flex-col gap-1 flex-1">
                        <label className="text-xs font-bold text-gray-500">상품명</label>
                        <input
                            type="text"
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                            className="border rounded-lg p-2 text-sm w-full"
                            placeholder="상품명"
                        />
                    </div>
                    <div className="flex flex-col gap-1">
                        <label className="text-xs font-bold text-gray-500">가격</label>
                        <input
                            type="number"
                            value={newPrice}
                            onChange={(e) => setNewPrice(e.target.value)}
                            className="w-32 border rounded-lg p-2 text-sm"
                            placeholder="가격"
                        />
                    </div>
                    <button onClick={handleAdd} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-indigo-500 font-bold h-10">추가</button>
                </div>

                {/* List: Group by Category? Or just simple list with category column? 
                    User asked to "Manage by category". A flat list with sorting/filtering might be enough, 
                    or grouping visually. Let's do simple list first with edit capability.
                */}
                <div className="flex-1 overflow-y-auto space-y-2 pr-2">
                    <div className="grid grid-cols-12 gap-2 text-xs font-bold text-gray-400 mb-2 px-3">
                        <div className="col-span-2">카테고리</div>
                        <div className="col-span-5">상품명</div>
                        <div className="col-span-3 text-right">가격</div>
                        <div className="col-span-2 text-center">관리</div>
                    </div>

                    {products.length === 0 && <div className="text-center text-gray-400 mt-20">등록된 상품이 없습니다.</div>}

                    {products.sort((a, b) => (a.category || "").localeCompare(b.category || "")).map(p => (
                        <div key={p.id} className="grid grid-cols-12 gap-2 items-center bg-white border border-gray-100 p-3 rounded-lg shadow-sm hover:bg-gray-50 transition-colors">
                            {editingId === p.id ? (
                                <>
                                    <div className="col-span-2">
                                        <input className="w-full border rounded p-1 text-xs" value={editCategory} onChange={e => setEditCategory(e.target.value)} />
                                    </div>
                                    <div className="col-span-5">
                                        <input className="w-full border rounded p-1 text-xs" value={editName} onChange={e => setEditName(e.target.value)} />
                                    </div>
                                    <div className="col-span-3">
                                        <input className="w-full border rounded p-1 text-xs text-right" type="number" value={editPrice} onChange={e => setEditPrice(e.target.value)} />
                                    </div>
                                    <div className="col-span-2 flex justify-center gap-1">
                                        <button onClick={() => saveEdit(p.id)} className="text-blue-600 hover:text-blue-800 text-xs font-bold bg-blue-50 px-2 py-1 rounded">저장</button>
                                        <button onClick={cancelEdit} className="text-gray-500 hover:text-gray-700 text-xs bg-gray-100 px-2 py-1 rounded">취소</button>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div className="col-span-2 text-xs text-gray-500 font-medium bg-gray-100 px-2 py-1 rounded text-center truncate">{p.category || "기타"}</div>
                                    <div className="col-span-5 font-bold text-gray-800 truncate">{p.name}</div>
                                    <div className="col-span-3 text-sm text-blue-600 font-bold text-right">{p.price.toLocaleString()} P</div>
                                    <div className="col-span-2 flex justify-center gap-2">
                                        <button onClick={() => startEdit(p)} className="text-gray-400 hover:text-blue-500">✏️</button>
                                        <button onClick={() => handleDelete(p.id)} className="text-gray-400 hover:text-red-500">🗑️</button>
                                    </div>
                                </>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
