import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { nitro } from "nitro/vite";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [
    // TanStack Start must come before React, and it handles the Start/SSR wiring.
    tanstackStart(),
    // React plugin
    viteReact(),
    // Tailwind CSS
    tailwindcss(),
    // Nitro remains for the runtime server build in this setup.
    nitro({
      presets: ["vercel"],
    }),
  ],
  resolve: {
    alias: {
      // @ alias for src directory
      "@": path.resolve(__dirname, "./src"),
    },
    // Use Vite's native tsconfig paths resolution (replaces vite-tsconfig-paths plugin)
    tsconfigPaths: true,
  },
  define: {
    // Inject VITE_* environment variables
    ...(Object.keys(process.env).reduce((acc, key) => {
      if (key.startsWith("VITE_")) {
        acc[`process.env.${key}`] = JSON.stringify(process.env[key]);
      }
      return acc;
    }, {} as Record<string, string>)),
  },
});
