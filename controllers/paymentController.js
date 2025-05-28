require('dotenv').config();
const bot = require('../config/telegramBot');
const User = require('../models/User'); // Добавим User
const SubscriptionPlan = require('../models/SubscriptionPlan'); // Добавим SubscriptionPlan
const Subscription = require('../models/Subscription'); // Добавим Subscription
const UserPurchase = require('../models/UserPurchase'); // Добавим UserPurchase

const TEST_PROVIDER_TOKEN = process.env.TELEGRAM_TEST_PROVIDER_TOKEN;
const MAIN_API_BASE_URL = process.env.MAIN_API_BASE_URL || 'https://rhythmcapsule.ru/api'; // URL вашего основного API

// Удаляем захардкоженные bundlesData
// const bundlesData = { ... };

const createInvoice = async (req, res) => {
  const { bundleId, userId } = req.body;
  const fetch = (await import('node-fetch')).default; // Динамический импорт

  if (!TEST_PROVIDER_TOKEN) {
    console.error('Тестовый токен провайдера не найден в переменных окружения!');
    return res.status(500).json({ message: 'Ошибка конфигурации сервера: отсутствует токен провайдера.' });
  }

  if (!userId) {
    console.error('UserID (telegramId) не предоставлен для создания счета');
    return res.status(400).json({ message: 'Необходим ID пользователя для создания счета.' });
  }

  if (!bundleId) {
    console.error('BundleID не предоставлен для создания счета');
    return res.status(400).json({ message: 'Необходим ID бандла для создания счета.' });
  }

  let bundleDetails;
  try {
    const bundleResponse = await fetch(`${MAIN_API_BASE_URL}/bundles/${bundleId}/details`);
    if (!bundleResponse.ok) {
      const errorData = await bundleResponse.json().catch(() => ({ message: bundleResponse.statusText }));
      console.error(`Ошибка при получении деталей бандла ${bundleId} с основного API: ${bundleResponse.status}`, errorData.message);
      return res.status(bundleResponse.status === 404 ? 404 : 500).json({ 
        message: errorData.message || 'Не удалось получить информацию о бандле от основного сервера.' 
      });
    }
    bundleDetails = await bundleResponse.json();
    
    // Проверка, что все необходимые поля получены
    if (!bundleDetails.title || bundleDetails.price_in_smallest_unit === undefined || !bundleDetails.currency) {
        console.error(`Неполные данные для бандла ${bundleId} получены с основного API:`, bundleDetails);
        return res.status(500).json({ message: 'Получены неполные данные о бандле от основного сервера.' });
    }

  } catch (error) {
    console.error(`Сетевая ошибка или ошибка JSON при получении деталей бандла ${bundleId}:`, error);
    return res.status(500).json({ message: 'Ошибка связи с основным сервером для получения информации о бандле.' });
  }
  
  const payload = `bundle_purchase_${bundleId}_user_${userId}_${Date.now()}`;
  
  // Параметры для инвойса
  const invoiceParams = {
    title: bundleDetails.title,
    description: bundleDetails.description || '',
    payload: payload,
    provider_token: TEST_PROVIDER_TOKEN,
    currency: bundleDetails.currency,
    prices: [{ label: bundleDetails.title, amount: bundleDetails.price_in_smallest_unit }],
    photo_url: bundleDetails.photo_url, // Добавляем изображение
    // start_parameter: `bundle_${bundleId}` // Можно использовать для deeplink, если нужно
  };

  console.log("DEBUG (paymentController): Arguments for createInvoiceLink:", JSON.stringify(invoiceParams, null, 2)); // Добавляем лог
  console.log("DEBUG (paymentController): Photo URL being sent:", invoiceParams.photo_url);
  console.log("DEBUG (paymentController): Photo URL accessible test - will be checked by Telegram servers");

  // Подготавливаем опции для инвойса
  const invoiceOptions = {
    need_name: false,
    need_phone_number: false,
    need_email: false,
    need_shipping_address: false,
    is_flexible: false
  };

  // Добавляем photo_url только если он есть
  if (invoiceParams.photo_url) {
    invoiceOptions.photo_url = invoiceParams.photo_url;
    invoiceOptions.photo_width = 512;
    invoiceOptions.photo_height = 512;
  }

  console.log("DEBUG (paymentController): Final invoice options:", JSON.stringify(invoiceOptions, null, 2));

  try {
    // Создаем ссылку на инвойс вместо прямой отправки
    const invoiceLink = await bot.createInvoiceLink(
      invoiceParams.title,
      invoiceParams.description,
      invoiceParams.payload,
      invoiceParams.provider_token,
      invoiceParams.currency,
      invoiceParams.prices,
      invoiceOptions
    );

    if (!invoiceLink) {
      console.error('Не удалось создать ссылку на инвойс от Telegram API.');
      return res.status(500).json({ message: 'Не удалось получить ссылку на инвойс от Telegram.' });
    }
    
    console.log('Ссылка на инвойс успешно создана для пользователя:', userId, 'бандл:', bundleId, 'ссылка:', invoiceLink);
    // Отправляем ссылку на фронтенд
    res.status(200).json({ 
      message: 'Ссылка на инвойс успешно создана.',
      invoice_link: invoiceLink // Ключ, который фронтенд будет использовать
    });

  } catch (error) {
    console.error('Ошибка при создании ссылки на инвойс Telegram:', error.response ? error.response.body : error);
    let errorMessage = 'Не удалось создать ссылку на инвойс.';
    if (error.response && error.response.body && error.response.body.description) {
        errorMessage += ` Детали: ${error.response.body.description}`;
    } else if (error.message) {
        errorMessage += ` Детали: ${error.message}`;
    }
    res.status(500).json({ message: errorMessage });
  }
};

const createCollectionInvoice = async (req, res) => {
  const { collectionId, userId } = req.body;
  const fetch = (await import('node-fetch')).default; // Динамический импорт

  if (!TEST_PROVIDER_TOKEN) {
    console.error('Тестовый токен провайдера не найден в переменных окружения!');
    return res.status(500).json({ message: 'Ошибка конфигурации сервера: отсутствует токен провайдера.' });
  }

  if (!userId) {
    console.error('UserID (telegramId) не предоставлен для создания счета коллекции');
    return res.status(400).json({ message: 'Необходим ID пользователя для создания счета.' });
  }

  if (!collectionId) {
    console.error('CollectionID не предоставлен для создания счета');
    return res.status(400).json({ message: 'Необходим ID коллекции для создания счета.' });
  }

  let collectionDetails;
  try {
    const collectionResponse = await fetch(`${MAIN_API_BASE_URL}/bundle-collections/${collectionId}/details`);
    if (!collectionResponse.ok) {
      const errorData = await collectionResponse.json().catch(() => ({ message: collectionResponse.statusText }));
      console.error(`Ошибка при получении деталей коллекции ${collectionId} с основного API: ${collectionResponse.status}`, errorData.message);
      return res.status(collectionResponse.status === 404 ? 404 : 500).json({ 
        message: errorData.message || 'Не удалось получить информацию о коллекции от основного сервера.' 
      });
    }
    collectionDetails = await collectionResponse.json();
    
    // Проверка, что все необходимые поля получены
    if (!collectionDetails.title || collectionDetails.price_in_smallest_unit === undefined || !collectionDetails.currency) {
        console.error(`Неполные данные для коллекции ${collectionId} получены с основного API:`, collectionDetails);
        return res.status(500).json({ message: 'Получены неполные данные о коллекции от основного сервера.' });
    }

  } catch (error) {
    console.error(`Сетевая ошибка или ошибка JSON при получении деталей коллекции ${collectionId}:`, error);
    return res.status(500).json({ message: 'Ошибка связи с основным сервером для получения информации о коллекции.' });
  }
  
  const payload = `collection_purchase_${collectionId}_user_${userId}_${Date.now()}`;
  
  // Параметры для инвойса
  const invoiceParams = {
    title: collectionDetails.title,
    description: collectionDetails.description || '',
    payload: payload,
    provider_token: TEST_PROVIDER_TOKEN,
    currency: collectionDetails.currency,
    prices: [{ label: collectionDetails.title, amount: collectionDetails.price_in_smallest_unit }],
    photo_url: collectionDetails.photo_url, // Добавляем изображение коллекции
  };

  console.log("DEBUG (paymentController): Arguments for createCollectionInvoiceLink:", JSON.stringify(invoiceParams, null, 2));
  console.log("DEBUG (paymentController): Collection Photo URL being sent:", invoiceParams.photo_url);
  console.log("DEBUG (paymentController): Collection Photo URL accessible test - will be checked by Telegram servers");

  // Подготавливаем опции для инвойса
  const invoiceOptions = {
    need_name: false,
    need_phone_number: false,
    need_email: false,
    need_shipping_address: false,
    is_flexible: false
  };

  // Добавляем photo_url только если он есть
  if (invoiceParams.photo_url) {
    invoiceOptions.photo_url = invoiceParams.photo_url;
    invoiceOptions.photo_size = 512;
    invoiceOptions.photo_width = 512;
    invoiceOptions.photo_height = 512;
  }

  console.log("DEBUG (paymentController): Final invoice options:", JSON.stringify(invoiceOptions, null, 2));

  try {
    // Создаем ссылку на инвойс вместо прямой отправки
    const invoiceLink = await bot.createInvoiceLink(
      invoiceParams.title,
      invoiceParams.description,
      invoiceParams.payload,
      invoiceParams.provider_token,
      invoiceParams.currency,
      invoiceParams.prices,
      invoiceOptions
    );

    if (!invoiceLink) {
      console.error('Не удалось создать ссылку на инвойс коллекции от Telegram API.');
      return res.status(500).json({ message: 'Не удалось получить ссылку на инвойс от Telegram.' });
    }
    
    console.log('Ссылка на инвойс коллекции успешно создана для пользователя:', userId, 'коллекция:', collectionId, 'ссылка:', invoiceLink);
    // Отправляем ссылку на фронтенд
    res.status(200).json({ 
      message: 'Ссылка на инвойс коллекции успешно создана.',
      invoice_link: invoiceLink
    });

  } catch (error) {
    console.error('Ошибка при создании ссылки на инвойс коллекции Telegram:', error.response ? error.response.body : error);
    let errorMessage = 'Не удалось создать ссылку на инвойс коллекции.';
    if (error.response && error.response.body && error.response.body.description) {
        errorMessage += ` Детали: ${error.response.body.description}`;
    } else if (error.message) {
        errorMessage += ` Детали: ${error.message}`;
    }
    res.status(500).json({ message: errorMessage });
  }
};

// Обработчик PreCheckoutQuery (ОБЯЗАТЕЛЬНО НУЖЕН для подтверждения платежа)
// Telegram отправляет этот запрос перед тем, как списать деньги.
// Вы должны ответить в течение 10 секунд.
bot.on('pre_checkout_query', async (preCheckoutQuery) => {
  const queryId = preCheckoutQuery.id;
  const userIdFromQuery = preCheckoutQuery.from.id; // Это telegramId пользователя
  const invoicePayload = preCheckoutQuery.invoice_payload;
  const totalAmount = preCheckoutQuery.total_amount;
  const currency = preCheckoutQuery.currency;
  const fetch = (await import('node-fetch')).default; 

  console.log(`Получен pre_checkout_query от пользователя ${userIdFromQuery} для заказа ${invoicePayload}. Сумма: ${totalAmount} ${currency}. Query ID: ${queryId}`);

  const payloadParts = invoicePayload.split('_');
  const type = payloadParts[0]; // 'sub' или 'bundle' или 'collection'

  if (type === 'sub') {
    // Логика для подписок
    // payload: sub_planId_dbUserId_timestamp
    const planId = payloadParts[1];
    // const dbUserId = payloadParts[2]; // userId из нашей БД, если мы его туда клали

    if (!planId) {
      console.error('PreCheckout (Subscription): Не удалось извлечь planId из payload:', invoicePayload);
      await bot.answerPreCheckoutQuery(queryId, false, { error_message: 'Ошибка обработки заказа (подписка).' });
      return;
    }

    try {
      const plan = await SubscriptionPlan.findById(planId);
      if (!plan) {
        console.error(`PreCheckout (Subscription): План подписки ${planId} не найден.`);
        await bot.answerPreCheckoutQuery(queryId, false, { error_message: 'Выбранный план подписки больше не доступен.' });
        return;
      }
      if (!plan.isActive) {
        console.error(`PreCheckout (Subscription): План подписки ${planId} не активен.`);
        await bot.answerPreCheckoutQuery(queryId, false, { error_message: 'Этот план подписки временно недоступен.' });
        return;
      }
      // Проверка цены и валюты
      if (plan.price !== totalAmount || plan.currency.toUpperCase() !== currency.toUpperCase()) {
        console.warn(`PreCheckout (Subscription): Несоответствие цены/валюты для плана ${planId}.`);
        console.warn(`  Ожидалось: ${plan.price} ${plan.currency}, Получено от TG: ${totalAmount} ${currency}`);
        await bot.answerPreCheckoutQuery(queryId, false, { error_message: 'Цена или валюта подписки изменились. Пожалуйста, попробуйте снова.' });
        return;
      }

      await bot.answerPreCheckoutQuery(queryId, true);
      console.log(`Успешно ответили на pre_checkout_query (ID: ${queryId}) для подписки на план ${planId}.`);

    } catch (error) {
      console.error(`PreCheckout (Subscription): Ошибка при проверке плана ${planId}:`, error);
      await bot.answerPreCheckoutQuery(queryId, false, { error_message: 'Внутренняя ошибка сервера при проверке подписки.' });
    }

  } else if (type === 'bundle') { // Предполагаем, что старый payload был bundle_purchase_...
    // Логика для бандлов (существующая)
    const bundleIdFromPayload = payloadParts.length > 2 ? payloadParts[2] : null; // bundleId был третьим элементом bundle_purchase_BUNDLEID_user_USERID_...

    if (!bundleIdFromPayload) {
      console.error('PreCheckout (Bundle): Не удалось извлечь bundleId из payload:', invoicePayload);
      await bot.answerPreCheckoutQuery(queryId, false, { error_message: 'Ошибка обработки заказа (бандл).' });
      return;
    }
    try {
      const bundleResponse = await fetch(`${MAIN_API_BASE_URL}/bundles/${bundleIdFromPayload}/details`);
      if (!bundleResponse.ok) {
        const errorData = await bundleResponse.json().catch(() => ({ message: 'Не удалось проверить товар' }));
        console.error(`PreCheckout (Bundle): Ошибка при получении деталей бандла ${bundleIdFromPayload} с основного API: ${bundleResponse.status}`, errorData.message);
        await bot.answerPreCheckoutQuery(queryId, false, { error_message: errorData.message });
        return;
      }
      const bundleDetails = await bundleResponse.json();

      if (bundleDetails.price_in_smallest_unit !== totalAmount || bundleDetails.currency.toUpperCase() !== currency.toUpperCase()) {
        console.warn(`PreCheckout (Bundle): Несоответствие цены/валюты для бандла ${bundleIdFromPayload}.`);
        console.warn(`  Ожидалось: ${bundleDetails.price_in_smallest_unit} ${bundleDetails.currency}, Получено от TG: ${totalAmount} ${currency}`);
        await bot.answerPreCheckoutQuery(queryId, false, { error_message: 'Цена или валюта товара изменились. Пожалуйста, попробуйте снова.' });
        return;
      }

      await bot.answerPreCheckoutQuery(queryId, true);
      console.log(`Успешно ответили на pre_checkout_query (ID: ${queryId}) для бандла ${bundleIdFromPayload}.`);

    } catch (error) {
      console.error(`PreCheckout (Bundle): Ошибка при проверке бандла ${bundleIdFromPayload}:`, error);
      // Не отвечаем, чтобы Telegram мог повторить, если это ошибка связи.
      // Если это ошибка нашей валидации, то false.
      // Лучше ответить false, чтобы не было зависаний на стороне пользователя
      await bot.answerPreCheckoutQuery(queryId, false, { error_message: 'Внутренняя ошибка сервера при проверке товара.' });
    }
  } else if (type === 'collection') {
    // Логика для коллекций
    const collectionIdFromPayload = payloadParts.length > 2 ? payloadParts[2] : null; // collectionId был третьим элементом collection_purchase_COLLECTIONID_user_USERID_...

    if (!collectionIdFromPayload) {
      console.error('PreCheckout (Collection): Не удалось извлечь collectionId из payload:', invoicePayload);
      await bot.answerPreCheckoutQuery(queryId, false, { error_message: 'Ошибка обработки заказа (коллекция).' });
      return;
    }
    try {
      const collectionResponse = await fetch(`${MAIN_API_BASE_URL}/bundle-collections/${collectionIdFromPayload}/details`);
      if (!collectionResponse.ok) {
        const errorData = await collectionResponse.json().catch(() => ({ message: 'Не удалось проверить коллекцию' }));
        console.error(`PreCheckout (Collection): Ошибка при получении деталей коллекции ${collectionIdFromPayload} с основного API: ${collectionResponse.status}`, errorData.message);
        await bot.answerPreCheckoutQuery(queryId, false, { error_message: errorData.message });
        return;
      }
      const collectionDetails = await collectionResponse.json();

      if (collectionDetails.price_in_smallest_unit !== totalAmount || collectionDetails.currency.toUpperCase() !== currency.toUpperCase()) {
        console.warn(`PreCheckout (Collection): Несоответствие цены/валюты для коллекции ${collectionIdFromPayload}.`);
        console.warn(`  Ожидалось: ${collectionDetails.price_in_smallest_unit} ${collectionDetails.currency}, Получено от TG: ${totalAmount} ${currency}`);
        await bot.answerPreCheckoutQuery(queryId, false, { error_message: 'Цена или валюта коллекции изменились. Пожалуйста, попробуйте снова.' });
        return;
      }

      await bot.answerPreCheckoutQuery(queryId, true);
      console.log(`Успешно ответили на pre_checkout_query (ID: ${queryId}) для коллекции ${collectionIdFromPayload}.`);

    } catch (error) {
      console.error(`PreCheckout (Collection): Ошибка при проверке коллекции ${collectionIdFromPayload}:`, error);
      await bot.answerPreCheckoutQuery(queryId, false, { error_message: 'Внутренняя ошибка сервера при проверке коллекции.' });
    }
  } else {
    console.error('PreCheckout: Неизвестный тип payload:', invoicePayload);
    await bot.answerPreCheckoutQuery(queryId, false, { error_message: 'Неподдерживаемый тип заказа.' });
  }
});

// Обработчик успешного платежа (SuccessfulPayment)
bot.on('successful_payment', async (msg) => {
  const chatId = msg.chat.id; 
  const telegramUserId = msg.from.id;  
  const fetch = (await import('node-fetch')).default; 
  const { 
    currency, 
    total_amount, 
    invoice_payload, 
    telegram_payment_charge_id, 
    provider_payment_charge_id 
  } = msg.successful_payment;

  console.log(`Успешный платеж от пользователя ${telegramUserId} (чат ${chatId})`);
  console.log(`  Payload: ${invoice_payload}`);
  console.log(`  Сумма: ${total_amount / 100} ${currency}`);
  console.log(`  Telegram Payment Charge ID: ${telegram_payment_charge_id}`);
  console.log(`  Provider Payment Charge ID: ${provider_payment_charge_id}`);

  const payloadParts = invoice_payload.split('_');
  const type = payloadParts[0];

  if (type === 'sub') {
    // Логика для подписок
    // payload: sub_planId_dbUserId_timestamp
    const planId = payloadParts[1];
    const dbUserId = payloadParts[2]; // ID пользователя из нашей MongoDB

    try {
      const plan = await SubscriptionPlan.findById(planId);
      const user = await User.findById(dbUserId);

      if (!plan || !user) {
        console.error(`SuccessfulPayment (Subscription): План ${planId} или пользователь ${dbUserId} не найдены.`);
        // Тут сложно что-то сделать, платеж уже прошел. Логируем и возможно шлем алерт админу.
        await bot.sendMessage(telegramUserId, 'Произошла ошибка при активации вашей подписки. Пожалуйста, свяжитесь с поддержкой.');
        return;
      }

      // Получаем кастомное имя из кэша (импортируем кэш из subscriptionController)
      const subscriptionController = require('./subscriptionController');
      const paymentDataCache = subscriptionController.paymentDataCache;
      const cachedPaymentData = paymentDataCache ? paymentDataCache.get(invoice_payload) : null;
      const customPlanName = cachedPaymentData ? cachedPaymentData.customPlanName : null;
      
      console.log('DEBUG: Bot SuccessfulPayment - invoice_payload:', invoice_payload);
      console.log('DEBUG: Bot SuccessfulPayment - cachedPaymentData:', cachedPaymentData);
      console.log('DEBUG: Bot SuccessfulPayment - customPlanName:', customPlanName);
      
      // Очищаем данные из кэша после использования
      if (cachedPaymentData && paymentDataCache) {
        paymentDataCache.delete(invoice_payload);
      }

      const startDate = new Date();
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + plan.duration);

      const subscription = new Subscription({
        userId: user._id,
        telegramUserId: user.telegramId, // Убедимся, что telegramId пользователя есть
        planId: plan._id,
        customPlanName: customPlanName && customPlanName !== 'default' ? customPlanName : null, // Добавляем кастомное имя
        status: 'active',
        startDate,
        endDate,
        autoRenew: false, 
        paymentHistory: [{
          amount: total_amount,
          currency,
          telegramPaymentId: telegram_payment_charge_id,
          providerPaymentId: provider_payment_charge_id, // Добавим ID от провайдера
          status: 'completed',
          paymentDate: new Date()
        }]
      });

      await subscription.save();

      user.subscriptions.push(subscription._id);
      user.currentSubscriptionId = subscription._id;
      user.hasActiveSubscription = true;
      await user.save();

      // Используем кастомное имя для сообщения, если оно есть
      const displayName = customPlanName && customPlanName !== 'default' ? customPlanName : plan.name;
      await bot.sendMessage(
        user.telegramId,
        `🎉 Поздравляем! Вы успешно оформили подписку "${displayName}".\n\nВаша подписка действует до ${endDate.toLocaleDateString()}.\n\nСпасибо за поддержку!`
      );
      console.log(`SuccessfulPayment (Subscription): Подписка ${plan.name} для пользователя ${user.telegramId} (ID: ${user._id}) успешно создана и активирована.`);

    } catch (error) {
      console.error(`SuccessfulPayment (Subscription): Ошибка при создании подписки для payload ${invoice_payload}:`, error);
      // Платеж прошел, но не смогли обновить БД. Критично.
      // Отправляем сообщение пользователю и лог админу.
      try {
        await bot.sendMessage(telegramUserId, 'Платеж за подписку прошел, но произошла ошибка при ее активации. Мы уже разбираемся. Пожалуйста, свяжитесь с поддержкой, если подписка не появится в ближайшее время.');
      } catch (sendError) {
        console.error('Failed to send error message to user about subscription activation failure', sendError);
      }
    }

  } else if (type === 'bundle') {
    // Логика для бандлов (существующая)
    const purchasedBundleId = payloadParts.length > 2 ? payloadParts[2] : null;
    let bundleTitleForMessage = purchasedBundleId || 'купленный товар';

    if (purchasedBundleId) {
      try {
        const bundleDetailsResponse = await fetch(`${MAIN_API_BASE_URL}/bundles/${purchasedBundleId}/details`);
        if (bundleDetailsResponse.ok) {
          const bundleDetails = await bundleDetailsResponse.json();
          bundleTitleForMessage = bundleDetails.title || bundleTitleForMessage;
        }
      } catch (fetchError) {
        console.warn(`SuccessfulPayment (Bundle): Не удалось получить название бандла ${purchasedBundleId} для сообщения. Ошибка: ${fetchError.message}`);
      }

      try {
        // Сохраняем покупку в локальной базе telegram сервера
        const existingPurchase = await UserPurchase.findOne({ 
          telegramUserId: telegramUserId, 
          bundleId: purchasedBundleId 
        });
        
        if (!existingPurchase) {
          const newPurchase = new UserPurchase({
            telegramUserId: telegramUserId,
            bundleId: purchasedBundleId,
            telegramPaymentChargeId: telegram_payment_charge_id,
            providerPaymentChargeId: provider_payment_charge_id,
          });
          
          await newPurchase.save();
          console.log(`SuccessfulPayment (Bundle): Покупка бандла ${purchasedBundleId} для пользователя ${telegramUserId} сохранена в локальной базе.`);
        } else {
          console.log(`SuccessfulPayment (Bundle): Покупка бандла ${purchasedBundleId} для пользователя ${telegramUserId} уже существует в локальной базе.`);
        }
      } catch (error) {
        console.error(`SuccessfulPayment (Bundle): Ошибка при сохранении покупки бандла ${purchasedBundleId} для ${telegramUserId} в локальной базе:`, error);
      }
    } else {
      console.error('SuccessfulPayment (Bundle): Не удалось извлечь purchasedBundleId из payload:', invoice_payload);
      bundleTitleForMessage = 'ваш заказ';
    }

    try {
      await bot.sendMessage(chatId, 
        `Спасибо за покупку "${bundleTitleForMessage}"!\n\nСумма: ${total_amount / 100} ${currency}.\nДоступ к материалам предоставлен. Вы можете найти их в соответствующем разделе приложения.`
      );
      console.log(`Сообщение об успешной покупке ("${bundleTitleForMessage}") отправлено пользователю ${telegramUserId} в чат ${chatId}.`);
    } catch (error) {
      console.error(`Ошибка при отправке сообщения об успешной покупке пользователю ${telegramUserId}:`, error);
    }
  } else if (type === 'collection') {
    // Логика для коллекций
    const purchasedCollectionId = payloadParts.length > 2 ? payloadParts[2] : null;
    let collectionTitleForMessage = purchasedCollectionId || 'купленная коллекция';

    if (purchasedCollectionId) {
      try {
        const collectionDetailsResponse = await fetch(`${MAIN_API_BASE_URL}/bundle-collections/${purchasedCollectionId}/details`);
        if (collectionDetailsResponse.ok) {
          const collectionDetails = await collectionDetailsResponse.json();
          collectionTitleForMessage = collectionDetails.title || collectionTitleForMessage;
        }
      } catch (fetchError) {
        console.warn(`SuccessfulPayment (Collection): Не удалось получить название коллекции ${purchasedCollectionId} для сообщения. Ошибка: ${fetchError.message}`);
      }

      try {
        // Получаем все бандлы коллекции
        const collectionBundlesResponse = await fetch(`${MAIN_API_BASE_URL}/bundle-collections/${purchasedCollectionId}/bundles`);
        if (collectionBundlesResponse.ok) {
          const collectionData = await collectionBundlesResponse.json();
          const bundles = collectionData.bundles || [];

          // Сохраняем покупку каждого бандла в коллекции
          for (const bundle of bundles) {
            const existingPurchase = await UserPurchase.findOne({ 
              telegramUserId: telegramUserId, 
              bundleId: bundle.id 
            });
            
            if (!existingPurchase) {
              const newPurchase = new UserPurchase({
                telegramUserId: telegramUserId,
                bundleId: bundle.id,
                collectionId: purchasedCollectionId, // Указываем, что это покупка через коллекцию
                telegramPaymentChargeId: telegram_payment_charge_id,
                providerPaymentChargeId: provider_payment_charge_id,
              });
              
              await newPurchase.save();
              console.log(`SuccessfulPayment (Collection): Покупка бандла ${bundle.id} (${bundle.name}) из коллекции ${purchasedCollectionId} для пользователя ${telegramUserId} сохранена.`);
            } else {
              console.log(`SuccessfulPayment (Collection): Покупка бандла ${bundle.id} для пользователя ${telegramUserId} уже существует.`);
            }
          }

          console.log(`SuccessfulPayment (Collection): Покупка коллекции ${purchasedCollectionId} (${bundles.length} бандлов) для пользователя ${telegramUserId} обработана.`);
        } else {
          console.error(`SuccessfulPayment (Collection): Не удалось получить бандлы коллекции ${purchasedCollectionId}`);
        }
      } catch (error) {
        console.error(`SuccessfulPayment (Collection): Ошибка при сохранении покупки коллекции ${purchasedCollectionId} для ${telegramUserId}:`, error);
      }
    } else {
      console.error('SuccessfulPayment (Collection): Не удалось извлечь purchasedCollectionId из payload:', invoice_payload);
      collectionTitleForMessage = 'ваша коллекция';
    }

    try {
      await bot.sendMessage(chatId, 
        `Спасибо за покупку коллекции "${collectionTitleForMessage}"!\n\nСумма: ${total_amount / 100} ${currency}.\nДоступ ко всем бандлам коллекции предоставлен. Вы можете найти их в соответствующем разделе приложения.`
      );
      console.log(`Сообщение об успешной покупке коллекции ("${collectionTitleForMessage}") отправлено пользователю ${telegramUserId} в чат ${chatId}.`);
    } catch (error) {
      console.error(`Ошибка при отправке сообщения об успешной покупке коллекции пользователю ${telegramUserId}:`, error);
    }
  } else {
    console.error('SuccessfulPayment: Неизвестный тип payload:', invoice_payload);
    try {
       await bot.sendMessage(telegramUserId, 'Ваш платеж прошел успешно, но мы не смогли определить тип покупки. Пожалуйста, свяжитесь с поддержкой.');
    } catch (sendError) {
      console.error('Failed to send error message to user about unknown purchase type', sendError);
    }
  }
});

module.exports = {
  createInvoice,
  createCollectionInvoice,
  // handlePaymentWebhook теперь не нужен, если вся логика в bot.on()
};