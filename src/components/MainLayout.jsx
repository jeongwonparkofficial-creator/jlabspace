import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";

export default function MainLayout() {
    return (
        <div className="flex h-screen bg-white">
            <Sidebar />
            <div className="flex-1 overflow-auto bg-gray-50 p-8">
                <Outlet />
            </div>
        </div>
    );
}
