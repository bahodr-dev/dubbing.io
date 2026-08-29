import { useState, useEffect, useCallback } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import type { ActiveTab, Project } from './types';
import { INITIAL_PROJECTS } from './data/sampleProjects';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import { AuthModal } from './components/AuthModal';
import { NewDubModal } from './components/NewDubModal';
import { ProtectedRoute } from './components/ProtectedRoute';
import { DashboardView } from './views/DashboardView';
import { StudioView } from './views/StudioView';
import { PricingView } from './views/PricingView';
import { SignUpView } from './views/SignUpView';
import { api } from './services/api';
import { ToastProvider, useToast } from './context/ToastContext';

function AppContent() {
  const navigate = useNavigate();
  const location = useLocation();
  const { showSuccess, showError, showInfo } = useToast();

  const [userEmail, setUserEmail] = useState<string | null>(null);

  const [projects, setProjects] = useState<Project[]>(() => {
    const saved = localStorage.getItem('dubbing_io_projects');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return INITIAL_PROJECTS;
      }
    }
    return INITIAL_PROJECTS;
  });

  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isNewDubOpen, setIsNewDubOpen] = useState(false);

  // Authenticate session with backend and sync database projects via secure cookie
  const syncWithBackend = useCallback(async () => {
    try {
      const res = await api.auth.me();
      setUserEmail(res.user.email);

      // Fetch persistent user projects from SQLite backend
      try {
        const projRes = await api.projects.list();
        if (projRes.projects && projRes.projects.length > 0) {
          setProjects(projRes.projects);
          localStorage.setItem('dubbing_io_projects', JSON.stringify(projRes.projects));
        }
      } catch (err: unknown) {
        console.warn('Could not sync projects from backend:', err);
      }
    } catch {
      // Session unauthenticated or expired
      setUserEmail(null);
    }
  }, []);

  useEffect(() => {
    syncWithBackend();
  }, [syncWithBackend]);

  // Derive activeTab from current route path
  const currentPath = location.pathname;
  let activeTab: ActiveTab = 'dashboard';
  if (currentPath.startsWith('/studio')) activeTab = 'studio';
  else if (currentPath === '/pricing') activeTab = 'pricing';
  else if (currentPath === '/signup' || currentPath === '/signin') activeTab = 'signup';
  else activeTab = 'dashboard';

  // Persist offline cache to localStorage
  useEffect(() => {
    localStorage.setItem('dubbing_io_projects', JSON.stringify(projects));
  }, [projects]);

  const handleNavigate = (tab: ActiveTab) => {
    if (tab === 'dashboard') navigate('/dashboard');
    else if (tab === 'pricing') navigate('/pricing');
    else if (tab === 'signup') navigate('/signup');
    else if (tab === 'studio') {
      const targetId = projects.length > 0 ? projects[0].id : 'new';
      navigate(`/studio/${targetId}`);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleOpenProject = (proj: Project) => {
    navigate(`/studio/${proj.id}`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCreateProject = async (newProj: Project) => {
    setProjects((prev) => [newProj, ...prev]);
    navigate(`/studio/${newProj.id}`);
    window.scrollTo({ top: 0, behavior: 'smooth' });

    try {
      await api.projects.create(newProj);
      showSuccess('Project created and saved to database!');
    } catch (err: unknown) {
      const errorObj = err as Error;
      showError(errorObj.message || 'Could not save project to database');
    }
  };

  const handleUpdateProject = async (updated: Project) => {
    setProjects((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    try {
      await api.projects.update(updated.id, updated);
    } catch (err: unknown) {
      const errorObj = err as Error;
      showError(errorObj.message || 'Could not update project in database');
    }
  };

  const handleRenameProject = async (projectId: string, newTitle: string) => {
    setProjects((prev) =>
      prev.map((p) =>
        p.id === projectId
          ? { ...p, title: newTitle, updatedAt: new Date().toISOString() }
          : p
      )
    );
    try {
      await api.projects.update(projectId, { title: newTitle });
      showSuccess('Project renamed successfully');
    } catch (err: unknown) {
      const errorObj = err as Error;
      showError(errorObj.message || 'Could not rename project');
    }
  };

  const handleDeleteProject = async (projId: string) => {
    setProjects((prev) => prev.filter((p) => p.id !== projId));
    try {
      await api.projects.delete(projId);
      showSuccess('Project deleted successfully');
    } catch (err: unknown) {
      const errorObj = err as Error;
      showError(errorObj.message || 'Could not delete project from database');
    }
  };

  const handleAuthSuccess = async (email: string) => {
    setUserEmail(email);
    showSuccess(`Welcome back, ${email.split('@')[0]}!`);
    await syncWithBackend();
    navigate('/dashboard');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleLogout = async () => {
    await api.auth.logout();
    setUserEmail(null);
    showInfo('Logged out successfully');
    navigate('/signup');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSelectPlan = (_plan: string) => {
    setIsNewDubOpen(true);
  };

  const isAuthPage = location.pathname === '/signup' || location.pathname === '/signin';

  return (
    <div className="app-container">
      {/* Universal Navigation Header */}
      {!isAuthPage && (
        <Navbar
          activeTab={activeTab}
          onNavigate={handleNavigate}
          onOpenAuth={() => setIsAuthOpen(true)}
          onOpenNewDub={() => setIsNewDubOpen(true)}
          isAuthenticated={!!userEmail}
          onLogout={handleLogout}
        />
      )}

      {/* Main View Routes */}
      <main className="main-content">
        <Routes>
          {/* Default Root Redirect */}
          <Route
            path="/"
            element={
              userEmail ? <Navigate to="/dashboard" replace /> : <Navigate to="/signup" replace />
            }
          />

          {/* Sign Up / Sign In Page (Redirects to /dashboard if authenticated) */}
          <Route
            path="/signup"
            element={
              userEmail ? (
                <Navigate to="/dashboard" replace />
              ) : (
                <SignUpView
                  onNavigate={handleNavigate}
                  onSuccess={handleAuthSuccess}
                  onOpenSignIn={() => setIsAuthOpen(true)}
                />
              )
            }
          />
          <Route
            path="/signin"
            element={
              userEmail ? (
                <Navigate to="/dashboard" replace />
              ) : (
                <SignUpView
                  onNavigate={handleNavigate}
                  onSuccess={handleAuthSuccess}
                  onOpenSignIn={() => setIsAuthOpen(true)}
                />
              )
            }
          />

          {/* Dashboard View (Protected) */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute isAuthenticated={!!userEmail}>
                <DashboardView
                  projects={projects}
                  onOpenProject={handleOpenProject}
                  onCreateProject={handleCreateProject}
                  onOpenNewDub={() => setIsNewDubOpen(true)}
                  onDeleteProject={handleDeleteProject}
                  onRenameProject={handleRenameProject}
                />
              </ProtectedRoute>
            }
          />

          {/* Studio View (Protected, Dynamic Route by Project ID) */}
          <Route
            path="/studio/:projectId"
            element={
              <ProtectedRoute isAuthenticated={!!userEmail}>
                <StudioView
                  projects={projects}
                  onUpdateProject={handleUpdateProject}
                  onBackToDashboard={() => {
                    navigate('/dashboard');
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  onOpenNewDub={() => setIsNewDubOpen(true)}
                />
              </ProtectedRoute>
            }
          />

          {/* Pricing View */}
          <Route
            path="/pricing"
            element={<PricingView onSelectPlan={handleSelectPlan} />}
          />

          {/* Fallback to Root */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      {/* Architectural Footer */}
      {!isAuthPage && <Footer onNavigate={handleNavigate} />}

      {/* Global Modals */}
      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        onSuccess={handleAuthSuccess}
        onNavigateToSignUp={() => {
          setIsAuthOpen(false);
          navigate('/signup');
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
      />

      <NewDubModal
        isOpen={isNewDubOpen}
        onClose={() => setIsNewDubOpen(false)}
        onCreateProject={handleCreateProject}
      />
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <AppContent />
      </ToastProvider>
    </BrowserRouter>
  );
}
