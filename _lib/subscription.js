const CACHE_TTL_SECONDS = 60;

const responseHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Cache-Control": `public, max-age=${CACHE_TTL_SECONDS}, s-maxage=${CACHE_TTL_SECONDS}`,
  "Content-Type": "text/plain; charset=utf-8",
  "X-Content-Type-Options": "nosniff",
};

export async function serveSubscription(request, sourceUrl, profileTitle) {
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

  const body = [
    `#profile-title: ${profileTitle}`,
    "#profile-update-interval: 1",
    ...entries,
    "",
  ].join("\n");
  const response = new Response(body, { headers: responseHeaders });

  await cache.put(cacheKey, response.clone());
  return response;
}
