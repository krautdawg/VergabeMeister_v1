import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { addSubscriber, sendConfirmationEmail, getSubscriberCount } from './brevo.js';

const router = Router();

// Rate limit signup: 5 requests per 15 minutes per IP
const signupLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Zu viele Anfragen. Bitte versuche es später erneut.' },
});

// Simple email validation
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * POST /api/signup
 * Body: { email: string }
 * Returns 201 for new subscriber, 200 for existing, 400 for invalid input.
 */
router.post('/signup', signupLimiter, async (req, res) => {
  try {
    const { email } = req.body ?? {};

    if (!email || typeof email !== 'string') {
      return res.status(400).json({ error: 'E-Mail-Adresse fehlt.' });
    }

    const trimmed = email.trim().toLowerCase();
    if (!isValidEmail(trimmed)) {
      return res.status(400).json({ error: 'Ungültige E-Mail-Adresse.' });
    }

    const { created } = await addSubscriber(trimmed);

    // Fire-and-forget confirmation email (don't block response)
    sendConfirmationEmail(trimmed).catch((err) => {
      console.error('Failed to send confirmation email:', err.response?.body || err.message);
    });

    if (created) {
      return res.status(201).json({ message: 'Erfolgreich eingetragen!' });
    }
    return res.status(200).json({ message: 'Du bist bereits auf der Warteliste.' });
  } catch (err) {
    console.error('Signup error:', err.response?.body || err.message);
    return res.status(500).json({ error: 'Etwas ist schiefgelaufen. Bitte versuche es erneut.' });
  }
});

/**
 * GET /api/count
 * Returns { count: N } from cached Brevo data.
 */
router.get('/count', async (_req, res) => {
  try {
    const count = await getSubscriberCount();
    return res.json({ count });
  } catch (err) {
    console.error('Count error:', err.message);
    return res.json({ count: 0 });
  }
});

/**
 * GET /api/health
 * Simple health check.
 */
router.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

export default router;
