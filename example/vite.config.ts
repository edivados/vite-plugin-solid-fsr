import { defineConfig } from "vite";
import solid from "vite-plugin-solid";
import routes from "vite-plugin-solid-fsr";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "~": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  plugins: [
    solid(),
    routes(),
  ]
});
