import { useState } from "react";
import { Link } from "react-router-dom";

export default function FindId() {
    const [email, setEmail] = useState("");

    const handleSubmit = (e) => {
        e.preventDefault();
        alert("관리자에게 아이디 찾기 요청을 전송했습니다. (기능 준비중)");
    };

    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4 transition-colors duration-300">
            <div className="w-full max-w-md animate-fade-in-up">
                <div className="text-center mb-8">
                    <h2 className="text-2xl font-bold text-gray-900">
                        아이디 찾기
                    </h2>
                    <p className="mt-2 text-sm text-gray-600">
                        가입 시 등록한 이메일(또는 정보)을 입력하세요
                    </p>
                </div>

                <div className="bg-white p-8 shadow-xl rounded-2xl ring-1 ring-gray-900/5">
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div>
                            <label htmlFor="email" className="block text-sm font-medium text-gray-900">
                                이메일 / 연락처
                            </label>
                            <input
                                id="email"
                                type="text"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="mt-2 block w-full rounded-xl border-0 py-2.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
                                placeholder="예: contact@example.com"
                            />
                        </div>
                        <button
                            type="submit"
                            className="flex w-full justify-center rounded-xl bg-indigo-600 px-3 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 transition-all hover:scale-[1.02]"
                        >
                            아이디 찾기
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
