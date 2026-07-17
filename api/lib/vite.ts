import type { Hono } from "hono";
import type { HttpBindings } from "@hono/node-server";
import fs from "fs";
import path from "path";

type App = Hono<{ Bindings: HttpBindings }>;

export function serveStaticFiles(app: App) {
  const distPath = path.resolve(import.meta.dirname, "../../dist/public");

  app.use("*", async (c, next) => {
    const url = new URL(c.req.url);
    const pathname = url.pathname;

    // Skip API routes
    if (pathname.startsWith("/api/")) {
      return next();
    }

    // For exact file requests, try to serve the file
    const relativePath = pathname === "/" ? "index.html" : pathname.slice(1);
    const filePath = path.resolve(distPath, relativePath);

    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      const ext = path.extname(filePath);
      const contentTypeMap: Record<string, string> = {
        ".html": "text/html",
        ".js": "application/javascript",
        ".css": "text/css",
        ".json": "application/json",
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".svg": "image/svg+xml",
        ".ico": "image/x-icon",
      };
      const content = fs.readFileSync(filePath);
      return c.body(content, 200, {
        "Content-Type": contentTypeMap[ext] || "application/octet-stream",
      });
    }

    // For all other routes, serve index.html (SPA fallback)
    const accept = c.req.header("accept") ?? "";
    if (accept.includes("text/html") || pathname.includes("/")) {
      const indexPath = path.resolve(distPath, "index.html");
      const content = fs.readFileSync(indexPath, "utf-8");
      return c.html(content);
    }

    return next();
  });
}
