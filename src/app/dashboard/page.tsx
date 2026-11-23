// FILE: src/app/dashboard/page.tsx
// Vista pública (sección 15): mismo contenido que consumía `/` antes de la
// Fase 2. Solo lectura: habla con el SnapshotReader (fixtures o DB).

import { getDashboardPayload } from "@/data/fixturesReader";
import { DashboardApp } from "@/components/dashboard/DashboardApp";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const payload = await getDashboardPayload();
  return <DashboardApp payload={payload} />;
}
