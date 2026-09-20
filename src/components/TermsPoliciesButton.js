import { useRef, useState } from 'react';
import {
  Popover,
  PopoverClose,
  PopoverContent,
  PopoverTitle,
  PopoverTrigger,
} from '../../components/ui/popover';
import PolicyLinks from './PolicyLinks';

export default function TermsPoliciesButton() {
  const [open, setOpen] = useState(false);
  const firstLinkRef = useRef(null);
  const triggerRef = useRef(null);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        className="sidebar-action-button sidebar-action-button-inverse terms-policies-button"
        ref={triggerRef}
      >
        <span>Terms &amp; Policies</span>
      </PopoverTrigger>
      <PopoverContent
        className="policies-popover"
        side="top"
        align="start"
        sideOffset={10}
        initialFocus={firstLinkRef}
        finalFocus={triggerRef}
      >
        <div className="policies-popover-heading">
          <PopoverTitle>Terms &amp; Policies</PopoverTitle>
          <PopoverClose
            className="policies-close"
            aria-label="Close Terms & Policies"
          >
            Close
          </PopoverClose>
        </div>
        <nav className="policy-links" aria-label="Policy documents">
          <PolicyLinks
            firstLinkRef={firstLinkRef}
            onNavigate={() => setOpen(false)}
          />
        </nav>
      </PopoverContent>
    </Popover>
  );
}
