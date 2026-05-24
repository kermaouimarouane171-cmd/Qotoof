/* eslint-disable no-console */
import express from 'express';
import apiRoutes from './routes/index.js';
import { connectDB } from './config/db.js';
import { notFoundMiddleware } from './middleware/notFoundMiddleware.js';
import { errorMiddleware } from './middleware/errorMiddleware.js';

export const createServer = () => {
  const app = express();

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok' });
  });

  app.use('/api', apiRoutes);

  app.use(notFoundMiddleware);
  app.use(errorMiddleware);

  return app;
};

export const startServer = async () => {
  await connectDB();

  const app = createServer();
  const port = Number(process.env.PORT || 4000);

  app.listen(port, () => {
    console.log(`[api] Server listening on port ${port}`);
  });
};
