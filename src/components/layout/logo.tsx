import Image from "next/image";
import { cn } from "@/lib/utils";

/** Horizontal lockup for the dark sidebar: mark + wordmark (client artwork). */
export function SidebarLogo({ className }: { className?: string }) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <Image src="/brand/apexaora-mark.png" alt="" width={512} height={214} priority className="h-6 w-auto" />
      <Image
        src="/brand/apexaora-wordmark-on-dark.png"
        alt="Apexaora Innovations"
        width={640}
        height={110}
        priority
        className="h-[1.375rem] w-auto"
      />
    </span>
  );
}

export function LogoMark({ className, alt = "" }: { className?: string; alt?: string }) {
  return <Image src="/brand/apexaora-mark.png" alt={alt} width={512} height={214} className={cn("h-5 w-auto", className)} />;
}

/** Stacked lockup for dark hero surfaces (login). */
export function HeroLogo({ className }: { className?: string }) {
  return (
    <Image
      src="/brand/apexaora-logo-on-dark.png"
      alt="Apexaora Innovations"
      width={880}
      height={482}
      priority
      className={cn("h-auto w-56", className)}
    />
  );
}
