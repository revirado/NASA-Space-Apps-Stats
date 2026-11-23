// FILE: src/lib/terminalGuard.ts
// Guard de las APIs de escritura de la terminal (sección 15, defensa en
// profundidad):
//   1. Sin modo que habilite la terminal → 404 (nunca 403: no revelar existencia).
//   2. TERMINAL_TOKEN definido → exige header 'x-terminal-token' (comparación
//      en tiempo constante).
//   3. Sin token en producción → 503 «sin configuración» nombrando la variable,
//      jamás su valor: la escritura no se abre por accidente.
//   4. Sin token en desarrollo → permite (comodidad local) con warning en log.
// SOLO SERVIDOR.

import { timingSafeEqual } from 'crypto';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { canUseTerminal, isProductionEnv } from '@/config/appMode';

export type GuardResult = { ok: true } | { ok: false; response: NextResponse };

export function guardTerminal(req: NextRequest): GuardResult {
  // Regla 1: el modo decide si la ruta existe (404 y no 403)
  if (!canUseTerminal()) {
    return { ok: false, response: new NextResponse(null, { status: 404 }) };
  }

  const token = process.env.TERMINAL_TOKEN?.trim() || null;

  // Regla 2: token definido → obligatorio en todos los entornos
  if (token) {
    const provided = req.headers.get('x-terminal-token') ?? '';
    const a = Buffer.from(provided);
    const b = Buffer.from(token);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      return {
        ok: false,
        response: NextResponse.json({ error: 'unauthorized' }, { status: 401 }),
      };
    }
    return { ok: true };
  }

  // Regla 3: producción sin token → escritura cerrada por configuración
  if (isProductionEnv) {
    return {
      ok: false,
      response: NextResponse.json(
        { status: 'unconfigured', missingVar: 'TERMINAL_TOKEN' },
        { status: 503 }
      ),
    };
  }

  // Regla 4: desarrollo sin token → permitido, con aviso en el log del servidor
  console.warn('[terminalGuard] TERMINAL_TOKEN no definido en desarrollo: escritura sin token');
  return { ok: true };
}
