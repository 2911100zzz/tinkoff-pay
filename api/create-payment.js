import crypto from 'crypto';

/* реквизиты Demo-терминала */
const TERMINAL_KEY = '1751222414062DEMO';
const SECRET_KEY   = 'cphAtzhjwfgaWb#$';

const SUCCESS_URL  = 'https://project5662082.tilda.ws/success';
const FAIL_URL     = 'https://project5662082.tilda.ws/fail';

const SAVE_URL     = 'http://tc-soft.ru/TC2019/Pay/save-order.php';

/* helpers */
function makeOrderId() {
  return 'ORD' + Date.now().toString(36) + crypto.randomBytes(3).toString('hex');
}
function makeToken(obj) {
  // 1) копируем объект и добавляем пароль как поле Password
  const data = { ...obj, Password: SECRET_KEY };

  // 2) удаляем поля-объекты, которые не участвуют в подписи
  delete data.Token;
  delete data.Receipt;
  delete data.DATA;   // ← если есть

  // 3) сортируем ключи и конкатенируем ТОЛЬКО значения
  const str = Object.keys(data)
    .sort()
    .map(k => data[k])
    .join('');          // ← БЕЗ добавления SECRET_KEY вторично!

  return crypto.createHash('sha256').update(str).digest('hex');
}


export default async function handler(req, res) {
  /* CORS pre-flight */
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin',  '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).end();
  }
  if (req.method !== 'POST') return res.status(405).end('method not allowed');
  res.setHeader('Access-Control-Allow-Origin', '*');

  try {
    const { license = '', amount } = req.body || {};
    const licenses = license.split(/[\n,]+/).map(x => x.trim()).filter(Boolean);
    if (!licenses.length || !amount || isNaN(amount))
      return res.status(400).json({ error: 'missing fields' });

    const orderId = makeOrderId();

    /* сохраняем заказ на своём сервере (не критично при ошибке) */
    try {
      await fetch(SAVE_URL, {
        method : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body   : JSON.stringify({
+      orderId,
+      amount: Number(amount),   // ← сумма в рублях
+      licenses
+    })
      });
    } catch {}

    const payload = {
      TerminalKey: TERMINAL_KEY,
      Amount     : Math.round(Number(amount) * 100),
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

    /* временные логи – смотрим в Runtime Logs */
    console.log('Init payload:', payload);
    console.log('Tinkoff response:', bankRes);

    return res.status(200).json(bankRes);
  } catch (e) {
    console.error('create-payment fatal:', e);
    return res.status(500).json({ error: 'internal server error' });
  }
}

export const config = { api: { bodyParser: true } };
