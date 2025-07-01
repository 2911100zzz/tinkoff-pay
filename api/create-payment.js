// tinkoff-pay/api/create-payment.js
import crypto from 'crypto';
import fetch from 'node-fetch';

const TERMINAL_KEY = '1751222414062DEMO';
const PASSWORD     = 'cphAtzhjwfgaWb#$';
const SUCCESS_URL  = 'https://project5662082.tilda.ws/success';
const FAIL_URL     = 'https://project5662082.tilda.ws/fail';

// ───── генерация короткого уникального orderId ─────
function makeOrderId () {
  const ts  = Date.now().toString(36);          // 8-9 симв.
  const rnd = crypto.randomBytes(3).toString('hex'); // 6 симв.
  return `ord-${ts}-${rnd}`;                    // всего ~20 симв.
}

// ───── расчёт Token для Init ─────
function makeToken (obj) {
  const o = { ...obj, Password: PASSWORD };
  const str = Object.keys(o).sort().map(k => `${k}=${o[k]}`).join('');
  return crypto.createHash('sha256').update(str).digest('hex');
}

export default async function handler (req, res) {
  if (req.method !== 'POST') return res.status(405).end('method not allowed');

  try {
    const { license, amount } = req.body;          // license = "строка c номерами через , "
    const licensesArr = license.split(',').map(s => s.trim()).filter(Boolean);

    if (!licensesArr.length || !amount) {
      return res.status(400).json({ error: 'missing fields' });
    }

    /* 1. генерируем уникальный orderId */
    const orderId = makeOrderId();

    /* 2. сохраняем заказ на ваш сервер */
    await fetch('http://tc-soft.ru/TC2019/Pay/save-order.php', {
      method : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body   : JSON.stringify({ orderId, licenses: licensesArr })
    });

    /* 3. создаём платёж в Tinkoff */
    const payload = {
      TerminalKey: TERMINAL_KEY,
      Amount     : Math.round(amount * 100),
      OrderId    : orderId,
      Description: 'оплата лицензий',
      SuccessURL : SUCCESS_URL,
      FailURL    : FAIL_URL
    };
    payload.Token = makeToken(payload);

    const bankRes = await fetch('https://securepay.tinkoff.ru/v2/Init', {
      method : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body   : JSON.stringify(payload)
    }).then(r => r.json());

    return res.status(200).json(bankRes);
  } catch (e) {
    console.error('create-payment error:', e);
    return res.status(500).json({ error: 'internal error' });
  }
}

/* Vercel runtime config */
export const config = { api: { bodyParser: true } };
