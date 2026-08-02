'use client';

import { cn } from '@/lib/utils';

interface ToggleGroupProps<T extends string> {
    /** Accessible name for the group, e.g. "Price unit". */
    label: string;
    options: readonly T[];
    value: T;
    onChange: (value: T) => void;
    /** Optional secondary line rendered under each option label. */
    renderHint?: (option: T) => React.ReactNode;
    className?: string;
    size?: 'sm' | 'md';
}

/**
 * A radio group styled as a segmented control.
 *
 * Uses real radio semantics so screen readers announce which option is
 * selected and arrow keys move between them — plain buttons conveyed neither.
 */
export function ToggleGroup<T extends string>({
    label,
    options,
    value,
    onChange,
    renderHint,
    className,
    size = 'md',
}: ToggleGroupProps<T>) {
    return (
        <div
            role="radiogroup"
            aria-label={label}
            className={cn('flex gap-1 rounded-lg bg-zinc-800/60 p-1', className)}
        >
            {options.map((option) => {
                const isSelected = option === value;
                return (
                    <button
                        key={option}
                        type="button"
                        role="radio"
                        aria-checked={isSelected}
                        // Only the selected option stays in the tab order; arrow
                        // keys move within the group, matching native radios.
                        tabIndex={isSelected ? 0 : -1}
                        onClick={() => onChange(option)}
                        onKeyDown={(event) => {
                            if (!['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp'].includes(event.key)) {
                                return;
                            }
                            event.preventDefault();
                            const delta = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : -1;
                            const next = options[(options.indexOf(option) + delta + options.length) % options.length];
                            onChange(next);
                        }}
                        className={cn(
                            'flex-1 rounded-md font-medium transition-all',
                            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900',
                            size === 'sm' ? 'px-2 py-1 text-xs' : 'px-3 py-2 text-sm',
                            isSelected
                                ? 'bg-gold-500 text-black shadow-lg'
                                : 'text-zinc-300 hover:bg-white/5 hover:text-white'
                        )}
                    >
                        {option}
                        {renderHint && <span className="block text-[0.7rem] opacity-80">{renderHint(option)}</span>}
                    </button>
                );
            })}
        </div>
    );
}
