require('dotenv').config();
const fetch = require('node-fetch'); // Или используйте import fetch from 'node-fetch'; если у вас ES Modules
const bot = require('../config/telegramBot');

const TEST_PROVIDER_TOKEN = process.env.TELEGRAM_TEST_PROVIDER_TOKEN;
const MAIN_API_BASE_URL = process.env.MAIN_API_BASE_URL || 'https://rhythmcapsule.ru/api'; // URL вашего основного API

// Удаляем захардкоженные bundlesData
// const bundlesData = { ... };

const createInvoice = async (req, res) => {
  const { bundleId, userId } = req.body;

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

  console.log(`Получен pre_checkout_query от пользователя ${userId} для заказа ${invoicePayload}. Сумма: ${totalAmount} ${currency}. Query ID: ${queryId}`);

  // Извлекаем bundleId из payload
  // Пример payload: `bundle_purchase_${bundleId}_user_${userId}_${Date.now()}`
  const payloadParts = invoicePayload.split('_');
  const bundleIdFromPayload = payloadParts.length > 2 ? payloadParts[2] : null;

  if (!bundleIdFromPayload) {
    console.error('Не удалось извлечь bundleId из preCheckoutQuery payload:', invoicePayload);
    await bot.answerPreCheckoutQuery(queryId, false, { error_message: 'Ошибка обработки заказа.' });
    return;
  }

  try {
    // Получаем актуальные детали бандла с вашего основного API для проверки
    const bundleResponse = await fetch(`${MAIN_API_BASE_URL}/bundles/${bundleIdFromPayload}/details`);
    if (!bundleResponse.ok) {
      const errorData = await bundleResponse.json().catch(() => ({ message: 'Не удалось проверить товар' }));
      console.error(`PreCheckout: Ошибка при получении деталей бандла ${bundleIdFromPayload} с основного API: ${bundleResponse.status}`, errorData.message);
      await bot.answerPreCheckoutQuery(queryId, false, { error_message: errorData.message });
      return;
    }
    const bundleDetails = await bundleResponse.json();

    // ПРОВЕРКА: Сумма и валюта из preCheckoutQuery должны совпадать с актуальными данными бандла
    if (bundleDetails.price_in_smallest_unit !== totalAmount || bundleDetails.currency.toUpperCase() !== currency.toUpperCase()) {
      console.warn(`PreCheckout: Несоответствие цены/валюты для бандла ${bundleIdFromPayload}.`);
      console.warn(`  Ожидалось: ${bundleDetails.price_in_smallest_unit} ${bundleDetails.currency}, Получено от TG: ${totalAmount} ${currency}`);
      await bot.answerPreCheckoutQuery(queryId, false, { error_message: 'Цена или валюта товара изменились. Пожалуйста, попробуйте снова.' });
      return;
    }

    // Дополнительные проверки (например, доступен ли товар и т.д.) можно добавить здесь

    await bot.answerPreCheckoutQuery(queryId, true);
    console.log(`Успешно ответили на pre_checkout_query (ID: ${queryId}) для бандла ${bundleIdFromPayload}.`);

  } catch (error) {
    console.error(`PreCheckout: Ошибка при проверке бандла ${bundleIdFromPayload}:`, error);
    // Не отвечаем false, если была ошибка связи, чтобы Telegram мог повторить
    // Однако, если ошибка критическая и мы не хотим разрешать платеж, можно ответить false.
    // По умолчанию, если мы здесь, лучше не отвечать, чтобы избежать двойного списания при повторе.
    // Но если это ошибка валидации с нашей стороны, то false.
    // Для простоты, если есть ошибка, то не отвечаем, давая Telegram решить.
  }
});

// Обработчик успешного платежа (SuccessfulPayment)
bot.on('successful_payment', async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const { currency, total_amount, invoice_payload, telegram_payment_charge_id, provider_payment_charge_id } = msg.successful_payment;

  console.log(`Успешный платеж от пользователя ${userId} (чат ${chatId})`);
  console.log(`  Payload: ${invoice_payload}`);
  console.log(`  Сумма: ${total_amount / 100} ${currency}`);
  console.log(`  Telegram Payment Charge ID: ${telegram_payment_charge_id}`);
  console.log(`  Provider Payment Charge ID: ${provider_payment_charge_id}`);

  const payloadParts = invoice_payload.split('_');
  const purchasedBundleId = payloadParts.length > 2 ? payloadParts[2] : null;

  let bundleTitle = purchasedBundleId || 'купленный товар';
  if (purchasedBundleId) {
    try {
      const bundleResponse = await fetch(`${MAIN_API_BASE_URL}/bundles/${purchasedBundleId}/details`);
      if (bundleResponse.ok) {
        const bundleDetails = await bundleResponse.json();
        bundleTitle = bundleDetails.title || bundleTitle;
      }
    } catch (fetchError) {
      console.warn(`SuccessfulPayment: Не удалось получить название бандла ${purchasedBundleId} для сообщения. Ошибка: ${fetchError.message}`);
    }
  }

  try {
    await bot.sendMessage(chatId, 
      `Спасибо за покупку "${bundleTitle}"!

Сумма: ${total_amount / 100} ${currency}.
Доступ к материалам предоставлен. Вы можете найти их в разделе "Моя Коллекция" или "База Барабанщика" в приложении.`
    );
    console.log(`Сообщение об успешной покупке бандла ${purchasedBundleId} отправлено пользователю ${userId}.`);
    
    // !!! ВАЖНО: Здесь должна быть логика предоставления доступа к бандлу в вашей БД !!!
    // Например, на вашем "основном сервере" может быть API для отметки, что пользователь ${userId} купил ${purchasedBundleId}
    // await fetch(`${MAIN_API_BASE_URL}/user/${userId}/grant-bundle-access`, { method: 'POST', body: JSON.stringify({ bundleId: purchasedBundleId }) });

  } catch (error) {
    console.error(`Ошибка при отправке сообщения об успешной покупке пользователю ${userId}:`, error);
  }
});

module.exports = {
  createInvoice,
}; 