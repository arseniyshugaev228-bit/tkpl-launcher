# Сайт TKPL Launcher

```
html/       index.html — разметка
css/        style.css  — стили
js/         main.js    — анимации (Motion) и отправка формы
py/         server.py  — бэкенд на Flask: раздаёт сайт и шлёт отзывы на почту
downloads/  TKPL-Launcher.exe — файл, который скачивают с сайта
```

## Запуск

```
pip install -r py/requirements.txt
python py/server.py
```

Открыть https://arseniyshugaev228-bit.github.io/tkpl-launcher/

## Почта для отзывов

1. Скопируй `py/.env.example` в `py/.env`.
2. Создай пароль приложения Google: https://myaccount.google.com/apppasswords
   (нужна включённая двухэтапная аутентификация).
3. Вставь его в `SMTP_PASSWORD` и перезапусти сервер.

Все отзывы дополнительно сохраняются в `py/feedback.jsonl`, даже если письмо не ушло.

## Новая версия лаунчера

Пересобери exe и скопируй его в `downloads/TKPL-Launcher.exe` с заменой.
