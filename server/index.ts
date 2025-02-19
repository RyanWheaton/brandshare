import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { serveStatic, log } from "./vite";
import session from "express-session";
import { storage } from "./storage";
import fontsRouter from "./routes/fonts";

// Set development mode explicitly if not set
process.env.NODE_ENV = process.env.NODE_ENV || 'development';

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Configure session middleware
app.use(
  session({
    store: storage.sessionStore,
    secret: process.env.SESSION_SECRET || 'development_secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    },
  })
);

// Request logging middleware with enhanced analytics logging
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;

      // Enhanced logging for analytics endpoint
      if (path.includes('/analytics')) {
        logLine += ` [Analytics Request]`;
        if (capturedJsonResponse) {
          const dataStatus = capturedJsonResponse ? 'Data Present' : 'No Data';
          logLine += ` :: ${dataStatus}`;
        }
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

// Mount fonts router
app.use('/api/fonts', fontsRouter);

(async () => {
  try {
    log("Starting server initialization...");
    const server = registerRoutes(app);

    // Global error handler with enhanced logging
    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";
      log(`Error: ${message} (${status})`);
      if (err.stack) {
        log(`Stack: ${err.stack}`);
      }
      res.status(status).json({ message });
    });

    // Serve static files in production only
    if (process.env.NODE_ENV === "production") {
      log("Starting in production mode with static files");
      serveStatic(app);
    }

    // Single fixed port
    const PORT = 3000;
    log(`Starting Express server on port ${PORT}...`);

    server.listen(PORT, '0.0.0.0', () => {
      log(`Express server started successfully on port ${PORT} in ${process.env.NODE_ENV} mode`);
      // Let the workflow handle Vite separately
    }).on('error', (error: NodeJS.ErrnoException) => {
      log(`Failed to start server: ${error.message}`);
      if (error.code === 'EADDRINUSE') {
        log(`Port ${PORT} is already in use. Please free up the port and try again.`);
      }
      process.exit(1);
    });

  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
})();