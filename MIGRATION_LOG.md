# MIGRATION_LOG

Registro cronológico del progreso de la migración fuera de Lovable.

## Hecho

### 2026-08-12 — Confirmado: build standalone OK
- Se ejecutó `npm install` y `npm run build` en un entorno limpio fuera de Lovable.
- El build terminó correctamente con exit code 0.
- La compilación de cliente, SSR y Nitro finalizó sin errores bloqueantes.
- Esto confirma que el proyecto puede compilar de forma standalone, aunque todavía requiere limpieza de dependencias y configuración específica de Lovable.

### 2026-08-12 — Login de Google migrado a Supabase
- Se reemplazó la llamada a `lovable.auth.signInWithOAuth("google", ...)` en `src/routes/auth.tsx`.
- Ahora la autenticación OAuth usa directamente:
  `supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: window.location.origin } })`
- Se elimina la dependencia del módulo de autenticación generado por Lovable.

### 2026-08-12 — Eliminado módulo de auth de Lovable y dependencia del paquete
- Se eliminó el archivo `src/integrations/lovable/index.ts`.
- Se quitó la dependencia `@lovable.dev/cloud-auth-js` de `package.json`.
- Se validó que ya no quedan referencias a `lovable.auth`, `@lovable.dev/cloud-auth-js` ni `createLovableAuth` en el código fuente.

### 2026-08-13 — Configuración de Vite migrada completamente
- Se eliminó el import de `@lovable.dev/vite-tanstack-config` de `vite.config.ts`.
- Se reemplazó con configuración explícita de plugins:
  - `@tanstack/router-plugin/vite` (TanStack Router)
  - `@vitejs/plugin-react` (React)
  - `@tailwindcss/vite` (Tailwind CSS)
  - `nitro/vite` (SSR/build server, preset cloudflare)
  - Resolución nativa de tsconfig paths (`resolve.tsconfigPaths: true`)
  - Alias `@` para `src/`
  - Inyección de variables `VITE_*`
- Se removió la dependencia `@lovable.dev/vite-tanstack-config` del `package.json`.
- Se validó que el build funciona correctamente sin advertencias.

### 2026-08-13 — Eliminado reporting de errores de Lovable
- Se eliminó el archivo `src/lib/lovable-error-reporting.ts`.
- Se removió el import `reportLovableError` de `src/routes/__root.tsx`.
- Se reemplazó el reporting de Lovable con `console.error` simple en el ErrorComponent.
- Se validó que el build funciona correctamente.

### 2026-08-13 — Cambiado preset de Nitro a node-server
- Se cambió el preset de Nitro de "cloudflare" a "node-server" en `vite.config.ts`.
- "node-server" es compatible con despliegues en Node.js/self-hosted y Vercel.
- Se verificó que no hay dependencias específicas de Cloudflare (KV, D1, R2, Durable Objects) en el código.
- La base de datos usa Supabase, no Cloudflare D1.
- Se validó que el build funciona correctamente con el nuevo preset.

### 2026-08-13 — Removido .env del tracking de git
- Se agregó `.env` a `.gitignore` (también `.env.local` y `.env.*.local`).
- Se ejecutó `git rm --cached .env` para sacar el archivo del tracking sin borrar la copia local.
- Se creó `.env.example` con las variables requeridas pero sin valores reales (para documentación/setup).
- El archivo `.env` local sigue existiendo en la máquina, pero git ya no lo trackea.

### 2026-08-13 — README.md actualizado: removidas referencias a Lovable
- Se reescribió completamente el README.md eliminando el PRD y referencias a Lovable.
- El nuevo README es más profesional con:
  - Descripción clara del proyecto: Portal de Soporte Técnico para Ministerio de Producción
  - Stack técnico actualizado (React, Vite, Tailwind, TanStack, Nitro/Node.js)
  - Instrucciones de instalación, setup de Supabase y `.env`
  - Guía de scripts npm (dev, build, preview)
  - Estructura del proyecto explicada
  - Instrucciones de despliegue para Vercel y self-hosted
  - Información de autenticación (Google OAuth + email/password)
  - Se agregó nota sobre configuración actual: Node.js preset, no Cloudflare
- Se removieron: referencias a Lovable, secciones del PRD antiguo, links a Lovable Cloud, Build with Lovable

### 2026-08-14 — Corregida migración de roles y consolidado el esquema SQL
- Se corrigió la sintaxis faltante en la política `Admins update roles` en la migración final.
- Se reemplazó la lógica hardcodeada de `sistemasmprod@gmail.com` por la regla general del primer usuario administrador y los siguientes empleados.
- Se consolidó el esquema en un único archivo: `supabase/migrations/00000000000000_schema_completo.sql`.
- Se eliminaron los 4 archivos SQL originales del historial de migraciones para dejar una única definición del esquema.

## Pendiente

### Configurar OAuth de Google y Supabase para el dominio final
- Definir el dominio final de despliegue.
- Configurar las Redirect URLs correctas en Supabase y en Google Cloud Console.
- Actualmente este paso aún no está definido.
