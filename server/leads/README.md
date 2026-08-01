# Сервис заявок (ampublishing-leads)

Принимает заявки со страницы «Услуги», хранит их в SQLite и отдаёт админке.
Нужен потому, что сайт статический (GitHub Pages) и сам ничего принять не может.

## Где живёт
- VPS `173.242.49.73`, каталог `/opt/ampublishing-leads`, порт `5062` (только localhost).
- systemd: `ampublishing-leads.service` (`systemctl restart ampublishing-leads`).
- nginx: текущий адрес `https://radio-api.helpushelpua.com/leads/…` → `127.0.0.1:5062`.
  Целевой понятный адрес: `https://leads.munister.com.ua/api/…` → `127.0.0.1:5062`.
  Готовый nginx-шаблон лежит рядом: `nginx-leads.munister.com.ua.conf`.
- База: `/opt/ampublishing-leads/database/leads.db`, ежедневный бэкап в
  `/opt/backups/ampublishing-leads` (cron `/etc/cron.d/ampublishing-leads-backup`, 7 копий).

## Секреты
`/opt/ampublishing-leads/.env` (chmod 600, в репозиторий не попадает):

    LEADS_ADMIN_TOKEN=…      токен для чтения заявок в админке
    CORS_ORIGINS=…           откуда принимаются заявки
    TELEGRAM_BOT_TOKEN=…     необязательно — уведомления о новых заявках
    TELEGRAM_CHAT_ID=…

Токен админки вводится в админке сайта и хранится в localStorage браузера —
**никогда** не коммить его в `public/content/integrations.json`, файл публичный.

## Ручки
| Метод | Путь | Доступ |
|---|---|---|
| POST | `/leads/api/leads` | публично (honeypot, лимит 5/час на IP, дубли 10 мин) |
| GET | `/leads/api/health` | публично |
| GET | `/leads/api/leads` | `X-Admin-Token` |
| PATCH | `/leads/api/leads/<id>` | `X-Admin-Token` |
| DELETE | `/leads/api/leads/<id>` | `X-Admin-Token` |
| GET | `/leads/api/leads.csv` | `X-Admin-Token` или `?token=` |
| GET | `/leads/api/stats` | `X-Admin-Token` |

## Обновление
    scp server/leads/app.py root@173.242.49.73:/opt/ampublishing-leads/app.py
    ssh root@173.242.49.73 systemctl restart ampublishing-leads

## Перенос на домен Munister

Для замены технического `radio-api…` на понятный адрес не нужен новый API или
перенос базы: это тот же сервис за новым HTTPS reverse proxy.

1. В DNS создать `A`-запись `leads.munister.com.ua` → `173.242.49.73`.
2. На VPS скопировать `nginx-leads.munister.com.ua.conf` в
   `/etc/nginx/sites-available/`, включить симлинком в `sites-enabled/`.
3. Выпустить сертификат: `certbot --nginx -d leads.munister.com.ua` и выполнить
   `nginx -t && systemctl reload nginx`.
4. В `/opt/ampublishing-leads/.env` добавить оба домена в `CORS_ORIGINS`:
   `https://ampublishing.org,https://www.ampublishing.org`.
5. В админке AM изменить только базовый адрес на
   `https://leads.munister.com.ua/api`; поле адреса формы синхронизируется
   автоматически с `/leads`.

После этого заявки, статусы, CSV и Telegram продолжают работать с той же SQLite
базой, а админка показывает их в разделе «Заявки».
