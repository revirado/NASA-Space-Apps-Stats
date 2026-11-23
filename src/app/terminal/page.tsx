// FILE: src/app/terminal/page.tsx
// Terminal de carga (privada, Fase 2). Si el modo no la habilita responde 404
// y nunca 403, para no revelar que existe (sección 15).

import { notFound } from "next/navigation";
import { canUseTerminal } from "@/config/appMode";
import { TerminalApp } from "@/components/terminal/TerminalApp";

export const dynamic = "force-dynamic";

export default function TerminalPage() {
  if (!canUseTerminal()) notFound();
  return <TerminalApp />;
}
