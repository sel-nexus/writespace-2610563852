/** Offer self-registration for plaintext, browser-local demo accounts. */
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { registerUser } from '../utils/accounts';

const inputStyle = 'mt-2 w-full rounded-lg border border-slate-300 bg-white px-4 py-3 focus-visible:outline focus-visible:outline-2';
const fields = [
  { name: 'displayName', label: 'Display name', type: 'text', autoComplete: 'nickname' },
  { name: 'username', label: 'Username', type: 'text', autoComplete: 'username' },
  { name: 'password', label: 'Password', type: 'password', autoComplete: 'new-password' },
  { name: 'confirmPassword', label: 'Confirm password', type: 'password', autoComplete: 'new-password' },
];

/** Render a controlled draft and prevent duplicate creation after partial persistence.
 * Returns:
 *   Accessible field errors, local-only disclosures, and sign-in recovery.
 */
export default function RegisterPage() {
  const [values, setValues] = useState({ displayName: '', username: '', password: '', confirmPassword: '' });
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [created, setCreated] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  /** Save only a valid draft and navigate only after both writes succeed.
   * Args:
   *   event: Form submission event.
   */
  function submit(event) {
    event.preventDefault();
    if (created || submitting) return;
    setSubmitting(true);
    const result = registerUser(values);
    setErrors(result.errors || {});
    setError('');
    setSubmitting(false);
    if (result.ok) {
      navigate('/blogs', { replace: true });
    } else if (result.error === 'account_created') {
      setCreated(true);
      setError('Account created, but your session could not be saved locally. Sign in using Login; do not register again.');
    } else if (result.error === 'generation_failed') {
      setError('Your account could not be prepared. Nothing was saved. Please try again.');
    } else if (result.error !== 'validation_failed') {
      setError('Your account could not be saved locally. You are not signed in. Please try again.');
    }
  }

  return (
    <main className="mx-auto max-w-lg px-6 py-16 sm:py-24">
      <h1 className="font-[Georgia,serif] text-4xl tracking-tight">Register</h1>
      <p className="mt-4 leading-relaxed text-slate-600">Create your local writing account.</p>
      <form className="mt-8 space-y-6" onSubmit={submit} noValidate aria-busy={submitting}>
        {fields.map((field) => (
          <div key={field.name}>
            <label htmlFor={`register-${field.name}`} className="font-medium">{field.label}</label>
            <input
              id={`register-${field.name}`}
              name={field.name}
              type={field.type}
              autoComplete={field.autoComplete}
              value={values[field.name]}
              onChange={(event) => setValues({ ...values, [field.name]: event.target.value })}
              disabled={created || submitting}
              aria-required="true"
              aria-invalid={Boolean(errors[field.name])}
              aria-describedby={errors[field.name] ? `register-${field.name}-error` : undefined}
              className={inputStyle}
            />
            {errors[field.name] && (
              <p id={`register-${field.name}-error`} role="alert" className="mt-2 text-sm text-red-700">
                {errors[field.name]}
              </p>
            )}
          </div>
        ))}
        {error && (
          <p role="alert" className="text-sm leading-relaxed text-red-700">{error}</p>
        )}
        <button
          type="submit"
          disabled={created || submitting}
          className={`w-full rounded-lg bg-indigo-600 px-6 py-3 font-medium text-white hover:bg-indigo-700
            focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50`}
        >
          {created ? 'Account created' : submitting ? 'Creating account…' : 'Register'}
        </button>
      </form>
      <p className="mt-8 text-sm leading-relaxed text-slate-600">
        Local demo only. Passwords are stored in plaintext. Data stays in this browser and does not sync.
        Client-side guards are bypassable, not trusted security. Never use real passwords or sensitive information.
        Clearing browser storage removes your account and data.
      </p>
      <div className="mt-8 flex flex-wrap gap-6">
        <Link to="/login" className="rounded text-indigo-700 underline focus-visible:outline">Login</Link>
        <Link to="/" className="rounded text-indigo-700 underline focus-visible:outline">Back to Home</Link>
      </div>
    </main>
  );
}
