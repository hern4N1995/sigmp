# MIGRATION_LOG

Registro cronológico del progreso de la migración fuera de Lovable.

## Hecho

### 2026-08-28 — Filtros integrados en gráficos
- Los filtros de área y mes ahora están ubicados dentro de sus gráficos correspondientes, manteniendo su aplicación conjunta sobre las métricas.

### 2026-08-28 — Estabilidad de filtros de estadísticas
- Se cargan todas las áreas del catálogo, incluso las que todavía no tienen solicitudes.
- Se reservó el espacio de la barra vertical para evitar movimientos del header, footer y contenido al abrir los desplegables.

### 2026-08-28 — Filtros en estadísticas
- Se agregaron filtros por área y mes en la vista administrativa de estadísticas.
- Los filtros se aplican a todos los gráficos y al promedio de tiempo de resolución.

### 2026-08-28 — Eliminación administrativa de usuarios
- Se agregó la función RPC `eliminar_usuario(UUID)`, restringida a administradores y protegida contra autoeliminación.
- La pantalla de usuarios ahora ofrece acciones con sólo los iconos de lápiz y X, con confirmación antes de eliminar.

### 2026-08-28 — Formato de fecha y carga de área
- El listado administrativo muestra la columna `FECHA / HORA` en formato de 24 horas.
- La vista administrativa y el formulario de nueva solicitud resuelven el área desde `area_id`, conservando el texto anterior como fallback.

### 2026-08-28 — Historial reducido y eliminación de canceladas
- `mis-solicitudes.tsx` ahora consulta sólo las cuatro solicitudes más recientes, ordenadas por fecha descendente.
- Se agregó la migración `20260828000005_empleados_eliminar_canceladas.sql` con una policy que permite a cada empleado eliminar únicamente sus propias solicitudes en estado `cancelado`.
- Se agregó confirmación y eliminación desde el listado del empleado; las solicitudes `visto` no tienen esta acción porque se eliminan automáticamente.

### 2026-08-28 — Detalle administrativo y borrado de solicitudes vistas
- Se completó el detalle de sólo lectura del administrador con empleado, área, descripción completa, fechas, motivo de cancelación, responsable y colaborador.
- Se agregó `20260828000004_borrar_solicitudes_vistas.sql`, que elimina automáticamente una solicitud al pasar de `cancelado` a `visto` mediante un trigger `AFTER UPDATE` `SECURITY DEFINER`.
- El listado administrativo vuelve a consultar los datos después de actualizar el estado; la policy de borrado de administradores no interviene en el trigger.

### 2026-08-28 — Detalle y correcciones en solicitudes del empleado
- El botón “Cancelar” sólo aparece para solicitudes `en_espera` o `en_proceso` creadas durante el día actual; no aparece para `finalizado`, `cancelado` ni `visto`.
- Se agregó un detalle de sólo lectura con la información completa de cada solicitud y se protegieron los textos largos contra desbordes.

### 2026-08-28 — Permiso para cancelar solicitudes con motivo
- Se agregó la migración `20260828000003_grant_admin_update_function.sql` para otorgar `EXECUTE` a `authenticated` sobre `admin_puede_actualizar_solicitud(UUID, TEXT)`.
- La policy de cancelación de empleados permanece independiente; el permiso evita que la evaluación de la policy administrativa bloquee cancelaciones legítimas.

### 2026-08-28 — Protección de solicitudes canceladas
- Se agregó `visto` al estado de solicitudes y una protección de base de datos que impide que una solicitud cancelada vuelva a `en_proceso` o `finalizado`.
- El botón de acción administrativa de una solicitud cancelada la marca como `visto`, sin abrir la asignación de colaborador.
- Las métricas contemplan `cancelado` y `visto` como estados no atendidos; sólo `finalizado` participa del promedio de resolución.

### 2026-08-28 — Cancelación de solicitudes por empleados
- Se agregó la migración `20260828000001_cancelacion_solicitudes.sql` con el estado `cancelado`, el motivo de cancelación y una policy para cancelar solicitudes propias creadas durante el día actual.
- Los empleados pueden cancelar sus solicitudes del día indicando un motivo obligatorio; administración visualiza el motivo en el detalle.

### 2026-08-28 — Asignación de responsables y colaboradores en solicitudes
- Se agregó la migración `20260828000000_asignacion_solicitudes.sql` con `asignado_a`, `colaborador_id` y asignación automática del responsable al primer cambio desde `en_espera`.
- La vista administrativa muestra responsable y colaborador, permite filtrar las solicitudes asignadas al administrador logueado y ofrece un colaborador opcional al finalizar.
- La policy existente de UPDATE para administradores ya permite escribir `colaborador_id` porque cubre la fila completa.

### 2026-08-27 — Flujo de recuperación de contraseña
- Se agregó el enlace “¿Olvidaste tu contraseña?” debajo del formulario de login.
- Se crearon las rutas `/recuperar-password` y `/actualizar-password` con integración a Supabase Auth.
- Ambos formularios incluyen estados de carga, error y éxito para guiar al usuario durante la recuperación.

### 2026-08-19 — Catálogo de áreas y selección por combobox
- Se creó la migración `20260819000000_create_areas.sql` con el catálogo oficial de áreas, RLS de lectura para usuarios autenticados y la relación `profiles.area_id`.
- El formulario de completar perfil ahora carga las áreas desde Supabase, permite buscarlas sin distinguir mayúsculas ni acentos y guarda el UUID seleccionado.
- La vista de perfil muestra `nombre_corto`, manteniendo el campo `area` por compatibilidad hacia atrás.

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
