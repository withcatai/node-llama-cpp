import path from "node:path";
import {fileURLToPath} from "node:url";
import {defineConfig} from "vite";
import electron from "vite-plugin-electron/simple";
import react from "@vitejs/plugin-react";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// These modules won't be bundled as part of the Vite build of the Electron (main) side,
// but they'll be included in the final Electron app build inside the asar file.
// Performance and efficiency wise, this is absolutely fine and has no real drawbacks
const electronExternalModules = ["node-llama-cpp", "lifecycle-utils"];

// https://vitejs.dev/config/
export default defineConfig({
    esbuild: {
        target: "es2022"
    },
    optimizeDeps: {
        exclude: electronExternalModules,
        esbuildOptions: {
            target: "es2022"
        }
    },
    build: {
        outDir: path.join(__dirname, "dist"),
        target: "es2022"
    },
    root: path.join(__dirname, "src"),
    publicDir: path.join(__dirname, "public"),
    plugins: [
        react(),
        electron({
            main: {
                // Shortcut of `build.lib.entry`.
                entry: path.join(__dirname, "electron/index.ts"),
                onstart({startup}) {
                    if (process.env["ENABLE_INSPECT"] === "true")
                        return startup([".", "--inspect"]);

                    return startup(["."]);
                },
                vite: {
                    build: {
                        target: "es2022",
                        outDir: path.join(__dirname, "dist-electron"),
                        rollupOptions: {
                            external: electronExternalModules
                        }
                    }
                }
            },
            preload: {
                // Shortcut of `build.rollupOptions.input`.
                // Preload scripts may contain Web assets, so use the `build.rollupOptions.input` instead `build.lib.entry`.
                input: path.join(__dirname, "electron/preload.ts"),
                vite: {
                    build: {
                        target: "es2022",
                        outDir: path.join(__dirname, "dist-electron")
                    }
                }
            },
            // Polyfill the Electron and Node.js API for Renderer process.
            // If you want use Node.js in Renderer process, the `nodeIntegration` needs to be enabled in the Main process.
            // See 👉 https://github.com/electron-vite/vite-plugin-electron-renderer
            renderer: process.env.NODE_ENV === "test"
            // https://github.com/electron-vite/vite-plugin-electron-renderer/issues/78#issuecomment-2053600808
                ? undefined
                : {}
        })
    ]
});
