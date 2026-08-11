import Link from "next/link";

import { BrandLogo } from "@/components/brand-logo";

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/" className="inline-flex items-center gap-3 group">
      {/*
        The plate is transparent rather than `bg-white`: that white square only
        existed to make the opaque JPEG readable. Box size, radius, border and
        hover transform are unchanged, so alignment and layout are identical.
      */}
      <div className="relative h-9 w-9 overflow-hidden rounded-xl border border-border shadow-sm transition-all duration-300 group-hover:shadow-glow-sm group-hover:scale-105">
        <BrandLogo fill sizes="36px" className="object-contain p-0.5" priority />
      </div>
      {!compact ? (
        <div className="leading-tight">
          <p className="text-sm font-bold tracking-wide text-foreground">Prismconnex</p>
          <p className="text-[10px] text-muted-foreground">AI Trade Shows CRM</p>
        </div>
      ) : null}
    </Link>
  );
}
