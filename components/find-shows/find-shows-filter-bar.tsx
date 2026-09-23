'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, ChevronDown, Filter, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Drawer } from '@/components/ui/drawer';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { CountryFlag } from '@/components/find-shows/country-flag';
import { findShowsRegions, countryStatsByRegion } from '@/lib/find-shows/catalog';
import {
  createMegaMenuController,
  type MegaMenuController,
} from '@/lib/find-shows/mega-menu-hover';
import type {
  FindShowFilterOption,
  FindShowFilters,
  FindShowsCategory,
  FindShowsRegion,
} from '@/types/find-shows';

/**
 * Shared open/close state for every hover panel in the bar. The controller
 * holds the timing rules (see lib/find-shows/mega-menu-hover.ts); this hook
 * only mirrors its current menu into React state.
 */
function useMegaMenu(): MegaMenuController & { openId: string | null } {
  const [openId, setOpenId] = useState<string | null>(null);
  const controller = useMemo(() => createMegaMenuController({ onChange: setOpenId }), []);

  useEffect(() => controller.dispose, [controller]);

  return { ...controller, openId };
}

/** Hover handlers every panel and its pill share. */
function useHoverHandlers(menu: MegaMenuController, id: string) {
  // Touch and pen input have no hover state — opening on "mouseenter" there
  // would fire on tap and fight the click handler, so it stays pointer-fine
  // only, exactly as the previous implementation did.
  const isHoverPointer = () =>
    typeof window !== 'undefined' && window.matchMedia('(pointer: fine)').matches;

  const onMouseEnter = useCallback(() => {
    if (isHoverPointer()) {
      menu.openNow(id, 'hover');
    }
  }, [menu, id]);

  const onMouseLeave = useCallback(() => {
    if (isHoverPointer()) {
      menu.scheduleClose();
    }
  }, [menu]);

  // Re-entering the panel itself must never re-open a different menu, so the
  // panel cancels the pending close rather than calling openNow.
  const panelHandlers = {
    onMouseEnter: () => menu.cancelScheduledClose(),
    onMouseLeave,
  };

  return { onMouseEnter, onMouseLeave, panelHandlers };
}

/** Open/close transition shared by both panels (see tailwind.config.ts). */
const megaMenuPanelMotionClass =
  'data-[state=open]:animate-mega-menu-in data-[state=closed]:animate-mega-menu-out motion-reduce:animate-none';

function FilterCombobox({
  options,
  defaultOption,
  value,
  onChange,
  ariaLabel,
  searchPlaceholder,
  emptyText,
}: {
  options: FindShowFilterOption[];
  defaultOption: FindShowFilterOption;
  value: string;
  onChange: (value: string) => void;
  ariaLabel: string;
  searchPlaceholder: string;
  emptyText: string;
}) {
  const [open, setOpen] = useState(false);
  const selectedOption =
    value === defaultOption.value
      ? defaultOption
      : options.find((option) => option.value === value) ?? defaultOption;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={ariaLabel}
          className="flex h-11 w-full items-center justify-between rounded-2xl border border-slate-200/70 bg-white/90 px-4 text-left text-sm font-medium text-slate-700 shadow-sm transition-colors hover:border-indigo-300/70 hover:bg-white dark:border-white/[0.08] dark:bg-[#0f1729]/90 dark:text-slate-200 dark:hover:border-indigo-400/30"
        >
          <span className="truncate">{selectedOption.label}</span>
          <ChevronDown className="ml-3 size-4 shrink-0 text-slate-400 dark:text-slate-500" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[280px] overflow-hidden p-0">
        <Command>
          <CommandInput placeholder={searchPlaceholder} aria-label={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              <CommandItem
                value={[defaultOption.label, defaultOption.value].filter(Boolean).join(' ')}
                onSelect={() => {
                  onChange(defaultOption.value);
                  setOpen(false);
                }}
              >
                <span className="flex-1">{defaultOption.label}</span>
                {value === defaultOption.value ? <Check className="size-4 text-indigo-500" /> : null}
              </CommandItem>
              {options.map((option) => (
                <CommandItem
                  key={`${option.label}-${option.value}`}
                  value={[option.label, option.value].filter(Boolean).join(' ')}
                  onSelect={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                >
                  <span className="flex-1">{option.label}</span>
                  {value === option.value ? <Check className="size-4 text-indigo-500" /> : null}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

/**
 * Continent illustrations for the All Regions panel, one per region. The
 * previous globe icon was identical for all four, so it carried no
 * information; these are keyed by region name and live in
 * public/assets/regions/.
 */
const regionMapIcons: Record<Exclude<FindShowsRegion, 'All Regions'>, string> = {
  Americas: '/assets/regions/americas.svg',
  Europe: '/assets/regions/europe.svg',
  'Africa & Middle East': '/assets/regions/africa-middle-east.svg',
  'Asia-Pacific': '/assets/regions/asia-pacific.svg',
};

/** One region tile in the All Regions panel. */
function RegionCard({
  region,
  count,
  onSelect,
}: {
  region: Exclude<FindShowsRegion, 'All Regions'>;
  count: number;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="group flex flex-col items-center justify-center gap-2 rounded-2xl border border-slate-200/60 bg-slate-50/80 p-5 transition-all hover:-translate-y-1 hover:border-indigo-300 hover:bg-white hover:shadow-xl"
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- a static SVG
          gains nothing from the image optimizer. */}
      <img
        src={regionMapIcons[region]}
        alt=""
        width={52}
        height={52}
        className="size-[52px] opacity-90 transition-transform group-hover:scale-110"
      />
      <span className="text-sm font-black tracking-tight text-slate-900">{region}</span>
      <span className="rounded-full bg-slate-200/80 px-2.5 py-1 text-[11px] font-bold text-slate-700">
        {count} shows
      </span>
    </button>
  );
}

function RegionMegaMenuPopover({
  region,
  filters,
  onFiltersChange,
  menu,
}: {
  region: FindShowsRegion;
  filters: FindShowFilters;
  onFiltersChange: (nextFilters: FindShowFilters) => void;
  menu: MegaMenuController & { openId: string | null };
}) {
  const menuId = `region:${region}`;
  const open = menu.openId === menuId;
  const isActive = filters.region === region;
  const { onMouseEnter, onMouseLeave, panelHandlers } = useHoverHandlers(menu, menuId);

  let label: string = region;
  if (isActive && filters.country) {
    label = `${region}: ${filters.country}`;
  }

  return (
    <div onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}>
      <Popover
        open={open}
        onOpenChange={(nextOpen) => (nextOpen ? menu.openNow(menuId) : menu.closeNow())}
      >
        <PopoverTrigger asChild>
          <button
            type="button"
            onClick={() => {
              // Apply parent region filter instantly when clicking
              if (region !== 'All Regions' && filters.region !== region) {
                onFiltersChange({ ...filters, region, country: '' });
              }
            }}
            className={cn(
              'group inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-medium transition-all duration-200',
              isActive
                ? 'border-indigo-500/60 bg-indigo-500/12 text-indigo-600 shadow-[0_8px_24px_rgba(79,70,229,0.12)] dark:border-indigo-400/40 dark:bg-indigo-400/10 dark:text-indigo-300'
                : 'border-slate-200/70 bg-white/80 text-slate-600 hover:border-indigo-300/70 hover:text-slate-900 dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-slate-300 dark:hover:border-indigo-400/30 dark:hover:text-white'
            )}
          >
            <span className="max-w-[120px] truncate sm:max-w-none">{label}</span>
            <ChevronDown className="size-3.5 shrink-0 transition-transform opacity-60 group-data-[state=open]:rotate-180" />
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          sideOffset={12}
          {...panelHandlers}
          // A hover-opened panel must not pull focus (the cursor is elsewhere
          // and focusing would scroll the page); a click or keyboard open
          // keeps Radix's default focus move so the menu stays operable.
          onOpenAutoFocus={(event) => {
            if (menu.getOpenSource() === 'hover') {
              event.preventDefault();
            }
          }}
          onEscapeKeyDown={() => menu.closeNow()}
          className={cn(
            'z-[100] w-[95vw] max-w-[1000px] shrink-0 rounded-[28px] border border-white/40 bg-white/95 p-6 shadow-[0_40px_100px_rgba(0,0,0,0.12)] backdrop-blur-3xl outline-none dark:border-white/20 dark:bg-white/90 dark:shadow-[0_40px_200px_rgba(0,0,0,0.5)]',
            megaMenuPanelMotionClass
          )}
        >
        {region === 'All Regions' ? (
           <div>
             <div className="mb-5 flex items-center justify-between border-b border-slate-200/70 pb-4">
               <h3 className="text-xl font-black tracking-tight text-slate-950">Regions</h3>
               <button
                 type="button"
                 onClick={() => {
                   onFiltersChange({ ...filters, region: 'All Regions', country: '' });
                   menu.closeNow();
                 }}
                 className="text-sm font-bold text-slate-500 transition-colors hover:text-slate-900"
               >
                 Clear Region
               </button>
             </div>
             <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                {findShowsRegions
                  .filter((subRegion): subRegion is Exclude<FindShowsRegion, 'All Regions'> =>
                    subRegion !== 'All Regions'
                  )
                  .map((subRegion) => (
                    <RegionCard
                      key={subRegion}
                      region={subRegion}
                      count={
                        countryStatsByRegion[subRegion]?.reduce(
                          (acc, curr) => acc + curr.count,
                          0
                        ) || 0
                      }
                      onSelect={() => {
                        onFiltersChange({ ...filters, region: subRegion, country: '' });
                        menu.closeNow();
                      }}
                    />
                  ))}
             </div>
           </div>
        ) : (
           <div>
             <div className="mb-5 flex items-center justify-between border-b border-slate-200/70 pb-4">
               <h3 className="text-xl font-black tracking-tight text-slate-950">
                 Shows in {region}
               </h3>
               <button
                 type="button"
                 onClick={() => {
                   onFiltersChange({ ...filters, region, country: '' });
                   menu.closeNow();
                 }}
                 className="rounded-full bg-indigo-100 px-4 py-1.5 text-sm font-bold text-indigo-700 transition-all hover:bg-indigo-600 hover:text-white hover:shadow-md"
               >
                 View All {region}
               </button>
             </div>
             {countryStatsByRegion[region] && countryStatsByRegion[region].length > 0 ? (
               <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                 {countryStatsByRegion[region].map(stat => {
                    const isCountryActive = isActive && filters.country === stat.country;
                    return (
                      <button
                        key={stat.country}
                        onClick={() => {
                          onFiltersChange({ ...filters, region, country: stat.country });
                          menu.closeNow();
                        }}
                        className={cn(
                          "flex w-full items-center gap-2.5 rounded-xl border border-transparent p-2 text-left transition-all hover:bg-slate-100",
                          isCountryActive && "border-indigo-500/30 bg-indigo-50/80 shadow-sm"
                        )}
                      >
                        <CountryFlag country={stat.country} />
                        <div className="flex flex-col overflow-hidden">
                          <span className={cn(
                            "truncate text-[13px] font-extrabold leading-tight transition-colors",
                            isCountryActive ? "text-indigo-700" : "text-slate-900"
                          )}>
                            {stat.country}
                          </span>
                          <span className="text-[11px] font-bold text-slate-500">
                            {stat.count} <span className="opacity-80">shows</span>
                          </span>
                        </div>
                      </button>
                    );
                 })}
               </div>
             ) : (
               <div className="py-8 text-center text-sm font-semibold text-slate-500">No imported events available in this region.</div>
             )}
           </div>
        )}
      </PopoverContent>
    </Popover>
    </div>
  );
}

function FilterFields({
  categories,
  filters,
  onFiltersChange,
  activeFilterCount,
  onClear,
}: {
  categories: FindShowFilterOption<FindShowsCategory>[];
  filters: FindShowFilters;
  onFiltersChange: (nextFilters: FindShowFilters) => void;
  activeFilterCount: number;
  onClear: () => void;
}) {
  const [allCategoriesOption, ...categoryOptions] = categories;
  // One controller for the whole bar: hovering another pill swaps panels at
  // once instead of leaving the previous one open for its grace period.
  const menu = useMegaMenu();
  const categoryMenuId = 'category';
  const categoryOpen = menu.openId === categoryMenuId;
  const {
    onMouseEnter: handleCategoryMouseEnter,
    onMouseLeave: handleCategoryMouseLeave,
    panelHandlers: categoryPanelHandlers,
  } = useHoverHandlers(menu, categoryMenuId);

  const selectedCategoryOption =
    filters.category === (allCategoriesOption?.value ?? 'All Categories')
      ? allCategoriesOption
      : categoryOptions.find((o) => o.value === filters.category) ?? allCategoriesOption;

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
          Region
        </p>
        <span className="rounded-full border border-slate-200/70 bg-white/80 px-2.5 py-1 text-[11px] font-semibold text-slate-500 dark:border-white/[0.08] dark:bg-white/[0.05] dark:text-slate-300">
          {activeFilterCount} active
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {findShowsRegions.map((region) => (
          <RegionMegaMenuPopover
            key={region}
            region={region}
            filters={filters}
            onFiltersChange={onFiltersChange}
            menu={menu}
          />
        ))}

        {/* Separator dot */}
        <span className="mx-1 size-1 shrink-0 rounded-full bg-slate-300 dark:bg-slate-600" />

        {/* All Categories – pill-style popover trigger */}
        <div onMouseEnter={handleCategoryMouseEnter} onMouseLeave={handleCategoryMouseLeave}>
          <Popover
            open={categoryOpen}
            onOpenChange={(nextOpen) =>
              nextOpen ? menu.openNow(categoryMenuId) : menu.closeNow()
            }
          >
            <PopoverTrigger asChild>
              <button
                type="button"
                aria-label="Filter shows by category"
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-medium transition-all duration-200',
                  filters.category && filters.category !== (allCategoriesOption?.value ?? 'All Categories')
                    ? 'border-indigo-500/60 bg-indigo-500/12 text-indigo-600 shadow-[0_8px_24px_rgba(79,70,229,0.12)] dark:border-indigo-400/40 dark:bg-indigo-400/10 dark:text-indigo-300'
                    : 'border-slate-200/70 bg-white/80 text-slate-600 hover:border-indigo-300/70 hover:text-slate-900 dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-slate-300 dark:hover:border-indigo-400/30 dark:hover:text-white'
                )}
              >
                <span className="truncate">{selectedCategoryOption?.label ?? 'All Categories'}</span>
                <ChevronDown className="size-3.5 shrink-0 opacity-60 transition-transform data-[state=open]:rotate-180" />
              </button>
            </PopoverTrigger>
            <PopoverContent
              align="start"
              {...categoryPanelHandlers}
              onOpenAutoFocus={(event) => {
                if (menu.getOpenSource() === 'hover') {
                  event.preventDefault();
                }
              }}
              onEscapeKeyDown={() => menu.closeNow()}
              className={cn(
                'z-[100] w-[280px] overflow-hidden rounded-2xl border border-white/40 bg-white/95 p-0 shadow-[0_40px_100px_rgba(0,0,0,0.12)] backdrop-blur-3xl outline-none dark:border-white/20 dark:bg-white/90 dark:shadow-[0_40px_200px_rgba(0,0,0,0.5)]',
                megaMenuPanelMotionClass
              )}
            >
            <Command className="bg-transparent dark:bg-transparent">
              <CommandInput placeholder="Search category..." aria-label="Search category..." className="text-slate-950 placeholder:text-slate-500 border-none focus:ring-0" />
              <CommandList>
                <CommandEmpty className="py-6 text-center text-sm font-semibold text-slate-500">No matching category</CommandEmpty>
                <CommandGroup>
                  <CommandItem
                    value={
                      [allCategoriesOption?.label, allCategoriesOption?.value]
                        .filter(Boolean)
                        .join(' ') || 'All Categories'
                    }
                    className="cursor-pointer font-bold text-slate-700 aria-selected:bg-slate-100 aria-selected:text-slate-950 hover:bg-slate-100 hover:text-slate-950 data-[selected=true]:bg-slate-100 data-[selected=true]:text-slate-950"
                    onSelect={() => {
                      onFiltersChange({
                        ...filters,
                        category: (allCategoriesOption?.value ?? 'All Categories') as FindShowsCategory,
                      });
                      menu.closeNow();
                    }}
                  >
                    <span className="flex-1">{allCategoriesOption?.label ?? 'All Categories'}</span>
                    {filters.category === (allCategoriesOption?.value ?? 'All Categories') ? (
                      <Check className="size-4 text-indigo-600" />
                    ) : null}
                  </CommandItem>
                  {categoryOptions.map((option) => (
                    <CommandItem
                      key={`${option.label}-${option.value}`}
                      value={[option.label, option.value].filter(Boolean).join(' ')}
                      className="cursor-pointer font-bold text-slate-700 aria-selected:bg-slate-100 aria-selected:text-slate-950 hover:bg-slate-100 hover:text-slate-950 data-[selected=true]:bg-slate-100 data-[selected=true]:text-slate-950"
                      onSelect={() => {
                        onFiltersChange({
                          ...filters,
                          category: option.value as FindShowsCategory,
                        });
                        menu.closeNow();
                      }}
                    >
                      <span className="flex-1 drop-shadow-sm">{option.label}</span>
                      {filters.category === option.value ? (
                        <Check className="size-4 text-indigo-600" />
                      ) : null}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
        </div>

        {/* Clear All Filters – matching pill style */}
        {activeFilterCount > 0 && (
          <button
            type="button"
            onClick={onClear}
            className="inline-flex items-center gap-1.5 rounded-full border border-red-200/70 bg-red-50/60 px-4 py-2 text-sm font-medium text-red-600 transition-all duration-200 hover:border-red-300/70 hover:bg-red-50 dark:border-red-400/20 dark:bg-red-400/8 dark:text-red-400 dark:hover:border-red-400/40"
          >
            <X className="size-3.5 shrink-0" />
            Clear All Filters
          </button>
        )}
      </div>
    </div>
  );
}

export function FindShowsFilterBar({
  categories,
  filters,
  onFiltersChange,
  activeFilterCount,
  onClear,
}: {
  categories: FindShowFilterOption<FindShowsCategory>[];
  filters: FindShowFilters;
  onFiltersChange: (nextFilters: FindShowFilters) => void;
  activeFilterCount: number;
  onClear: () => void;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      <section className="sticky top-[72px] z-30 border-y border-slate-200/60 bg-white/75 px-5 py-4 backdrop-blur-xl dark:border-white/[0.08] dark:bg-[#0b1220]/80 md:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="mb-3 flex items-center justify-between gap-3 md:hidden">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
              Filters
            </p>
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200/70 bg-white/85 px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:border-indigo-300/70 dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-slate-200 dark:hover:border-indigo-400/30"
            >
              <Filter className="size-4" />
              Filters ({activeFilterCount})
            </button>
          </div>

          <div className="hidden md:block">
            <FilterFields
              categories={categories}
              filters={filters}
              onFiltersChange={onFiltersChange}
              activeFilterCount={activeFilterCount}
              onClear={onClear}
            />
          </div>
        </div>
      </section>

      <Drawer
        open={mobileOpen}
        title={`Filters (${activeFilterCount})`}
        onClose={() => setMobileOpen(false)}
      >
        <FilterFields
          categories={categories}
          filters={filters}
          onFiltersChange={onFiltersChange}
          activeFilterCount={activeFilterCount}
          onClear={() => {
            onClear();
            setMobileOpen(false);
          }}
        />
      </Drawer>
    </>
  );
}
