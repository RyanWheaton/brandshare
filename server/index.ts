import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import session from "express-session";
import { storage } from "./storage";
import fontsRouter from "./routes/fonts";
import { execSync } from 'child_process';
import { setupVite, serveStatic, log } from "./vite";

// Set development mode explicitly if not set
process.env.NODE_ENV = process.env.NODE_ENV || 'development';

const app = express();

// Basic middleware
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

// Add CORS headers and content type for API routes
app.use('/api', (req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (!res.getHeader('Content-Type')) {
    res.setHeader('Content-Type', 'application/json');
  }
  next();
});

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      log(`${req.method} ${path} ${res.statusCode} in ${duration}ms`, 'express');
    }
  });

  next();
});

(async () => {
  try {
    log("Starting server initialization...", 'express');

    // Check if port 5000 is available with better error handling
    try {
      log("Checking port 5000 availability...", 'express');
      const processUsingPort = execSync("lsof -i :5000").toString();
      if (processUsingPort) {
        log("⚠️ Port 5000 is in use. Process information:", 'express');
        log(processUsingPort, 'express');
        log("Attempting to free port...", 'express');
        execSync("kill -9 $(lsof -t -i :5000)");
        // Wait a moment for the port to be freed
        await new Promise(resolve => setTimeout(resolve, 1000));
        log("✅ Port 5000 has been freed", 'express');
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes('Command failed')) {
        log("✅ Port 5000 is available", 'express');
      } else {
        log("⚠️ Error checking port availability:", 'express');
        log(error instanceof Error ? error.message : String(error), 'express');
      }
    }

    // First register all API routes
    log("Registering API routes...", 'express');
    app.use('/api/fonts', fontsRouter);
    const server = registerRoutes(app);
    log("✅ API routes registered", 'express');

    // Global error handler with enhanced logging
    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";
      log(`Error: ${message} (${status})`, 'express');
      if (err.stack) {
        log(`Stack: ${err.stack}`, 'express');
      }
      res.status(status).json({ message });
    });

    // Setup Vite or static file serving with enhanced error handling
    if (process.env.NODE_ENV === 'development') {
      log("Setting up Vite development server...", 'express');
      try {
        await setupVite(app, server);
        log("✅ Vite development server setup complete", 'express');
      } catch (error) {
        log("❌ Failed to setup Vite development server:", 'express');
        log(error instanceof Error ? error.message : String(error), 'express');
        throw error;
      }
    } else {
      log("Setting up static file serving...", 'express');
      serveStatic(app);
      log("✅ Static file serving setup complete", 'express');
    }

    // Force port 5000 as required by the workflow
    const PORT = 5000;
    const HOST = '0.0.0.0';
    log(`Starting Express server on ${HOST}:${PORT}...`, 'express');

    server.listen(PORT, HOST)
      .once('listening', () => {
        const address = server.address();
        if (address && typeof address === 'object') {
          log(`✅ Express server started successfully on ${address.address}:${address.port} in ${process.env.NODE_ENV} mode`, 'express');
          log(`Server is accepting connections from all network interfaces`, 'express');
        } else {
          log(`✅ Express server started successfully on port ${PORT} in ${process.env.NODE_ENV} mode`, 'express');
        }
      })
      .once('error', (error: NodeJS.ErrnoException) => {
        log(`❌ Failed to start server: ${error.message}`, 'express');
        if (error.code === 'EADDRINUSE') {
          log(`Port ${PORT} is already in use. Please free the port and try again.`, 'express');
        }
        process.exit(1);
      });

  } catch (error) {
    log('❌ Failed to start server:', 'express');
    log(error instanceof Error ? error.stack || error.message : String(error), 'express');
    process.exit(1);
  }
})();