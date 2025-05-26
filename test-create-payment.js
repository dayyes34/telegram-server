const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const User = require('./models/User');
const SubscriptionPlan = require('./models/SubscriptionPlan');

require('dotenv').config();

const testCreatePayment = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Подключение к MongoDB установлено');
    
    // Найдем пользователя и план
    const user = await User.findOne({ telegramId: 198189188 });
    const plan = await SubscriptionPlan.findOne({ name: 'Rhythm Legend+' });
    
    if (!user || !plan) {
      console.log('Пользователь или план не найден');
      return;
    }
    
    console.log('Найден пользователь:', user.firstName, user.lastName);
    console.log('Найден план:', plan.name);
    
    // Создаем токен
    const token = jwt.sign(
      { userId: user._id, telegramId: user.telegramId }, 
      process.env.JWT_SECRET || 'default_secret_for_development', 
      { expiresIn: '7d' }
    );
    
    // Симулируем запрос к API
    const subscriptionController = require('./controllers/subscriptionController');
    
    const customPlanName = 'Мой Тестовый Ритм-План 🎵🎸';
    
    const req = {
      body: {
        planId: plan._id.toString(),
        customPlanName: customPlanName
      },
      userId: user._id,
      telegramId: user.telegramId
    };
    
    const res = {
      status: (code) => ({
        json: (data) => {
          console.log('\n=== ОТВЕТ API /api/payments/create-payment ===');
          console.log('Статус:', code);
          console.log('Данные:', JSON.stringify(data, null, 2));
        }
      })
    };
    
    console.log('\n=== ТЕСТОВЫЙ ЗАПРОС ===');
    console.log('planId:', req.body.planId);
    console.log('customPlanName:', req.body.customPlanName);
    console.log('userId:', req.userId);
    console.log('telegramId:', req.telegramId);
    
    // Вызываем метод createPaymentLink
    await subscriptionController.createPaymentLink(req, res);
    
  } catch (error) {
    console.error('Ошибка:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\nСоединение с MongoDB закрыто');
  }
};

testCreatePayment(); 