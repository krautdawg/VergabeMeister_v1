import {
  ContactsApi,
  CreateContact,
  ContactsApiApiKeys,
  TransactionalEmailsApi,
  TransactionalEmailsApiApiKeys,
  SendSmtpEmail,
} from '@getbrevo/brevo';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const contactsApi = new ContactsApi();
contactsApi.setApiKey(ContactsApiApiKeys.apiKey, process.env.BREVO_API_KEY);

const emailApi = new TransactionalEmailsApi();
emailApi.setApiKey(TransactionalEmailsApiApiKeys.apiKey, process.env.BREVO_API_KEY);

const listId = Number(process.env.BREVO_LIST_ID);

// --- Subscriber count cache ---
let cachedCount = 0;
let cacheTimestamp = 0;
const CACHE_TTL = 60_000; // 60 seconds

/**
 * Add a subscriber to the Brevo contact list.
 * Returns { created: true } for new additions, { created: false } if already on the list.
 */
export async function addSubscriber(email) {
  // Check if contact is already on this specific list
  let alreadyOnList = false;
  try {
    const info = await contactsApi.getContactInfo(email);
    alreadyOnList = info.body.listIds?.includes(listId) ?? false;
  } catch {
    // Contact doesn't exist yet — that's fine
  }

  const contact = new CreateContact();
  contact.email = email;
  contact.listIds = [listId];
  contact.updateEnabled = true;

  await contactsApi.createContact(contact);

  // Invalidate the subscriber count cache so it refreshes
  cacheTimestamp = 0;

  return { created: !alreadyOnList };
}

/**
 * Send the branded confirmation email via Brevo transactional API.
 */
export async function sendConfirmationEmail(email) {
  const templatePath = join(__dirname, '..', 'templates', 'confirmation-email.html');
  const htmlContent = readFileSync(templatePath, 'utf-8');

  const message = new SendSmtpEmail();
  message.subject = 'Willkommen auf der VergabeMeister-Warteliste!';
  message.htmlContent = htmlContent;
  message.textContent = [
    'Du bist dabei!',
    '',
    'Danke, dass du dich für die VergabeMeister-Warteliste eingetragen hast.',
    '',
    'Was kommt als Nächstes?',
    '- Wir arbeiten mit Hochdruck am Launch.',
    '- Du bekommst als Erste/r Zugang, sobald wir starten.',
    '- Bis dahin: Lehn dich zurück — wir melden uns.',
    '',
    'Dein VergabeMeister-Team',
    '',
    '---',
    '© 2026 VergabeMeister',
  ].join('\n');
  message.sender = {
    email: process.env.BREVO_SENDER_EMAIL,
    name: process.env.BREVO_SENDER_NAME,
  };
  message.to = [{ email }];
  message.tags = ['waitlist-confirmation'];

  await emailApi.sendTransacEmail(message);
}

/**
 * Get the subscriber count for the waitlist, with 60s in-memory cache.
 */
export async function getSubscriberCount() {
  const now = Date.now();
  if (now - cacheTimestamp < CACHE_TTL) {
    return cachedCount;
  }

  try {
    const listDetails = await contactsApi.getList(listId);
    cachedCount = listDetails.body.totalSubscribers ?? 0;
    cacheTimestamp = now;
  } catch (err) {
    console.error('Failed to fetch subscriber count:', err.response?.body || err.message);
    // Return last known count on error
  }

  return cachedCount;
}
