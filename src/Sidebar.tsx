import { useState, useEffect } from "react";
import { NavLink, useNavigate, useLocation } from "react-router-dom";

interface MenuSection {
  label: string;
  icon: string;
  items: { name: string; path: string; icon: string }[];
}

const MENU_SECTIONS: MenuSection[] = [
  {
    label: "Alignment",
    icon: "🔗",
    items: [
      { name: "Dashboard", path: "/dashboard", icon: "🏠" },
      { name: "Projects", path: "/projects", icon: "📁" },
      { name: "Techniques", path: "/tagmanager", icon: "🏷️" },
    ],
  },
  {
    label: "Terminology",
    icon: "📖",
    items: [
      { name: "Terminology", path: "/terminology", icon: "📖" },
    ],
  },
  {
    label: "Analysis",
    icon: "📊",
    items: [
      { name: "Corpus Search", path: "/corpussearch", icon: "🔍" },
      { name: "Corpus Analysis", path: "/corpusanalysis", icon: "📊" },
      { name: "Analytics", path: "/analytics", icon: "📈" },
      { name: "Semantic Net", path: "/semantic", icon: "🕸️" },
      { name: "Stylometry", path: "/stylometry", icon: "🖊️" },
      { name: "Narrative", path: "/narrative", icon: "📖" },
    ],
  },
  {
    label: "Settings",
    icon: "⚙️",
    items: [
      { name: "Prompt Tuner", path: "/prompttuner", icon: "🧪" },
      { name: "Database", path: "/database", icon: "🗄️" },
      { name: "LLM Settings", path: "/settings", icon: "⚙️" },
      { name: "Trash", path: "/trash", icon: "🗑️" },
    ],
  },
];

export const Sidebar = ({ collapsed, setCollapsed }: { collapsed: boolean, setCollapsed: (val: boolean) => void }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [version, setVersion] = useState("");

  // Determine which section is active based on current path
  const activeSection = MENU_SECTIONS.findIndex((section) =>
    section.items.some((item) => location.pathname.startsWith(item.path))
  );

  // Track which sections are expanded (default: expand the active section)
  const [expandedSections, setExpandedSections] = useState<Set<number>>(
    new Set(activeSection >= 0 ? [activeSection] : [])
  );

  useEffect(() => {
    window.api.getAppVersion().then(setVersion).catch(() => {});
  }, []);

  // Auto-expand the active section when route changes
  useEffect(() => {
    if (activeSection >= 0) {
      setExpandedSections((prev) => new Set([...prev, activeSection]));
    }
  }, [activeSection]);

  const toggleSection = (idx: number) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) {
        next.delete(idx);
      } else {
        next.add(idx);
      }
      return next;
    });
  };

  const handleLogout = async () => {
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

      {/* Menu sections */}
      <div className="flex-1 overflow-y-auto p-2">
        {MENU_SECTIONS.map((section, sIdx) => {
          const isExpanded = expandedSections.has(sIdx);
          const isActive = activeSection === sIdx;

          return (
            <div key={section.label} className="mb-2">
              {/* Section header */}
              {collapsed ? (
                // Collapsed: show icon only; click toggles expand
                <div
                  className={`flex items-center justify-center p-2 rounded cursor-pointer transition mb-1 ${
                    isActive ? "bg-base-300 text-primary" : "hover:bg-base-300 text-base-content/60"
                  }`}
                  onClick={() => toggleSection(sIdx)}
                  title={section.label}
                >
                  <span className="text-lg">{section.icon}</span>
                </div>
              ) : (
                // Expanded sidebar: show label + toggle chevron
                <div
                  className={`flex items-center justify-between px-2 py-1.5 rounded cursor-pointer transition text-xs font-semibold uppercase tracking-wider ${
                    isActive ? "text-primary" : "text-base-content/50 hover:text-base-content/70"
                  }`}
                  onClick={() => toggleSection(sIdx)}
                >
                  <span className="flex items-center gap-1.5">
                    <span>{section.icon}</span>
                    {section.label}
                  </span>
                  <span className={`transition-transform text-[10px] ${isExpanded ? "rotate-90" : ""}`}>
                    ▶
                  </span>
                </div>
              )}

              {/* Section items */}
              {isExpanded && (
                <ul className="menu menu-sm">
                  {section.items.map((item) => (
                    <li key={item.path}>
                      <NavLink
                        to={item.path}
                        className={({ isActive: linkActive }) =>
                          linkActive ? "active font-bold" : ""
                        }
                      >
                        <span>{item.icon}</span>
                        {!collapsed && <span>{item.name}</span>}
                      </NavLink>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer with Logout */}
      <div className="p-4 border-t border-base-300">
        {!collapsed && (
          <p className="text-sm text-gray-500 mb-2">
            © 2025 LATA — B.H & A.A
            {version && (
              <span className="ml-2 text-xs text-gray-400">v{version}</span>
            )}
          </p>
        )}
        <button className="btn btn-sm btn-error w-full" onClick={handleLogout}>
          {collapsed ? "🚪" : "Logout"}
        </button>
      </div>
    </div>
  );
};
