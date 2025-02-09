import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import { insertSharePageSchema, insertAnnotationSchema, insertTemplateSchema } from "@shared/schema";
import { setupDropbox } from "./dropbox";
import session from "express-session";
import { User } from "@shared/schema";

// Extend Express Request type to include our custom properties
interface CustomRequest extends Request {
  user?: User;
  session: session.Session & {
    authorizedPages?: number[];
  };
  sharePage?: any;
}

// Middleware to check password protection
async function checkSharePageAccess(req: CustomRequest, res: Response, next: NextFunction) {
  const page = await storage.getSharePageBySlug(req.params.slug);
  if (!page) return res.sendStatus(404);

  // Check if page has expired
  if (page.expiresAt && new Date(page.expiresAt) < new Date()) {
    return res.status(403).json({ error: "This share page has expired" });
  }

  // If page has no password, or if correct password is in session, proceed
  if (!page.password || req.session.authorizedPages?.includes(page.id)) {
    req.sharePage = page;
    return next();
  }

  // Check if password was provided in request
  const providedPassword = req.body.password;
  if (providedPassword === page.password) {
    // Store authorized page in session
    if (!req.session.authorizedPages) {
      req.session.authorizedPages = [];
    }
    req.session.authorizedPages.push(page.id);
    req.sharePage = page;
    return next();
  }

  return res.status(401).json({ error: "Password required" });
}

export function registerRoutes(app: Express): Server {
  setupAuth(app);
  setupDropbox(app);

  // Share Pages CRUD
  app.post("/api/pages", async (req: CustomRequest, res: Response) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    const parsed = insertSharePageSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json(parsed.error);
    }

    try {
      // Validate expiration date if provided
      if (parsed.data.expiresAt) {
        const expirationDate = new Date(parsed.data.expiresAt);
        if (isNaN(expirationDate.getTime())) {
          return res.status(400).json({
            error: "Invalid expiration date format"
          });
        }
        if (expirationDate < new Date()) {
          return res.status(400).json({
            error: "Expiration date must be in the future"
          });
        }
      }

      const page = await storage.createSharePage(req.user!.id, parsed.data);
      res.status(201).json(page);
    } catch (error) {
      console.error('Error creating share page:', error);
      res.status(500).json({ error: "Failed to create share page" });
    }
  });

  app.get("/api/pages", async (req: CustomRequest, res: Response) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    const pages = await storage.getUserSharePages(req.user!.id);
    res.json(pages);
  });

  app.get("/api/pages/:id", async (req: CustomRequest, res: Response) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    const page = await storage.getSharePage(parseInt(req.params.id));
    if (!page || page.userId !== req.user!.id) return res.sendStatus(404);

    const stats = await storage.getPageStats(page.id);
    res.json({ ...page, stats });
  });

  // Get share page with password verification
  app.post("/api/p/:slug/verify", checkSharePageAccess, async (req: CustomRequest, res: Response) => {
    const stats = await storage.getPageStats(req.sharePage!.id);
    res.json({ ...req.sharePage!, stats });
  });

  // Get share page (public route)
  app.get("/api/p/:slug", async (req: CustomRequest, res: Response) => {
    const page = await storage.getSharePageBySlug(req.params.slug);
    if (!page) return res.sendStatus(404);

    // Check expiration
    if (page.expiresAt && new Date(page.expiresAt) < new Date()) {
      return res.status(403).json({ error: "This share page has expired" });
    }

    // If page is password protected and not authorized, return minimal info
    if (page.password && !req.session.authorizedPages?.includes(page.id)) {
      return res.json({
        id: page.id,
        title: page.title,
        isPasswordProtected: true,
      });
    }

    // Get IP address from request
    const ip = req.headers['x-forwarded-for'] as string || req.socket.remoteAddress || '';
    const clientIp = ip.split(',')[0].trim();

    // Record page view with IP address
    await storage.recordPageView(page.id, clientIp);

    const stats = await storage.getPageStats(page.id);
    res.json({ ...page, stats });
  });

  app.patch("/api/pages/:id", async (req: CustomRequest, res: Response) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    const parsed = insertSharePageSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json(parsed.error);
    }

    const page = await storage.getSharePage(parseInt(req.params.id));
    if (!page || page.userId !== req.user!.id) return res.sendStatus(404);

    try {
      // Validate expiration date if provided
      if (parsed.data.expiresAt) {
        const expirationDate = new Date(parsed.data.expiresAt);
        if (isNaN(expirationDate.getTime())) {
          return res.status(400).json({
            error: "Invalid expiration date format"
          });
        }
        if (expirationDate < new Date()) {
          return res.status(400).json({
            error: "Expiration date must be in the future"
          });
        }
      }

      const updatedPage = await storage.updateSharePage(page.id, parsed.data);
      const stats = await storage.getPageStats(updatedPage.id);
      res.json({ ...updatedPage, stats });
    } catch (error) {
      console.error('Error updating share page:', error);
      res.status(500).json({ error: "Failed to update share page" });
    }
  });

  app.delete("/api/pages/:id", async (req: CustomRequest, res: Response) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    const page = await storage.getSharePage(parseInt(req.params.id));
    if (!page || page.userId !== req.user!.id) return res.sendStatus(404);

    await storage.deleteSharePage(page.id);
    res.sendStatus(204);
  });

  // Template endpoints
  app.post("/api/templates", async (req: CustomRequest, res: Response) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    const parsed = insertTemplateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json(parsed.error);
    }

    const template = await storage.createTemplate(req.user!.id, parsed.data);
    res.status(201).json(template);
  });

  app.get("/api/templates", async (req: CustomRequest, res: Response) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    const templates = await storage.getUserTemplates(req.user!.id);
    res.json(templates);
  });

  app.get("/api/templates/:id", async (req: CustomRequest, res: Response) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    const template = await storage.getTemplate(parseInt(req.params.id));
    if (!template || template.userId !== req.user!.id) return res.sendStatus(404);

    res.json(template);
  });

  app.patch("/api/templates/:id", async (req: CustomRequest, res: Response) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    const parsed = insertTemplateSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json(parsed.error);
    }

    const template = await storage.getTemplate(parseInt(req.params.id));
    if (!template || template.userId !== req.user!.id) return res.sendStatus(404);

    const updatedTemplate = await storage.updateTemplate(template.id, parsed.data);
    res.json(updatedTemplate);
  });

  app.delete("/api/templates/:id", async (req: CustomRequest, res: Response) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    const template = await storage.getTemplate(parseInt(req.params.id));
    if (!template || template.userId !== req.user!.id) return res.sendStatus(404);

    await storage.deleteTemplate(template.id);
    res.sendStatus(204);
  });

  app.post("/api/templates/:id/duplicate", async (req: CustomRequest, res: Response) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    const template = await storage.getTemplate(parseInt(req.params.id));
    if (!template) return res.sendStatus(404);

    const newTemplate = await storage.duplicateTemplate(template.id, req.user!.id);
    res.json(newTemplate);
  });

  app.post("/api/templates/:id/create-page", async (req: CustomRequest, res: Response) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    const template = await storage.getTemplate(parseInt(req.params.id));
    if (!template) return res.sendStatus(404);

    const newPage = await storage.createSharePageFromTemplate(template.id, req.user!.id);
    res.json(newPage);
  });

  // Page Stats endpoints
  app.get("/api/pages/:id/stats", async (req: CustomRequest, res: Response) => {
    const page = await storage.getSharePage(parseInt(req.params.id));
    if (!page) return res.sendStatus(404);

    // Only allow page owner to see detailed stats
    if (req.isAuthenticated() && page.userId === req.user!.id) {
      const stats = await storage.getPageStats(page.id);
      res.json(stats);
    } else {
      res.sendStatus(403);
    }
  });

  // Annotation endpoints
  app.post("/api/pages/:pageId/files/:fileIndex/annotations", async (req: CustomRequest, res: Response) => {
    const parsed = insertAnnotationSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json(parsed.error);
    }

    const page = await storage.getSharePage(parseInt(req.params.pageId));
    if (!page) return res.sendStatus(404);

    const annotation = await storage.createAnnotation(
      page.id,
      req.user?.id || null,
      parsed.data
    );
    res.status(201).json(annotation);
  });

  app.get("/api/pages/:pageId/files/:fileIndex/annotations", async (req: CustomRequest, res: Response) => {
    const page = await storage.getSharePage(parseInt(req.params.pageId));
    if (!page) return res.sendStatus(404);

    const annotations = await storage.getAnnotations(
      page.id,
      parseInt(req.params.fileIndex)
    );
    res.json(annotations);
  });

  app.delete("/api/annotations/:id", async (req: CustomRequest, res: Response) => {
    const userId = req.user?.id;
    await storage.deleteAnnotation(parseInt(req.params.id), userId);
    res.sendStatus(204);
  });

  const httpServer = createServer(app);
  return httpServer;
}