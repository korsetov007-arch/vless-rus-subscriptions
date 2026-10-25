const CACHE_TTL_SECONDS = 60;

const responseHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Cache-Control": `public, max-age=${CACHE_TTL_SECONDS}, s-maxage=${CACHE_TTL_SECONDS}`,
  "Content-Type": "text/plain; charset=utf-8",
  "X-Content-Type-Options": "nosniff",
};

function encodeBase64Utf8(value) {
  const bytes = new TextEncoder().encode(value);
  let binary = "";

  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }

  return btoa(binary);
}

export async function serveSubscription(request, sourceUrl) {
  const cache = caches.default;
  const cacheKey = new Request(new URL(request.url).toString(), { method: "GET" });
  const cachedResponse = await cache.match(cacheKey);

  if (cachedResponse) {
    return cachedResponse;
  }

  let upstreamResponse;
  try {
    upstreamResponse = await fetch(sourceUrl, {
      headers: { "User-Agent": "vless-rus-subscription/1.0" },
      cf: { cacheTtl: CACHE_TTL_SECONDS, cacheEverything: true },
    });
  } catch {
    return new Response("Could not fetch the upstream configuration.\n", {
      status: 502,
      headers: { ...responseHeaders, "Cache-Control": "no-store" },
    });
  }

  if (!upstreamResponse.ok) {
    return new Response(`Upstream returned HTTP ${upstreamResponse.status}.\n`, {
      status: 502,
      headers: { ...responseHeaders, "Cache-Control": "no-store" },
    });
  }

  const entries = (await upstreamResponse.text())
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.toLowerCase().startsWith("vless://"));

  if (entries.length === 0) {
    return new Response("The upstream configuration contains no VLESS links.\n", {
      status: 502,
      headers: { ...responseHeaders, "Cache-Control": "no-store" },
    });
  }

  const response = new Response(encodeBase64Utf8(`${entries.join("\n")}\n`), {
    headers: responseHeaders,
  });

  await cache.put(cacheKey, response.clone());
  return response;
}
