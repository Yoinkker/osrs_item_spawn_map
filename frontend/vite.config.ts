import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { type Plugin, defineConfig } from "vite";

const REPO_ROOT = resolve(fileURLToPath(import.meta.url), "../..");
const SPAWN_DATA_PATH = join(REPO_ROOT, "data/spawn_items.json");
const ICONS_DIR = join(REPO_ROOT, "data/icons");

const ICON_MIME_TYPES: { [ext: string]: string } = {
  png: "image/png",
  gif: "image/gif",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
};

function spawnDataPlugin(): Plugin {
  return {
    name: "spawn-data",
    configureServer(server) {
      server.middlewares.use("/spawn_items.json", (_req, res) => {
        try {
          const body = readFileSync(SPAWN_DATA_PATH);
          res.setHeader("Content-Type", "application/json");
          res.end(body);
        } catch {
          res.statusCode = 404;
          res.end("spawn_items.json not found - run the scraper first");
        }
      });
    },
    generateBundle() {
      this.emitFile({
        type: "asset",
        fileName: "spawn_items.json",
        source: readFileSync(SPAWN_DATA_PATH),
      });
    },
  };
}

function iconAssetPlugin(): Plugin {
  return {
    name: "spawn-icons",
    configureServer(server) {
      server.middlewares.use("/icons", (req, res, next) => {
        const urlPath = req.url?.split("?")[0] ?? "";
        const rel = decodeURIComponent(urlPath.replace(/^\/+/, ""));
        if (!rel || rel.includes("..")) {
          res.statusCode = 400;
          res.end("invalid icon path");
          return;
        }
        const filePath = join(ICONS_DIR, rel);
        if (
          !filePath.startsWith(ICONS_DIR) ||
          !existsSync(filePath) ||
          !statSync(filePath).isFile()
        ) {
          next();
          return;
        }
        const ext = rel.split(".").pop()?.toLowerCase() ?? "";
        const type = ICON_MIME_TYPES[ext] ?? "application/octet-stream";
        res.setHeader("Content-Type", type);
        res.setHeader("Cache-Control", "public, max-age=604800");
        res.end(readFileSync(filePath));
      });
    },
    generateBundle() {
      if (!existsSync(ICONS_DIR)) {
        if (process.env.REQUIRE_VITE_WORKER_URL === "1") {
          throw new Error("data/icons missing, run pnpm bundle:icons before production build");
        }
        return;
      }
      const names = readdirSync(ICONS_DIR).filter((name) =>
        statSync(join(ICONS_DIR, name)).isFile(),
      );
      if (process.env.REQUIRE_VITE_WORKER_URL === "1" && names.length === 0) {
        throw new Error("data/icons is empty, run pnpm bundle:icons before production build");
      }
      for (const name of names) {
        const filePath = join(ICONS_DIR, name);
        this.emitFile({
          type: "asset",
          fileName: `icons/${name}`,
          source: readFileSync(filePath),
        });
      }
    },
  };
}

export default defineConfig(({ command }) => {
  if (
    command === "build" &&
    process.env.REQUIRE_VITE_WORKER_URL === "1" &&
    !process.env.VITE_WORKER_URL?.trim()
  ) {
    throw new Error("VITE_WORKER_URL must be set for production deploy builds");
  }

  return {
    plugins: [spawnDataPlugin(), iconAssetPlugin()],
    server: {
      port: 5173,
      proxy: {
        "/api": "http://localhost:8787",
        "/tile-proxy": "http://localhost:8787",
      },
    },
    build: {
      outDir: "dist",
      emptyOutDir: true,
    },
    test: {
      include: ["src/**/*.test.ts"],
    },
  };
});
