import Image from "next/image";
import Link from "next/link";

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/" className="inline-flex items-center gap-3 group">
      <div className="relative h-9 w-9 overflow-hidden rounded-xl border border-border bg-white shadow-sm transition-all duration-300 group-hover:shadow-glow-sm group-hover:scale-105">
        <Image
          src="/prismconnex-logo.jpeg"
          alt="Prismconnex Global Solutions"
          fill
          sizes="36px"
          className="object-contain p-0.5"
          priority
        />
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
