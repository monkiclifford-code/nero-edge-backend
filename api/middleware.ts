import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context";
import { env } from "./lib/env";

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
});

export const createRouter = t.router;
export const publicQuery = t.procedure;

// EA Webhook procedure — validates secret token from EA WebRequest()
export const eaWebhook = t.procedure.use(async ({ ctx, next }) => {
  const authHeader = ctx.req.headers.get("x-ea-secret");
  if (!authHeader || authHeader !== env.eaSecret) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Invalid or missing EA secret",
    });
  }
  return next({ ctx });
});
