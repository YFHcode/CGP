'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Check } from 'lucide-react';

import { cn } from '@/lib/utils';
import { useCurrency } from '@/contexts/CurrencyContext';
import {
    SUPPORTED_CURRENCIES,
    CURRENCY_LABELS,
    type SupportedCurrency,
} from '@/lib/currencies';

/**
 * Currency picker implemented as a proper listbox.
 *
 * The previous version was a plain div with no ARIA roles, no keyboard support
 * at all, and outside-click detection that matched on a CSS class string.
 */
export function CurrencySelector() {
    const [isOpen, setIsOpen] = useState(false);
    const [activeIndex, setActiveIndex] = useState(0);
    const { currency, setCurrency, hasError } = useCurrency();

    const containerRef = useRef<HTMLDivElement>(null);
    const buttonRef = useRef<HTMLButtonElement>(null);
    const optionRefs = useRef<(HTMLLIElement | null)[]>([]);

    // Close on outside click, using a ref rather than a class-name lookup.
    useEffect(() => {
        if (!isOpen) return;

        const handlePointerDown = (event: MouseEvent | TouchEvent) => {
            if (!containerRef.current?.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handlePointerDown);
        document.addEventListener('touchstart', handlePointerDown);
        return () => {
            document.removeEventListener('mousedown', handlePointerDown);
            document.removeEventListener('touchstart', handlePointerDown);
        };
    }, [isOpen]);

    // Move DOM focus with the active option so screen readers follow along.
    useEffect(() => {
        if (isOpen) optionRefs.current[activeIndex]?.focus();
    }, [isOpen, activeIndex]);

    const open = () => {
        setActiveIndex(Math.max(0, SUPPORTED_CURRENCIES.indexOf(currency)));
        setIsOpen(true);
    };

    const close = (returnFocus = true) => {
        setIsOpen(false);
        if (returnFocus) buttonRef.current?.focus();
    };

    const select = (value: SupportedCurrency) => {
        setCurrency(value);
        close();
    };

    const handleListKeyDown = (event: React.KeyboardEvent) => {
        switch (event.key) {
            case 'Escape':
                event.preventDefault();
                close();
                break;
            case 'ArrowDown':
                event.preventDefault();
                setActiveIndex((i) => (i + 1) % SUPPORTED_CURRENCIES.length);
                break;
            case 'ArrowUp':
                event.preventDefault();
                setActiveIndex(
                    (i) => (i - 1 + SUPPORTED_CURRENCIES.length) % SUPPORTED_CURRENCIES.length
                );
                break;
            case 'Home':
                event.preventDefault();
                setActiveIndex(0);
                break;
            case 'End':
                event.preventDefault();
                setActiveIndex(SUPPORTED_CURRENCIES.length - 1);
                break;
            case 'Enter':
            case ' ':
                event.preventDefault();
                select(SUPPORTED_CURRENCIES[activeIndex]);
                break;
            case 'Tab':
                close(false);
                break;
        }
    };

    return (
        <div ref={containerRef} className="relative">
            <button
                ref={buttonRef}
                type="button"
                aria-haspopup="listbox"
                aria-expanded={isOpen}
                aria-label={`Currency: ${CURRENCY_LABELS[currency]}. Change currency`}
                onClick={() => (isOpen ? close(false) : open())}
                onKeyDown={(event) => {
                    if (event.key === 'ArrowDown') {
                        event.preventDefault();
                        open();
                    }
                }}
                className="flex items-center gap-2 rounded-full bg-gold-500/10 px-4 py-1.5 text-sm font-medium text-gold-300 transition-colors hover:bg-gold-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400"
            >
                {currency}
                <ChevronDown
                    className={cn('h-4 w-4 transition-transform', isOpen && 'rotate-180')}
                    aria-hidden="true"
                />
            </button>

            {hasError && (
                <span className="sr-only" role="status">
                    Exchange rates are unavailable; prices are shown in US dollars.
                </span>
            )}

            {isOpen && (
                <ul
                    role="listbox"
                    aria-label="Select currency"
                    onKeyDown={handleListKeyDown}
                    className="absolute right-0 top-full z-50 mt-2 w-56 overflow-hidden rounded-xl border border-white/10 bg-zinc-900 p-1 shadow-xl"
                >
                    {SUPPORTED_CURRENCIES.map((code, index) => {
                        const isSelected = code === currency;
                        return (
                            <li
                                key={code}
                                id={`currency-${code}`}
                                ref={(el) => {
                                    optionRefs.current[index] = el;
                                }}
                                role="option"
                                aria-selected={isSelected}
                                tabIndex={-1}
                                onClick={() => select(code)}
                                onMouseEnter={() => setActiveIndex(index)}
                                className={cn(
                                    'flex cursor-pointer items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm transition-colors focus:outline-none',
                                    index === activeIndex && 'bg-white/10',
                                    isSelected ? 'text-gold-300' : 'text-zinc-200'
                                )}
                            >
                                <span>
                                    <span className="font-medium">{code}</span>
                                    <span className="ml-2 text-xs text-zinc-400">
                                        {CURRENCY_LABELS[code]}
                                    </span>
                                </span>
                                {isSelected && <Check className="h-4 w-4 shrink-0" aria-hidden="true" />}
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
}
