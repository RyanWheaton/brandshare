import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import session from "express-session";
import { storage } from "./storage";
import fontsRouter from "./routes/fonts";
import path from "path";
import { execSync } from 'child_process';

// Simple logging function
const log = (message: string) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${message}`);
};

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

    // Check if port 5000 is available
    try {
      const processUsingPort = execSync("lsof -i :5000").toString();
      log("⚠️ Port 5000 is in use. Attempting to free port...");
      execSync("kill -9 $(lsof -t -i :5000)");
      log("✅ Port 5000 has been freed");
    } catch (error) {
      log("✅ Port 5000 is available");
    }

    // Check Vite dev server status
    if (process.env.NODE_ENV === 'development') {
      try {
        const viteProcess = execSync("lsof -i :5173").toString();
        log("✅ Vite dev server is running on port 5173");
      } catch (error) {
        log("⚠️ Vite dev server is not running on port 5173. Frontend assets may not be served properly.");
      }
    }

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

    // Serve static files in development
    if (process.env.NODE_ENV === 'development') {
      // Only redirect non-API routes to Vite dev server
      app.use((req, res, next) => {
        if (req.path.startsWith('/api')) {
          return next();
        }
        res.redirect(`http://localhost:5173${req.path}`);
      });
    } else {
      // Serve static files in production
      const staticPath = path.join(__dirname, '../dist');
      app.use(express.static(staticPath));

      // SPA fallback
      app.get('*', (req, res) => {
        if (!req.path.startsWith('/api')) {
          res.sendFile(path.join(staticPath, 'index.html'));
        }
      });
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