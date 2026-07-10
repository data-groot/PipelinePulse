import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export function RunStatusBadge({ status }: { status: string }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        status === 'success' && 'border-emerald-500/50 text-emerald-500',
        status === 'failed' && 'border-destructive/50 text-destructive',
        status === 'running' && 'border-amber-500/50 text-amber-500'
      )}
    >
      {status}
    </Badge>
  );
}
