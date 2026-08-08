import { Router } from 'express';
import healthRouter from './health.route';

const v1Router = Router();

v1Router.use('/health', healthRouter);

v1Router.get('/', (_req, res) => {
    res.json({
        message: 'Music Streaming API v1',
        version: 'v1'
    });
});

export default v1Router;