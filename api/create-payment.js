/*  api/create-payment.js
 *  Создаёт платёж в Tinkoff и сохраняет OrderId → лицензии
 *  (Node 18+ — можно использовать встроенный fetch, node-fetch не нужен)
 */

import crypto from 'crypto';

/* === 1. реквизиты терминала === */
const TERMINAL_KEY = '1751222414102';
const SECRET_KEY   = 'bKqncR!3sO5Ti2Si';

const SUCCESS_URL  = 'https://project5662082.tilda.ws/success';
const FAIL_URL     = 'https://project5662082.tilda.ws/fail';

/* URL скрипта на вашем сервере, куда сохраняем заказ */
const SAVE_URL     = 'http://tc-soft.ru/TC2019/Pay/save-order.php';

/* === 2. utilities === */

/* уникальный, короткий (< 36 симв.) OrderId */
function makeOrderId () {
  return (
    'ORD' +
    Date.now().toString(36) +      // время
    crypto.randomBytes(3).toString('hex')  // 6 симв. случайно
  );
}

/* правильная подпись (Token) — конкатенация ТОЛЬКО значений + SecretKey */
function makeToken(obj) {
  const data = { ...obj };           // копируем объект без Token
  delete data.Token;
  delete data.Receipt;               // (Receipt не участвует)
  // 1) сортируем ключи
  // 2) конкатенируем ТОЛЬКО значения
  // 3) + SecretKey в КОНЕЦ
  const str = Object.keys(data)
    .sort()
    .reduce((acc, k) => acc + data[k], '') + SECRET_KEY;

  return crypto.createHash('sha256').update(str).digest('hex');
}


/* === 3. handler === */
export default async function handler (req, res) {
  /* — CORS preflight — */
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin',  '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).end();
  }
  if (req.method !== 'POST') {
    return res.status(405).end('method not allowed');
  }
  res.setHeader('Access-Control-Allow-Origin', '*');

  try {
    /* входные поля формы */
    const { license = '', amount } = req.body || {};
    const licensesArr = license
      .split(/[\n,]+/)
      .map(s => s.trim())
      .filter(Boolean);

    if (!licensesArr.length || !amount || isNaN(amount)) {
      return res.status(400).json({ error: 'missing fields' });
    }

    /* уникальный OrderId */
    const orderId = makeOrderId();

    /* сохраняем заказ на сервере (не критично, если не удастся) */
    try {
      await fetch(SAVE_URL, {
        method : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body   : JSON.stringify({ orderId, licenses: licensesArr })
      });
    } catch (e) {
      console.error('save-order failed (ignored):', e.message);
    }

    /* формируем запрос Init */
const payload = {
  TerminalKey: TERMINAL_KEY,
  Amount     : Math.round(Number(amount) * 100),
  OrderId    : orderId,
  Description: 'оплата лицензий',
  SuccessURL : SUCCESS_URL,   // используем объявленную константу
  FailURL    : FAIL_URL       // и константу FAIL_URL
};

    payload.Token = makeToken(payload);

    /* запрос к Tinkoff */
    const bankRes = await fetch('https://securepay.tinkoff.ru/v2/Init', {
      method : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body   : JSON.stringify(payload)
    }).then(r => r.json());

    return res.status(200).json(bankRes);
  } catch (err) {
    console.error('create-payment fatal:', err);
    return res.status(500).json({ error: 'internal server error' });
  }
}

/* — bodyParser включён — */
export const config = { api: { bodyParser: true } };
