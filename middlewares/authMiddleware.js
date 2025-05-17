const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
  try {
    // Извлечение токена из заголовка Authorization
    const authHeader = req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Отказано в доступе, токен не предоставлен' });
    }
    
    // Получаем JWT из заголовка
    const token = authHeader.substring(7);
    
    // Проверяем токен
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default_secret_for_development');
    
    // Добавляем userId к объекту запроса
    req.userId = decoded.userId;
    req.telegramId = decoded.telegramId;
    
    next();
  } catch (error) {
    console.error('Ошибка в middleware аутентификации:', error);
    res.status(401).json({ message: 'Отказано в доступе, недействительный токен' });
  }
}; 