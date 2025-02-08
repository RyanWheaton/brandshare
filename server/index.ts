import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import net from "net";

// Function to check if a port is available
async function findAvailablePort(preferredPort: number): Promise<number> {
  const server = net.createServer();

  try {
    await new Promise<void>((resolve, reject) => {
      server.once('error', (err) => {
        log(`Port ${preferredPort} is not available: ${err.message}`);
        reject(err);
      });
      server.once('listening', () => {
        server.close();
        resolve();
      });
      server.listen(preferredPort, '0.0.0.0');
    });
    return preferredPort;
  } catch (err) {
    // If preferred port is not available, try ports 5001-5100
    for (let port = 5001; port <= 5100; port++) {
      try {
        await new Promise<void>((resolve, reject) => {
          const testServer = net.createServer();
          testServer.once('error', reject);
          testServer.once('listening', () => {
            testServer.close();
            resolve();
          });
          testServer.listen(port, '0.0.0.0');
        });
        log(`Falling back to port ${port}`);
        return port;
      } catch {
        continue;
      }
    }
    throw new Error('No available ports found between 5001 and 5100');
  }
}

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

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

(async () => {
  try {
    const server = registerRoutes(app);

    // Error handling middleware
    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";
      log(`Error: ${message}`);
      res.status(status).json({ message });
    });

    if (app.get("env") === "development") {
      await setupVite(app, server);
    } else {
      serveStatic(app);
    }

    // Try to use port 5000 first
    const PORT = await findAvailablePort(5000);

    server.listen(PORT, "0.0.0.0", () => {
      log(`Server started successfully on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
})();