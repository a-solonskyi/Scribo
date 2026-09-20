import { redirect } from 'next/navigation';

// Keep old bookmarks usable now that Instructions lives in the professor sidebar.
export default function InstructionsPage() {
  redirect('/dashboard');
}
