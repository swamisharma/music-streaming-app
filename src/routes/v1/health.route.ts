import { Router } from 'express';

const router = Router();

router.get('/', (_req, res) => {
    res.json({
        status: 'ok',
        version: 'v1'
    });
});

export default router;