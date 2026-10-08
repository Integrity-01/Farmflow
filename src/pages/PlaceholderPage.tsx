import type { LucideIcon } from 'lucide-react';
import { Hammer } from 'lucide-react';
import { EmptyState } from '@/components/ui/EmptyState';

interface PlaceholderPageProps {
  title: string;
  phase?: string;
  description?: string;
  icon?: LucideIcon;
}

export function PlaceholderPage({ title, phase, description, icon }: PlaceholderPageProps) {
  return (
    <EmptyState
      icon={icon ?? Hammer}
      title={title}
      description={
        description ??
        `${title} arrives in ${phase ?? 'a later phase'}. The FarmFlow foundation is ready and growing.`
      }
    />
  );
}