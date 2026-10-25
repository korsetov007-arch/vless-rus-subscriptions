import assert from "node:assert/strict";
import test from "node:test";
import { dedupeKey, encodeTitle, parseEntries, serveSubscription } from "../_lib/subscription.js";

function stubRuntime(fetchImpl) {
  globalThis.caches = { default: { match: async () => undefined, put: async () => {} } };
  globalThis.fetch = fetchImpl;
}

const sourceUrl = "https://raw.githubusercontent.com/example/list.txt";

test("returns a text/plain subscription with base64 title, headers and supported links", async () => {
  stubRuntime(
    async () =>
      new Response(
        [
          "# profile-title: upstream",
          "",
          "vless://id@example.com:443?security=tls&fp=chrome#A",
          "trojan://pw@example.org:443#B",
          "hysteria2://pw@example.net:443?sni=x#C",
          "http://ignored.example",
          "",
        ].join("\n"),
      ),
  );

  const response = await serveSubscription(new Request("https://example.pages.dev/mobile"), sourceUrl, {
    title: "🏴 BLACK Mobile",
  });

  const expectedTitle = encodeTitle("🏴 BLACK Mobile (3)");
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "text/plain; charset=utf-8");
  assert.equal(response.headers.get("profile-title"), expectedTitle);
  assert.equal(response.headers.get("profile-update-interval"), "1");
  assert.equal(response.headers.get("cache-control"), "public, max-age=60, s-maxage=60");
  assert.equal(
    await response.text(),
    [
      `#profile-title: ${expectedTitle}`,
      "#profile-update-interval: 1",
      "vless://id@example.com:443?security=tls&fp=chrome#A",
      "trojan://pw@example.org:443#B",
      "hysteria2://pw@example.net:443?sni=x#C",
      "",
    ].join("\n"),
  );
});

test("title is ASCII-safe base64 of UTF-8 and decodes back", () => {
  const encoded = encodeTitle("🏴 BLACK");
  assert.match(encoded, /^base64:[A-Za-z0-9+/=]+$/);
  const bytes = Uint8Array.from(atob(encoded.slice(7)), (c) => c.charCodeAt(0));
  assert.equal(new TextDecoder().decode(bytes), "🏴 BLACK");
});

test("dedupe drops entries that differ only by fp and parameter order", () => {
  const text = [
    "vless://id@h:443?a=1&b=2&fp=chrome#N",
    "vless://id@h:443?b=2&a=1&fp=firefox#N",
    "vless://id@h:443?a=1&b=2&fp=ios#N",
    "vless://id@h:443?a=1&b=3&fp=chrome#N",
  ].join("\n");

  assert.equal(parseEntries(text).length, 2);
  assert.equal(parseEntries(text, { dedupe: false }).length, 4);
  assert.equal(dedupeKey("vless://id@h:443?a=1&fp=x#N"), dedupeKey("vless://id@h:443?fp=y&a=1#M"));
});

test("?full=1 keeps every variant", async () => {
  stubRuntime(
    async () =>
      new Response("vless://id@h:443?fp=chrome#N\nvless://id@h:443?fp=firefox#N\n"),
  );

  const full = await serveSubscription(new Request("https://example.pages.dev/mobile?full=1"), sourceUrl, {
    title: "T",
  });
  assert.equal((await full.text()).split("\n").filter((l) => l.startsWith("vless://")).length, 2);

  const deduped = await serveSubscription(new Request("https://example.pages.dev/mobile"), sourceUrl, {
    title: "T",
  });
  assert.equal((await deduped.text()).split("\n").filter((l) => l.startsWith("vless://")).length, 1);
});

test("reports an upstream HTTP error instead of returning an empty subscription", async () => {
  stubRuntime(async () => new Response("unavailable", { status: 503 }));

  const response = await serveSubscription(new Request("https://example.pages.dev/mobile"), sourceUrl, {
    title: "T",
  });

  assert.equal(response.status, 502);
  assert.match(await response.text(), /HTTP 503/);
});

test("reports an error when upstream has no supported links", async () => {
  stubRuntime(async () => new Response("# only comments\nhttp://nope\n"));

  const response = await serveSubscription(new Request("https://example.pages.dev/desktop"), sourceUrl, {
    title: "T",
  });
  assert.equal(response.status, 502);
});
