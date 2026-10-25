import { mkdir, readFile, writeFile } from "node:fs/promises";
import { parseEntries, encodeTitle } from "../_lib/subscription.js";

const UPSTREAM_BASE =
  "https://raw.githubusercontent.com/igareck/vpn-configs-for-russia/main/";
const OUTPUT_DIR = new URL("../dist/", import.meta.url);
const PROFILES = [
  {
    file: "desktop.txt",
    source: "BLACK_VLESS_RUS.txt",
    title: "🏴 BLACK Full",
  },
  {
    file: "mobile.txt",
    source: "BLACK_VLESS_RUS_mobile.txt",
    title: "🏴 BLACK Mobile",
  },
];

async function fetchProfile(profile) {
  const response = await fetch(new URL(profile.source, UPSTREAM_BASE), {
    headers: { "User-Agent": "vless-rus-subscription/1.0" },
    signal: AbortSignal.timeout(8000),
  });

  if (!response.ok) {
    throw new Error(`${profile.source}: upstream returned HTTP ${response.status}`);
  }

  const entries = parseEntries(await response.text());
  if (entries.length === 0) {
    throw new Error(`${profile.source}: upstream has no supported proxy links`);
  }

  const title = encodeTitle(`${profile.title} (${entries.length})`);
  return [
    `#profile-title: ${title}`,
    "#profile-update-interval: 1",
    ...entries,
    "",
  ].join("\n");
}

await mkdir(OUTPUT_DIR, { recursive: true });

for (const profile of PROFILES) {
  const content = await fetchProfile(profile);
  await writeFile(new URL(profile.file, OUTPUT_DIR), content, "utf8");
  console.log(`Generated ${profile.file}`);
}

const index = await readFile(new URL("../public/index.html", import.meta.url), "utf8");
await writeFile(new URL("index.html", OUTPUT_DIR), index, "utf8");
