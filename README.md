# Серверная часть Telegram Web App для Drum Sequencer

Этот сервер предоставляет API для аутентификации пользователей Telegram, хранения их профилей и связывания с сохраненными паттернами.

## Установка

1. Установите необходимые зависимости:

```bash
npm install
```

2. Создайте файл `.env` в корневой директории сервера с следующими переменными:

```
# Настройки MongoDB
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/drummer?retryWrites=true&w=majority

# Настройки сервера
PORT=5001
NODE_ENV=development

# Настройки Telegram
TELEGRAM_BOT_TOKEN=your_telegram_bot_token_here
JWT_SECRET=your_jwt_secret_here
WEBAPP_URL=https://yourdomain.com/app/
```

## Запуск сервера

### Для разработки (с автоматической перезагрузкой при изменениях):

```bash
npm run dev
```

### Для продакшена:

```bash
npm start
```

## API Endpoints

### Аутентификация

- `POST /api/users/auth/telegram` - Аутентификация пользователя через Telegram WebApp
  - Body: `{ "initData": "..." }`
  - Response: `{ "token": "JWT_TOKEN", "user": {...} }`

### Профиль пользователя

- `GET /api/users/profile` - Получение информации о профиле пользователя (требует JWT токен)
  - Headers: `Authorization: Bearer JWT_TOKEN`
  - Response: `{ "user": {...} }`

## Telegram Бот

Бот предоставляет следующие команды:

- `/start` - Регистрация и вход в приложение
- `/help` - Показать справочное сообщение
- `/webapp` - Открыть Telegram Web App

## Интеграция с MongoDB

Сервер использует MongoDB для хранения:
- Профилей пользователей
- Сессий секвенсора, созданных пользователями

## Безопасность

- Проверка аутентичности данных Telegram при авторизации
- Защита API эндпоинтов с помощью JWT токенов
- Безопасное хранение данных пользователя 