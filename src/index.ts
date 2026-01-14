import { Effect } from "effect";
import { NodeRuntime } from "@effect/platform-node";
import { loadConfig } from "./config.js";
import { createStore } from "./store.js";
import { createApp } from "./app.js";

const program = Effect.gen(function* (_) {
  const config = yield* _(loadConfig);
  const store = createStore();
  const app = createApp({ config, store });

  yield* _(Effect.tryPromise(() => app.listen({ port: config.port, host: "0.0.0.0" })));
});

NodeRuntime.runMain(program);
