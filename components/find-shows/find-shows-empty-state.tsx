import { SearchX } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function FindShowsEmptyState({ onClear }: { onClear: () => void }) {
  return (
    <div className="glass-card flex min-h-[340px] flex-col items-center justify-center rounded-[28px] border border-dashed border-slate-300/80 px-6 text-center dark:border-white/[0.12]">
      <div className="flex size-16 items-center justify-center rounded-2xl bg-indigo-500/10 text-indigo-500 dark:bg-indigo-400/10 dark:text-indigo-300">
        <SearchX className="size-7" />
      </div>
      <h3 className="mt-6 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
        No trade shows found matching your filters
      </h3>
      <p className="mt-3 max-w-md text-sm leading-relaxed text-slate-600 dark:text-slate-300">
        Try broadening the country, category, or date range filters to bring more trade shows back
        into view.
      </p>
      <Button className="mt-6 rounded-full px-6" onClick={onClear}>
        Clear Filters
      </Button>
    </div>
  );
}
