import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import apiRoutes from './api/routes.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Serve static files from public/
app.use(express.static(join(__dirname, 'public')));

// Mount API routes
app.use('/api', apiRoutes);

app.listen(PORT, () => {
  console.log(`VergabeMeister server running on http://localhost:${PORT}`);
});
