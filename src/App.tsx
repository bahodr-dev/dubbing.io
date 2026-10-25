import { lazy, Suspense, useState, useEffect, useCallback, useRef } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import type { ActiveTab, Project, ProjectLoadState } from './types';
import { INITIAL_PROJECTS } from './data/sampleProjects';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import { ProtectedRoute } from './components/ProtectedRoute';
import { api } from './services/api';
import type { UserProfile } from './services/api';
import { ToastProvider, useToast } from './context/ToastContext';

const LandingView = lazy(() => import('./views/LandingView').then((module) => ({ default: module.LandingView })));
const DashboardView = lazy(() => import('./views/DashboardView').then((module) => ({ default: module.DashboardView })));
const StudioView = lazy(() => import('./views/StudioView').then((module) => ({ default: module.StudioView })));
const PricingView = lazy(() => import('./views/PricingView').then((module) => ({ default: module.PricingView })));
const SignUpView = lazy(() => import('./views/SignUpView').then((module) => ({ default: module.SignUpView })));
const ResetPasswordView = lazy(() => import('./views/ResetPasswordView').then((module) => ({ default: module.ResetPasswordView })));
const AuthModal = lazy(() => import('./components/AuthModal').then((module) => ({ default: module.AuthModal })));
const NewDubModal = lazy(() => import('./components/NewDubModal').then((module) => ({ default: module.NewDubModal })));
const CheckoutModal = lazy(() => import('./components/CheckoutModal').then((module) => ({ default: module.CheckoutModal })));

function PageFallback() {
  return (
    <div className="route-loading" role="status" aria-live="polite">
      <div className="route-loading-card">
        <span className="route-loading-spinner" aria-hidden="true" />
        Loading workspace…
      </div>
    </div>
  );
}

function AppContent() {
  const navigate = useNavigate();
  const location = useLocation();
  const { showSuccess, showError, showInfo } = useToast();

  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [projectLoadState, setProjectLoadState] = useState<ProjectLoadState>('loading');

  const [projects, setProjects] = useState<Project[]>(() => {
    const saved = localStorage.getItem('dubla_uz_projects');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return INITIAL_PROJECTS;
      }
    }
    return INITIAL_PROJECTS;
  });
  const projectsRef = useRef(projects);
  const latestProjectUpdateRef = useRef(new Map<string, symbol>());

  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isNewDubOpen, setIsNewDubOpen] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState('creator');

  const returnedPaymentOrder = new URLSearchParams(location.search).get('paymentOrder');
  useEffect(() => {
    if (returnedPaymentOrder && userEmail) setIsCheckoutOpen(true);
  }, [returnedPaymentOrder, userEmail]);

  // Load persistent user projects from SQLite backend
  const loadProjects = useCallback(async () => {
    setProjectLoadState('loading');
    try {
      // The dashboard currently renders up to 100 recent projects; the API
      // supports smaller paginated requests for future infinite scrolling.
      const projRes = await api.projects.list({ limit: 100 });
      const syncedProjects = projRes.projects || [];
      setProjects(syncedProjects);
      localStorage.setItem('dubla_uz_projects', JSON.stringify(syncedProjects));
      setProjectLoadState('success');
    } catch (err: unknown) {
      console.warn('Could not sync projects from backend:', err);
      setProjectLoadState('error');
    }
  }, []);

  // Authenticate session with backend and sync database projects via secure cookie
  const syncWithBackend = useCallback(async () => {
    try {
      const res = await api.auth.me();
      setUserProfile(res.user);
      setUserEmail(res.user.email);
      await loadProjects();
    } catch {
      // Session unauthenticated or expired
      setUserProfile(null);
      setUserEmail(null);
      setProjectLoadState('success');
    } finally {
      setIsAuthLoading(false);
    }
  }, [loadProjects]);

  useEffect(() => {
    syncWithBackend();
  }, [syncWithBackend]);

  // Derive activeTab from current route path
  const currentPath = location.pathname;
  let activeTab: ActiveTab = 'dashboard';
  if (currentPath.startsWith('/studio')) activeTab = 'studio';
  else if (currentPath === '/pricing') activeTab = 'pricing';
  else if (currentPath === '/signup' || currentPath === '/signin' || currentPath === '/reset-password') activeTab = 'signup';
  else activeTab = 'dashboard';

  // Persist offline cache to localStorage
  useEffect(() => {
    projectsRef.current = projects;
    localStorage.setItem('dubla_uz_projects', JSON.stringify(projects));
  }, [projects]);

  const handleNavigate = (tab: ActiveTab) => {
    if (tab === 'home') navigate('/');
    else if (tab === 'dashboard') navigate('/dashboard');
    else if (tab === 'pricing') navigate(userEmail ? '/dashboard/pricing' : '/pricing');
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
    try {
      const { project: savedProject } = await api.projects.create(newProj);
      const project = savedProject || newProj;
      setProjects((prev) => [project, ...prev.filter((item) => item.id !== project.id)]);
      navigate(`/studio/${project.id}`);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      showSuccess('Project created and saved to database!');
    } catch (err: unknown) {
      const errorObj = err as Error;
      showError(errorObj.message || 'Could not save project to database');
      throw err;
    }
  };

  const handleUpdateProject = async (updated: Project) => {
    const previousProject = projectsRef.current.find((project) => project.id === updated.id);
    const updateToken = Symbol(updated.id);
    latestProjectUpdateRef.current.set(updated.id, updateToken);

    setProjects((prev) => {
      const next = prev.map((project) => (project.id === updated.id ? updated : project));
      projectsRef.current = next;
      return next;
    });

    try {
      await api.projects.update(updated.id, updated);
    } catch (err: unknown) {
      if (previousProject && latestProjectUpdateRef.current.get(updated.id) === updateToken) {
        setProjects((prev) => {
          const rolledBack = prev.map((project) =>
            project.id === updated.id ? previousProject : project
          );
          projectsRef.current = rolledBack;
          return rolledBack;
        });
      }
      const errorObj = err as Error;
      showError(errorObj.message || 'Could not update project in database');
    } finally {
      if (latestProjectUpdateRef.current.get(updated.id) === updateToken) {
        latestProjectUpdateRef.current.delete(updated.id);
      }
    }
  };

  const handleSettingsSaved = (projectId: string, patch: Partial<Project>) => {
    setProjects((prev) => {
      const next = prev.map((project) =>
        project.id === projectId ? { ...project, ...patch } : project
      );
      projectsRef.current = next;
      return next;
    });
  };

  const handleRenameProject = async (projectId: string, newTitle: string) => {
    try {
      await api.projects.update(projectId, { title: newTitle });
      setProjects((prev) =>
        prev.map((p) =>
          p.id === projectId
            ? { ...p, title: newTitle, updatedAt: new Date().toISOString() }
            : p
        )
      );
      showSuccess('Project renamed successfully');
    } catch (err: unknown) {
      const errorObj = err as Error;
      showError(errorObj.message || 'Could not rename project');
      throw err;
    }
  };

  const handleDeleteProject = async (projId: string) => {
    try {
      await api.projects.delete(projId);
      setProjects((prev) => prev.filter((p) => p.id !== projId));
      showSuccess('Project deleted successfully');
    } catch (err: unknown) {
      const errorObj = err as Error;
      showError(errorObj.message || 'Could not delete project from database');
      throw err;
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
    setUserProfile(null);
    setProjects([]);
    localStorage.removeItem('dubla_uz_projects');
    showInfo('Logged out successfully');
    navigate('/signup');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSelectPlan = (plan: string) => {
    if (plan === 'free') {
      if (!userEmail) {
        setIsAuthOpen(true);
      } else {
        navigate('/dashboard');
      }
      return;
    }

    if (!userEmail) {
      setIsAuthOpen(true);
      return;
    }

    setSelectedPlanId(plan);
    setIsCheckoutOpen(true);
  };

  const isLandingPage = location.pathname === '/' || location.pathname === '/uz';
  const isAuthPage = location.pathname === '/signup' || location.pathname === '/signin' || location.pathname === '/reset-password';

  return (
    <div className="app-container">
      {/* Universal Navigation Header */}
      {!isAuthPage && !isLandingPage && (
        <Navbar
          activeTab={activeTab}
          onNavigate={handleNavigate}
          onOpenAuth={() => setIsAuthOpen(true)}
          onOpenNewDub={() => setIsNewDubOpen(true)}
          isAuthenticated={!!userEmail}
          user={userProfile}
          onLogout={handleLogout}
        />
      )}

      {/* Main View Routes */}
      <main className="main-content">
        <Suspense fallback={<PageFallback />}>
          <Routes>
          {/* Default Root Redirect */}
          <Route
            path="/"
            element={
              <LandingView isAuthenticated={!!userEmail} />
            }
          />

          <Route path="/uz" element={<LandingView isAuthenticated={!!userEmail} />} />

          {/* Sign Up / Sign In Page (Redirects to /dashboard if authenticated) */}
          <Route
            path="/signup"
            element={
              userEmail ? (
                <Navigate to="/dashboard" replace />
              ) : (
                <SignUpView
                  key="signup"
                  initialMode="signup"
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
                  key="signin"
                  initialMode="signin"
                  onNavigate={handleNavigate}
                  onSuccess={handleAuthSuccess}
                  onOpenSignIn={() => setIsAuthOpen(true)}
                />
              )
            }
          />
          <Route path="/reset-password" element={<ResetPasswordView />} />

          {/* Dashboard View (Protected) */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute isAuthenticated={!!userEmail} isLoading={isAuthLoading}>
                <DashboardView
                  projects={projects}
                  projectLoadState={projectLoadState}
                  onRetryLoadProjects={loadProjects}
                  onOpenProject={handleOpenProject}
                  onCreateProject={handleCreateProject}
                  onOpenNewDub={() => setIsNewDubOpen(true)}
                  onDeleteProject={handleDeleteProject}
                  onRenameProject={handleRenameProject}
                  onSelectPlan={handleSelectPlan}
                />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard/:tab"
            element={
              <ProtectedRoute isAuthenticated={!!userEmail} isLoading={isAuthLoading}>
                <DashboardView
                  projects={projects}
                  projectLoadState={projectLoadState}
                  onRetryLoadProjects={loadProjects}
                  onOpenProject={handleOpenProject}
                  onCreateProject={handleCreateProject}
                  onOpenNewDub={() => setIsNewDubOpen(true)}
                  onDeleteProject={handleDeleteProject}
                  onRenameProject={handleRenameProject}
                  onSelectPlan={handleSelectPlan}
                />
              </ProtectedRoute>
            }
          />

          {/* Convenient redirects for top-level routes */}
          <Route path="/gifts" element={<Navigate to="/dashboard/gifts" replace />} />
          <Route path="/voices" element={<Navigate to="/dashboard/voices" replace />} />
          <Route path="/recent" element={<Navigate to="/dashboard/recent" replace />} />

          {/* Studio View (Protected, Dynamic Route by Project ID) */}
          <Route
            path="/studio/:projectId"
            element={
              <ProtectedRoute isAuthenticated={!!userEmail} isLoading={isAuthLoading}>
                <StudioView
                  projects={projects}
                  onUpdateProject={handleUpdateProject}
                  onSettingsSaved={handleSettingsSaved}
                  onMinutesBalanceChange={(minutesBalance) => {
                    setUserProfile((current) => current
                      ? current.minutesBalance === minutesBalance
                        ? current
                        : { ...current, minutesBalance }
                      : current);
                  }}
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
            element={userEmail ? <Navigate to="/dashboard/pricing" replace /> : <PricingView onSelectPlan={handleSelectPlan} />}
          />

          {/* Fallback to Root */}
          <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </main>

      {/* Architectural Footer */}
      {!isAuthPage && !isLandingPage && <Footer onNavigate={handleNavigate} />}

      {/* Global Modals */}
      {isAuthOpen && (
        <Suspense fallback={null}>
          <AuthModal
            isOpen
            onClose={() => setIsAuthOpen(false)}
            onSuccess={handleAuthSuccess}
            onNavigateToSignUp={() => {
              setIsAuthOpen(false);
              navigate('/signup');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          />
        </Suspense>
      )}

      {isNewDubOpen && (
        <Suspense fallback={null}>
          <NewDubModal
            isOpen
            onClose={() => setIsNewDubOpen(false)}
            onCreateProject={handleCreateProject}
          />
        </Suspense>
      )}

      {isCheckoutOpen && (
        <Suspense fallback={null}>
          <CheckoutModal
            isOpen
            initialOrderId={returnedPaymentOrder}
            onClose={() => {
              setIsCheckoutOpen(false);
              if (returnedPaymentOrder) {
                const params = new URLSearchParams(location.search);
                params.delete('paymentOrder');
                navigate({ pathname: location.pathname, search: params.toString() }, { replace: true });
              }
            }}
            selectedPlanId={selectedPlanId}
            onSuccess={syncWithBackend}
          />
        </Suspense>
      )}
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
