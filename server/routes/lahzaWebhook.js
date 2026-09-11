const express = require('express');
const router  = express.Router();
const { verifyWebhookSignature } = require('../lib/lahza');
const { completeLahzaPayment } = require('./lahza');

// Mounted in index.js with express.raw({ type: 'application/json' })
// BEFORE the global express.json() — req.body here is the raw Buffer,
// not a parsed object, because the signature check needs the exact
// bytes Lahza actually signed (see lib/lahza.js's verifyWebhookSignature
// comment, and the "if a real card processor ever comes back" note that
// used to sit where Paddle's webhook was mounted).
router.post('/', async (req, res) => {
  const signature = req.headers['x-lahza-signature'];
  const rawBody = req.body; // Buffer, thanks to express.raw() in index.js

  if (!verifyWebhookSignature(rawBody, signature)) {
    console.error('[lahza webhook] signature check failed — ignoring');
    return res.status(401).json({ error: 'Invalid signature' });
  }

  let event;
  try { event = JSON.parse(rawBody.toString('utf8')); } catch (_) {
    return res.status(400).json({ error: 'Invalid JSON' });
  }

  // Ack immediately — Lahza just needs a 200 to stop retrying this
  // event. The actual grant happens after responding; completeLahzaPayment
  // is idempotent (see routes/lahza.js) so there's no harm in that.
  res.status(200).json({ received: true });

  if (event?.event === 'charge.success') {
    const reference = event.data?.reference;
    if (reference) {
      try {
        const result = await completeLahzaPayment(reference);
        if (!result.ok && !result.alreadyProcessed) {
          console.error('[lahza webhook] charge.success but grant failed:', reference, result.reason);
        }
      } catch (e) {
        console.error('[lahza webhook] completeLahzaPayment threw:', e.message);
      }
    }
  }
});

module.exports = router;
