/** Sign into the plaintext, browser-local demo without a backend. */
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authenticate, roleHome, setSession } from '../utils/auth';
import { getUsers } from '../utils/storage';

const inputStyle = 'mt-2 w-full rounded-lg border border-slate-300 bg-white px-4 py-3 focus-visible:outline focus-visible:outline-2';

/** Render controlled credentials and navigate only after session persistence.
 * Returns:
 *   Login form with actionable credential and local persistence errors.
 */
export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [invalid, setInvalid] = useState(false);
  const navigate = useNavigate();

  /** Validate exact credentials and persist identity before navigation.
   * Args:
   *   event: Form submission event.
   */
  function submit(event) {
    event.preventDefault();
    const session = authenticate(username, password, getUsers());
    setInvalid(!session);
    if (!session) {
      setError('Invalid username or password.');
      return;
    }
    if (!setSession(session).ok) {
      setError('Your session could not be saved locally. You are not signed in. Please try again.');
      return;
    }
    navigate(roleHome(session), { replace: true });
  }

  return (
    <main className="mx-auto max-w-lg px-6 py-16 sm:py-24">
      <h1 className="font-[Georgia,serif] text-4xl tracking-tight">Login</h1>
      <p className="mt-4 leading-relaxed text-slate-600">Welcome back to your writing space.</p>
      <form className="mt-8 space-y-6" onSubmit={submit} noValidate>
        <div>
          <label htmlFor="username" className="font-medium">Username</label>
          <input
            id="username"
            name="username"
            autoComplete="username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            aria-required="true"
            aria-invalid={invalid}
            aria-describedby={error ? 'login-error' : undefined}
            className={inputStyle}
          />
        </div>
        <div>
          <label htmlFor="password" className="font-medium">Password</label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            aria-required="true"
            aria-invalid={invalid}
            aria-describedby={error ? 'login-error' : undefined}
            className={inputStyle}
          />
        </div>
        {error && <p id="login-error" role="alert" className="text-sm leading-relaxed text-red-700">{error}</p>}
        <button
          type="submit"
          className="w-full rounded-lg bg-indigo-600 px-6 py-3 font-medium text-white hover:bg-indigo-700 focus-visible:ring-2"
        >
          Login
        </button>
      </form>
      <p className="mt-8 text-sm text-slate-600">Demo Admin credentials: username <strong>admin</strong>, password <strong>admin</strong>.</p>
      <p className="mt-4 text-sm leading-relaxed text-slate-600">
        Local demo only. Passwords are stored in plaintext. Data stays in this browser and does not sync.
        Client-side guards are bypassable, not trusted security. Never use real passwords or sensitive information.
      </p>
      <div className="mt-8 flex flex-wrap gap-6">
        <Link to="/register" className="rounded text-indigo-700 underline focus-visible:outline">Create an account</Link>
        <Link to="/" className="rounded text-indigo-700 underline focus-visible:outline">Back to Home</Link>
      </div>
    </main>
  );
}
