/** Manage local demo accounts without switching identity or changing posts. */
import { useState } from 'react';
import { UserRow } from '../components/UserRow';
import { getSession } from '../utils/auth';
import { getUsers } from '../utils/storage';
import { canDeleteAccount } from '../utils/permissions';
import { createManagedUser, deleteManagedUser } from '../utils/accounts';

const emptyDraft = { displayName: '', username: '', password: '', role: 'user' };
const fixedAdmin = { id: 'default-admin', displayName: 'Admin', username: 'admin', role: 'admin' };
const inputStyle = 'mt-2 w-full rounded-lg border border-slate-300 bg-white px-4 py-3 focus-visible:outline focus-visible:outline-2';
const fields = [
  { name: 'displayName', label: 'Display name', type: 'text', autoComplete: 'off' },
  { name: 'username', label: 'Username', type: 'text', autoComplete: 'off' },
  { name: 'password', label: 'Password', type: 'password', autoComplete: 'new-password' },
  { name: 'role', label: 'Role' },
];
const failures = {
  forbidden: 'You no longer have permission to manage this account. Nothing was saved.',
  not_found: 'This account no longer exists. Reload to refresh the list. Nothing was deleted.',
  generation_failed: 'The account could not be prepared. Nothing was saved. Please try again.',
};

/** Render a controlled draft and responsive protected account list.
 * Returns:
 *   Field-associated errors and honest status with no mount mutations.
 */
export default function UserManagement() {
  const [users, setUsers] = useState(getUsers);
  const [draft, setDraft] = useState(emptyDraft);
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const session = getSession();

  /** Apply visible results only after the mutation completes.
   * Args:
   *   result: Honest service result.
   *   success: Message shown only after persistence succeeds.
   */
  function showResult(result, success) {
    setErrors(result.errors || {});
    setError('');
    setStatus('');
    if (result.ok) {
      setUsers(getUsers());
      setStatus(success);
    } else if (result.error === 'canceled') {
      setStatus('Deletion canceled. Nothing was deleted.');
    } else if (result.error !== 'validation_failed') {
      setError(failures[result.error] || 'Changes could not be saved locally. Nothing was saved. Please try again.');
    }
  }

  /** Create with a fresh service check, retaining failed drafts.
   * Args:
   *   event: Form submission event.
   */
  function submit(event) {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    const result = createManagedUser(draft);
    showResult(result, 'Account created locally. Your sign-in is unchanged.');
    if (result.ok) setDraft(emptyDraft);
    setSubmitting(false);
  }

  /** Confirm before fresh identity and target resolution.
   * Args:
   *   id: Displayed identifier, not a trusted mounted record.
   */
  function remove(id) {
    const result = deleteManagedUser(id, window.confirm('Delete this account? Its posts will remain. This cannot be undone.'));
    showResult(result, 'Account deleted locally. Its posts remain unchanged.');
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-16">
      <h1 className="font-[Georgia,serif] text-4xl tracking-tight">User Management</h1>
      <p className="mt-4 max-w-[70ch] leading-relaxed text-slate-600">
        Accounts and plaintext demo passwords stay in this browser. Never use real passwords or sensitive data.
        Client-side guards are bypassable, not trusted security. Tabs may overwrite changes; reload before retrying.
      </p>
      <section aria-labelledby="create-account-title" className="mt-12">
        <h2 id="create-account-title" className="font-[Georgia,serif] text-2xl">Create account</h2>
        <form onSubmit={submit} noValidate aria-busy={submitting} className="mt-6 grid gap-6 sm:grid-cols-2">
          {fields.map((field) => {
            const attributes = {
              id: 'managed-' + field.name, name: field.name, value: draft[field.name],
              onChange: (event) => setDraft({ ...draft, [field.name]: event.target.value }),
              disabled: submitting || session?.role !== 'admin', 'aria-required': true,
              'aria-invalid': Boolean(errors[field.name]),
              'aria-describedby': errors[field.name] ? 'managed-' + field.name + '-error' : undefined,
              className: inputStyle,
            };
            return (
              <div key={field.name}>
                <label htmlFor={attributes.id} className="font-medium">{field.label}</label>
                {field.name === 'role' ? (
                  <select {...attributes}>
                    <option value="user">User</option>
                    <option value="admin">Admin</option>
                  </select>
                ) : (
                  <input {...attributes} type={field.type} autoComplete={field.autoComplete} />
                )}
                {errors[field.name] && (
                  <p id={'managed-' + field.name + '-error'} role="alert" className="mt-2 text-sm text-red-700">
                    {errors[field.name]}
                  </p>
                )}
              </div>
            );
          })}
          <button
            type="submit"
            disabled={submitting || session?.role !== 'admin'}
            className={`min-h-11 justify-self-start rounded-lg bg-indigo-600 px-6 py-3 font-medium text-white
              hover:bg-indigo-700 focus-visible:outline focus-visible:outline-2 disabled:opacity-50`}
          >
            {submitting ? 'Creating account…' : 'Create account'}
          </button>
        </form>
      </section>
      {error && (
        <p role="alert" className="mt-6 text-red-700">{error}</p>
      )}
      <p role="status" className="mt-6 text-sm text-slate-600">{status}</p>
      <section aria-labelledby="accounts-title" className="mt-12">
        <h2 id="accounts-title" className="font-[Georgia,serif] text-2xl">Local accounts</h2>
        {!users.length && (
          <p className="mt-4 text-slate-600">No managed accounts yet.</p>
        )}
        <table aria-label="Local accounts" className="mt-6 block w-full text-left sm:table">
          <thead className="hidden border-b border-slate-200 text-sm text-slate-600 sm:table-header-group">
            <tr>
              {['Display name', 'Username', 'Role', 'Actions'].map((label) => (
                <th key={label} scope="col" className="px-4 py-3 font-medium">{label}</th>
              ))}
            </tr>
          </thead>
          <tbody className="block sm:table-row-group sm:divide-y sm:divide-slate-200">
            {[fixedAdmin, ...users].map((account, index) => {
              const reserved = account.id === 'default-admin' || account.username.trim().toLowerCase() === 'admin';
              const reason = reserved ? 'Default admin cannot be deleted.'
                : account.id === session?.userId ? 'Your active account cannot be deleted.'
                  : !canDeleteAccount(session, account) ? 'Only Admin can delete accounts.' : '';
              return (
                <UserRow key={account.id + '-' + index} account={account} disabledReason={reason} onDelete={remove} />
              );
            })}
          </tbody>
        </table>
      </section>
    </main>
  );
}
