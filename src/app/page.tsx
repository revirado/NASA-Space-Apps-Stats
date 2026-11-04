// FILE: src/app/page.tsx
// Ruta única del proyecto (sandbox). Servidor: lee fixtures (o DB según
// DATA_SOURCE) con el SnapshotReader y entrega el payload a la vista cliente.

import { getDashboardPayload } from "@/data/fixturesReader";
import { DashboardApp } from "@/components/dashboard/DashboardApp";

export const dynamic = "force-dynamic";

export default async function Home() {
  const payload = await getDashboardPayload();
  return <DashboardApp payload={payload} />;
}
