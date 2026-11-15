import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { router as apiRouter } from './routes/api';
import { JobService } from './services/jobService';
import { renderSwaggerHtml } from './openapi';

dotenv.config({ path: '.env.local' });
dotenv.config();

const app = express();
const PORT = Number(process.env.PORT || 4000);

app.use(helmet({
  contentSecurityPolicy: false, // development / local dashboard
}));
app.use(express.json({ limit: '10mb' }));
app.use(morgan('dev'));

// API Routes
app.use('/api/v1', apiRouter);

// Interactive Swagger UI documentation
app.get('/api-docs', (_req, res) => {
  res.setHeader('Content-Type', 'text/html');
  res.send(renderSwaggerHtml());
});

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
    await JobService.expireStaleJobs();
    await JobService.pruneDiagnostics();
    setInterval(() => void JobService.expireStaleJobs().catch(console.error), 60_000).unref();
    setInterval(() => void JobService.pruneDiagnostics().catch(console.error), 3_600_000).unref();

    const server = app.listen(PORT, '127.0.0.1', () => {
      const address = server.address();
      if (address && typeof address !== 'string') {
        console.log(`[UpdatePilot Server] API listening on http://localhost:${address.port}`);
      }
    });
  } catch (error) {
    console.error('[UpdatePilot Server] Startup failed:', error);
    process.exit(1);
  }
}

startServer();
