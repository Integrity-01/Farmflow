import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/utils/cn';

interface PaginationProps {
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
  className?: string;
}

export function Pagination({ page, pageCount, onPageChange, className }: PaginationProps) {
  if (pageCount <= 1) {
    return null;
  }

  const pages = Array.from(new Set([1, 2, page - 1, page, page + 1, pageCount - 1, pageCount]))
    .filter((p) => p >= 1 && p <= pageCount)
    .sort((a, b) => a - b);

  const items: (number | 'ellipsis')[] = [];
  for (let i = 0; i < pages.length; i += 1) {
    if (i > 0 && pages[i] - pages[i - 1] > 1) {
      items.push('ellipsis');
    }
    items.push(pages[i]);
  }

  return (
    <nav className={cn('flex items-center gap-1', className)} aria-label="Pagination">
      <Button
        variant="ghost"
        size="icon"
        className="hidden sm:inline-flex"
        disabled={page <= 1}
        aria-label="First page"
        onClick={() => onPageChange(1)}
      >
        <ChevronsLeft className="size-4" aria-hidden />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        disabled={page <= 1}
        aria-label="Previous page"
        onClick={() => onPageChange(page - 1)}
      >
        <ChevronLeft className="size-4" aria-hidden />
      </Button>

      <div className="flex items-center gap-1">
        {items.map((item, index) =>
          item === 'ellipsis' ? (
            <span key={`el-${index}`} className="px-1 text-sm text-slate-400">
              …
            </span>
          ) : (
            <Button
              key={item}
              variant={item === page ? 'secondary' : 'ghost'}
              size="icon"
              aria-label={`Page ${item}`}
              aria-current={item === page ? 'page' : undefined}
              onClick={() => onPageChange(item)}
              className="h-9 w-9 text-sm"
            >
              {item}
            </Button>
          ),
        )}
      </div>

      <Button
        variant="ghost"
        size="icon"
        disabled={page >= pageCount}
        aria-label="Next page"
        onClick={() => onPageChange(page + 1)}
      >
        <ChevronRight className="size-4" aria-hidden />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="hidden sm:inline-flex"
        disabled={page >= pageCount}
        aria-label="Last page"
        onClick={() => onPageChange(pageCount)}
      >
        <ChevronsRight className="size-4" aria-hidden />
      </Button>
    </nav>
  );
}

export function pageRange(total: number, page: number, pageSize: number, label: string) {
  if (total === 0) {
    return `0 ${label}`;
  }
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  return `${from}–${to} of ${total} ${label}`;
}