import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import session from "express-session";
import { storage } from "./storage";
import fontsRouter from "./routes/fonts";
import path from "path";
import { execSync } from 'child_process';
import { setupVite, serveStatic } from "./vite";

// Simple logging function
const log = (message: string) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${message}`);
};

// Set development mode explicitly if not set
process.env.NODE_ENV = process.env.NODE_ENV || 'development';

const app = express();

// Basic middleware
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Add CORS headers for API routes
app.use('/api', (req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Content-Type', 'application/json');
  next();
});

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

(async () => {
  try {
    log("Starting server initialization...");

    // Check if port 5000 is available
    try {
      const processUsingPort = execSync("lsof -i :5000").toString();
      log("⚠️ Port 5000 is in use. Attempting to free port...");
      execSync("kill -9 $(lsof -t -i :5000)");
      log("✅ Port 5000 has been freed");
    } catch (error) {
      log("✅ Port 5000 is available");
    }

    // Mount API routes first
    app.use('/api/fonts', fontsRouter);
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

    // Handle static files and development mode last
    if (process.env.NODE_ENV === 'development') {
      await setupVite(app, server);
    } else {
      serveStatic(app);
    }

    // Force port 5000 as required by the workflow
    const PORT = 5000;
    log(`Starting Express server on port ${PORT}...`);

    server.listen(PORT, '0.0.0.0')
      .once('listening', () => {
        log(`Express server started successfully on port ${PORT} in ${process.env.NODE_ENV} mode`);
      })
      .once('error', (error: NodeJS.ErrnoException) => {
        log(`Failed to start server: ${error.message}`);
        process.exit(1);
      });

  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
})();