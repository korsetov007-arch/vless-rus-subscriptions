import assert from "node:assert/strict";
import test from "node:test";
import { serveSubscription } from "../_lib/subscription.js";

test("returns a Happ subscription with its expected content type and VLESS entries", async () => {
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
    "VLESS Desktop",
  );

  assert.equal(response.status, 200);
  assert.equal(
    await response.text(),
    "#profile-title: VLESS Desktop\n#profile-update-interval: 1\nvless://id@example.com:443#Тест\n",
  );
  assert.equal(response.headers.get("content-type"), "application/json");
  assert.equal(response.headers.get("profile-title"), "VLESS Desktop");
  assert.equal(response.headers.get("profile-update-interval"), "1");
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
    "VLESS Mobile",
  );

  assert.equal(response.status, 502);
  assert.match(await response.text(), /HTTP 503/);
});
