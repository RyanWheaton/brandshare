import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import session from "express-session";
import { storage } from "./storage";
import fontsRouter from "./routes/fonts";
import { createServer } from "net";

// Set development mode explicitly if not set
process.env.NODE_ENV = process.env.NODE_ENV || 'development';

// Function to find an available port
async function findAvailablePort(startPort: number): Promise<number> {
  const isPortAvailable = (port: number): Promise<boolean> => {
    return new Promise((resolve) => {
      const server = createServer()
        .listen(port, '0.0.0.0', () => {
          server.close();
          resolve(true);
        })
        .on('error', () => {
          resolve(false);
        });
    });
  };

  let port = startPort;
  while (!(await isPortAvailable(port))) {
    port++;
    if (port > startPort + 100) {
      throw new Error('No available ports found in range');
    }
  }
  return port;
}

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

// Request logging middleware
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
      if (capturedJsonResponse) {
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

    // Global error handler
    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";
      log(`Error: ${message}`);
      res.status(status).json({ message });
    });

    if (process.env.NODE_ENV === "development") {
      log("Starting in development mode with Vite dev server");
      await setupVite(app, server);
    } else {
      log("Starting in production mode with static files");
      serveStatic(app);
    }

    // Find an available port starting from the preferred port
    const preferredPort = Number(process.env.PORT) || 5001; // Default to 5001 for Replit
    const port = await findAvailablePort(preferredPort);

    server.listen(port, '0.0.0.0', () => {
      log(`Server started successfully and is serving on port ${port} in ${process.env.NODE_ENV} mode`);
      // Store the active port for future reference
      process.env.ACTIVE_PORT = port.toString();
    });

    // Handle server errors
    server.on('error', (error: NodeJS.ErrnoException) => {
      if (error.code === 'EADDRINUSE') {
        log(`Port ${port} is already in use. Trying another port...`);
      } else {
        log(`Server error: ${error.message}`);
        process.exit(1);
      }
    });

    // Enhanced cleanup on process termination
    const cleanup = () => {
      log('Closing server...');
      server.close(() => {
        log('Server closed');
        process.exit(0);
      });
    };

    process.on('SIGTERM', cleanup);
    process.on('SIGINT', cleanup);

  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
})();