const UserPurchase = require('../models/UserPurchase');

// Получить список покупок пользователя
const getUserPurchases = async (req, res) => {
  try {
    const { telegramUserId } = req.params;
    if (!telegramUserId) {
      return res.status(400).json({ message: 'Отсутствует ID пользователя.' });
    }

    const numericTelegramUserId = Number(telegramUserId);
    if (isNaN(numericTelegramUserId)) {
      return res.status(400).json({ message: 'ID пользователя должен быть числом.' });
    }

    const purchases = await UserPurchase.find(
      { telegramUserId: numericTelegramUserId },
      'bundleId'
    );
    
    const purchasedBundleIds = purchases.map(p => p.bundleId);
    
    res.status(200).json({ purchasedBundleIds });

  } catch (error) {
    console.error(`[My Purchases] Error fetching purchases for user ${req.params.telegramUserId}:`, error);
    res.status(500).json({ message: 'Внутренняя ошибка сервера при получении списка покупок.' });
  }
};

// Предоставить доступ к бандлу
const grantBundleAccess = async (req, res) => {
  try {
    const { telegramUserId } = req.params;
    const { bundleId, telegramPaymentChargeId, providerPaymentChargeId } = req.body;

    console.log(`[Grant Access] Attempt to grant access for user ${telegramUserId} to bundle ${bundleId}`);

    if (!telegramUserId || !bundleId) {
      return res.status(400).json({ message: 'Отсутствует ID пользователя или ID бандла.' });
    }

    const existingPurchase = await UserPurchase.findOne({ 
      telegramUserId: Number(telegramUserId), 
      bundleId 
    });
    
    if (existingPurchase) {
      console.log(`[Grant Access] User ${telegramUserId} already owns bundle ${bundleId}. Purchase record ID: ${existingPurchase._id}`);
      return res.status(200).json({ 
        message: 'Доступ к этому бандлу у пользователя уже есть.', 
        purchase: existingPurchase 
      });
    }

    const newPurchase = new UserPurchase({
      telegramUserId: Number(telegramUserId),
      bundleId,
      telegramPaymentChargeId,
      providerPaymentChargeId,
    });
    
    await newPurchase.save();

    console.log(`[Grant Access] Access granted for user ${telegramUserId} to bundle ${bundleId}. New purchase ID: ${newPurchase._id}`);
    res.status(201).json({ 
      message: 'Доступ к бандлу успешно предоставлен.', 
      purchase: newPurchase 
    });

  } catch (error) {
    console.error('[Grant Access] Error granting bundle access:', error);
    if (error.code === 11000) {
      console.warn(`[Grant Access] Attempt to create duplicate purchase for user ${req.params.telegramUserId}, bundle ${req.body.bundleId}.`);
      const existing = await UserPurchase.findOne({ 
        telegramUserId: Number(req.params.telegramUserId), 
        bundleId: req.body.bundleId 
      });
      return res.status(409).json({ 
        message: 'Этот бандл уже был приобретен ранее.', 
        purchase: existing 
      });
    }
    res.status(500).json({ message: 'Внутренняя ошибка сервера при предоставлении доступа.' });
  }
};

module.exports = {
  getUserPurchases,
  grantBundleAccess
}; 