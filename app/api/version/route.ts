import { NextResponse } from 'next/server';
import packageJson from '@/package.json';

export const dynamic = 'force-static';

export async function GET() {
  return NextResponse.json({
    name: packageJson.name,
    version: packageJson.version,
    next: packageJson.dependencies.next,
    react: packageJson.dependencies.react,
    packageManager: packageJson.packageManager
  });
}
