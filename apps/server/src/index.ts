import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { router as apiRouter } from './routes/api';
import { SecurityService } from './services/securityService';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

app.use(helmet({
  contentSecurityPolicy: false, // development / local dashboard
}));
app.use(cors({
  origin: '*', // Allows local Next.js frontend requests
}));
app.use(express.json({ limit: '10mb' }));
app.use(morgan('dev'));

// API Routes
app.use('/api/v1', apiRouter);

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'UpdatePilot API Server',
    timestamp: new Date().toISOString(),
  });
});

async function startServer() {
  try {
    // Seed security intelligence on boot if empty
    await SecurityService.seedKnownAdvisories();

    app.listen(PORT, () => {
      console.log(`[UpdatePilot Server] API listening on http://localhost:${PORT}`);
      console.log(`[UpdatePilot Server] Endpoints mounted at http://localhost:${PORT}/api/v1`);
    });
  } catch (error) {
    console.error('[UpdatePilot Server] Startup failed:', error);
    process.exit(1);
  }
}

startServer();
