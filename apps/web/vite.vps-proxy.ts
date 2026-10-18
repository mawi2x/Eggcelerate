import { readFileSync } from "node:fs";
import path from "node:path";
import type { Plugin, ProxyOptions, ServerOptions } from "vite";

const sessionCookie = "egg_session";
const localSessionCookie = "egg_vps_dev_session";

export function vpsDevelopment(): { plugin: Plugin; server: ServerOptions } {
  const target = new URL(
    process.env.EGG_VPS_API_TARGET ?? "https://4.193.224.4",
  );
  if (
    target.protocol !== "https:" ||
    target.username ||
    target.password ||
    target.pathname !== "/" ||
    target.search ||
    target.hash
  ) {
    throw new Error(
      "EGG_VPS_API_TARGET must be an HTTPS origin without credentials.",
    );
  }
  const localOrigin = "https://127.0.0.1:5174";
  const tlsDirectory = path.resolve(
    import.meta.dirname,
    "../../infrastructure/https/private",
  );
  const proxy: ProxyOptions = {
    target: target.origin,
    changeOrigin: true,
    secure: true,
    cookieDomainRewrite: "",
    headers: { origin: target.origin, referer: `${target.origin}/` },
    configure(instance) {
      instance.on("proxyReq", (outgoing, incoming) => {
        // Cookies do not isolate localhost ports. Never send the local Docker
        // session to the VPS or overwrite it with a development VPS login.
        const value = incoming.headers.cookie
          ?.split(";")
          .map((entry) => entry.trim())
          .find((entry) => entry.startsWith(`${localSessionCookie}=`))
          ?.slice(localSessionCookie.length + 1);
        outgoing.removeHeader("cookie");
        if (value) outgoing.setHeader("cookie", `${sessionCookie}=${value}`);
      });
      instance.on("proxyRes", (incoming) => {
        const cookies = incoming.headers["set-cookie"];
        if (cookies) {
          incoming.headers["set-cookie"] = cookies.map((cookie) =>
            cookie.startsWith(`${sessionCookie}=`)
              ? `${localSessionCookie}=${cookie.slice(sessionCookie.length + 1)}`
              : cookie,
          );
        }
      });
    },
  };
  return {
    plugin: {
      name: "eggcelerate-vps-development",
      apply: "serve",
      configureServer(server) {
        server.middlewares.use((request, response, next) => {
          const pathname = request.url?.split("?", 1)[0] ?? "";
          if (!(pathname === "/readyz" || pathname.startsWith("/api/"))) {
            next();
            return;
          }
          const origin = request.headers.origin;
          const safe = ["GET", "HEAD", "OPTIONS"].includes(
            request.method ?? "GET",
          );
          // Check the browser origin BEFORE rewriting it for the upstream API.
          // Mutations still require the real VPS session and CSRF token.
          if (
            (origin && origin !== localOrigin) ||
            (!safe && origin !== localOrigin)
          ) {
            response.statusCode = 403;
            response.setHeader("Content-Type", "application/json");
            response.end(
              JSON.stringify({
                ok: false,
                error: {
                  code: "unauthorized",
                  message: "Use the local HTTPS development origin.",
                },
              }),
            );
            return;
          }
          next();
        });
      },
    },
    server: {
      host: "127.0.0.1",
      port: 5174,
      strictPort: true,
      https: {
        cert: readFileSync(
          process.env.EGG_DEV_TLS_CERT ?? path.join(tlsDirectory, "server.crt"),
        ),
        key: readFileSync(
          process.env.EGG_DEV_TLS_KEY ?? path.join(tlsDirectory, "server.key"),
        ),
      },
      cors: { origin: localOrigin },
      proxy: { "/api": proxy, "/readyz": proxy },
    },
  };
}
