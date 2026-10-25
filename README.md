# VLESS-подписки для Happ и Nekoray

Cloudflare Pages Functions публикуют два URL-профиля:

- `/desktop` — `BLACK_VLESS_RUS.txt`
- `/mobile` — `BLACK_VLESS_RUS_mobile.txt`

Каждый endpoint загружает актуальный файл из репозитория `igareck/vpn-configs-for-russia`, оставляет строки `vless://` и возвращает их в Base64 — в формате URI-подписки, который используют Happ и Nekoray. Ответ кэшируется на 60 секунд; после обновления исходного файла подписка обновится автоматически, без пересборки Pages.

## Публикация через GitHub и Cloudflare Pages

1. Создайте GitHub-репозиторий и загрузите в него все файлы этого проекта.
2. В Cloudflare откройте **Workers & Pages → Create application → Pages → Connect to Git** и подключите репозиторий.
3. Выберите preset **None**, укажите каталог сборки `public` и оставьте команду сборки пустой. Если Cloudflare предлагает использовать `wrangler.toml`, конфигурация уже задана.
4. После первого успешного деплоя Pages выдаст домен вида `https://<имя-проекта>.pages.dev`.
5. В Happ или Nekoray добавьте как URL-подписку один из адресов:
   - `https://<имя-проекта>.pages.dev/desktop`
   - `https://<имя-проекта>.pages.dev/mobile`

Обычный `GET` поддерживается; при ошибке исходного GitHub-файла endpoint вернёт HTTP 502, а не пустую подписку. Изменения в upstream-репозитории появляются по истечении кэша — обычно в течение минуты.

## Проверка

```sh
npm test
```
