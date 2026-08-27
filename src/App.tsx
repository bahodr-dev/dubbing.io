import { useState, useEffect } from 'react';
import type { ActiveTab, Project } from './types';
import { INITIAL_PROJECTS } from './data/sampleProjects';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import { AuthModal } from './components/AuthModal';
import { NewDubModal } from './components/NewDubModal';
import { DashboardView } from './views/DashboardView';
import { StudioView } from './views/StudioView';
import { PricingView } from './views/PricingView';
import { SignUpView } from './views/SignUpView';
import { api } from './services/api';

export function App() {
  const [userEmail, setUserEmail] = useState<string | null>(() => {
    return localStorage.getItem('dubbing_io_user');
  });

  // Default directly to 'signup' if user is not authenticated, otherwise 'dashboard'
  const [activeTab, setActiveTab] = useState<ActiveTab>(() => {
    const savedUser = localStorage.getItem('dubbing_io_user');
    const token = localStorage.getItem('dubbing_io_token');
    return (savedUser || token) ? 'dashboard' : 'signup';
  });

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

  const [activeProjectId, setActiveProjectId] = useState<string | null>(INITIAL_PROJECTS[0].id);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isNewDubOpen, setIsNewDubOpen] = useState(false);

  // Authenticate session with backend on initial load
  useEffect(() => {
    const verifySession = async () => {
      const token = api.getToken();
      if (token) {
        try {
          const res = await api.auth.me();
          setUserEmail(res.user.email);
          localStorage.setItem('dubbing_io_user', res.user.email);

          // Fetch user's persistent projects from SQLite database
          try {
            const projRes = await api.projects.list();
            if (projRes.projects && projRes.projects.length > 0) {
              setProjects(projRes.projects);
              setActiveProjectId(projRes.projects[0].id);
            }
          } catch (err) {
            console.warn('Could not fetch projects from DB:', err);
          }
        } catch {
          api.auth.logout();
          setUserEmail(null);
          setActiveTab('signup');
        }
      }
    };

    verifySession();
  }, []);

  // Persist projects to localStorage
  useEffect(() => {
    localStorage.setItem('dubbing_io_projects', JSON.stringify(projects));
  }, [projects]);

  const activeProject = projects.find(p => p.id === activeProjectId) || projects[0];

  const handleOpenProject = (proj: Project) => {
    setActiveProjectId(proj.id);
    setActiveTab('studio');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCreateProject = async (newProj: Project) => {
    setProjects(prev => [newProj, ...prev]);
    setActiveProjectId(newProj.id);
    setActiveTab('studio');
    window.scrollTo({ top: 0, behavior: 'smooth' });

    if (api.getToken()) {
      try {
        await api.projects.create(newProj);
      } catch (err) {
        console.warn('Could not save project to database:', err);
      }
    }
  };

  const handleUpdateProject = async (updated: Project) => {
    setProjects(prev => prev.map(p => p.id === updated.id ? updated : p));
    if (api.getToken()) {
      try {
        await api.projects.update(updated.id, updated);
      } catch (err) {
        console.warn('Could not update project in DB:', err);
      }
    }
  };

  const handleRenameProject = async (projectId: string, newTitle: string) => {
    setProjects(prev => prev.map(p => p.id === projectId ? { ...p, title: newTitle, updatedAt: new Date().toISOString() } : p));
    if (api.getToken()) {
      try {
        await api.projects.update(projectId, { title: newTitle });
      } catch (err) {
        console.warn('Could not rename project in DB:', err);
      }
    }
  };

  const handleDeleteProject = async (projId: string) => {
    setProjects(prev => prev.filter(p => p.id !== projId));
    if (activeProjectId === projId) {
      const remaining = projects.filter(p => p.id !== projId);
      if (remaining.length > 0) {
        setActiveProjectId(remaining[0].id);
      }
    }
    if (api.getToken()) {
      try {
        await api.projects.delete(projId);
      } catch (err) {
        console.warn('Could not delete project from DB:', err);
      }
    }
  };

  const handleAuthSuccess = async (email: string) => {
    setUserEmail(email);
    localStorage.setItem('dubbing_io_user', email);
    setActiveTab('dashboard');
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // Sync projects from database
    if (api.getToken()) {
      try {
        const projRes = await api.projects.list();
        if (projRes.projects && projRes.projects.length > 0) {
          setProjects(projRes.projects);
          setActiveProjectId(projRes.projects[0].id);
        }
      } catch (err) {
        console.warn('Could not load database projects:', err);
      }
    }
  };

  const handleLogout = () => {
    api.auth.logout();
    setUserEmail(null);
    setActiveTab('signup');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSelectPlan = (_plan: string) => {
    setIsNewDubOpen(true);
  };

  // Dedicated Full-Screen Experience for Sign Up (Default Entry Point)
  if (activeTab === 'signup') {
    return (
      <div className="app-container">
        <SignUpView
          onNavigate={(tab) => {
            setActiveTab(tab);
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          onSuccess={handleAuthSuccess}
          onOpenSignIn={() => setIsAuthOpen(true)}
        />

        <AuthModal
          isOpen={isAuthOpen}
          onClose={() => setIsAuthOpen(false)}
          onSuccess={handleAuthSuccess}
          onNavigateToSignUp={() => {
            setIsAuthOpen(false);
            setActiveTab('signup');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
        />
      </div>
    );
  }

  return (
    <div className="app-container">
      {/* Universal Navigation */}
      <Navbar
        activeTab={activeTab}
        onNavigate={(tab) => {
          setActiveTab(tab);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        onOpenAuth={() => setIsAuthOpen(true)}
        onOpenNewDub={() => setIsNewDubOpen(true)}
        isAuthenticated={!!userEmail}
        onLogout={handleLogout}
      />

      {/* Main View Router */}
      <main className="main-content">
        {activeTab === 'dashboard' && (
          <DashboardView
            projects={projects}
            onOpenProject={handleOpenProject}
            onCreateProject={handleCreateProject}
            onOpenNewDub={() => setIsNewDubOpen(true)}
            onDeleteProject={handleDeleteProject}
            onRenameProject={handleRenameProject}
          />
        )}

        {activeTab === 'studio' && activeProject && (
          <StudioView
            project={activeProject}
            onUpdateProject={handleUpdateProject}
            onBackToDashboard={() => {
              setActiveTab('dashboard');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            onOpenNewDub={() => setIsNewDubOpen(true)}
          />
        )}

        {activeTab === 'pricing' && (
          <PricingView
            onSelectPlan={handleSelectPlan}
          />
        )}
      </main>

      {/* Architectural Footer */}
      <Footer
        onNavigate={(tab) => {
          setActiveTab(tab);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
      />

      {/* Global Modals */}
      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        onSuccess={handleAuthSuccess}
        onNavigateToSignUp={() => {
          setIsAuthOpen(false);
          setActiveTab('signup');
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

export default App;
