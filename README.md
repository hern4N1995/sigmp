# Production Support Hub

Perfecto. Antes del PRD, dejo un breve resumen de lo que se va a construir y los únicos puntos que quedaron implícitos.

Resumen

Se desarrollará un sitio web interno para el Ministerio de Producción que permitirá a los empleados registrar solicitudes de soporte técnico al Área de Sistemas.

Existirán dos roles:

Empleado: inicia sesión, registra una solicitud y puede ver el estado de la misma.

Administrador (Área de Sistemas): recibe las solicitudes, las administra, cambia su estado a finalizado y visualiza estadísticas del servicio.

El sitio tendrá un diseño moderno, minimalista, completamente responsive, con modo oscuro por defecto, modo claro opcional y una paleta de colores basada en tonos verdes.

Puntos asumidos (para evitar dejar huecos)

Como no se especificaron durante la conversación, se dejan como requisitos abiertos para que Lovable los implemente de la forma más conveniente:

Los administradores podrán crear usuarios manualmente (correo + contraseña).

Los usuarios autenticados mediante Google podrán acceder automáticamente.

Las estadísticas serán por día y estado de los pedidos.

No se incluye envío de correos electrónicos (solo notificaciones dentro del sistema).

No se incluye panel de superadministrador ni gestión avanzada de permisos.

PRD PARA LOVABLE

1. Rol del Asistente (Meta Prompting)

Eres un diseñador/desarrollador experto en UI/UX y Mobile-First, centrado en la estética, conversión y experiencia visual.

Debes construir un sitio web moderno utilizando las mejores prácticas de React, Vite y Tailwind CSS, priorizando una excelente experiencia de usuario, interfaces limpias y un código organizado y escalable.

2. Descripción General y Visión

Desarrollar un sistema web interno para el Ministerio de Producción destinado a la gestión de solicitudes de soporte técnico realizadas por los empleados hacia el Área de Sistemas.

El objetivo del sistema es centralizar todos los pedidos técnicos para mejorar el seguimiento, reducir tiempos de respuesta y disponer de estadísticas del trabajo realizado.

Usuarios

Empleado

Podrá:

Iniciar sesión.

Completar sus datos.

Crear solicitudes de soporte.

Ver el estado de sus solicitudes.

Administrador (Área de Sistemas)

Podrá:

Iniciar sesión.

Visualizar todas las solicitudes.

Gestionarlas.

Cambiar su estado.

Marcar solicitudes como finalizadas.

Consultar estadísticas.

Objetivo principal

Que cualquier empleado pueda registrar una incidencia informática de forma sencilla y que el Área de Sistemas pueda administrarlas desde un único panel.

3. Stack y Restricciones Técnicas

Frontend

React

Vite

Tailwind CSS

Diseño Mobile First

Componentes modernos

Diseño totalmente Responsive

Backend

Supabase

Utilizar:

Base de datos PostgreSQL

Authentication

Base de datos relacional

Métodos de autenticación

Login con Google

Login mediante correo y contraseña

Los administradores podrán crear usuarios internos con correo y contraseña.

No se requiere autenticación adicional.

4. Flujo de Usuario y Estructura de Navegación

Página 1 — Login

Pantalla inicial.

Debe permitir:

Iniciar sesión con Google.

Iniciar sesión mediante correo y contraseña.

Interfaz limpia y moderna.

Página 2 — Perfil del usuario

La primera vez que ingrese deberá completar:

Nombre

Apellido

DNI

Área o dependencia

Una vez guardados los datos accederá al sistema.

Página 3 — Nueva Solicitud

Formulario para crear un pedido.

Campos:

Nombre (autocompletado)

Apellido (autocompletado)

Área (autocompletado)

Motivo del pedido

Descripción del problema

Nivel de urgencia

Selector:

Urgente

Normal

Botón:

Enviar solicitud

Al finalizar deberá mostrarse un mensaje indicando:

"Su solicitud fue enviada correctamente."

La solicitud quedará con estado:

En espera

Página 4 — Mis Solicitudes

El empleado podrá visualizar todas sus solicitudes.

Cada tarjeta mostrará:

Fecha

Estado

Nivel de urgencia

Motivo

Estados posibles:

En espera

En proceso

Finalizado

Panel Administrador

Visible únicamente para usuarios con rol Administrador.

Debe contener:

Dashboard

Indicadores:

Cantidad de pedidos del día

Pedidos pendientes

Pedidos finalizados

Tiempo promedio de resolución

Total histórico de solicitudes

Tabla de solicitudes

Listado completo con filtros.

Columnas:

Fecha

Empleado

Área

Motivo

Urgencia

Estado

Acciones:

Ver detalle

Cambiar estado

Marcar como finalizado

Estadísticas

Mostrar gráficos con información como:

Solicitudes por día

Solicitudes por área

Cantidad de urgentes

Cantidad de normales

Solicitudes resueltas

Solicitudes pendientes

Tiempo promedio de resolución

Notificaciones

Cuando un empleado cree una nueva solicitud:

El administrador deberá visualizar una notificación dentro del sistema indicando que existe un nuevo pedido pendiente.

5. Funcionalidades Clave

Empleados

Login con Google

Login con correo y contraseña

Completar perfil

Crear solicitudes

Ver historial

Consultar estado de cada solicitud

Administradores

Login

Panel administrativo

Gestión completa de solicitudes

Cambio de estados

Finalizar solicitudes

Visualización de estadísticas

Recepción de notificaciones internas

Creación de usuarios internos

6. Lineamientos de Diseño UI/UX

El diseño debe ser moderno, profesional y minimalista.

Estilo

Inspirado en dashboards modernos.

Debe transmitir simplicidad y orden.

Paleta

Color principal:

Verde

Colores secundarios:

Grises oscuros

Fondos:

Modo oscuro predominante.

Debe existir opción para cambiar a modo claro.

Diseño

Mobile First

Totalmente Responsive

Excelente UX/UI

Componentes modernos

Tarjetas con sombras suaves

Bordes redondeados

Iconografía limpia

Animaciones sutiles

Navegación intuitiva

Experiencia

La creación de solicitudes debe poder realizarse en pocos pasos.

Toda la información importante debe encontrarse visible sin complicaciones.

El panel administrativo debe priorizar la rapidez para gestionar solicitudes.

7. Alcance del Proyecto (Scope)

Incluido

Login con Google

Login mediante correo y contraseña

Creación de usuarios por administradores

Gestión de perfiles

Formulario de solicitudes

Historial de solicitudes

Panel administrativo

Dashboard con estadísticas

Cambio de estados

Finalización de solicitudes

Notificaciones internas

Responsive Design

Dark Mode

Light Mode

Excluido

Aplicación móvil nativa

Envío de correos electrónicos

Integraciones con WhatsApp

Chat interno

Sistema de tickets con múltiples técnicos asignados

Firma digital

Gestión documental

Integraciones con sistemas externos

Requisitos adicionales para Lovable

Roles

Implementar únicamente dos roles:

Empleado

Administrador

Aplicar control de acceso para que únicamente los administradores puedan acceder al Dashboard, estadísticas y gestión de solicitudes.

Base de datos (Supabase)

Se recomienda una estructura con las siguientes tablas:

profiles

id

nombre

apellido

dni

area

rol

email

solicitudes

id

usuario_id

motivo

descripcion

urgencia

estado

fecha_creacion

fecha_finalizacion

Estados permitidos

En espera

En proceso

Finalizado

Seguridad

Configurar Row Level Security (RLS):

Los empleados solo podrán visualizar y gestionar sus propias solicitudes.

Los administradores podrán visualizar y administrar todas las solicitudes.

Solo los administradores podrán crear usuarios internos y cambiar el estado de las solicitudes.

Este PRD está listo para copiar y pegar en Lovable como superprompt. Proporciona una especificación suficientemente detallada para generar una primera versión funcional del sistema de mesa de ayuda interna del Ministerio de Producción.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://green-desk-helper.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/fe6cb6bd-244a-4cbc-8618-c51d90a5f619).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
