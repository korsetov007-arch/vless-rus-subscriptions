# VLESS-подписки для Happ и Nekoray

Cloudflare Pages Functions публикуют два URL-профиля:

- `/desktop` — `BLACK_VLESS_RUS.txt`
- `/mobile` — `BLACK_VLESS_RUS_mobile.txt`

Каждый endpoint при запросе берёт актуальный файл из `igareck/vpn-configs-for-russia` и отдаёт обычный список ссылок
(`Content-Type: text/plain; charset=utf-8`), как и сам исходный репозиторий.

- **Протоколы:** `vless`, `vmess`, `trojan`, `ss`, `hysteria2`/`hy2`, `tuic`. Остальное отбрасывается.
- **Дубли:** одна и та же нода в исходнике повторяется 4–8 раз с разным `fp=` (chrome/firefox/ios/…). Такие записи
  схлопываются, и ответ получается примерно в 3–4 раза короче (~11 КБ вместо ~30–41 КБ). Полный список без
  схлопывания: добавьте `?full=1` к ссылке.
- **Название профиля:** `🏴 BLACK Mobile (43)` / `🏴 BLACK Full (37)` — с актуальным числом серверов. Эмодзи передаются
  как `base64:` (так требует Happ), лимит Happ на название — 25 символов.
- **Автообновление:** ответ кэшируется на 60 секунд, клиент перезапрашивает подписку раз в час
  (`profile-update-interval: 1`). Пересборка Pages не нужна.
- При недоступности GitHub-файла endpoint вернёт HTTP 502, а не пустую подписку.

## Публикация через GitHub и Cloudflare Pages

1. Загрузите проект в GitHub-репозиторий.
2. Cloudflare: **Workers & Pages → Create application → Pages → Connect to Git**.
3. Preset **None**, каталог сборки `public`, команда сборки пустая.
4. После деплоя будет домен вида `https://<имя-проекта>.pages.dev`.
5. В Happ или Nekoray добавьте как **URL-подписку** (не как разовый импорт):
   - `https://<имя-проекта>.pages.dev/desktop`
   - `https://<имя-проекта>.pages.dev/mobile`

## Если Happ пишет «тайм-аут»

Если в браузере ссылка открывается, а в Happ нет, проверьте её с телефона по мобильным данным и по Wi‑Fi. Часть
российских операторов ограничивает соединения к IP Cloudflare; поможет свой домен через Cloudflare или раздача
подписки с другого хостинга (например, через GitHub Actions + GitHub Pages).

## Проверка

```sh
npm test
```
