
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { getDatabase, ref, set } from "firebase/database";
import { auth } from "../lib/firebase";

export default function Signup() {
    const [step, setStep] = useState(1);
    const [joinCode, setJoinCode] = useState("");
    const [formData, setFormData] = useState({
        id: "",
        email: "",
        password: "",
        confirmPassword: "",
        name: "",
        phone: ""
    });
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();
    const db = getDatabase();

    const VALID_CODE = "D82r38JW!";

    const handleNextStep = (e) => {
        e.preventDefault();
        setError("");

        // Check if entered code matches the static code
        if (joinCode === VALID_CODE) {
            setStep(2);
        } else {
            setError("가입 코드가 올바르지 않습니다. 다시 시도해주세요.");
        }
    };

    const handleSignup = async (e) => {
        e.preventDefault();
        if (formData.password !== formData.confirmPassword) {
            return setError("비밀번호가 일치하지 않습니다.");
        }
        if (!formData.name || !formData.phone) {
            return setError("모든 정보를 입력해주세요.");
        }

        setError("");
        setLoading(true);

        try {
            // Create user with the provided email
            const userCredential = await createUserWithEmailAndPassword(auth, formData.email, formData.password);
            const user = userCredential.user;

            // Update profile with the ID (as display name)
            await updateProfile(user, {
                displayName: formData.id
            });

            // Save extra data to Realtime Database
            await set(ref(db, 'users/' + user.uid), {
                username: formData.id,
                email: formData.email,
                name: formData.name,
                phone: formData.phone,
                points: 0,
                createdAt: new Date().toISOString()
            });

            alert("계정이 생성되었습니다!");
            navigate("/");
        } catch (err) {
            console.error(err);
            let msg = "가입에 실패했습니다.";
            switch (err.code) {
                case "auth/weak-password":
                    msg = "비밀번호는 6자리 이상이어야 합니다.";
                    break;
                case "auth/email-already-in-use":
                    msg = "이미 사용 중인 이메일입니다.";
                    break;
                case "auth/invalid-email":
                    msg = "이메일 형식이 올바르지 않습니다.";
                    break;
                default:
                    msg = "오류가 발생했습니다: " + err.message;
            }
            setError(msg);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4 dark:bg-gray-900 transition-colors duration-300">
            <div className="w-full max-w-md animate-fade-in-up">
                {/* Logo Header */}
                <div className="flex flex-col items-center mb-8">
                    <img
                        src="/logos/logo.png"
                        alt="Jeongwonlab Logo"
                        className="h-16 w-auto dark:hidden mb-2 opacity-80"
                    />
                    <img
                        src="/logos/logo-dark.png"
                        alt="Jeongwonlab Logo"
                        className="hidden h-16 w-auto dark:block mb-2 opacity-80"
                    />
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                        {step === 1 ? "가입 코드 입력" : "계정 생성"}
                    </h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                        단계 {step} / 2
                    </p>
                </div>

                <div className="bg-white p-8 shadow-xl rounded-2xl dark:bg-gray-800 ring-1 ring-gray-900/5">
                    {error && (
                        <div className="mb-4 p-3 text-sm text-red-500 bg-red-50 rounded-lg dark:bg-red-900/30 dark:text-red-400 border border-red-100 dark:border-red-900">
                            {error}
                        </div>
                    )}

                    {step === 1 ? (
                        <form onSubmit={handleNextStep} className="space-y-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-900 dark:text-gray-300">
                                    가입 코드
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={joinCode}
                                    onChange={(e) => setJoinCode(e.target.value)}
                                    className="mt-2 block w-full rounded-xl border-0 py-2.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 dark:bg-gray-700 dark:ring-gray-600 dark:text-white sm:text-sm sm:leading-6"
                                    placeholder="전달받은 가입 코드를 입력하세요"
                                />
                            </div>
                            <button
                                type="submit"
                                className="flex w-full justify-center rounded-xl bg-indigo-600 px-3 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 transition-all hover:scale-[1.02]"
                            >
                                코드 확인
                            </button>
                        </form>
                    ) : (
                        <form onSubmit={handleSignup} className="space-y-5">
                            <div>
                                <label className="block text-sm font-medium text-gray-900 dark:text-gray-300">
                                    아이디
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={formData.id}
                                    onChange={(e) => setFormData({ ...formData, id: e.target.value })}
                                    className="mt-1 block w-full rounded-xl border-0 py-2.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-indigo-600 dark:bg-gray-700 dark:ring-gray-600 dark:text-white"
                                    placeholder="아이디를 입력하세요"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-900 dark:text-gray-300">
                                    이름
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    className="mt-1 block w-full rounded-xl border-0 py-2.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-indigo-600 dark:bg-gray-700 dark:ring-gray-600 dark:text-white"
                                    placeholder="실명을 입력하세요"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-900 dark:text-gray-300">
                                    전화번호
                                </label>
                                <input
                                    type="tel"
                                    required
                                    value={formData.phone}
                                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                    className="mt-1 block w-full rounded-xl border-0 py-2.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-indigo-600 dark:bg-gray-700 dark:ring-gray-600 dark:text-white"
                                    placeholder="010-0000-0000"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-900 dark:text-gray-300">
                                    이메일
                                </label>
                                <input
                                    type="email"
                                    required
                                    value={formData.email}
                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                    className="mt-1 block w-full rounded-xl border-0 py-2.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-indigo-600 dark:bg-gray-700 dark:ring-gray-600 dark:text-white"
                                    placeholder="example@email.com"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-900 dark:text-gray-300">
                                    비밀번호
                                </label>
                                <input
                                    type="password"
                                    required
                                    value={formData.password}
                                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                    className="mt-1 block w-full rounded-xl border-0 py-2.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-indigo-600 dark:bg-gray-700 dark:ring-gray-600 dark:text-white"
                                    placeholder="••••••••"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-900 dark:text-gray-300">
                                    비밀번호 확인
                                </label>
                                <input
                                    type="password"
                                    required
                                    value={formData.confirmPassword}
                                    onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                                    className="mt-1 block w-full rounded-xl border-0 py-2.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-indigo-600 dark:bg-gray-700 dark:ring-gray-600 dark:text-white"
                                    placeholder="••••••••"
                                />
                            </div>

                            <div className="flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => setStep(1)}
                                    className="flex-1 justify-center rounded-xl px-3 py-2.5 text-sm font-semibold text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 dark:text-white dark:ring-gray-600 dark:hover:bg-gray-700"
                                >
                                    이전
                                </button>
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="flex-[2] justify-center rounded-xl bg-indigo-600 px-3 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 transition-all disabled:opacity-50"
                                >
                                    {loading ? "생성 중..." : "계정 생성"}
                                </button>
                            </div>
                        </form>
                    )}

                    <div className="mt-6 text-center">
                        <Link to="/" className="text-sm font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400">
                            이미 계정이 있으신가요? 로그인
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
