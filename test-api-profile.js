const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const User = require('./models/User');
const Subscription = require('./models/Subscription');
const SubscriptionPlan = require('./models/SubscriptionPlan');

require('dotenv').config();

const testAPIProfile = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Подключение к MongoDB установлено');
    
    // Найдем пользователя с кастомной подпиской
    const user = await User.findOne({ telegramId: 198189188 });
    if (!user) {
      console.log('Пользователь не найден');
      return;
    }
    
    console.log('Найден пользователь:', user.firstName, user.lastName);
    console.log('ID пользователя:', user._id);
    
    // Создаем токен для этого пользователя
    const token = jwt.sign(
      { userId: user._id, telegramId: user.telegramId }, 
      process.env.JWT_SECRET || 'default_secret_for_development', 
      { expiresIn: '7d' }
    );
    
    console.log('Создан токен:', token.substring(0, 50) + '...');
    
    // Теперь симулируем запрос к API
    const userController = require('./controllers/userController');
    
    // Создаем mock объекты req и res
    const req = {
      userId: user._id,
      telegramId: user.telegramId
    };
    
    const res = {
      status: (code) => ({
        json: (data) => {
          console.log('\n=== ОТВЕТ API /users/profile ===');
          console.log('Статус:', code);
          console.log('Данные:', JSON.stringify(data, null, 2));
          
          if (data.user && data.user.currentSubscription) {
            console.log('\n=== ПОДПИСКА В ОТВЕТЕ ===');
            console.log('Кастомное имя:', data.user.currentSubscription.customPlanName);
            console.log('Официальное имя:', data.user.currentSubscription.planId?.name);
            console.log('Статус:', data.user.currentSubscription.status);
          } else {
            console.log('\n❌ Подписка не найдена в ответе API');
          }
        }
      })
    };
    
    // Вызываем метод getUserProfile
    await userController.getUserProfile(req, res);
    
  } catch (error) {
    console.error('Ошибка:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\nСоединение с MongoDB закрыто');
  }
};

testAPIProfile(); 