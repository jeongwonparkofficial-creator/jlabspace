import { useState } from "react";
import { Link } from "react-router-dom";
import { getAuth, sendPasswordResetEmail } from "firebase/auth";

export default function FindPw() {
    const [id, setId] = useState("");
    const [msg, setMsg] = useState("");
    const [error, setError] = useState("");

    const handleReset = async (e) => {
        e.preventDefault();
        setMsg("");
        setError("");

        if (!id) return;

        // Construct email from ID
        const email = id.includes('@') ? id : `${id}@jeongwonlab.com`;
        const auth = getAuth();

        try {
            await sendPasswordResetEmail(auth, email);
            setMsg("비밀번호 재설정 이메일이 전송되었습니다. (가짜 이메일인 경우 수신 불가)");
        } catch (err) {
            if (err.code === 'auth/user-not-found') {
                setError("등록되지 않은 아이디입니다.");
            } else {
                setError("이메일 전송 실패: " + err.message);
            }
        }
    };

    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4 transition-colors duration-300">
            <div className="w-full max-w-md animate-fade-in-up">
                <div className="text-center mb-8">
                    <h2 className="text-2xl font-bold text-gray-900">
                        비밀번호 찾기
                    </h2>
                    <p className="mt-2 text-sm text-gray-600">
                        아이디를 입력하시면 재설정 링크를 보내드립니다
                    </p>
                </div>

                <div className="bg-white p-8 shadow-xl rounded-2xl ring-1 ring-gray-900/5">
                    {msg && (
                        <div className="mb-4 p-3 text-sm text-green-600 bg-green-50 rounded-lg border border-green-100">
                            {msg}
                        </div>
                    )}
                    {error && (
                        <div className="mb-4 p-3 text-sm text-red-500 bg-red-50 rounded-lg border border-red-100">
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleReset} className="space-y-6">
                        <div>
                            <label htmlFor="id" className="block text-sm font-medium text-gray-900">
                                아이디
                            </label>
                            <input
                                id="id"
                                type="text"
                                required
                                value={id}
                                onChange={(e) => setId(e.target.value)}
                                className="mt-2 block w-full rounded-xl border-0 py-2.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
                                placeholder="아이디 입력"
                            />
                        </div>
                        <button
                            type="submit"
                            className="flex w-full justify-center rounded-xl bg-indigo-600 px-3 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 transition-all hover:scale-[1.02]"
                        >
                            재설정 링크 보내기
                        </button>
                    </form>

                    <div className="mt-6 text-center">
                        <Link to="/" className="text-sm font-medium text-gray-600 hover:text-gray-900">
                            로그인으로 돌아가기
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
