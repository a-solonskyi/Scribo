import { useEffect, useState } from "react";
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";

import AssignmentPage from "./components/AssignmentPage";
import ClassPage from "./components/ClassPage";
import Layout from "./components/Layout";
import LoginPage from "./components/LoginPage";
import ProfessorDashboard from "./components/ProfessorDashboard";
import StudentWritingPage from "./components/StudentWritingPage";
import SubmissionAnalyticsPage from "./components/SubmissionAnalyticsPage";
import { ErrorState, LoadingState } from "./components/LoadingState";
import { getCurrentSession, onAuthChange } from "./sites/auth";

function ProtectedRoute({ session, children }) {
  const location = useLocation();

  if (!session?.approved) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <Layout session={session}>{children}</Layout>;
}

export default function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;

    async function loadSession() {
      try {
        const currentSession = await getCurrentSession();
        if (mounted) setSession(currentSession);
      } catch (err) {
        if (mounted) setError(err.message);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadSession();
    const unsubscribe = onAuthChange((nextSession) => setSession(nextSession));

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  if (loading) return <LoadingState label="Starting platform" />;

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage session={session} />} />
        <Route path="/write/:publicToken" element={<StudentWritingPage />} />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute session={session}>
              <ProfessorDashboard session={session} />
            </ProtectedRoute>
          }
        />
        <Route
          path="/class/:classId"
          element={
            <ProtectedRoute session={session}>
              <ClassPage session={session} />
            </ProtectedRoute>
          }
        />
        <Route
          path="/assignment/:assignmentId"
          element={
            <ProtectedRoute session={session}>
              <AssignmentPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/submission/:submissionId"
          element={
            <ProtectedRoute session={session}>
              <SubmissionAnalyticsPage session={session} />
            </ProtectedRoute>
          }
        />
        <Route
          path="/"
          element={<Navigate to={session ? "/dashboard" : "/login"} replace />}
        />
        <Route
          path="*"
          element={<ErrorState message={error || "Page not found."} />}
        />
      </Routes>
    </BrowserRouter>
  );
}
