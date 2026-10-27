'use client';

import { useState, type ReactNode } from 'react';

/**
 * A plain <img> that tries each source in turn and renders nothing once all
 * have failed — so whatever sits behind it (the banner gradient) shows
 * instead of a broken-image icon.
 *
 * `children` (e.g. an overlay) render after the image only while it is shown.
 *
 * The ref catches a load that already failed before React attached onError
 * (server-rendered markup starts loading before hydration).
 */
export function FallbackImage({
  sources,
  alt,
  className,
  fetchPriority,
  children,
}: {
  sources: string[];
  alt: string;
  className?: string;
  fetchPriority?: 'high' | 'low' | 'auto';
  children?: ReactNode;
}) {
  const [index, setIndex] = useState(0);
  const src = sources[index];
  if (!src) return null;

  const next = () => setIndex((current) => (current === index ? current + 1 : current));

  return (
    <>
      <img
        key={src}
        src={src}
        alt={alt}
        className={className}
        decoding="async"
        fetchPriority={fetchPriority}
        ref={(node) => {
          if (node && node.complete && node.naturalWidth === 0) next();
        }}
        onError={next}
      />
      {children}
    </>
  );
}
