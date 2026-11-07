import Link from "next/link";
import Image from "next/image";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-background px-6 text-center">
      <Image src="/brand/apexaora-mark.png" alt="Apexaora" width={512} height={214} className="h-10 w-auto" />
      <h1 className="font-heading text-2xl font-bold">404</h1>
      <p className="text-muted-foreground">This page doesn&apos;t exist.</p>
      <Link href="/" className="font-medium text-link hover:text-link-hover hover:underline">
        Back to dashboard
      </Link>
    </main>
  );
}
