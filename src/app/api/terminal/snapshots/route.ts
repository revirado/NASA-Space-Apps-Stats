// FILE: src/app/api/terminal/snapshots/route.ts
// GET: lista de capturas cargadas (vista de la terminal). Protegida por modo
// (404) y token (401) según sección 15.

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { guardTerminal } from '@/lib/terminalGuard';
import { listSnapshots } from '@/data/dbWriter';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const guard = guardTerminal(req);
  if (!guard.ok) return guard.response;

  const result = await listSnapshots();
  if (!result.ok) {
    return NextResponse.json({ status: result.state.status }, { status: 503 });
  }
  return NextResponse.json(result);
}
