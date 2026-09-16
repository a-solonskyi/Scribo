import { ArrowUpRight } from 'lucide-react';
import { POLICIES } from '../policies';

export default function PolicyLinks({ onNavigate, firstLinkRef }) {
  return POLICIES.map((policy, index) => (
    <a
      key={policy.slug}
      href={`/policies/${policy.slug}`}
      target="_blank"
      rel="noopener noreferrer"
      ref={index === 0 ? firstLinkRef : undefined}
      onClick={onNavigate}
    >
      <span>{policy.title}</span>
      <ArrowUpRight size={16} aria-hidden="true" />
      <span className="policy-sr-only"> (opens in a new tab)</span>
    </a>
  ));
}
