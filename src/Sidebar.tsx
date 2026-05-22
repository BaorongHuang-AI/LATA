import { useState, useEffect } from "react";
import { NavLink, useNavigate } from "react-router-dom";

export const Sidebar = ({ collapsed, setCollapsed }: { collapsed: boolean, setCollapsed: (val: boolean) => void }) => {

    const navigate = useNavigate();
    const [version, setVersion] = useState("");

    useEffect(() => {
        window.api.getAppVersion().then(setVersion).catch(() => {});
    }, []);

    const menuItems = [
        { name: "Dashboard", path: "/dashboard", icon: "🏠" },
        { name: "Projects", path: "/projects", icon: "📁" },
        // { name: "Aligner", path: "/onlinealign", icon: "🏠" },
        // { name: "Paracorpus Builder", path: "/paracorpus", icon: "📚" },
        // { name: "Translation Training", path: "/translationtraining", icon: "📚" },
        // { name: "Courses", path: "/admin/courses", icon: "📚" },
        // { name: "New Course", path: "/admin/newcourse", icon: "➕" },
        { name: "Prompts", path: "/promptmanager", icon: "💬️" },
        { name: "Prompt Tuner", path: "/prompttuner", icon: "🧪" },
        { name: "Techniques", path: "/tagmanager", icon: "🏷️" },
        { name: "Multimodal", path: "/multimodal", icon: "🖼️" },
        { name: "LLMs", path: "/settings", icon: "⚙️" },
    ];

    const handleLogout = async () => {
        // Clear tokens or any auth-related data
        // localStorage.removeItem("accessToken");
        // localStorage.removeItem("refreshToken"); // if you have
        // // Redirect to login page
        // navigate("/login", { replace: true });
        await window.api.logout();
        navigate("/login", { replace: true });
    };

    return (
        <div
            className={`fixed top-0 left-0 h-screen bg-base-200 border-r border-base-300 flex flex-col transition-all duration-300 ${
                collapsed ? "w-16" : "w-56"
            }`}
        >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-base-300">
                {!collapsed && <span className="text-lg font-bold">LATA</span>}
                <button className="btn btn-sm btn-ghost" onClick={() => setCollapsed(!collapsed)}>
                    {collapsed ? "➡️" : "⬅️"}
                </button>
            </div>

            {/* Menu */}
            <ul className="menu p-2 flex-1">
                {menuItems.map((item) => (
                    <li key={item.path}>
                        <NavLink
                            to={item.path}
                            className={({ isActive }) => (isActive ? "active font-bold" : "")}
                        >
                            <span>{item.icon}</span>
                            {!collapsed && <span>{item.name}</span>}
                        </NavLink>
                    </li>
                ))}
            </ul>

            {/* Footer with Logout */}
            <div className="p-4 border-t border-base-300">
                {!collapsed && (
                    <p className="text-sm text-gray-500 mb-2">
                        © 2025 LATA — B.H & A.A
                        {version && (
                            <span className="ml-2 text-xs text-gray-400">
                                v{version}
                            </span>
                        )}
                    </p>
                )}
                <button
                    className="btn btn-sm btn-error w-full"
                    onClick={handleLogout}
                >
                    {collapsed ? "🚪" : "Logout"}
                </button>
            </div>
        </div>
    );
};
