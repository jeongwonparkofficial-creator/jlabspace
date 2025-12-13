import { useAuth } from "../context/AuthContext";

export default function Main() {
    const { logout } = useAuth();

    return (
        <div className="min-h-screen p-8 bg-white text-gray-900">
            <div className="flex justify-between items-center mb-8">
                <h1 className="text-3xl font-bold">Jeongwonlab Workspace</h1>
                <button onClick={logout} className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 transition-colors">
                    로그아웃
                </button>
            </div>
            <div className="bg-gray-50 border border-gray-200 p-6 rounded-lg shadow-sm">
                <p className="text-lg">환영합니다! 보호된 메인 대시보드입니다.</p>
                <p className="mt-4 text-gray-600">
                    이곳에서 파일 기록 및 관리를 시작할 수 있습니다.
                </p>
            </div>
        </div>
    );
}
