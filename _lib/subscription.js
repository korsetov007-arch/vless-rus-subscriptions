const CACHE_TTL_SECONDS = 60;
const UPSTREAM_TIMEOUT_MS = 8000;

// Протоколы, которые понимают Happ / Nekoray и которые мы пропускаем в подписку.
const SUPPORTED_SCHEMES = ["vless", "vmess", "trojan", "ss", "hysteria2", "hy2", "tuic"];

const baseHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Content-Type": "text/plain; charset=utf-8",
  "X-Content-Type-Options": "nosniff",
};

const okHeaders = {
  ...baseHeaders,
  "Cache-Control": `public, max-age=${CACHE_TTL_SECONDS}, s-maxage=${CACHE_TTL_SECONDS}`,
};

function errorResponse(message, status = 502) {
  return new Response(`${message}\n`, {
    status,
    headers: { ...baseHeaders, "Cache-Control": "no-store" },
  });
}

// Заголовок профиля в Happ: UTF-8 (эмодзи, кириллица) передаётся как base64:<...>
// Лимит Happ на длину названия — 25 символов.
export function encodeTitle(title) {
  const bytes = new TextEncoder().encode(title);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return `base64:${btoa(binary)}`;
}

function hasSupportedScheme(line) {
  const match = /^([a-z0-9]+):\/\//i.exec(line);
  return match !== null && SUPPORTED_SCHEMES.includes(match[1].toLowerCase());
}

// Ключ для удаления дублей: одна и та же нода часто повторяется 4–8 раз,
// отличаясь только fingerprint (fp=chrome/firefox/ios/...). Убираем fp, имя и порядок параметров.
export function dedupeKey(line) {
  const hashIndex = line.indexOf("#");
  const withoutName = hashIndex === -1 ? line : line.slice(0, hashIndex);
  const queryIndex = withoutName.indexOf("?");
  if (queryIndex === -1) return withoutName;

  const base = withoutName.slice(0, queryIndex);
  const params = withoutName
    .slice(queryIndex + 1)
    .split("&")
    .filter((param) => param && !/^fp=/i.test(param))
    .sort();
  return `${base}?${params.join("&")}`;
}

export function parseEntries(text, { dedupe = true } = {}) {
  const seen = new Set();
  const entries = [];

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!hasSupportedScheme(line)) continue;

    if (dedupe) {
      const key = dedupeKey(line);
      if (seen.has(key)) continue;
      seen.add(key);
    }
    entries.push(line);
  }

  return entries;
}

// options: { title: string }  — название профиля без счётчика, например "🏴 BLACK Mobile"
export async function serveSubscription(request, sourceUrl, options = {}) {
  const profileBase = typeof options === "string" ? options : options.title ?? "Subscription";
  const url = new URL(request.url);
  // ?full=1 — отдать список без удаления дублей по fp
  const dedupe = url.searchParams.get("full") !== "1";

  const cache = caches.default;
  const cacheKey = new Request(url.toString(), { method: "GET" });
  const cachedResponse = await cache.match(cacheKey);
  if (cachedResponse) return cachedResponse;

  let upstreamResponse;
  try {
    upstreamResponse = await fetch(sourceUrl, {
      headers: { "User-Agent": "vless-rus-subscription/1.0" },
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      cf: { cacheTtl: CACHE_TTL_SECONDS, cacheEverything: true },
    });
  } catch {
    return errorResponse("Could not fetch the upstream configuration.");
  }

  if (!upstreamResponse.ok) {
    return errorResponse(`Upstream returned HTTP ${upstreamResponse.status}.`);
  }

  const entries = parseEntries(await upstreamResponse.text(), { dedupe });
  if (entries.length === 0) {
    return errorResponse("The upstream configuration contains no supported proxy links.");
  }

  const title = encodeTitle(`${profileBase} (${entries.length})`);
  const body = [
    `#profile-title: ${title}`,
    "#profile-update-interval: 1",
    ...entries,
    "",
  ].join("\n");

  const response = new Response(body, {
    headers: {
      ...okHeaders,
      "profile-title": title,
      "profile-update-interval": "1",
    },
  });

  await cache.put(cacheKey, response.clone());
  return response;
}
