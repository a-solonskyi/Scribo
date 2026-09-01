import { useEffect, useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";

import { signOutProfessor } from "../sites/auth";
import { getClasses } from "../sites/database";

export default function Layout({ children, session }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [classes, setClasses] = useState([]);

  useEffect(() => {
    let mounted = true;

    async function loadSidebarClasses() {
      try {
        const loadedClasses = await getClasses();
        if (mounted) setClasses(loadedClasses);
      } catch {
        if (mounted) setClasses([]);
      }
    }

    loadSidebarClasses();
    window.addEventListener("classes-updated", loadSidebarClasses);

    return () => {
      mounted = false;
      window.removeEventListener("classes-updated", loadSidebarClasses);
    };
  }, [session?.user?.id, location.pathname]);

  async function handleLogout() {
    await signOutProfessor();
    navigate("/login");
  }

  return (
    <div className="platform-shell">
      <aside className="sidebar">
        <Link className="wordmark" to="/dashboard">
          [ˈskriː.boː]
        </Link>
        <nav className="sidebar-nav">
          <NavLink to="/dashboard">Classes</NavLink>
          {classes.length ? (
            <div className="class-hierarchy" aria-label="Class list">
              {classes.map((item) => (
                <NavLink key={item.id} to={`/class/${item.id}`}>
                  {item.name}
                </NavLink>
              ))}
            </div>
          ) : null}
          <button type="button" onClick={handleLogout}>
            Logout
          </button>
        </nav>
        <p className="sidebar-email">{session?.user?.email}</p>
      </aside>
      <main className="platform-main">{children}</main>
    </div>
  );
}
