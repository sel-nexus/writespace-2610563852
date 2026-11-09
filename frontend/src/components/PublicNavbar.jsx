/** Offer public entry links and role-aware local-session destinations. */
import { useState } from 'react';
import PropTypes from 'prop-types';
import { Link, NavLink } from 'react-router-dom';
import { BookOpen, Menu, X } from 'lucide-react';
import { Avatar } from './Avatar';

const linkStyle = 'rounded-lg px-4 py-3 font-medium hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500';
export const sessionPropType = PropTypes.shape({
  userId: PropTypes.string.isRequired,
  username: PropTypes.string.isRequired,
  displayName: PropTypes.string.isRequired,
  role: PropTypes.oneOf(['admin', 'user']).isRequired,
});

/** Render keyboard-accessible desktop and mobile discovery navigation.
 * Args:
 *   session: Validated local identity or null for guests.
 * Returns:
 *   Sticky public navigation with an ordinary disclosure menu.
 */
export function PublicNavbar({ session = null }) {
  const [open, setOpen] = useState(false);
  const dashboard = session?.role === 'admin' ? '/admin' : '/blogs';
  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white">
      <nav aria-label="Primary" className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-4">
        <Link to="/" className={`flex items-center gap-3 text-xl font-semibold ${linkStyle}`} onClick={() => setOpen(false)}>
          <BookOpen className="text-indigo-600" size={24} strokeWidth={1.5} aria-hidden="true" />
          WriteSpace
        </Link>
        <button
          type="button"
          aria-label={open ? 'Close menu' : 'Open menu'}
          aria-expanded={open}
          aria-controls="public-navigation"
          className={`sm:hidden ${linkStyle}`}
          onClick={() => setOpen(!open)}
          onKeyDown={(event) => { if (event.key === 'Escape') setOpen(false); }}
        >
          {open ? <X size={24} strokeWidth={1.5} aria-hidden="true" /> : <Menu size={24} strokeWidth={1.5} aria-hidden="true" />}
        </button>
        <div
          id="public-navigation"
          className={`${open ? 'flex' : 'hidden'} w-full flex-col gap-2 sm:flex sm:w-auto sm:flex-row sm:items-center`}
          onKeyDown={(event) => { if (event.key === 'Escape') setOpen(false); }}
        >
          {session ? (
            <>
              <span className="flex items-center gap-2 px-4 py-2">
                <Avatar role={session.role} />
                {session.displayName}
              </span>
              <NavLink to={dashboard} className={linkStyle} onClick={() => setOpen(false)}>
                Go to Dashboard
              </NavLink>
            </>
          ) : (
            <>
              <NavLink to="/login" className={linkStyle} onClick={() => setOpen(false)}>
                Login
              </NavLink>
              <NavLink to="/register" className={`border border-indigo-200 text-indigo-600 ${linkStyle}`} onClick={() => setOpen(false)}>
                Get Started
              </NavLink>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}

PublicNavbar.propTypes = { session: sessionPropType };
