/* ---------- imports ---------- */
import https  from 'https';
import crypto from 'crypto';

/* ---------- конфигурация ---------- */
const TERMINAL_KEY = '1751222414062DEMO';       // ваш тестовый TerminalKey
const PASSWORD     = 'cphAtzhjwfgaWb#$';        // ваш тестовый Password
const SUCCESS_URL  = 'https://project5662082.tilda.ws/success';
const FAIL_URL     = 'https://project5662082.tilda.ws/fail';

/* ---------- вспомогательные функции ---------- */
function generateToken(params) {
  // добавляем пароль, удаляем поля-объекты
  const data = { ...params, Password: PASSWORD };
  delete data.DATA; delete data.Receipt;
  delete data.Shops; delete data.ReceiptData;

  const concat = Object.keys(data).sort().map(k => data[k]).join('');
  return crypto.createHash('sha256').update(concat).digest('hex');
}

/* ---------- основной обработчик ---------- */
export default async function handler(req, res) {
  /* --- CORS --- */
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  /* ------------- */

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { license, amount } = req.body || {};
    if (!license || !amount) {
      return res.status(400).json({ error: 'Missing license or amount' });
    }

    const orderId = Date.now() + '_' + license.replace(/[^a-zA-Z0-9]/g, '');
    const payload = {
      TerminalKey: TERMINAL_KEY,
      Amount: Math.round(Number(amount) * 100),
      OrderId: orderId,
      Description: `Оплата лицензии ${license}`,
      SuccessURL: SUCCESS_URL,
      FailURL: FAIL_URL,
      DATA: { License: license }
    };
    payload.Token = generateToken(payload);
    const body = JSON.stringify(payload);

    /* --- запрос в Т-Банк /v2/Init --- */
    const tinkoffResp = await new Promise((resolve, reject) => {
      const reqPay = https.request(
        {
          hostname: 'securepay.tinkoff.ru',
          path: '/v2/Init',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(body)
          }
        },
        resp => {
          let data = '';
          resp.on('data', chunk => (data += chunk));
          resp.on('end', () => resolve(JSON.parse(data)));
        }
      );
      reqPay.on('error', reject);
      reqPay.write(body);
      reqPay.end();
    });
    /* --------------------------------- */

    return res.status(200).json(tinkoffResp);
  } catch (err) {
    console.error('create-payment error:', err);
    return res.status(500).json({ error: 'Internal Server Error', details: err.message });
  }
}
