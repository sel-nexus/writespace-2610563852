/** Present an accessible browser-local count without decorative metrics. */
import PropTypes from 'prop-types';

/** Pair a statistic label with its value and any scope clarification.
 * Args:
 *   label: Source-approved statistic name.
 *   value: Count derived from a stored collection.
 *   note: Optional limitation or unresolved product meaning.
 * Returns:
 *   A flat definition-list card.
 */
export function StatCard({ label, value, note = '' }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-6">
      <dt className="text-sm font-medium text-slate-600">{label}</dt>
      <dd className="mt-3 text-4xl font-semibold tabular-nums tracking-tight">{value}</dd>
      {note && (
        <dd className="mt-3 text-sm leading-relaxed text-slate-600">{note}</dd>
      )}
    </div>
  );
}

StatCard.propTypes = {
  label: PropTypes.string.isRequired,
  value: PropTypes.number.isRequired,
  note: PropTypes.string,
};
