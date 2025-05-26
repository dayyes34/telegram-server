# Руководство по управлению системой подписок RhythmCapsule

## 📋 Обзор системы

Система подписок RhythmCapsule включает в себя:
- **Планы подписок** - различные тарифы с разными возможностями
- **Подписки пользователей** - активные подписки с датами начала/окончания
- **Автоматическая проверка** - система уведомлений и деактивации
- **Платежная система** - интеграция с Telegram Payments

## 🛠️ Инструменты управления

### 1. Управление планами подписки

#### Просмотр всех планов
```bash
node scripts/manage-plans.js list
```

#### Деактивация плана
```bash
node scripts/manage-plans.js deactivate <plan_id>
```

#### Активация плана
```bash
node scripts/manage-plans.js activate <plan_id>
```

#### Изменение цены плана
```bash
node scripts/manage-plans.js update-price <plan_id> <price_in_kopecks>
```

#### Удаление плана (безопасно)
```bash
node scripts/manage-plans.js delete <plan_id>
```

#### Принудительное удаление плана
```bash
node scripts/manage-plans.js force-delete <plan_id>
```

#### Массовая очистка планов
```bash
# Показать планы, которые можно безопасно удалить
node scripts/cleanup-plans.js show-deletable

# Удалить все неактивные планы без подписок
node scripts/cleanup-plans.js inactive

# Удалить все тестовые планы
node scripts/cleanup-plans.js test
```

### 2. Просмотр подписок пользователей

#### Все активные подписки
```bash
node scripts/view-subscriptions.js active
```

#### Подписки, истекающие в ближайшие дни
```bash
node scripts/view-subscriptions.js expiring [количество_дней]
```

#### Статистика подписок
```bash
node scripts/view-subscriptions.js stats
```

### 3. Добавление новых планов

#### Создание нового плана
```bash
node scripts/add-new-plan.js
```

Или отредактируйте файл `scripts/add-new-plan.js` для создания своего плана.

### 4. Управление подписками пользователей

#### Просмотр подписок пользователя
```bash
node scripts/manage-user-subscriptions.js show <telegram_id_or_name>
```

#### Отмена подписки (мягкая отписка)
```bash
node scripts/manage-user-subscriptions.js cancel <subscription_id> [reason]
```

#### Немедленное завершение подписки
```bash
node scripts/manage-user-subscriptions.js terminate <subscription_id> [reason]
```

#### Продление подписки
```bash
node scripts/manage-user-subscriptions.js extend <subscription_id> <days>
```

#### Поиск пользователей
```bash
node scripts/manage-user-subscriptions.js search <query>
```

## 📊 Текущие планы подписки

1. **Стартовый** - 299₽/месяц
   - Доступ к премиум-упражнениям
   - Доступ к базе барабанщика
   - Работа с метрономом

2. **Профессиональный** - 699₽/3 месяца
   - Все функции Стартового
   - Сохранение неограниченного количества паттернов
   - Экспорт в MIDI и WAV

3. **Капсула Плюс** - 990₽/месяц
   - Все функции Профессионального
   - Доступ к эксклюзивным мастер-классам
   - Персональные консультации (1 в месяц)

4. **Премиум** - 1499₽/год
   - Все функции предыдущих планов
   - Приоритетная поддержка

## 🔄 Автоматические процессы

### Проверка подписок
Система автоматически:
- Проверяет истекшие подписки каждые 30 минут
- Отправляет уведомления за 3 дня до истечения
- Деактивирует истекшие подписки
- Обновляет статус пользователей

### Ручной запуск проверки
```bash
curl -X POST http://localhost:5001/api/subscriptions/check \
  -H "x-api-key: YOUR_ADMIN_API_KEY"
```

## 🎯 API Endpoints

### Публичные (без авторизации)
- `GET /api/payments/subscription-plans` - получить все активные планы
- `GET /api/payments/subscription-plans/:id` - получить конкретный план

### Требующие авторизации пользователя
- `GET /api/payments/subscriptions` - подписки пользователя
- `GET /api/payments/subscription-status` - статус подписки
- `GET /api/payments/current-subscription` - текущая активная подписка
- `POST /api/payments/create-payment` - создать платеж
- `PUT /api/payments/subscriptions/:id/cancel-auto-renew` - отключить автопродление

### Административные (требуют ADMIN_API_KEY)
- `GET /api/admin/users` - все пользователи с подписками
- `GET /api/admin/users/search?query=<search>` - поиск пользователей
- `GET /api/admin/users/:userId/subscriptions` - подписки пользователя
- `PUT /api/admin/subscriptions/:id/cancel` - отменить подписку (мягко)
- `PUT /api/admin/subscriptions/:id/terminate` - завершить подписку (немедленно)
- `PUT /api/admin/subscriptions/:id/extend` - продлить подписку
- `GET /api/admin/stats` - статистика подписок

## 💳 Платежная система

### Настройка Telegram Payments
1. Получите токен провайдера платежей в @BotFather
2. Добавьте в `.env`:
   ```
   TELEGRAM_TEST_PROVIDER_TOKEN=your_test_token
   TELEGRAM_PROVIDER_TOKEN=your_production_token
   ```

### Процесс оплаты
1. Пользователь выбирает план на frontend
2. Создается invoice через Telegram Bot API
3. Пользователь оплачивает через Telegram
4. Webhook обрабатывает успешный платеж
5. Создается подписка в базе данных
6. Пользователь получает уведомление

## 📈 Мониторинг и аналитика

### Ключевые метрики
- Общее количество пользователей
- Процент подписчиков
- Популярность планов
- Количество активных/истекших подписок

### Получение статистики
```bash
node scripts/view-subscriptions.js stats
```

## 📊 Где хранятся подписки

### Основные коллекции MongoDB

1. **subscriptions** - основная таблица подписок
2. **users** - пользователи с информацией о подписках  
3. **subscriptionplans** - планы подписок

### Связи между данными

```
User (пользователь)
├── subscriptions: [ObjectId] - массив всех подписок
├── currentSubscriptionId: ObjectId - текущая активная подписка
└── hasActiveSubscription: Boolean - флаг активной подписки

Subscription (подписка)
├── userId: ObjectId → User
├── planId: ObjectId → SubscriptionPlan
├── status: 'active' | 'expired' | 'cancelled'
├── startDate, endDate: Date
└── paymentHistory: [] - история платежей

SubscriptionPlan (план)
├── name, description, price, duration
└── isActive: Boolean
```

## 🔧 Структура базы данных

### Модель SubscriptionPlan
```javascript
{
  name: String,           // Название плана
  description: String,    // Описание
  price: Number,         // Цена в копейках
  currency: String,      // Валюта (RUB)
  duration: Number,      // Длительность в днях
  features: [String],    // Список функций
  isActive: Boolean      // Активен ли план
}
```

### Модель Subscription
```javascript
{
  userId: ObjectId,      // ID пользователя
  telegramUserId: Number, // Telegram ID
  planId: ObjectId,      // ID плана
  status: String,        // active/expired/cancelled
  startDate: Date,       // Дата начала
  endDate: Date,         // Дата окончания
  autoRenew: Boolean,    // Автопродление
  paymentHistory: []     // История платежей
}
```

### Модель User
```javascript
{
  telegramId: Number,           // Telegram ID
  firstName: String,            // Имя
  lastName: String,             // Фамилия
  subscriptions: [ObjectId],    // Массив подписок
  currentSubscriptionId: ObjectId, // Текущая подписка
  hasActiveSubscription: Boolean   // Флаг активной подписки
}
```

## 🚨 Устранение неполадок

### Проблемы с платежами
1. Проверьте токен провайдера в `.env`
2. Убедитесь, что webhook настроен правильно
3. Проверьте логи сервера на ошибки

### Проблемы с подписками
1. Запустите ручную проверку подписок
2. Проверьте соединение с MongoDB
3. Убедитесь, что сервис подписок запущен

### Отладка
```bash
# Просмотр логов сервера
tail -f logs/server.log

# Проверка статуса сервера
curl http://localhost:5001/status
```

## 📝 Примеры использования

### Создание нового плана
```javascript
const newPlan = {
  name: "VIP",
  description: "Эксклюзивный доступ ко всем функциям",
  price: 299900, // 2999 рублей
  currency: "RUB",
  duration: 365,
  features: [
    "Все функции других планов",
    "Персональный менеджер",
    "Эксклюзивный контент"
  ],
  isActive: true
};
```

### Деактивация плана
```bash
# Получить ID плана
node scripts/manage-plans.js list

# Деактивировать план
node scripts/manage-plans.js deactivate 682e3d83c8ae40a013b458af
```

### Удаление планов
```bash
# Показать планы, которые можно безопасно удалить
node scripts/cleanup-plans.js show-deletable

# Безопасное удаление конкретного плана
node scripts/manage-plans.js delete 682e3d83c8ae40a013b458af

# Массовое удаление неактивных планов
node scripts/cleanup-plans.js inactive
```

⚠️ **ВАЖНО**: Удаление планов необратимо! Рекомендации:
- Всегда используйте `show-deletable` перед удалением
- Делайте резервную копию базы данных
- Предпочитайте деактивацию удалению
- Планы с активными подписками удалить нельзя

### Мониторинг истекающих подписок
```bash
# Подписки, истекающие в течение 3 дней
node scripts/view-subscriptions.js expiring 3
```

## 🔐 Безопасность

- Все API endpoints защищены JWT токенами
- Платежи проходят через Telegram Payments
- Данные пользователей зашифрованы в MongoDB
- Webhook защищен проверкой подписи Telegram

## 📞 Поддержка

При возникновении проблем:
1. Проверьте логи сервера
2. Запустите диагностические скрипты
3. Обратитесь к документации Telegram Bot API
4. Проверьте статус MongoDB соединения 