const https = require('https');

const TERMINAL_KEY = '1751222414062DEMO';
const PASSWORD     = 'cphAtzhjwfgaWb#$';
const SUCCESS_URL  = 'https://project5662082.tilda.ws/success';
const FAIL_URL     = 'https://project5662082.tilda.ws/fail';

function generateToken(params) {
  const crypto = require('crypto');
  const sorted = Object.assign({}, params, { Password: PASSWORD });
  const ordered = Object.keys(sorted).sort().map(k => sorted[k]).join('');
  return crypto.createHash('sha256').update(ordered).digest('hex');
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }

  try {
    const { license, amount } = req.body;
    if (!license || !amount) {
      res.status(400).json({ error: 'Missing license or amount' });
      return;
    }

    const orderId = Date.now() + '-' + license.replace(/[^a-zA-Z0-9]/g, '');
    const payload = {
      TerminalKey: TERMINAL_KEY,
      Amount: Math.round(amount * 100),
      OrderId: orderId,
      Description: `Оплата лицензии ${license}`,
      SuccessURL: SUCCESS_URL,
      FailURL: FAIL_URL,
      DATA: { License: license }
    };

    payload.Token = generateToken(payload);

    const response = await fetch('https://securepay.tinkoff.ru/v2/Init', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ error: 'Internal Server Error', details: err.message });
  }
}
