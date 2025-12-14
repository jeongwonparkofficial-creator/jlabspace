import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../lib/firebase";

export default function Login() {
    const [id, setId] = useState("admin");
    const [password, setPassword] = useState("root");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        if (id === "admin" && password === "root") {
            // Auto login logic could go here, but React state updates might be async.
            // Let's just let the user click or trigger it if we want full auto.
            // Request said "Auto Input" and "Go straight to POS". 
            // Let's try to auto-submit if it's the initial load? 
            // Actually, let's just pre-fill. The "Go straight to POS" might mean *after* login.
            // But "Start login page... auto input... go to POS". 
            // I'll add a small timeout to auto-click or just call the function.
            const timer = setTimeout(() => {
                document.getElementById("login-btn")?.click();
            }, 500);
            return () => clearTimeout(timer);
        }
    }, []);

    const handleLogin = async (e) => {
        if (e) e.preventDefault(); // Handle if called without event
        if (!id || !password) return;

        setError("");
        setLoading(true);

        try {
            // Firebase requires email format, so we format the ID internally
            const email = id.includes('@') ? id : `${id}@jeongwonlab.com`;

            await signInWithEmailAndPassword(auth, email, password);
            navigate("/pos");
        } catch (err) {
            console.error(err);
            setError("로그인에 실패했습니다. 아이디와 비밀번호를 확인해주세요.");
        } finally {
            setLoading(false);
        }
    };

    const handleFindId = (e) => {
        e.preventDefault();
        alert("아이디 찾기 기능은 아직 구현되지 않았습니다. 관리자에게 문의하세요.");
    };

    const handleFindPw = (e) => {
        e.preventDefault();
        alert("비밀번호 찾기 기능은 아직 구현되지 않았습니다. 관리자에게 문의하세요.");
    };

    return (
        <div className="flex min-h-screen flex-col bg-gray-50 dark:bg-gray-900 transition-colors duration-300">
            {/* Top Left Logo */}
            <div className="absolute top-8 left-8">
                <img
                    src="/logos/logo.png"
                    alt="Jeongwonlab Logo"
                    className="h-10 w-auto dark:hidden"
                />
                <img
                    src="/logos/logo-dark.png"
                    alt="Jeongwonlab Logo"
                    className="hidden h-10 w-auto dark:block"
                />
            </div>

            <div className="flex flex-1 flex-col items-center justify-center px-4">
                <div className="w-full max-w-sm space-y-10 animate-fade-in-up">
                    <div className="text-center">
                        <h2 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
                            Jeongwonlab
                        </h2>
                        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                            로그인하여 워크스페이스에 접속하세요
                        </p>
                    </div>

                    <div className="bg-white p-10 shadow-2xl rounded-2xl dark:bg-gray-800 ring-1 ring-gray-900/5 backdrop-blur-sm">
                        <form className="space-y-8" onSubmit={handleLogin}>
                            {error && (
                                <div className="p-4 text-sm text-red-500 bg-red-50 rounded-lg dark:bg-red-900/30 dark:text-red-400 border border-red-100 dark:border-red-900">
                                    {error}
                                </div>
                            )}

                            <div className="space-y-6">
                                <div>
                                    <label htmlFor="id" className="block text-sm font-medium leading-6 text-gray-900 dark:text-gray-300">
                                        아이디
                                    </label>
                                    <div className="mt-2">
                                        <input
                                            id="id"
                                            name="id"
                                            type="text"
                                            required
                                            value={id}
                                            onChange={(e) => setId(e.target.value)}
                                            className="block w-full rounded-xl border-0 px-4 py-3 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 dark:bg-gray-700 dark:ring-gray-600 dark:text-white dark:placeholder-gray-400 sm:text-sm sm:leading-6 transition-all"
                                            placeholder="아이디 입력"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <div className="flex items-center justify-between">
                                        <label htmlFor="password" className="block text-sm font-medium leading-6 text-gray-900 dark:text-gray-300">
                                            비밀번호
                                        </label>
                                        <div className="text-sm">
                                            <Link to="/find-pw" className="font-semibold text-indigo-600 hover:text-indigo-500 dark:text-indigo-400">
                                                비밀번호 찾기
                                            </Link>
                                        </div>
                                    </div>
                                    <div className="mt-2">
                                        <input
                                            id="password"
                                            name="password"
                                            type="password"
                                            required
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            className="block w-full rounded-xl border-0 px-4 py-3 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 dark:bg-gray-700 dark:ring-gray-600 dark:text-white dark:placeholder-gray-400 sm:text-sm sm:leading-6 transition-all"
                                            placeholder="••••••••"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div>
                                <button
                                    id="login-btn"
                                    type="submit"
                                    disabled={loading}
                                    className="flex w-full justify-center rounded-xl bg-indigo-600 px-3 py-3 text-sm font-semibold leading-6 text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-[1.02]"
                                >
                                    {loading ? "로그인 중..." : "로그인"}
                                </button>
                            </div>
                        </form>

                        <div className="mt-8">
                            <div className="relative">
                                <div className="absolute inset-0 flex items-center">
                                    <div className="w-full border-t border-gray-200 dark:border-gray-700" />
                                </div>
                                <div className="relative flex justify-center text-sm">
                                    <span className="bg-white px-2 text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                                        처음이신가요?
                                    </span>
                                </div>
                            </div>

                            <div className="mt-6 grid grid-cols-1 gap-3">
                                <Link
                                    to="/signup"
                                    className="flex w-full items-center justify-center gap-3 rounded-xl bg-white px-3 py-3 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus-visible:ring-transparent dark:bg-gray-700 dark:text-white dark:ring-gray-600 dark:hover:bg-gray-600 transition-all transform hover:scale-[1.02]"
                                >
                                    회원가입
                                </Link>
                            </div>

                            <div className="mt-6 text-center">
                                <Link to="/find-id" className="font-semibold text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400">
                                    아이디 찾기
                                </Link>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
