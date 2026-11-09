/** Offer role-aware local navigation and honest logout feedback. */
import { useRef, useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { BookOpen, ChevronDown, Menu, X } from 'lucide-react';
import { Avatar } from './Avatar';
import { sessionPropType } from './PublicNavbar';
import { clearSession, roleHome } from '../utils/auth';

const control = 'rounded-lg px-4 py-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500';

/** Render active navigation styling without changing route state.
 * Args:
 *   isActive: Router-provided active flag.
 * Returns:
 *   Compatible neutral and indigo navigation classes.
 */
function navStyle({ isActive }) {
  return `${control} ${isActive ? 'bg-slate-100 font-semibold text-indigo-700' : 'font-medium hover:bg-slate-100'}`;
}

/** Render desktop/mobile links and a keyboard-accessible account disclosure.
 * Args:
 *   session: Validated signed-in local identity.
 * Returns:
 *   Navigation retaining signed-in state and an alert if logout fails.
 */
export function Navbar({ session }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [error, setError] = useState('');
  const accountButton = useRef(null);
  const navigate = useNavigate();
  const links = session.role === 'admin'
    ? [['Dashboard', '/admin'], ['All Blogs', '/blogs'], ['Write', '/write'], ['Users', '/users']]
    : [['All Blogs', '/blogs'], ['Write', '/write']];

  /** Close both disclosures after navigation activation. */
  function closeMenus() {
    setMobileOpen(false);
    setAccountOpen(false);
  }

  /** Close the account disclosure on Escape and restore its trigger focus.
   * Args:
   *   event: Keyboard event from the navigation region.
   */
  function handleEscape(event) {
    if (event.key === 'Escape') {
      closeMenus();
      if (accountOpen) accountButton.current?.focus();
    }
  }

  /** Navigate to login only after local session removal completes. */
  function logout() {
    if (!clearSession().ok) {
      setError('Logout could not be completed locally. You are still signed in. Please try again.');
      return;
    }
    closeMenus();
    navigate('/login', { replace: true });
  }

  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white" onKeyDown={handleEscape}>
      <nav aria-label="Primary" className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-4">
        <Link to="/" className={`flex items-center gap-3 text-xl font-semibold ${control}`} onClick={closeMenus}>
          <BookOpen size={24} strokeWidth={1.5} className="text-indigo-600" aria-hidden="true" />
          WriteSpace
        </Link>
        <button
          type="button"
          aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={mobileOpen}
          aria-controls="authenticated-navigation"
          className={`sm:hidden ${control}`}
          onClick={() => setMobileOpen(!mobileOpen)}
        >
          {mobileOpen ? <X size={24} aria-hidden="true" /> : <Menu size={24} aria-hidden="true" />}
        </button>
        <div
          id="authenticated-navigation"
          className={`${mobileOpen ? 'flex' : 'hidden'} w-full flex-col gap-2 sm:flex sm:w-auto sm:flex-row sm:items-center`}
        >
          {links.map(([label, path]) => (
            <NavLink key={path} to={path} className={navStyle} onClick={closeMenus}>
              {label}
            </NavLink>
          ))}
          <div className="relative">
            <button
              ref={accountButton}
              type="button"
              aria-label={`Account for ${session.displayName}`}
              aria-expanded={accountOpen}
              aria-controls="account-actions"
              className={`flex items-center gap-2 hover:bg-slate-100 ${control}`}
              onClick={() => setAccountOpen(!accountOpen)}
            >
              <Avatar role={session.role} />
              {session.displayName}
              <ChevronDown size={16} aria-hidden="true" />
            </button>
            {accountOpen && (
              <div id="account-actions" className="z-30 mt-2 min-w-48 rounded-lg border border-slate-200 bg-white p-2 sm:absolute sm:right-0">
                <p className="px-4 py-2 text-sm text-slate-600">{session.role === 'admin' ? 'Admin' : 'User'}</p>
                <Link to={roleHome(session)} className={`block ${control}`} onClick={closeMenus}>
                  Go to Dashboard
                </Link>
                <button type="button" className={`w-full text-left hover:bg-slate-100 ${control}`} onClick={logout}>
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </nav>
      {error && <p role="alert" className="mx-auto max-w-6xl px-6 pb-4 text-sm text-red-700">{error}</p>}
    </header>
  );
}

Navbar.propTypes = { session: sessionPropType.isRequired };
