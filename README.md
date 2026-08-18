# Portal de Soporte Técnico — Ministerio de Producción de Corrientes

Sistema web interno para la gestión centralizada de solicitudes de soporte técnico del Ministerio de Producción de Corrientes.

## 📋 Descripción General

Este portal permite a los empleados del Ministerio de Producción registrar solicitudes de soporte técnico y al Área de Sistemas administrarlas, mejorar el seguimiento y reducir tiempos de respuesta mediante un único panel de control integrado.

### Objetivo Principal

Centralizar todos los pedidos técnicos de los empleados para:
- Mejorar el seguimiento de incidencias
- Reducir tiempos de respuesta
- Disponer de estadísticas del servicio
- Optimizar la gestión de recursos del Área de Sistemas

## 👥 Roles del Sistema

### Empleado
- Iniciar sesión con Google o correo/contraseña
- Completar perfil (nombre, apellido, DNI, área)
- Crear solicitudes de soporte técnico
- Ver estado y historial de sus solicitudes
- Recibir notificaciones internas de cambios

### Administrador (Área de Sistemas)
- Acceso al panel administrativo
- Ver todas las solicitudes
- Gestionar y cambiar estados
- Marcar solicitudes como finalizadas
- Visualizar estadísticas y reportes
- Crear usuarios internos (correo + contraseña)

## 🛠️ Stack Técnico

### Frontend
- **React 19** — UI library
- **Vite 8** — Build tool y dev server
- **Tailwind CSS 4** — Styling
- **TanStack Router** — Client-side routing
- **TanStack React Query** — Data fetching & caching
- **Shadcn/ui** — Componentes UI modernos
- **React Hook Form + Zod** — Form management y validación

### Backend / SSR
- **Nitro** — SSR server (Node.js preset)
- **Supabase** — PostgreSQL database + Authentication

### Infraestructura
- **TypeScript** — Type safety
- **ESLint + Prettier** — Code quality

## ✨ Características

### Para Empleados
- ✅ Autenticación con Google
- ✅ Autenticación con correo/contraseña
- ✅ Completar y actualizar perfil
- ✅ Crear solicitudes de soporte
- ✅ Historial de solicitudes personales
- ✅ Seguimiento de estado en tiempo real
- ✅ Notificaciones internas

### Para Administradores
- ✅ Dashboard con KPIs
- ✅ Tabla de solicitudes con filtros y búsqueda
- ✅ Gestión de estados (En espera → En proceso → Finalizado)
- ✅ Estadísticas por período
- ✅ Gráficos de solicitudes
- ✅ Tiempo promedio de resolución
- ✅ Gestión de usuarios internos

### Diseño
- ✅ Mobile First y Responsive
- ✅ Modo oscuro (por defecto)
- ✅ Modo claro (opcional)
- ✅ Interfaz minimalista y moderna
- ✅ Paleta de colores con tonos verdes

## 🚀 Instalación y Setup

### Requisitos Previos
- Node.js 18+ (se recomienda 20+)
- npm o bun

### Clonar el Repositorio
```bash
git clone <repository-url>
cd sigmp
```

### Instalar Dependencias
```bash
npm install
# o si usas bun:
bun install
```

### Configurar Variables de Entorno
1. Copiar `.env.example` a `.env`:
```bash
cp .env.example .env
```

2. Llenar las credenciales de Supabase en `.env`:
```env
SUPABASE_PROJECT_ID="your_project_id"
SUPABASE_PUBLISHABLE_KEY="your_publishable_key"
SUPABASE_URL="https://your-project-id.supabase.co"
VITE_SUPABASE_PROJECT_ID="your_project_id"
VITE_SUPABASE_PUBLISHABLE_KEY="your_publishable_key"
VITE_SUPABASE_URL="https://your-project-id.supabase.co"
```

> ⚠️ **Importante**: Nunca comitear el archivo `.env` con credenciales reales. Se encuentra en `.gitignore`.

### Configurar Supabase

1. Crear un proyecto en [supabase.com](https://supabase.com)
2. Copiar las credenciales al archivo `.env`
3. Ejecutar las migraciones (ver sección "Base de Datos" abajo)

### Base de Datos

Las migraciones SQL están en `supabase/migrations/`. Se aplicarán automáticamente con `supabase cli` o directamente en el dashboard de Supabase.

#### Migraciones Disponibles
- `20260724142359_*.sql` — Crear tablas iniciales
- `20260724142418_*.sql` — Agregar campos adicionales
- Etc.

Para aplicarlas manualmente:
```bash
# Con Supabase CLI
supabase db push

# O copiar y ejecutar directamente en el SQL editor de Supabase
```

## 📦 Scripts Disponibles

```bash
# Desarrollo local
npm run dev

# Build para producción
npm run build

# Preview del build (SSR)
npm run preview

# Linting
npm run lint

# Formato de código
npm run format
```

### `npm run dev`
Inicia el servidor de desarrollo Vite con hot reload.

**URL**: [http://localhost:5173](http://localhost:5173)

### `npm run build`
Compila la aplicación para producción. Genera:
- Cliente compilado en `dist/`
- Servidor SSR (Nitro) en `.output/`

### `npm run preview`
Ejecuta el build previamente compilado en modo SSR.

## 🗂️ Estructura del Proyecto

```
sigmp/
├── src/
│   ├── components/          # Componentes React (UI + lógica)
│   │   ├── ui/             # Componentes base de Shadcn/ui
│   │   ├── app-shell.tsx   # Layout principal
│   │   └── ...
│   ├── routes/             # Rutas (TanStack Router)
│   │   ├── __root.tsx      # Root layout
│   │   ├── auth.tsx        # Página de login
│   │   ├── index.tsx       # Home/Dashboard
│   │   └── _authenticated/ # Rutas protegidas
│   ├── hooks/              # Custom React hooks
│   ├── integrations/       # Integraciones (Supabase)
│   │   └── supabase/
│   ├── lib/                # Utilidades y helpers
│   ├── styles.css          # Estilos globales
│   ├── router.tsx          # Configuración de rutas
│   ├── server.ts           # Entry point del servidor SSR
│   └── start.ts            # Entry point del cliente
├── supabase/
│   ├── config.toml         # Configuración de Supabase
│   └── migrations/         # Migraciones SQL
├── vite.config.ts          # Configuración de Vite
├── tsconfig.json           # TypeScript config
├── tailwind.config.js      # Tailwind CSS config
├── eslint.config.js        # ESLint rules
└── package.json
```

## 🔐 Autenticación

### Google OAuth
1. Configurar Google Cloud Console
2. Agregar Redirect URIs en Google Cloud y Supabase:
   - Desarrollo: `http://localhost:5173/auth/callback`
   - Producción: `https://tu-dominio.com/auth/callback`

### Correo y Contraseña
- Los usuarios pueden registrarse directamente en Supabase
- Los administradores pueden crear usuarios internos con credenciales

## 🚢 Despliegue

El proyecto está configurado para desplegar en:

### Vercel
El preset de Nitro está configurado para Node.js. Para desplegar en Vercel:
```bash
npm run build
vercel deploy
```

### Self-hosted (VPS/Servidor propio)
```bash
npm run build
# Copiar .output/ al servidor
cd .output
node server/index.mjs
```

### Otros Proveedores
Para cambiar el preset de Nitro:
- **Vercel**: `preset: "vercel"`
- **Node.js**: `preset: "node-server"` (actual)
- **Cloudflare**: `preset: "cloudflare"`

Actualizar en `vite.config.ts`.

## 📝 Variables de Entorno

Ver `.env.example` para la lista completa. Las variables críticas son:

```
SUPABASE_URL              # URL del proyecto Supabase
SUPABASE_PUBLISHABLE_KEY  # Clave pública de Supabase
VITE_SUPABASE_URL         # URL de Supabase (cliente)
VITE_SUPABASE_PUBLISHABLE_KEY  # Clave pública (cliente)
```

## 🐛 Desarrollo

### Hot Reload
Vite + TanStack Router soportan hot reload automático durante el desarrollo.

### TypeScript
El proyecto está completamente tipado. Ejecutar verificación:
```bash
npx tsc --noEmit
```

### Testing
Actualmente no hay tests configurados, pero está listo para integrar:
- Vitest (unit tests)
- Playwright (e2e tests)

## 📄 Licencia

Interno — Ministerio de Producción de Corrientes

## 👤 Contacto

Para consultas técnicas o feedback, contactar al Área de Sistemas.

---

**Última actualización**: Agosto 2026

**Estado**: En desarrollo (migración desde Lovable completada)
