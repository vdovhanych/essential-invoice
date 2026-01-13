import Fastify from "fastify";
import { Effect } from "effect";
import { NodeRuntime } from "@effect/platform-node";
import { loadConfig } from "./config.js";

const program = Effect.gen(function* (_) {
  const config = yield* _(loadConfig);
  const app = Fastify({ logger: true });

  app.get("/health", async () => ({ status: "ok" }));

  app.get("/config", async () => ({
    port: config.port,
    bankType: config.bankType,
    imapPollIntervalMinutes: config.imapPollIntervalMinutes
  }));

  await app.listen({ port: config.port, host: "0.0.0.0" });
});

NodeRuntime.runMain(program);
