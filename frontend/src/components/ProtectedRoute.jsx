/** Gate local demo routes before rendering their content. */
import PropTypes from 'prop-types';
import { Navigate } from 'react-router-dom';
import { getSession } from '../utils/auth';

/** Resolve fresh identity and apply the guest and Admin route rules.
 * Args:
 *   children: Content rendered only after access is allowed.
 *   adminOnly: Whether this route requires the Admin role.
 * Returns:
 *   Allowed content or a replacement redirect; never writes storage.
 */
export function ProtectedRoute({ children, adminOnly = false }) {
  const session = getSession();
  if (!session) return <Navigate to="/login" replace />;
  if (adminOnly && session.role !== 'admin') return <Navigate to="/blogs" replace />;
  return children;
}

ProtectedRoute.propTypes = { children: PropTypes.node.isRequired, adminOnly: PropTypes.bool };
