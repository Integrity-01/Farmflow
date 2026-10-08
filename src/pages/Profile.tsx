import { User } from 'lucide-react';
import { PlaceholderPage } from './PlaceholderPage';

export function Profile() {
  return (
    <PlaceholderPage
      title="Your profile will go here"
      icon={User}
      phase="Phase 3 — Authentication"
      description="Personal information, tasks and performance summary will be shown here."
    />
  );
}