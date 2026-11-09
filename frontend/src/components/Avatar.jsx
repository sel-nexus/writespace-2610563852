/** Present static role marks without images or uploaded identity data. */
import PropTypes from 'prop-types';
import { BookOpen, Crown } from 'lucide-react';

const roles = {
  admin: { Icon: Crown, classes: 'bg-violet-600', label: 'Admin' },
  user: { Icon: BookOpen, classes: 'bg-indigo-500', label: 'User' },
};

/** Render a role-specific mark with an accessible role label.
 * Args:
 *   role: Local account role; unknown roles use the ordinary author mark.
 * Returns:
 *   Static role avatar.
 */
export function Avatar({ role = 'user' }) {
  const { Icon, classes, label } = roles[role] || roles.user;
  return (
    <span role="img" aria-label={label} className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white ${classes}`}>
      <Icon size={20} strokeWidth={1.5} aria-hidden="true" />
    </span>
  );
}

Avatar.propTypes = { role: PropTypes.string };

/** Return the shared static role avatar.
 * Args:
 *   role: Local account role.
 * Returns:
 *   Role avatar JSX.
 */
export function getAvatar(role) {
  return <Avatar role={role} />;
}
