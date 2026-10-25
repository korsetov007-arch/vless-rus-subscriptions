import assert from "node:assert/strict";
import test from "node:test";
import { serveSubscription } from "../_lib/subscription.js";

test("returns a base64 subscription containing only VLESS entries", async () => {
  globalThis.caches = {
    default: {
      match: async () => undefined,
      put: async () => {},
    },
  };
  globalThis.fetch = async () =>
    new Response(
      "# profile-title: test\n\nvless://id@example.com:443#Тест\nvmess://ignored\n",
    );

  const response = await serveSubscription(
    new Request("https://example.pages.dev/desktop"),
    "https://raw.githubusercontent.com/example/list.txt",
  );

  assert.equal(response.status, 200);
  assert.equal(
    Buffer.from(await response.text(), "base64").toString("utf8"),
    "vless://id@example.com:443#Тест\n",
  );
  assert.equal(response.headers.get("cache-control"), "public, max-age=60, s-maxage=60");
});

test("reports an upstream HTTP error instead of returning an empty subscription", async () => {
  globalThis.caches = {
    default: {
      match: async () => undefined,
      put: async () => {},
    },
  };
  globalThis.fetch = async () => new Response("unavailable", { status: 503 });

  const response = await serveSubscription(
    new Request("https://example.pages.dev/mobile"),
    "https://raw.githubusercontent.com/example/list.txt",
  );

  assert.equal(response.status, 502);
  assert.match(await response.text(), /HTTP 503/);
});
