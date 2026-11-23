// FILE: src/app/page.tsx
// `/` redirige a la vista habilitada (sección 15, regla confirmada por el
// autor). El dashboard está habilitado en todos los modos válidos y su página
// muestra el aviso «sin configuración» cuando APP_MODE falta o es inválido.
// En producción la terminal vive en /terminal y responde 404 por modo.

import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function Home() {
  redirect("/dashboard");
}
