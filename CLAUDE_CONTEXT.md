# Contexto del proyecto SIG

## Resumen

SIG es un portal interno para registrar y administrar solicitudes de soporte técnico del Ministerio de Producción de Corrientes. Los empleados crean y siguen sus tickets; el Área de Sistemas los gestiona desde un panel administrativo.

## Stack y arquitectura

- React 19 y TypeScript.
- Vite 8 como servidor de desarrollo y herramienta de compilación.
- TanStack Start/Router para aplicación y rutas.
- Nitro para generar el servidor SSR de producción.
- Tailwind CSS 4 y componentes basados en shadcn/ui/Radix.
- Supabase para autenticación, PostgreSQL, consultas y eventos en tiempo real.
- Zod para validaciones.

Rutas y componentes relevantes:

- `src/routes/_authenticated/admin/solicitudes.tsx`: gestión administrativa de tickets, filtros, búsqueda, estados, detalle y paginación.
- `src/routes/_authenticated/admin/estadisticas.tsx`: métricas, gráficos e informe CSV de tickets.
- `src/routes/_authenticated/admin/usuarios.tsx`: administración de cuentas y roles.
- `src/routes/_authenticated/completar-perfil.tsx`: completar y editar nombre, apellido, DNI y área.
- `src/routes/_authenticated/perfil.tsx`: consulta del perfil.
- `src/components/app-shell.tsx`: shell autenticado, encabezado y navegación.
- `src/integrations/supabase/`: clientes y tipos de Supabase.
- `supabase/migrations/`: migraciones SQL.

## Roles y funcionalidad

- **Empleado:** inicia sesión con Google o correo/contraseña, completa su perfil, crea solicitudes y consulta el estado/historial.
- **Administrador:** consulta y administra solicitudes, cambia estados, visualiza estadísticas e informes y gestiona usuarios/roles.
- Los estados de los tickets incluyen espera, en proceso, pausado, finalizado, cancelado y visto.

## Comportamiento reciente

Las mejoras recientes están en la rama `main`; el último commit observado es `ec6e234` (`correcciones`). El usuario indicó que ya subió las correcciones a GitHub.

- Los formularios de perfil validan nombre/apellido y DNI. La unicidad del DNI necesita la migración `supabase/migrations/20261002000000_dni_unico_profiles.sql`.
- La finalización del ticket guarda una resolución; revisar/aplicar `supabase/migrations/20260907000000_agregar_resolucion.sql` si la base remota aún no tiene esa columna.
- Estadísticas muestra etiquetas numéricas en gráficos e incluye informe de tickets filtrable por fechas, área, estado y urgencia, exportable a CSV. Tamaño de página del informe: 3 móvil y 10 escritorio.
- Usuarios muestra cards en móvil (3 por página) y tabla en escritorio (7 por página), con paginación.
- Solicitudes muestra 3 registros por página en móvil y 7 en escritorio; la paginación usa una ventana compacta con elipsis.
- El encabezado muestra el logo, “SIG”, un separador vertical y “Área de Sistemas / Ministerio de Producción”.

## Variables y seguridad

La aplicación espera configurar Supabase mediante `.env` (no versionar este archivo):

- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- Los identificadores de proyecto correspondientes.

No copiar valores de `.env`, claves, tokens ni datos de usuarios a documentación, prompts, commits o imágenes. Nunca incluir `SUPABASE_SERVICE_ROLE_KEY` en el cliente ni en una imagen pública. `.env.example` contiene placeholders y sirve de referencia.

## Desarrollo y compilación

Usar npm y el `package-lock.json`:

```bash
npm ci
npm run dev
npm run lint
npm run build
```

El build genera `.output/`; el entrypoint Node observado es `.output/server/index.mjs`. Revisar `package.json`, `vite.config.ts` y `README.md` si cambia el proceso de build o ejecución.

## Despliegue conocido en el NAS

El usuario ejecuta SIG en un NAS QNAP mediante Container Station. El contenedor se llama `sistema-tickets`, aparece en estado `running` y usa una imagen local etiquetada `sistema-tickets:arm`, importada mediante un archivo `.tar`.

**Este repositorio no contiene actualmente `Dockerfile` ni `docker-compose.yml`.** Por eso aún no se sabe cómo se construyó la imagen original. Antes de proponer cómo reemplazarla, confirmar:

1. Dónde está el Dockerfile o el proceso que produjo el `.tar`.
2. La arquitectura exacta del NAS/CPU (la etiqueta `arm` no basta para determinar ARM32 o ARM64).
3. Puertos, variables de entorno, volúmenes, red y política de reinicio del contenedor actual.
4. Que la nueva imagen se construya para la misma arquitectura y conserve la configuración necesaria.

No asumir que hacer `git pull`, reiniciar el contenedor o subir a GitHub actualiza la imagen que ya corre en el NAS. No borrar contenedores ni volúmenes persistentes sin confirmar previamente respaldos y configuración.

## Instrucciones de trabajo para Claude

- Antes de cambiar archivos, revisar `git status`, `README.md`, `package.json` y los módulos relacionados con la tarea.
- El árbol de trabajo estaba limpio en la última inspección. No descartar ni revertir cambios que el usuario haya hecho después.
- Hacer cambios pequeños y coherentes; respetar TypeScript, patrones existentes y la interfaz en español.
- Después de cambios de código, ejecutar la validación más pequeña que cubra el cambio y, cuando corresponda, `npm run build`.
- No desplegar al NAS, aplicar migraciones remotas, publicar ni crear commits sin petición explícita.
- Si una solicitud depende de la arquitectura o configuración del NAS, preguntar antes de asumirla.
