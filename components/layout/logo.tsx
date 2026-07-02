import Image from 'next/image';
import Link from 'next/link';

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/dashboard" className="flex items-center gap-3">
      <Image src="/hutka-logo.svg" alt="Hutka" width={42} height={42} className="rounded-2xl" priority />
      {!compact && (
        <div>
          <p className="text-lg font-black leading-none tracking-tight text-app-text">Hutka</p>
          <p className="mt-1 text-[11px] font-medium text-app-faint">Beauty Growth OS</p>
        </div>
      )}
    </Link>
  );
}
