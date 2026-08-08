import express, { Request, Response, NextFunction } from 'express';
import v1Router from './routes/v1/index';
import helmet from 'helmet';
import cors from 'cors';

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(helmet());
app.use(cors());

app.get('/', (_req, res) => {
  res.json({ message: 'Music Streaming API is running...!' });
});

app.get('/health', (_req, res) => {
  res.json({
    status: 'ok'
  });
});

app.use('/api/v1', v1Router);

app.use((req, res) => {
  res.status(404).json({
    message: "Route not found",
  });
});

app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Internal Server Error' });
});

export default app;