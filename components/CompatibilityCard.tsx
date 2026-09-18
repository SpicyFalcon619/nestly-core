import Link from 'next/link';
import { Users } from 'lucide-react';
import { compatBand, type CompatResult } from '@/lib/compatibility';

interface Props {
  result: CompatResult | null;
  /** Who the viewer is being compared against, for the caption. */
  otherName?: string;
  /** True when the viewer hasn't filled in their own preferences yet. */
  needsMyPreferences?: boolean;
}

/**
 * The 8-dimension flatmate score, shown on a listing. Rendered only when both
 * sides have preferences — or, with `needsMyPreferences`, as the prompt that
 * gets the viewer there.
 */
export default function CompatibilityCard({ result, otherName, needsMyPreferences }: Props) {
  if (needsMyPreferences) {
    return (
      <div className="card" style={{ padding: '24px' }}>
        <h4 className="compat-heading"><Users size={16} /> Flatmate compatibility</h4>
        <p style={{ fontSize: '13.5px', color: 'var(--ink-mid)', lineHeight: 1.6, margin: '0 0 14px' }}>
          {otherName ? `${otherName} has shared their lifestyle preferences.` : 'This lister has shared their lifestyle preferences.'}
          {' '}Fill in yours to see how well you match on sleep, cleanliness, noise, guests and four more.
        </p>
        <Link href="/profile" className="btn btn-outline btn-sm">Set my preferences</Link>
      </div>
    );
  }

  if (!result) return null;
  const band = compatBand(result.score);

  return (
    <div className="card" style={{ padding: '24px' }}>
      <h4 className="compat-heading"><Users size={16} /> Flatmate compatibility</h4>

      <div className="compat-head">
        <div
          className={`compat-ring compat-${band.tone}`}
          style={{ ['--compat-pct' as string]: `${result.score}%` }}
        >
          <span>{result.score}<small>%</small></span>
        </div>
        <div>
          <div className="compat-band">{band.label}</div>
          <div className="compat-caption">
            Your preferences against {otherName ? `${otherName}'s` : 'the lister\u2019s'}, across eight dimensions.
          </div>
        </div>
      </div>

      <div className="compat-rows">
        {result.dimensions.map(d => (
          <div className="compat-row" key={d.key}>
            <div className="compat-row-top">
              <span className="compat-row-label">{d.label}</span>
              <span className="compat-row-values">{d.mine} <span aria-hidden="true">·</span> {d.theirs}</span>
            </div>
            <div className="compat-bar">
              <div
                className={`compat-bar-fill compat-${d.score >= 0.75 ? 'high' : d.score >= 0.5 ? 'mid' : 'low'}`}
                style={{ width: `${Math.round(d.score * 100)}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      <p className="compat-foot">Left value is yours, right is theirs.</p>
    </div>
  );
}
