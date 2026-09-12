import Image from "next/image";

const assets = {
  lockup: { src: "/brand/logo-lockup.png", width: 1511, height: 544 },
  mark: { src: "/brand/logo-mark.png", width: 489, height: 544 },
  wordmark: { src: "/brand/logo-wordmark.png", width: 957, height: 415 },
  tile: { src: "/brand/logo-app-icon.png", width: 512, height: 512 },
} as const;

/** Shared First Leaf artwork. CSS follows the saved theme before hydration. */
export default function BrandLogo({
  variant = "lockup",
  className = "",
  decorative = false,
}: {
  variant?: keyof typeof assets;
  className?: string;
  decorative?: boolean;
}) {
  return (
    <Image
      {...assets[variant]}
      alt={decorative ? "" : "ForeSure 未然"}
      className={`brand-logo brand-logo--${variant} ${className}`}
      unoptimized
      loading="eager"
    />
  );
}
