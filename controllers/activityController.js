const UserActivity = require('../models/UserActivity');
const User = require('../models/User');

// Записать активность пользователя
exports.recordActivity = async (req, res) => {
  try {
    const { telegramId } = req.params;
    const { exerciseId, exerciseName, bundleId, bundleName, sessionDuration } = req.body;

    console.log(`Запись активности для пользователя ${telegramId}:`, {
      exerciseId,
      exerciseName,
      bundleId,
      bundleName,
      sessionDuration
    });

    // Проверяем, что пользователь существует
    const user = await User.findOne({ telegramId: parseInt(telegramId) });
    if (!user) {
      return res.status(404).json({ message: 'Пользователь не найден' });
    }

    // Получаем текущую дату (без времени)
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Ищем или создаем запись активности за сегодня
    let activityRecord = await UserActivity.findOne({
      telegramId: parseInt(telegramId),
      date: today
    });

    if (!activityRecord) {
      activityRecord = new UserActivity({
        userId: user._id,
        telegramId: parseInt(telegramId),
        date: today,
        activities: [],
        totalSessions: 0,
        totalDuration: 0
      });
    }

    // Добавляем новую активность
    await activityRecord.addActivity({
      exerciseId,
      exerciseName,
      bundleId,
      bundleName,
      sessionDuration: sessionDuration || 0
    });

    console.log(`Активность записана для пользователя ${telegramId}. Всего сессий за день: ${activityRecord.totalSessions}`);

    res.status(200).json({
      success: true,
      message: 'Активность записана',
      dailyStats: {
        totalSessions: activityRecord.totalSessions,
        totalDuration: activityRecord.totalDuration
      }
    });

  } catch (error) {
    console.error('Ошибка при записи активности:', error);
    res.status(500).json({ 
      message: 'Ошибка сервера при записи активности', 
      error: error.message 
    });
  }
};

// Получить активность пользователя за месяц
exports.getMonthlyActivity = async (req, res) => {
  try {
    const { telegramId } = req.params;
    const { year, month } = req.query;

    console.log(`Запрос активности за месяц для пользователя ${telegramId}: ${year}-${month}`);

    // Проверяем параметры
    const currentYear = year ? parseInt(year) : new Date().getFullYear();
    const currentMonth = month ? parseInt(month) : new Date().getMonth() + 1;

    if (currentMonth < 1 || currentMonth > 12) {
      return res.status(400).json({ message: 'Неверный номер месяца' });
    }

    // Получаем активность за месяц
    const activities = await UserActivity.getMonthlyActivity(
      parseInt(telegramId),
      currentYear,
      currentMonth
    );

    // Формируем календарь активности
    const calendar = generateActivityCalendar(activities, currentYear, currentMonth);

    res.status(200).json({
      success: true,
      year: currentYear,
      month: currentMonth,
      calendar,
      totalSessions: activities.reduce((sum, day) => sum + day.totalSessions, 0),
      totalDuration: activities.reduce((sum, day) => sum + day.totalDuration, 0)
    });

  } catch (error) {
    console.error('Ошибка при получении месячной активности:', error);
    res.status(500).json({ 
      message: 'Ошибка сервера при получении активности', 
      error: error.message 
    });
  }
};

// Получить детальную активность за день
exports.getDayActivity = async (req, res) => {
  try {
    const { telegramId } = req.params;
    const { date } = req.query;

    console.log(`Запрос детальной активности за день для пользователя ${telegramId}: ${date}`);

    if (!date) {
      return res.status(400).json({ message: 'Дата не указана' });
    }

    const targetDate = new Date(date);
    targetDate.setHours(0, 0, 0, 0);

    const activityRecord = await UserActivity.findOne({
      telegramId: parseInt(telegramId),
      date: targetDate
    });

    if (!activityRecord) {
      return res.status(200).json({
        success: true,
        date: targetDate,
        activities: [],
        totalSessions: 0,
        totalDuration: 0
      });
    }

    res.status(200).json({
      success: true,
      date: activityRecord.date,
      activities: activityRecord.activities,
      totalSessions: activityRecord.totalSessions,
      totalDuration: activityRecord.totalDuration
    });

  } catch (error) {
    console.error('Ошибка при получении дневной активности:', error);
    res.status(500).json({ 
      message: 'Ошибка сервера при получении дневной активности', 
      error: error.message 
    });
  }
};

// Вспомогательная функция для генерации календаря активности
function generateActivityCalendar(activities, year, month) {
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0);
  
  const weeks = [];
  let currentWeek = [];
  
  // Добавляем пустые дни в начале для выравнивания по неделям
  const startDay = (startDate.getDay() + 6) % 7; // Понедельник = 0
  for (let i = 0; i < startDay; i++) {
    currentWeek.push(null);
  }
  
  // Создаем карту активности по дням
  const activityMap = new Map();
  activities.forEach(activity => {
    const dayKey = activity.date.getDate();
    activityMap.set(dayKey, {
      sessions: activity.totalSessions,
      duration: activity.totalDuration,
      activities: activity.activities
    });
  });
  
  // Добавляем дни месяца
  const currentDate = new Date(startDate);
  while (currentDate <= endDate) {
    const dayOfMonth = currentDate.getDate();
    const dayActivity = activityMap.get(dayOfMonth);
    
    // Определяем уровень активности (0-4)
    let activityLevel = 0;
    if (dayActivity && dayActivity.sessions > 0) {
      if (dayActivity.sessions >= 10) activityLevel = 4;
      else if (dayActivity.sessions >= 7) activityLevel = 3;
      else if (dayActivity.sessions >= 4) activityLevel = 2;
      else activityLevel = 1;
    }
    
    currentWeek.push({
      date: new Date(currentDate),
      day: dayOfMonth,
      activity: activityLevel,
      sessions: dayActivity ? dayActivity.sessions : 0,
      duration: dayActivity ? dayActivity.duration : 0,
      exercises: dayActivity ? dayActivity.activities : []
    });
    
    // Если неделя заполнена (7 дней), добавляем её в массив недель
    if (currentWeek.length === 7) {
      weeks.push(currentWeek);
      currentWeek = [];
    }
    
    currentDate.setDate(currentDate.getDate() + 1);
  }
  
  // Добавляем пустые дни в конце последней недели
  while (currentWeek.length < 7 && currentWeek.length > 0) {
    currentWeek.push(null);
  }
  
  // Добавляем последнюю неделю, если она не пустая
  if (currentWeek.length > 0) {
    weeks.push(currentWeek);
  }
  
  return weeks;
} 