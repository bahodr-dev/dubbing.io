import { useState, useEffect } from 'react';
import type { ActiveTab, Project } from './types';
import { INITIAL_PROJECTS } from './data/sampleProjects';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import { AuthModal } from './components/AuthModal';
import { NewDubModal } from './components/NewDubModal';
import { LandingView } from './views/LandingView';
import { DashboardView } from './views/DashboardView';
import { StudioView } from './views/StudioView';
import { PricingView } from './views/PricingView';
import { SignUpView } from './views/SignUpView';

export function App() {
  const [userEmail, setUserEmail] = useState<string | null>(() => {
    return localStorage.getItem('dubbing_io_user');
  });

  // Default directly to 'signup' if user is not authenticated, otherwise 'dashboard'
  const [activeTab, setActiveTab] = useState<ActiveTab>(() => {
    const savedUser = localStorage.getItem('dubbing_io_user');
    return savedUser ? 'dashboard' : 'signup';
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

  const handleCreateProject = (newProj: Project) => {
    setProjects(prev => [newProj, ...prev]);
    setActiveProjectId(newProj.id);
    setActiveTab('studio');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleUpdateProject = (updated: Project) => {
    setProjects(prev => prev.map(p => p.id === updated.id ? updated : p));
  };

  const handleDeleteProject = (projId: string) => {
    setProjects(prev => prev.filter(p => p.id !== projId));
    if (activeProjectId === projId) {
      const remaining = projects.filter(p => p.id !== projId);
      if (remaining.length > 0) {
        setActiveProjectId(remaining[0].id);
      }
    }
  };

  const handleAuthSuccess = (email: string) => {
    setUserEmail(email);
    localStorage.setItem('dubbing_io_user', email);
    setActiveTab('dashboard');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleLogout = () => {
    setUserEmail(null);
    localStorage.removeItem('dubbing_io_user');
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
        {activeTab === 'landing' && (
          <LandingView
            onStartDubbing={() => setIsNewDubOpen(true)}
            onOpenPricing={() => {
              setActiveTab('pricing');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            onOpenSignIn={() => setIsAuthOpen(true)}
          />
        )}

        {activeTab === 'dashboard' && (
          <DashboardView
            projects={projects}
            onOpenProject={handleOpenProject}
            onOpenNewDub={() => setIsNewDubOpen(true)}
            onDeleteProject={handleDeleteProject}
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
