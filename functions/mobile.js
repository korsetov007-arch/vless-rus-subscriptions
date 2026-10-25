import { serveSubscription } from "../_lib/subscription.js";

const SOURCE_URL =
  "https://raw.githubusercontent.com/igareck/vpn-configs-for-russia/main/BLACK_VLESS_RUS_mobile.txt";

export function onRequestGet({ request }) {
  return serveSubscription(request, SOURCE_URL);
}
