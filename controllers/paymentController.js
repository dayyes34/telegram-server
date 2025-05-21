require('dotenv').config();
const bot = require('../config/telegramBot');

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
    // photo_url: bundleDetails.photo_url, // Опционально
    // start_parameter: `bundle_${bundleId}` // Можно использовать для deeplink, если нужно
  };

  console.log("DEBUG (paymentController): Arguments for createInvoiceLink:", JSON.stringify(invoiceParams, null, 2)); // Добавляем лог

  try {
    // Создаем ссылку на инвойс вместо прямой отправки
    const invoiceLink = await bot.createInvoiceLink(
      invoiceParams.title,
      invoiceParams.description,
      invoiceParams.payload,
      invoiceParams.provider_token,
      invoiceParams.currency,
      invoiceParams.prices,
      {
        // photo_url: invoiceParams.photo_url, // Передаем опциональные параметры сюда
        // start_parameter: invoiceParams.start_parameter
      }
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

// Обработчик PreCheckoutQuery (ОБЯЗАТЕЛЬНО НУЖЕН для подтверждения платежа)
// Telegram отправляет этот запрос перед тем, как списать деньги.
// Вы должны ответить в течение 10 секунд.
bot.on('pre_checkout_query', async (preCheckoutQuery) => {
  const queryId = preCheckoutQuery.id;
  const userId = preCheckoutQuery.from.id;
  const invoicePayload = preCheckoutQuery.invoice_payload;
  const totalAmount = preCheckoutQuery.total_amount; // Сумма в копейках от Telegram
  const currency = preCheckoutQuery.currency; // Валюта от Telegram
  const fetch = (await import('node-fetch')).default; // Динамический импорт

  console.log(`Получен pre_checkout_query от пользователя ${userId} для заказа ${invoicePayload}. Сумма: ${totalAmount} ${currency}. Query ID: ${queryId}`);

  // Извлекаем bundleId из payload
  const payloadParts = invoicePayload.split('_');
  const bundleIdFromPayload = payloadParts.length > 2 ? payloadParts[2] : null;

  if (!bundleIdFromPayload) {
    console.error('Не удалось извлечь bundleId из preCheckoutQuery payload:', invoicePayload);
    await bot.answerPreCheckoutQuery(queryId, false, { error_message: 'Ошибка обработки заказа.' });
    return;
  }

  try {
    const bundleResponse = await fetch(`${MAIN_API_BASE_URL}/bundles/${bundleIdFromPayload}/details`);
    if (!bundleResponse.ok) {
      const errorData = await bundleResponse.json().catch(() => ({ message: 'Не удалось проверить товар' }));
      console.error(`PreCheckout: Ошибка при получении деталей бандла ${bundleIdFromPayload} с основного API: ${bundleResponse.status}`, errorData.message);
      await bot.answerPreCheckoutQuery(queryId, false, { error_message: errorData.message });
      return;
    }
    const bundleDetails = await bundleResponse.json();

    if (bundleDetails.price_in_smallest_unit !== totalAmount || bundleDetails.currency.toUpperCase() !== currency.toUpperCase()) {
      console.warn(`PreCheckout: Несоответствие цены/валюты для бандла ${bundleIdFromPayload}.`);
      console.warn(`  Ожидалось: ${bundleDetails.price_in_smallest_unit} ${bundleDetails.currency}, Получено от TG: ${totalAmount} ${currency}`);
      await bot.answerPreCheckoutQuery(queryId, false, { error_message: 'Цена или валюта товара изменились. Пожалуйста, попробуйте снова.' });
      return;
    }

    await bot.answerPreCheckoutQuery(queryId, true);
    console.log(`Успешно ответили на pre_checkout_query (ID: ${queryId}) для бандла ${bundleIdFromPayload}.`);

  } catch (error) {
    console.error(`PreCheckout: Ошибка при проверке бандла ${bundleIdFromPayload}:`, error);
    // Не отвечаем, чтобы Telegram мог повторить, если это ошибка связи.
    // Если это ошибка нашей валидации, то false.
  }
});

// Обработчик успешного платежа (SuccessfulPayment)
bot.on('successful_payment', async (msg) => {
  const chatId = msg.chat.id; // ID чата, где произошла оплата (нужен для отправки сообщения)
  const userId = msg.from.id;  // Telegram User ID плательщика
  const fetch = (await import('node-fetch')).default; // Динамический импорт
  const { 
    currency, 
    total_amount, 
    invoice_payload, 
    telegram_payment_charge_id, 
    provider_payment_charge_id 
  } = msg.successful_payment;

  console.log(`Успешный платеж от пользователя ${userId} (чат ${chatId})`);
  console.log(`  Payload: ${invoice_payload}`);
  console.log(`  Сумма: ${total_amount / 100} ${currency}`); // total_amount в копейках
  console.log(`  Telegram Payment Charge ID: ${telegram_payment_charge_id}`);
  console.log(`  Provider Payment Charge ID: ${provider_payment_charge_id}`);

  // Извлекаем bundleId из payload
  // Payload: `bundle_purchase_${bundleId}_user_${originalUserId}_${Date.now()}`
  // Нам нужен bundleId
  const payloadParts = invoice_payload.split('_');
  const purchasedBundleId = payloadParts.length > 2 ? payloadParts[2] : null; // bundleId должен быть третьим элементом

  let bundleTitleForMessage = purchasedBundleId || 'купленный товар';

  if (purchasedBundleId) {
    // Получаем название бандла для сообщения пользователю (не критично, если не получится)
    try {
      const bundleDetailsResponse = await fetch(`${MAIN_API_BASE_URL}/bundles/${purchasedBundleId}/details`);
      if (bundleDetailsResponse.ok) {
        const bundleDetails = await bundleDetailsResponse.json();
        bundleTitleForMessage = bundleDetails.title || bundleTitleForMessage;
      }
    } catch (fetchError) {
      console.warn(`SuccessfulPayment: Не удалось получить название бандла ${purchasedBundleId} для сообщения. Ошибка: ${fetchError.message}`);
    }

    // --- РЕГИСТРАЦИЯ ПОКУПКИ НА ОСНОВНОМ СЕРВЕРЕ ---
    try {
      const grantAccessResponse = await fetch(`${MAIN_API_BASE_URL}/users/${userId}/grant-bundle-access`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Если ваш основной API требует аутентификации для этого эндпоинта, добавьте заголовок Authorization
          // 'Authorization': `Bearer ${process.env.YOUR_MAIN_API_INTERNAL_TOKEN}` 
        },
        body: JSON.stringify({
          bundleId: purchasedBundleId,
          telegramPaymentChargeId: telegram_payment_charge_id,
          providerPaymentChargeId: provider_payment_charge_id,
        }),
      });

      if (grantAccessResponse.ok) {
        const grantResult = await grantAccessResponse.json();
        console.log(`SuccessfulPayment: Доступ к бандлу ${purchasedBundleId} для пользователя ${userId} успешно зарегистрирован на основном сервере.`, grantResult.message);
      } else {
        // Если основной сервер вернул ошибку (например, бандл уже куплен или другая ошибка)
        const errorResult = await grantAccessResponse.json().catch(() => ({ message: grantAccessResponse.statusText }));
        console.error(`SuccessfulPayment: Ошибка при регистрации покупки бандла ${purchasedBundleId} для пользователя ${userId} на основном сервере. Статус: ${grantAccessResponse.status}. Ответ:`, errorResult.message);
        // В этой ситуации платеж в Telegram прошел. Нужно решить, что делать.
        // Можно попробовать отправить администратору уведомление, или пометить для ручной проверки.
        // Пока просто логируем.
      }
    } catch (error) {
      console.error(`SuccessfulPayment: Сетевая ошибка или ошибка JSON при попытке зарегистрировать покупку бандла ${purchasedBundleId} для ${userId} на основном сервере:`, error);
      // Также критическая ситуация, так как платеж прошел, а доступ не предоставлен.
    }
    // --- КОНЕЦ РЕГИСТРАЦИИ ПОКУПКИ ---

  } else {
    console.error('SuccessfulPayment: Не удалось извлечь purchasedBundleId из payload:', invoice_payload);
    // Отправляем общее сообщение, так как не знаем, что было куплено
    bundleTitleForMessage = 'ваш заказ';
  }

  // Отправляем сообщение пользователю о успешной покупке
  try {
    await bot.sendMessage(chatId, 
      `Спасибо за покупку "${bundleTitleForMessage}"!

Сумма: ${total_amount / 100} ${currency}.
Доступ к материалам предоставлен. Вы можете найти их в соответствующем разделе приложения.`
    ); // Сообщение немного изменено для универсальности
    console.log(`Сообщение об успешной покупке ("${bundleTitleForMessage}") отправлено пользователю ${userId} в чат ${chatId}.`);
  } catch (error) {
    console.error(`Ошибка при отправке сообщения об успешной покупке пользователю ${userId}:`, error);
  }
});

module.exports = {
  createInvoice,
}; 