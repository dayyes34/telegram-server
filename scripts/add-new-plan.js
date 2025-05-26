require('dotenv').config();
const mongoose = require('mongoose');
const SubscriptionPlan = require('../models/SubscriptionPlan');

// Новый план подписки
const newPlan = {
  name: "Rhythm Pro",
  description: "Расширенный доступ с дополнительными функциями",
  price: 200000, // 2000 рублей в копейках
  currency: "RUB",
  duration: 90, // 90 дней (3 месяца)
  features: [
    "Все функции Rhythm Legend+",
    "Приоритетная поддержка",
    "Эксклюзивные паттерны",
    "Экспорт в различные форматы"
  ],
  isActive: true
};

const addNewPlan = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Подключение к MongoDB установлено');
    
    // Проверяем, существует ли уже такой план
    const existingPlan = await SubscriptionPlan.findOne({ name: newPlan.name });
    if (existingPlan) {
      console.log(`План "${newPlan.name}" уже существует`);
      process.exit(0);
    }
    
    // Создаем новый план
    const plan = new SubscriptionPlan(newPlan);
    await plan.save();
    
    console.log(`Успешно добавлен новый план: ${plan.name}`);
    console.log(`Цена: ${plan.price/100} ${plan.currency}, Длительность: ${plan.duration} дней`);
    
  } catch (error) {
    console.error('Ошибка при добавлении плана:', error);
  } finally {
    await mongoose.connection.close();
    console.log('Соединение с MongoDB закрыто');
  }
};

addNewPlan(); 