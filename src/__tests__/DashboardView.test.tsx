import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { DashboardView } from '../views/DashboardView';
import { ToastProvider } from '../context/ToastContext';
import { api } from '../services/api';
import type { Project } from '../types';

const mockProjects: Project[] = [
  {
    id: 'p-1',
    title: 'Alpha Video',
    originalLanguage: 'en',
    targetLanguage: 'uz',
    status: 'completed',
    duration: 45,
    createdAt: '2026-09-01T10:00:00Z',
    updatedAt: '2026-09-10T12:00:00Z',
    videoUrl: 'https://example.com/1.mp4',
    thumbnailUrl: 'https://example.com/1.jpg',
    voiceId: 'voice-farrux',
    transcript: [],
  },
  {
    id: 'p-2',
    title: 'Beta Podcast',
    originalLanguage: 'ru',
    targetLanguage: 'en',
    status: 'processing',
    processingProgress: 70,
    duration: 120,
    createdAt: '2026-09-02T10:00:00Z',
    updatedAt: '2026-09-15T12:00:00Z',
    videoUrl: 'https://example.com/2.mp4',
    thumbnailUrl: 'https://example.com/2.jpg',
    voiceId: 'voice-elena',
    transcript: [],
  },
  {
    id: 'p-3',
    title: 'Gamma Documentary',
    originalLanguage: 'fr',
    targetLanguage: 'uz',
    status: 'draft',
    duration: 300,
    createdAt: '2026-09-03T10:00:00Z',
    updatedAt: '2026-09-12T12:00:00Z',
    videoUrl: 'https://example.com/3.mp4',
    thumbnailUrl: 'https://example.com/3.jpg',
    voiceId: 'voice-farrux',
    transcript: [],
  },
  {
    id: 'p-4',
    title: 'Delta Tutorial',
    originalLanguage: 'en',
    targetLanguage: 'es',
    status: 'failed',
    duration: 15,
    createdAt: '2026-09-04T10:00:00Z',
    updatedAt: '2026-09-16T12:00:00Z',
    videoUrl: 'https://example.com/4.mp4',
    thumbnailUrl: 'https://example.com/4.jpg',
    voiceId: 'voice-john',
    transcript: [],
  },
  {
    id: 'p-5',
    title: 'Epsilon Tech Talk',
    originalLanguage: 'de',
    targetLanguage: 'uz',
    status: 'completed',
    duration: 240,
    createdAt: '2026-09-05T10:00:00Z',
    updatedAt: '2026-09-08T12:00:00Z',
    videoUrl: 'https://example.com/5.mp4',
    thumbnailUrl: 'https://example.com/5.jpg',
    voiceId: 'voice-farrux',
    transcript: [],
  },
];

function renderDashboard(props: Partial<React.ComponentProps<typeof DashboardView>> = {}) {
  const defaultProps: React.ComponentProps<typeof DashboardView> = {
    projects: mockProjects,
    onOpenProject: vi.fn(),
    onOpenNewDub: vi.fn(),
    onDeleteProject: vi.fn().mockResolvedValue(undefined),
    onRenameProject: vi.fn().mockResolvedValue(undefined),
    ...props,
  };

  return {
    ...render(
      <BrowserRouter>
        <ToastProvider>
          <DashboardView {...defaultProps} />
        </ToastProvider>
      </BrowserRouter>
    ),
    props: defaultProps,
  };
}

// Provide a robust localStorage mock for JSDOM
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = String(value);
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
    get length() {
      return Object.keys(store).length;
    },
    key: vi.fn((idx: number) => Object.keys(store)[idx] ?? null),
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
  writable: true,
});

describe('DashboardView Component', () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
    vi.spyOn(api.voices, 'list').mockResolvedValue({ voices: [] });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const getSidebarBtn = (name: RegExp | string) => screen.getAllByRole('button', { name })[0];

  describe('Home Section and Recent Dubs', () => {
    it('sorts recent dubs by updatedAt descending and limits to 4 items', () => {
      renderDashboard();

      // The 4 most recent by updatedAt should be:
      // 1. Delta Tutorial (Sep 16)
      // 2. Beta Podcast (Sep 15)
      // 3. Gamma Documentary (Sep 12)
      // 4. Alpha Video (Sep 10)
      // (Epsilon Tech Talk is Sep 8, so it should NOT be in the top 4 on home)
      expect(screen.getByText('Delta Tutori...')).toBeInTheDocument();
      expect(screen.getByText('Beta Podcast')).toBeInTheDocument();
      expect(screen.getByText('Gamma Docume...')).toBeInTheDocument();
      expect(screen.getByText('Alpha Video')).toBeInTheDocument();
      expect(screen.queryByText('Epsilon Tech Talk')).not.toBeInTheDocument();
    });

    it('clicking "View all" switches to Recent Projects view', () => {
      renderDashboard();

      const viewAllBtn = screen.getByRole('button', { name: /view all/i });
      fireEvent.click(viewAllBtn);

      expect(screen.getByRole('heading', { level: 1, name: 'Recent Projects' })).toBeInTheDocument();
      // In Recent Projects view, all 5 projects should be present
      expect(screen.getByText('Epsilon Tech...')).toBeInTheDocument();
    });
  });

  describe('Project Search and Filtering', () => {
    it('filters projects by title and by language in Recent Projects tab', () => {
      renderDashboard();

      // Switch to Recent Projects tab
      fireEvent.click(getSidebarBtn(/recent projects/i));

      const searchInput = screen.getByLabelText(/search projects/i);

      // Search by title
      fireEvent.change(searchInput, { target: { value: 'Delta' } });
      expect(screen.getByText('Delta Tutori...')).toBeInTheDocument();
      expect(screen.queryByText('Alpha Video')).not.toBeInTheDocument();

      // Search by language (Spanish / 'es')
      fireEvent.change(searchInput, { target: { value: 'es' } });
      expect(screen.getByText('Delta Tutori...')).toBeInTheDocument();

      // Clear search via clear button
      const clearBtn = screen.getByRole('button', { name: /clear search input/i });
      fireEvent.click(clearBtn);
      expect(screen.getByText('Alpha Video')).toBeInTheDocument();
    });

    it('filters projects by status and clears filters correctly', () => {
      renderDashboard();
      fireEvent.click(getSidebarBtn(/recent projects/i));

      // Click "Failed" status filter pill
      const failedPill = screen.getByRole('button', { name: /failed/i });
      fireEvent.click(failedPill);

      expect(screen.getByText('Delta Tutori...')).toBeInTheDocument();
      expect(screen.queryByText('Alpha Video')).not.toBeInTheDocument();
      expect(screen.queryByText('Beta Podcast')).not.toBeInTheDocument();

      // Clear filters button appears in toolbar
      const clearFiltersBtn = screen.getByRole('button', { name: /clear filters/i });
      fireEvent.click(clearFiltersBtn);

      // All projects restored
      expect(screen.getByText('Alpha Video')).toBeInTheDocument();
      expect(screen.getByText('Beta Podcast')).toBeInTheDocument();
    });

    it('displays no-results state when search has no matches', () => {
      renderDashboard();
      fireEvent.click(getSidebarBtn(/recent projects/i));

      const searchInput = screen.getByLabelText(/search projects/i);
      fireEvent.change(searchInput, { target: { value: 'NonexistentKeywordXYZ' } });

      expect(screen.getByText('No matching projects found')).toBeInTheDocument();
      const clearBtn = screen.getByRole('button', { name: /clear filters/i });
      expect(clearBtn).toBeInTheDocument();
      fireEvent.click(clearBtn);

      expect(screen.getByText('Alpha Video')).toBeInTheDocument();
      expect(screen.getByText('Beta Podcast')).toBeInTheDocument();
      expect(screen.queryByText('No matching projects found')).not.toBeInTheDocument();
    });

    it('displays true empty state when user has no projects at all', () => {
      const onOpenNewDub = vi.fn();
      renderDashboard({ projects: [], onOpenNewDub });
      fireEvent.click(getSidebarBtn(/recent projects/i));

      expect(screen.getByText('No dubbing projects yet')).toBeInTheDocument();
      const createFirstBtn = screen.getByRole('button', { name: /create first project/i });
      expect(createFirstBtn).toBeInTheDocument();
      fireEvent.click(createFirstBtn);
      expect(onOpenNewDub).toHaveBeenCalled();
    });
  });

  describe('Project Actions, Rename Dialog, and Delete Dialog', () => {
    it('contains dialog focus and returns focus to the menu trigger after cancel', () => {
      renderDashboard();
      fireEvent.click(getSidebarBtn(/recent projects/i));
      const trigger = screen.getByRole('button', { name: 'Actions for Alpha Video' });
      fireEvent.click(trigger);
      fireEvent.click(screen.getByRole('menuitem', { name: /rename project/i }));
      const input = screen.getByLabelText(/project title/i);
      expect(input).toHaveFocus();
      const cancel = screen.getByRole('button', { name: 'Cancel' });
      fireEvent.keyDown(input, { key: 'Tab', shiftKey: true });
      expect(cancel).toHaveFocus();
      fireEvent.keyDown(cancel, { key: 'Tab' });
      expect(input).toHaveFocus();
      fireEvent.keyDown(input, { key: 'Escape' });
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(trigger).toHaveFocus();
      expect(document.body.style.overflow).not.toBe('hidden');
    });
    it('opens and closes actions menu with Escape', () => {
      renderDashboard();
      fireEvent.click(getSidebarBtn(/recent projects/i));

      const actionsBtn = screen.getByRole('button', { name: 'Actions for Alpha Video' });
      fireEvent.click(actionsBtn);

      expect(screen.getByRole('menu', { name: 'Actions for Alpha Video' })).toBeInTheDocument();

      fireEvent.keyDown(document, { key: 'Escape' });
      expect(screen.queryByRole('menu', { name: 'Actions for Alpha Video' })).not.toBeInTheDocument();
    });

    it('opens Rename dialog, validates input, and renames project', async () => {
      const onRename = vi.fn().mockResolvedValue(undefined);
      renderDashboard({ onRenameProject: onRename });
      fireEvent.click(getSidebarBtn(/recent projects/i));

      // Open menu for Alpha Video
      fireEvent.click(screen.getByRole('button', { name: 'Actions for Alpha Video' }));
      fireEvent.click(screen.getByRole('menuitem', { name: /rename project/i }));

      // Check dialog is open
      const dialog = screen.getByRole('dialog', { name: /rename project/i });
      expect(dialog).toBeInTheDocument();

      const input = screen.getByLabelText(/project title/i) as HTMLInputElement;
      expect(input.value).toBe('Alpha Video');

      // Submit button should be disabled for unchanged name
      const renameBtn = screen.getByRole('button', { name: /^rename$/i });
      expect(renameBtn).toBeDisabled();

      // Blank name should also be disabled
      fireEvent.change(input, { target: { value: '   ' } });
      expect(renameBtn).toBeDisabled();

      // Enter valid new name
      fireEvent.change(input, { target: { value: 'Alpha Video 2.0' } });
      expect(renameBtn).not.toBeDisabled();

      fireEvent.click(renameBtn);

      await waitFor(() => {
        expect(onRename).toHaveBeenCalledWith('p-1', 'Alpha Video 2.0');
      });
    });

    it('displays error in Rename dialog when callback rejects', async () => {
      const onRename = vi.fn().mockRejectedValue(new Error('Network error on rename'));
      renderDashboard({ onRenameProject: onRename });
      fireEvent.click(getSidebarBtn(/recent projects/i));

      fireEvent.click(screen.getByRole('button', { name: 'Actions for Alpha Video' }));
      fireEvent.click(screen.getByRole('menuitem', { name: /rename project/i }));

      const input = screen.getByLabelText(/project title/i);
      fireEvent.change(input, { target: { value: 'New Name' } });
      fireEvent.click(screen.getByRole('button', { name: /^rename$/i }));

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent('Network error on rename');
      });
      // Dialog remains open
      expect(screen.getByRole('dialog', { name: /rename project/i })).toBeInTheDocument();
    });

    it('opens Delete confirmation dialog, cancels safely, and deletes project on confirm', async () => {
      const onDelete = vi.fn().mockResolvedValue(undefined);
      renderDashboard({ onDeleteProject: onDelete });
      fireEvent.click(getSidebarBtn(/recent projects/i));

      // Open menu and select Delete
      fireEvent.click(screen.getByRole('button', { name: 'Actions for Alpha Video' }));
      fireEvent.click(screen.getByRole('menuitem', { name: /delete project/i }));

      // Dialog opens
      expect(screen.getByRole('dialog', { name: /delete project/i })).toBeInTheDocument();
      expect(screen.getByText(/Are you sure you want to delete/i)).toBeInTheDocument();

      // Safe Cancel does not delete
      const cancelBtn = screen.getByRole('button', { name: /cancel/i });
      fireEvent.click(cancelBtn);
      expect(onDelete).not.toHaveBeenCalled();
      expect(screen.queryByRole('dialog', { name: /delete project/i })).not.toBeInTheDocument();

      // Open delete dialog again and confirm delete
      fireEvent.click(screen.getByRole('button', { name: 'Actions for Alpha Video' }));
      fireEvent.click(screen.getByRole('menuitem', { name: /delete project/i }));

      const confirmDeleteBtn = screen.getByRole('button', { name: /^delete$/i });
      fireEvent.click(confirmDeleteBtn);

      await waitFor(() => {
        expect(onDelete).toHaveBeenCalledWith('p-1');
      });
    });
  });

  describe('Loading and Error States', () => {
    it('does not show an empty workspace while Home is loading', () => {
      renderDashboard({ projects: [], projectLoadState: 'loading' });
      expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true');
      expect(screen.queryByText('No dubs in this workspace')).not.toBeInTheDocument();
    });
    it('shows loading skeletons when projectLoadState is loading and no cached data exists', () => {
      renderDashboard({ projects: [], projectLoadState: 'loading' });
      fireEvent.click(getSidebarBtn(/recent projects/i));

      const status = screen.getByRole('status');
      expect(status).toHaveAttribute('aria-busy', 'true');
    });

    it('shows full recoverable error state with Retry button when projectLoadState is error and no projects', () => {
      const onRetry = vi.fn();
      renderDashboard({ projects: [], projectLoadState: 'error', onRetryLoadProjects: onRetry });

      const alert = screen.getByRole('alert');
      expect(alert).toHaveTextContent(/failed to load projects/i);

      const retryBtn = screen.getByRole('button', { name: /retry loading/i });
      fireEvent.click(retryBtn);
      expect(onRetry).toHaveBeenCalledTimes(1);
    });

    it('shows non-blocking error banner and keeps cached projects when error occurs with existing data', () => {
      const onRetry = vi.fn();
      renderDashboard({ projectLoadState: 'error', onRetryLoadProjects: onRetry });

      const alert = screen.getByRole('alert');
      expect(alert).toHaveTextContent(/showing offline cached projects/i);

      // Projects are still visible
      expect(screen.getByText('Delta Tutori...')).toBeInTheDocument();

      const retryBtn = screen.getByRole('button', { name: /retry/i });
      fireEvent.click(retryBtn);
      expect(onRetry).toHaveBeenCalledTimes(1);
    });
  });

  describe('Mobile Navigation Drawer', () => {
    it('opens drawer via mobile menu button, closes on Escape, and closes on selecting section', () => {
      renderDashboard();

      const mobileMenuBtn = screen.getByLabelText(/open navigation menu/i);
      expect(screen.queryByRole('dialog', { name: /dashboard navigation drawer/i })).not.toBeInTheDocument();
      mobileMenuBtn.focus();
      fireEvent.click(mobileMenuBtn);

      const drawer = screen.getByRole('dialog', { name: /dashboard navigation drawer/i });
      expect(drawer).toHaveClass('drawer-open');

      // Close via Escape
      fireEvent.keyDown(document.activeElement!, { key: 'Escape' });
      expect(drawer).not.toBeInTheDocument();
      expect(mobileMenuBtn).toHaveFocus();

      // Open again and click a section
      fireEvent.click(mobileMenuBtn);
      const reopenedDrawer = screen.getByRole('dialog', { name: /dashboard navigation drawer/i });
      expect(reopenedDrawer).toHaveClass('drawer-open');

      const recentTabInDrawer = within(reopenedDrawer).getByRole('button', { name: /recent projects/i });
      fireEvent.click(recentTabInDrawer);

      expect(reopenedDrawer).not.toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 1, name: 'Recent Projects' })).toBeInTheDocument();
    });
  });

  describe('URL Routing and Section Navigation', () => {
    it('navigates to /dashboard/voices when Voices Studio is clicked', () => {
      renderDashboard();
      fireEvent.click(getSidebarBtn(/voices studio/i));
      expect(screen.getByRole('heading', { level: 1, name: 'Voices Studio' })).toBeInTheDocument();
      expect(window.location.pathname).toBe('/dashboard/voices');
    });

    it('navigates to /dashboard/gifts when Gifts is clicked', () => {
      renderDashboard();
      fireEvent.click(getSidebarBtn(/^gifts/i));
      expect(screen.getByRole('heading', { level: 1, name: /gifts & referral rewards/i })).toBeInTheDocument();
      expect(window.location.pathname).toBe('/dashboard/gifts');
    });

    it('navigates back to /dashboard when Home is clicked', () => {
      renderDashboard();
      fireEvent.click(getSidebarBtn(/^gifts/i));
      expect(window.location.pathname).toBe('/dashboard/gifts');

      fireEvent.click(getSidebarBtn(/^home/i));
      expect(window.location.pathname).toBe('/dashboard');
      expect(screen.getByRole('heading', { level: 1, name: 'Start new dubbing' })).toBeInTheDocument();
    });
  });
});
