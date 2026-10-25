import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from '../App';
import { LandingView } from '../views/LandingView';
import { api } from '../services/api';

function renderLanding(isAuthenticated = false) {
  return render(<MemoryRouter><LandingView isAuthenticated={isAuthenticated} /></MemoryRouter>);
}

describe('Landing page visitor flows', () => {
  beforeEach(() => {
    window.history.replaceState({}, '', '/');
    localStorage.clear();
    vi.spyOn(api.auth, 'me').mockRejectedValue(new Error('No session'));
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('collapses after a short scroll and expands again near the top', () => {
    vi.stubGlobal('scrollY', 0);
    renderLanding();
    const header = screen.getByRole('banner');
    expect(header).not.toHaveClass('is-collapsed');

    vi.stubGlobal('scrollY', 64);
    fireEvent.scroll(window);
    expect(header).toHaveClass('is-collapsed');

    vi.stubGlobal('scrollY', 32);
    fireEvent.scroll(window);
    expect(header).toHaveClass('is-collapsed');

    vi.stubGlobal('scrollY', 0);
    fireEvent.scroll(window);
    expect(header).not.toHaveClass('is-collapsed');
  });

  it('starts as a capsule when the page opens at a restored scroll position', () => {
    vi.stubGlobal('scrollY', 180);
    renderLanding();
    expect(screen.getByRole('banner')).toHaveClass('is-collapsed');
  });

  it('marks the section reached by scrolling and clears the marker at the top', async () => {
    vi.stubGlobal('scrollY', 0);
    renderLanding();
    const nav = screen.getByRole('navigation');
    const positions = { studio: 600, 'how-it-works': 1400, possibilities: 2200, faq: 3000 };
    for (const [id, top] of Object.entries(positions)) {
      vi.spyOn(document.getElementById(id)!, 'getBoundingClientRect')
        .mockImplementation(() => new DOMRect(0, top - window.scrollY, 1000, 500));
    }
    for (const [scrollY, label] of [[500, 'Studiya'], [1300, 'Qanday ishlaydi?'], [2100, 'Imkoniyatlar'], [2900, 'Savol-javob']] as const) {
      vi.stubGlobal('scrollY', scrollY);
      fireEvent.scroll(window);
      await waitFor(() => expect(within(nav).getByRole('link', { name: label })).toHaveAttribute('aria-current', 'location'));
      expect(nav.querySelectorAll('[aria-current="location"]')).toHaveLength(1);
    }
    vi.stubGlobal('scrollY', 0);
    fireEvent.scroll(window);
    await waitFor(() => expect(nav.querySelector('[aria-current]')).toBeNull());
  });

  it('reveals off-screen content once and shows everything when reduced motion is enabled', () => {
    let reveal: (entries: { target: Element; isIntersecting: boolean }[]) => void = () => {};
    const unobserve = vi.fn();
    const disconnect = vi.fn();
    vi.stubGlobal('IntersectionObserver', class {
      constructor(callback: typeof reveal) { reveal = callback; }
      observe = vi.fn();
      unobserve = unobserve;
      disconnect = disconnect;
    });
    const media = { matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() };
    vi.spyOn(window, 'matchMedia').mockReturnValue(media as unknown as MediaQueryList);
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      return new DOMRect(0, this.hasAttribute('data-reveal') ? window.innerHeight + 80 : 0, 800, 240);
    });
    const { container } = renderLanding();
    const card = screen.getByRole('heading', { name: 'Tarjima, kontekst bilan.' }).closest('article')!;
    expect(card).toHaveAttribute('data-reveal-state', 'pending');
    reveal([{ target: card, isIntersecting: true }]);
    expect(card).toHaveAttribute('data-reveal-state', 'visible');
    expect(unobserve).toHaveBeenCalledWith(card);

    media.matches = true;
    const handleChange = media.addEventListener.mock.calls[0][1] as () => void;
    handleChange();
    expect(container.querySelector('[data-reveal-state="pending"]')).toBeNull();
    expect(disconnect).toHaveBeenCalled();
  });

  it('keeps the homepage public and connects the primary action to account creation', async () => {
    render(<App />);
    await screen.findByRole('heading', { level: 1, name: /g‘oyangiz bir til bilan/i }, { timeout: 5000 });
    await waitFor(() => expect(api.auth.me).toHaveBeenCalled());
    expect(window.location.pathname).toBe('/');
    fireEvent.click(screen.getByRole('link', { name: /birinchi loyihani boshlash/i }));
    await screen.findByRole('heading', { name: /create your dubla.uz account/i }, { timeout: 5000 });
    expect(window.location.pathname).toBe('/signup');
    fireEvent.click(screen.getByRole('button', { name: /bosh sahifa/i }));
    await screen.findByRole('heading', { level: 1, name: /g‘oyangiz bir til bilan/i }, { timeout: 5000 });
    expect(window.location.pathname).toBe('/');
  }, 10000);

  it('opens the Uzbek introduction at /uz and connects login to the sign-in form', async () => {
    window.history.replaceState({}, '', '/uz');
    render(<App />);
    await screen.findByRole('heading', { level: 1, name: /g‘oyangiz bir til bilan/i }, { timeout: 5000 });
    expect(window.location.pathname).toBe('/uz');
    fireEvent.click(screen.getByRole('link', { name: 'Kirish' }));
    await screen.findByRole('heading', { name: /sign in to dubla.uz/i }, { timeout: 5000 });
    expect(window.location.pathname).toBe('/signin');
  });

  it('sends existing users to their workspace instead of asking them to register', () => {
    renderLanding(true);
    for (const link of screen.getAllByRole('link', { name: /ish maydoniga o‘tish/i })) {
      expect(link).toHaveAttribute('href', '/dashboard');
    }
    expect(screen.getByRole('link', { name: /studiyaga o‘tish/i })).toHaveAttribute('href', '/dashboard');
    expect(screen.queryByRole('link', { name: 'Kirish' })).not.toBeInTheDocument();
  });

  it('changes the studio sample between original and Uzbek text', () => {
    renderLanding();
    const group = screen.getByRole('group', { name: 'Namuna matni tili' });
    const original = within(group).getByRole('button', { name: 'Original' });
    const uzbek = within(group).getByRole('button', { name: 'O‘zbekcha' });
    expect(uzbek).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(original);
    expect(original).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('Original ovoz')).toBeInTheDocument();
    fireEvent.click(uzbek);
    expect(screen.getByText('O‘zbekcha ovoz')).toBeInTheDocument();
  });

  it('closes the mobile navigation after selecting a section or pressing Escape', () => {
    renderLanding();
    const toggle = screen.getByRole('button', { name: 'Menyuni ochish' });
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(within(screen.getByRole('navigation')).getByRole('link', { name: 'Imkoniyatlar' }));
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(toggle);
    fireEvent.keyDown(toggle, { key: 'Escape' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
  });
  it('lets visitors edit a translation, preview the subtitle, and restore the sample', () => {
    renderLanding();
    const translation = screen.getByRole('textbox', { name: /tarjima · o‘zbekcha/i });
    const originalValue = (translation as HTMLTextAreaElement).value;
    fireEvent.change(translation, { target: { value: 'Bu darsni birga o‘rganamiz.' } });
    expect(screen.getByText('Bu darsni birga o‘rganamiz.', { selector: 'p' })).toBeInTheDocument();
    // Clicking the active category must not discard the visitor's edits.
    fireEvent.click(screen.getByRole('tab', { name: 'Ta’lim va kurslar' }));
    expect(translation).toHaveValue('Bu darsni birga o‘rganamiz.');
    fireEvent.click(screen.getByRole('button', { name: 'Namuna tarjimasini tiklash' }));
    expect(translation).toHaveValue(originalValue);
  });

  it('switches sample context with keyboard navigation and shows the matching translation', () => {
    renderLanding();
    const education = screen.getByRole('tab', { name: 'Ta’lim va kurslar' });
    fireEvent.keyDown(education, { key: 'ArrowRight' });
    const creators = screen.getByRole('tab', { name: 'Kontent yaratuvchilar' });
    expect(creators).toHaveAttribute('aria-selected', 'true');
    expect(creators).toHaveFocus();
    expect(screen.getByRole('tabpanel')).toHaveAccessibleName('Kontent yaratuvchilar');
    expect((screen.getByRole('textbox', { name: /tarjima · o‘zbekcha/i }) as HTMLTextAreaElement).value).toContain('ijodiy loyiha');
    fireEvent.keyDown(creators, { key: 'End' });
    expect(screen.getByRole('tab', { name: 'Biznes va jamoalar' })).toHaveFocus();
    expect((screen.getByRole('textbox', { name: /tarjima · o‘zbekcha/i }) as HTMLTextAreaElement).value).toContain('Jamoangizga');
  });

});
