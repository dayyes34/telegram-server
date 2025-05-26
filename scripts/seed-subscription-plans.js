require('dotenv').config();
const mongoose = require('mongoose');
const SubscriptionPlan = require('../models/SubscriptionPlan');

// Планы подписки для начального заполнения
const initialPlans = [
  {
    name: "Rhythm Legend+",
    description: "Безлимитный доступ к упражнениям и AI-Функционалу",
    price: 100000, // 1000 рублей в копейках
    currency: "RUB",
    duration: 30, // 30 дней
    features: [
      "Доступ к Базе Барабанщика",
      "Доступ к AI-Функционалу",
      "Возможность сохранять понравившиеся паттерны"
    ],
    isActive: true
  }
];

// Функция для заполнения БД планами подписки
const seedSubscriptionPlans = async () => {
  try {
    // Подключение к MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Подключение к MongoDB установлено');
    
    // Проверка существующих планов
    const existingPlansCount = await SubscriptionPlan.countDocuments();
    console.log(`Найдено ${existingPlansCount} существующих планов подписки`);
    
    if (existingPlansCount > 0) {
      console.log('Планы подписки уже существуют в базе данных. Пропускаем заполнение.');
      console.log('Если вы хотите пересоздать планы, сначала удалите их из базы данных.');
      process.exit(0);
    }
    
    // Вставка планов подписки
    const result = await SubscriptionPlan.insertMany(initialPlans);
    console.log(`Успешно добавлено ${result.length} планов подписки:`);
    
    result.forEach((plan) => {
      console.log(`- ${plan.name}: ${plan.price/100} ${plan.currency}, ${plan.duration} дней`);
    });
    
    console.log('Заполнение базы данных завершено успешно');
  } catch (error) {
    console.error('Ошибка при заполнении базы данных планами подписки:', error);
  } finally {
    // Закрытие соединения с MongoDB
    await mongoose.connection.close();
    console.log('Соединение с MongoDB закрыто');
  }
};

// Запуск скрипта
seedSubscriptionPlans(); 