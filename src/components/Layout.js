import { useEffect, useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";

import { signOutProfessor } from "../sites/auth";
import { getAssignment, getClasses, getSubmission } from "../sites/database";

export default function Layout({ children, session }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [classes, setClasses] = useState([]);
  const [activeEssay, setActiveEssay] = useState(null);

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

  useEffect(() => {
    let mounted = true;

    async function loadActiveEssay() {
      const assignmentMatch = location.pathname.match(/^\/assignment\/([^/]+)/);
      const submissionMatch = location.pathname.match(/^\/submission\/([^/]+)/);

      try {
        if (assignmentMatch) {
          const assignment = await getAssignment(assignmentMatch[1]);
          if (mounted) {
            setActiveEssay({
              id: assignment.id,
              topic: assignment.topic,
              classId: assignment.class_id,
            });
          }
          return;
        }

        if (submissionMatch) {
          const submission = await getSubmission(submissionMatch[1]);
          if (mounted) {
            setActiveEssay({
              id: submission.assignment_id,
              topic: submission.assignments?.topic || "Selected essay",
              classId: submission.assignments?.class_id,
            });
          }
          return;
        }

        if (mounted) setActiveEssay(null);
      } catch {
        if (mounted) setActiveEssay(null);
      }
    }

    loadActiveEssay();
    return () => {
      mounted = false;
    };
  }, [location.pathname]);

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
              {classes.map((item) => {
                const containsActiveEssay = activeEssay?.classId === item.id;
                return (
                  <div className="class-tree-item" key={item.id}>
                    <NavLink
                      className={({ isActive }) =>
                        isActive || containsActiveEssay ? "active" : undefined
                      }
                      to={`/class/${item.id}`}
                    >
                      {item.name}
                    </NavLink>
                    {containsActiveEssay ? (
                      <div className="essay-hierarchy">
                        <NavLink className="active" to={`/assignment/${activeEssay.id}`}>
                          {activeEssay.topic}
                        </NavLink>
                      </div>
                    ) : null}
                  </div>
                );
              })}
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
