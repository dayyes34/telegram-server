require('dotenv').config();
const mongoose = require('mongoose');
const SubscriptionPlan = require('../models/SubscriptionPlan');

// Планы подписки для начального заполнения
const initialPlans = [
  {
    name: "Стартовый",
    description: "Базовый доступ к премиум-контенту на 1 месяц",
    price: 29900, // 299 рублей в копейках
    currency: "RUB",
    duration: 30, // 30 дней
    features: [
      "Доступ к премиум-упражнениям",
      "Доступ к базе барабанщика",
      "Работа с метрономом"
    ],
    isActive: true
  },
  {
    name: "Профессиональный",
    description: "Полный доступ ко всем возможностям на 3 месяца",
    price: 69900, // 699 рублей в копейках
    currency: "RUB",
    duration: 90, // 90 дней
    features: [
      "Доступ к премиум-упражнениям",
      "Доступ к базе барабанщика",
      "Работа с метрономом",
      "Сохранение неограниченного количества патернов",
      "Экспорт в MIDI и WAV"
    ],
    isActive: true
  },
  {
    name: "Премиум",
    description: "Полный доступ ко всем возможностям на год",
    price: 149900, // 1499 рублей в копейках
    currency: "RUB",
    duration: 365, // 365 дней
    features: [
      "Доступ к премиум-упражнениям",
      "Доступ к базе барабанщика",
      "Работа с метрономом",
      "Сохранение неограниченного количества патернов",
      "Экспорт в MIDI и WAV",
      "Приоритетная поддержка"
    ],
    isActive: true
  },
  {
    name: "Капсула Плюс",
    description: "Расширенный доступ к функциям и контенту на 1 месяц",
    price: 99000, // 990 рублей в копейках
    currency: "RUB",
    duration: 30, // 30 дней
    features: [
      "Все возможности плана 'Профессиональный'",
      "Доступ к эксклюзивным мастер-классам",
      "Персональные консультации (1 в месяц)"
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