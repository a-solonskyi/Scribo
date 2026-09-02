import { useEffect, useRef, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";

import { signOutProfessor } from "../sites/auth";
import { getAssignment, getClasses, getSubmission } from "../sites/database";

export default function Layout({ children, session }) {
  const location = useLocation();
  const [classes, setClasses] = useState([]);
  const [activeEssay, setActiveEssay] = useState(null);
  const [donationView, setDonationView] = useState(null);
  const donationRef = useRef(null);

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

    void loadSidebarClasses();
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

    void loadActiveEssay();
    return () => {
      mounted = false;
    };
  }, [location.pathname]);

  useEffect(() => {
    if (!donationView) return undefined;

    function closeDonationPanel(event) {
      if (event.type === "keydown" && event.key !== "Escape") return;
      if (
        event.type === "pointerdown" &&
        donationRef.current?.contains(event.target)
      ) {
        return;
      }
      setDonationView(null);
    }

    document.addEventListener("pointerdown", closeDonationPanel);
    document.addEventListener("keydown", closeDonationPanel);
    return () => {
      document.removeEventListener("pointerdown", closeDonationPanel);
      document.removeEventListener("keydown", closeDonationPanel);
    };
  }, [donationView]);

  function handleLogout() {
    signOutProfessor();
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
        </nav>
        <div className="sidebar-footer">
          <div className="sidebar-donation" ref={donationRef}>
            {donationView ? (
              <section
                className="donation-popover"
                aria-label="Donation options"
              >
                {donationView === "developer" ? (
                  <div className="donation-details">
                    <div className="donation-details-header">
                      <button
                        type="button"
                        aria-label="Back to donation options"
                        onClick={() => setDonationView("options")}
                      >
                        &lt;
                      </button>
                      <strong>Support developer</strong>
                    </div>
                    <p>Солонський Андрій В&apos;ячеславович</p>
                    <p>4441111031292125</p>
                    <p>UA563220010000026200325264809</p>
                    <p>3570712210</p>
                  </div>
                ) : (
                  <div className="donation-options">
                    <button
                      type="button"
                      onClick={() => setDonationView("developer")}
                    >
                      Support developer
                    </button>
                    <a
                      href="https://savelife.in.ua/donate/#donate-army-card-once"
                      target="_blank"
                      rel="noreferrer"
                      onClick={() => setDonationView(null)}
                    >
                      Support Ukraine
                    </a>
                  </div>
                )}
              </section>
            ) : null}
            <button
              className="filled-button sidebar-donate-button"
              type="button"
              aria-expanded={Boolean(donationView)}
              onClick={() =>
                setDonationView((current) => (current ? null : "options"))
              }
            >
              Donate
            </button>
          </div>
          <p className="sidebar-email">{session?.user?.email}</p>
          <button className="sidebar-logout-button" type="button" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </aside>
      <main className="platform-main">{children}</main>
    </div>
  );
}
