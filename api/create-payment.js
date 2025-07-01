/*  api/create-payment.js
 *  Vercel API Route: принимает POST из формы, сохраняет заказ на вашем сервере
 *  и создаёт платёж в Tinkoff.  CORS-safe, зависит только от node-fetch.
 *  ───────────────────────────────────────────────────────────────────────── */

import crypto from 'crypto';
import fetch  from 'node-fetch';         // <-- в package.json:  "node-fetch": "^3.3.2"

/* === 1. Константы вашего магазина  === */
const TERMINAL_KEY = '1751222414062DEMO';
const PASSWORD     = 'cphAtzhjwfgaWb#$';

const SUCCESS_URL  = 'https://project5662082.tilda.ws/success';
const FAIL_URL     = 'https://project5662082.tilda.ws/fail';

/* URL, куда сохраняем «OrderId → лицензии» на вашем сервере */
const SAVE_URL     = 'http://tc-soft.ru/TC2019/Pay/save-order.php';

/* === 2. Вспомогательные функции === */

/* короткий уникальный orderId: ord-<ts36>-<randHex6>  (≈ 20 символов) */
function makeOrderId () {
  const ts  = Date.now().toString(36);          // timestamp в 36-чной
  const rnd = crypto.randomBytes(3).toString('hex');
  return `ord-${ts}-${rnd}`;
}

/* Шифр SHA-256: согласно документации Tinkoff v2/Init */
function makeToken (obj) {
  const data = { ...obj, Password: PASSWORD };
  const str  = Object.keys(data)
    .sort()
    .map(k => `${k}=${data[k]}`)
    .join('');
  return crypto.createHash('sha256').update(str).digest('hex');
}

/* === 3. Основной обработчик  === */
export default async function handler (req, res) {
  /* ── CORS pre-flight ── */
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin',  '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).end('method not allowed');
  }

  /* разрешаем CORS для самого POST-ответа */
  res.setHeader('Access-Control-Allow-Origin', '*');

  try {
    const { license = '', amount } = req.body || {};

    /* 1) нормализуем список лицензий */
    const licensesArr = license
      .split(/[\n,]+/)
      .map(s => s.trim())
      .filter(s => s.length > 0);

    if (!licensesArr.length || !amount || isNaN(amount)) {
      return res.status(400).json({ error: 'missing or bad fields' });
    }

    /* 2) генерируем уникальный OrderId */
    const orderId = makeOrderId();

    /* 3) сохраняем данные заказа на вашем сервере */
    try {
      await fetch(SAVE_URL, {
        method : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body   : JSON.stringify({ orderId, licenses: licensesArr })
      });
    } catch (e) {
      console.error('save-order failed (проигнорировано):', e.message);
      /* не прерываем процесс — платёж всё равно создадим */
    }

    /* 4) собираем payload для /v2/Init */
    const payload = {
      TerminalKey: TERMINAL_KEY,
      Amount     : Math.round(parseFloat(amount) * 100), // в копейках
      OrderId    : orderId,
      Description: 'оплата лицензий',
      SuccessURL,
      FailURL
    };
    payload.Token = makeToken(payload);

    /* 5) запрос к Tinkoff */
    const bankRes = await fetch('https://securepay.tinkoff.ru/v2/Init', {
      method : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body   : JSON.stringify(payload)
    }).then(r => r.json());

    return res.status(200).json(bankRes);
  } catch (err) {
    console.error('create-payment error:', err);
    return res.status(500).json({ error: 'internal server error' });
  }
}

/* Включаем парсинг JSON-тела у Vercel */
export const config = { api: { bodyParser: true } };
