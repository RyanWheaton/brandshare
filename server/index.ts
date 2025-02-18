import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
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
      } else if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
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

    // In development mode, always use Vite's dev server
    if (process.env.NODE_ENV === "development") {
      log("Starting in development mode with Vite dev server");
      await setupVite(app, server);
    } else {
      log("Starting in production mode with static files");
      serveStatic(app);
    }

    // Determine port from environment variable or use fallback ports
    const primaryPort = process.env.PORT ? parseInt(process.env.PORT) : 5000;
    const ports = [primaryPort, 3000, 3001, 8080];
    let serverStarted = false;

    // Try each port in sequence
    for (const PORT of ports) {
      try {
        await new Promise<void>((resolve, reject) => {
          const serverInstance = server.listen(PORT, '0.0.0.0');

          // Set timeout for server startup
          const timeout = setTimeout(() => {
            serverInstance.close();
            resolve(); // Move to next port if timeout
            log(`Server startup timed out on port ${PORT}, trying next port...`);
          }, 5000);

          serverInstance.once('listening', () => {
            clearTimeout(timeout);
            log(`Server started successfully and is serving on port ${PORT} in ${process.env.NODE_ENV} mode`);
            serverStarted = true;
            resolve();
          });

          serverInstance.once('error', (error: NodeJS.ErrnoException) => {
            clearTimeout(timeout);
            if (error.code === 'EADDRINUSE') {
              log(`Port ${PORT} is in use, trying next port...`);
              resolve(); // Continue to next port
            } else {
              reject(error);
            }
          });
        });

        if (serverStarted) break;
      } catch (error) {
        log(`Error starting server on port ${PORT}: ${error}`);
        if (PORT === ports[ports.length - 1]) {
          throw new Error(`Failed to start server on any available port. Last error: ${error}`);
        }
      }
    }

    if (!serverStarted) {
      throw new Error('Failed to start server on any available port after trying all options');
    }

  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
})();