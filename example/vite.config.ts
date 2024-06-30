import path from "node:path";
import { defineConfig } from "vite";
import solid from "vite-plugin-solid";
import solidFSR from "vite-plugin-solid-fsr";

export default defineConfig({
  server: {
    port: 3000,
  },
  resolve: {
    alias: {
      "~": path.join(__dirname, "src"),
    },
  },
  plugins: [
    solid({ extensions: [".jsx", ".tsx"] }),
    solidFSR(),
  ]
});
