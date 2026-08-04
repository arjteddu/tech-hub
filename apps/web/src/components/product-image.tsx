// Plain <img>, not next/image: product photos live on whatever R2_PUBLIC_URL
// domain the deployer configures, which next/image needs to know about
// upfront via remotePatterns in next.config.ts. A scaffold can't know that
// domain in advance — swap this for next/image once yours is fixed.
export function ProductImage({ src, alt, className }: { src?: string; alt: string; className?: string }) {
  if (!src) {
    return <div className={`bg-black/5 dark:bg-white/10 ${className ?? ""}`} aria-hidden />;
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} className={`object-cover ${className ?? ""}`} />;
}
