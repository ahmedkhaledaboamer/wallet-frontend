import Image from "next/image";

/** Static, locale-neutral splash shown while the client restores the session. */
export function SplashScreen() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background" aria-busy="true">
      <Image
        src="/brand/apexaora-mark.png"
        alt="Apexaora"
        width={512}
        height={214}
        priority
        className="h-10 w-auto animate-pulse motion-reduce:animate-none"
      />
    </div>
  );
}
