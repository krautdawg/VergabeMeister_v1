import 'dotenv/config';
import { ContactsApi, CreateList, ContactsApiApiKeys } from '@getbrevo/brevo';

const apiKey = process.env.BREVO_API_KEY;

if (!apiKey) {
  console.error('Error: BREVO_API_KEY is not set in .env');
  process.exit(1);
}

const contactsApi = new ContactsApi();
contactsApi.setApiKey(ContactsApiApiKeys.apiKey, apiKey);

async function setup() {
  try {
    // Brevo requires a folderId — get the default folder (ID 1)
    const folders = await contactsApi.getFolders(10, 0);
    const folderId = folders.body.folders?.[0]?.id ?? 1;

    const newList = new CreateList();
    newList.name = 'VergabeMeister Warteliste';
    newList.folderId = folderId;

    const result = await contactsApi.createList(newList);
    const listId = result.body.id;

    console.log('Contact list created successfully!');
    console.log(`List ID: ${listId}`);
    console.log('');
    console.log(`Add this to your .env file:`);
    console.log(`BREVO_LIST_ID=${listId}`);
  } catch (err) {
    if (err.response?.body?.message?.includes('already exist')) {
      console.error('A list with this name already exists. Check your Brevo dashboard for the list ID.');
    } else {
      console.error('Failed to create list:', err.response?.body || err.message);
    }
    process.exit(1);
  }
}

setup();
