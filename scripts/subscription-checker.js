/**
 * Скрипт для проверки и обновления статуса подписок
 * Можно запустить вручную: node scripts/subscription-checker.js
 * Или через npm: npm run check-subscriptions
 */

require('dotenv').config();
const mongoose = require('mongoose');
const subscriptionService = require('../services/subscriptionService');

const runSubscriptionCheck = async () => {
  try {
    // Подключение к MongoDB
    console.log('Подключение к MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Подключение к MongoDB установлено');
    
    // Запуск проверки подписок через сервис
    console.log('Запуск проверки подписок...');
    const result = await subscriptionService.checkSubscriptions();
    
    if (result.success) {
      console.log(`Проверка подписок успешно завершена (${result.checkedAt.toISOString()})`);
    } else {
      console.error('Ошибка при проверке подписок:', result.error);
      process.exit(1);
    }
    
  } catch (error) {
    console.error('Критическая ошибка при проверке подписок:', error);
    process.exit(1);
  } finally {
    // Закрытие соединения с MongoDB
    try {
      await mongoose.connection.close();
      console.log('Соединение с MongoDB закрыто');
    } catch (err) {
      console.error('Ошибка при закрытии соединения с MongoDB:', err);
    }
  }
  
  // Завершаем процесс после выполнения всех операций
  process.exit(0);
};

// Запуск проверки подписок
runSubscriptionCheck(); 