/** Present one account as a desktop table row and a mobile stacked card. */
import PropTypes from 'prop-types';
import { useId } from 'react';
import { Avatar } from './Avatar';

/** Render credential-free details and explain protected deletion.
 * Args:
 *   account: Display identity and role; passwords are never rendered.
 *   disabledReason: Explanation when deletion is unavailable.
 *   onDelete: Action invoked with the displayed identifier.
 * Returns:
 *   Semantic table row with intrinsic mobile stacking.
 */
export function UserRow({ account, disabledReason, onDelete }) {
  const explanationId = useId();
  return (
    <tr className="mb-4 block rounded-lg border border-slate-200 bg-white p-4 sm:mb-0 sm:table-row sm:border-0 sm:p-0">
      <th scope="row" className="block break-words py-2 text-left font-medium sm:table-cell sm:px-4 sm:py-5">
        <span className="flex items-center gap-3">
          <Avatar role={account.role} />
          <span>{account.displayName}</span>
        </span>
      </th>
      <td className="block break-all py-2 sm:table-cell sm:px-4 sm:py-5">
        <span className="mr-2 text-sm text-slate-600 sm:hidden">Username:</span>
        {account.username}
      </td>
      <td className="block py-2 sm:table-cell sm:px-4 sm:py-5">
        <span className="mr-2 text-sm text-slate-600 sm:hidden">Role:</span>
        {account.role === 'admin' ? 'Admin' : 'User'}
      </td>
      <td className="block py-2 sm:table-cell sm:px-4 sm:py-5">
        <span title={disabledReason || undefined} tabIndex={disabledReason ? 0 : undefined} className="rounded focus-visible:outline">
          <button
            type="button"
            aria-label={`Delete ${account.username}`}
            disabled={Boolean(disabledReason)}
            aria-describedby={disabledReason ? explanationId : undefined}
            onClick={() => onDelete(account.id)}
            className={`min-h-11 rounded-lg border border-slate-300 px-4 py-3 text-red-700 hover:bg-slate-50
              focus-visible:outline focus-visible:outline-2 disabled:cursor-not-allowed disabled:text-slate-500`}
          >
            Delete
          </button>
        </span>
        {disabledReason && (
          <p id={explanationId} className="mt-2 max-w-[28ch] text-sm text-slate-600">{disabledReason}</p>
        )}
      </td>
    </tr>
  );
}

UserRow.propTypes = {
  account: PropTypes.shape({
    id: PropTypes.string.isRequired, displayName: PropTypes.string.isRequired,
    username: PropTypes.string.isRequired, role: PropTypes.oneOf(['admin', 'user']).isRequired,
  }).isRequired,
  disabledReason: PropTypes.string,
  onDelete: PropTypes.func.isRequired,
};
