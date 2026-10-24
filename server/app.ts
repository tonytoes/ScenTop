import fs from 'node:fs';
import path from 'node:path';
import compression from 'compression';
import cors from 'cors';
import express, { type Express } from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import type { AppContext } from './context';
import { apiNotFound, errorHandler } from './middleware/errors';
import { authRouter } from './routes/auth';
import { cartRouter } from './routes/cart';
import { contactRouter } from './routes/contact';
import { ordersRouter } from './routes/orders';
import { productsRouter } from './routes/products';
import { wishlistRouter } from './routes/wishlist';

// Origins used by the Capacitor mobile app (Android uses https://localhost, iOS uses capacitor://localhost)
const MOBILE_APP_ORIGINS = ['https://localhost', 'http://localhost', 'capacitor://localhost', 'ionic://localhost'];

// Angular names built files like main-ABCD1234.js, so these never change and can be cached for a year
const HASHED_FILE = /-[A-Za-z0-9_-]{8,}\.(js|css|woff2?)$/;

function limiter(max: number, windowMs: number, ctx: AppContext) {
  return rateLimit({
    windowMs,
    limit: max,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    skip: () => ctx.config.env === 'test',
    handler: (_req, res) => {
      res.status(429).json({ error: { message: 'Too many requests. Please wait a moment and try again.', code: 'rate_limited' } });
    },
  });
}

export function createApp(ctx: AppContext): Express {
  const { config } = ctx;
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', config.trustProxy);

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          // Ionic components set inline styles
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
          fontSrc: ["'self'", 'data:'],
          connectSrc: ["'self'", 'data:', ...(config.neonAuthBaseUrl ? [new URL(config.neonAuthBaseUrl).origin] : [])],
          objectSrc: ["'none'"],
          frameAncestors: ["'none'"],
          upgradeInsecureRequests: config.env === 'production' ? [] : null,
        },
      },
    }),
  );
  app.use(compression());

  const api = express.Router();
  const deleteLimiter = limiter(10, 15 * 60_000, ctx);
  api.use(cors({ origin: [...MOBILE_APP_ORIGINS, ...config.corsOrigins] }));
  api.use(express.json({ limit: '200kb' }));
  api.use(limiter(300, 60_000, ctx));
  api.use(['/auth/login', '/auth/signup', '/auth/neon', '/auth/otp', '/auth/delete-code'], limiter(20, 15 * 60_000, ctx));
  api.use('/auth/me', (req, res, next) => req.method === 'DELETE' ? deleteLimiter(req, res, next) : next());
  api.use('/contact', limiter(10, 60 * 60_000, ctx));

  api.get('/health', async (_req, res) => {
    await ctx.db.query('SELECT 1');
    res.json({ status: 'ok' });
  });

  api.use('/auth', authRouter(ctx));
  api.use(productsRouter(ctx));
  api.use(cartRouter(ctx));
  api.use(wishlistRouter(ctx));
  api.use(ordersRouter(ctx));
  api.use(contactRouter(ctx));
  api.use(apiNotFound);
  app.use('/api', api);

  serveWebApp(app, config.staticDir, config.env !== 'development');

  app.use(errorHandler);
  return app;
}

/** Serves the built Angular app, falling back to index.html so that deep links like /product/deep-rouge work. */
function serveWebApp(app: Express, staticDir: string, cache: boolean) {
  const indexFile = path.join(staticDir, 'index.html');

  if (!fs.existsSync(indexFile)) {
    app.get('/', (_req, res) => {
      res.type('text/plain').send('The ScenTop API is running. Build the web app with "npm run build" to serve it from here.');
    });
    return;
  }

  app.use(
    express.static(staticDir, {
      index: false,
      setHeaders(res, filePath) {
        // While developing, files keep their names but change, so never let the browser reuse an old copy
        if (!cache) res.setHeader('Cache-Control', 'no-cache');
        else if (HASHED_FILE.test(filePath)) res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        else if (filePath.endsWith('index.html')) res.setHeader('Cache-Control', 'no-cache');
        else res.setHeader('Cache-Control', 'public, max-age=86400');
      },
    }),
  );

  app.use((req, res, next) => {
    const isPage = (req.method === 'GET' || req.method === 'HEAD') && !path.extname(req.path);
    if (!isPage) return next();
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(indexFile);
  });
}
