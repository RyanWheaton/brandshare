import type { Express, Request, Response, NextFunction, RequestHandler } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import { insertSharePageSchema, insertAnnotationSchema, insertTemplateSchema, fileSchema } from "@shared/schema";
import { setupDropbox } from "./dropbox";
import session from "express-session";
import { User } from "@shared/schema";
import { z } from "zod";

// Extend Express Request type to include our custom properties
declare module 'express-session' {
  interface SessionData {
    authorizedPages?: number[];
  }
}

// Update CustomRequest to extend Request properly
interface CustomRequest extends Request {
  user?: User;
  sharePage?: any;
}

type TypedRequestHandler<P = {}, ResBody = any, ReqBody = any> = (
  req: CustomRequest & { params: P; body: ReqBody },
  res: Response<ResBody>,
  next?: NextFunction
) => Promise<void | Response>;

// Update middleware type signature
const checkSharePageAccess: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const customReq = req as CustomRequest;
  const page = await storage.getSharePageBySlug(req.params.slug);
  if (!page) return res.sendStatus(404);

  // Check if page has expired
  if (page.expiresAt && new Date(page.expiresAt) < new Date()) {
    return res.status(403).json({
      error: "This share page has expired",
      expiredAt: page.expiresAt
    });
  }

  // Initialize authorized pages if not exists
  if (!req.session.authorizedPages) {
    req.session.authorizedPages = [];
  }

  // If page has no password, or user is already authorized, proceed
  if (!page.password || req.session.authorizedPages.includes(page.id)) {
    customReq.sharePage = page;
    return next();
  }

  // Check provided password
  const providedPassword = req.body.password;
  if (!providedPassword) {
    return res.status(401).json({
      error: "Password required",
      isPasswordProtected: true
    });
  }

  if (providedPassword === page.password) {
    req.session.authorizedPages.push(page.id);
    customReq.sharePage = page;
    return next();
  }

  return res.status(401).json({
    error: "Incorrect password",
    isPasswordProtected: true
  });
};

async function validateFont(font: string): Promise<boolean> {
  try {
    const response = await fetch(`/api/fonts/search?q=${encodeURIComponent(font)}`);
    const fonts = await response.json();
    return fonts.some((f: any) => f.family === font);
  } catch {
    return true; // Fail open if API is unavailable
  }
}

// Add Dropbox URL validation schema
const dropboxUrlSchema = z.object({
  dropboxUrl: z.string().url().refine(url => url.includes('dropbox.com'), {
    message: "Not a valid Dropbox URL"
  })
});

export function registerRoutes(app: Express): Server {
  setupAuth(app);
  setupDropbox(app);

  // Add Dropbox file endpoint
  app.post("/api/files/dropbox", (async (req: CustomRequest, res: Response) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    const parsed = dropboxUrlSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json(parsed.error);
    }

    try {
      const { dropboxUrl } = parsed.data;

      // Extract filename from URL
      const urlParts = new URL(dropboxUrl);
      const pathSegments = urlParts.pathname.split('/');
      const filename = pathSegments[pathSegments.length - 1];

      // Create file object
      const file = {
        name: decodeURIComponent(filename),
        url: dropboxUrl,
        preview_url: dropboxUrl,
        isFullWidth: false
      };

      const parsedFile = fileSchema.parse(file);

      res.json({ success: true, file: parsedFile });
    } catch (error) {
      console.error('Error processing Dropbox URL:', error);
      res.status(400).json({
        success: false,
        message: error instanceof Error ? error.message : "Failed to process Dropbox URL"
      });
    }
  }) as RequestHandler);

  // Share Pages CRUD
  app.post("/api/pages", (async (req: CustomRequest, res: Response) => {
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
  }) as RequestHandler);

  app.get("/api/pages", (async (req: CustomRequest, res: Response) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    const pages = await storage.getUserSharePages(req.user!.id);

    // Fetch stats for each page
    const pagesWithStats = await Promise.all(
      pages.map(async (page) => {
        const stats = await storage.getPageStats(page.id);
        return { ...page, stats };
      })
    );

    res.json(pagesWithStats);
  }) as RequestHandler);

  app.get("/api/pages/:id", (async (req: CustomRequest, res: Response) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    const page = await storage.getSharePage(parseInt(req.params.id));
    if (!page || page.userId !== req.user!.id) return res.sendStatus(404);

    const stats = await storage.getPageStats(page.id);
    res.json({ ...page, stats });
  }) as RequestHandler);

  // Password verification endpoint
  app.post("/api/p/:slug/verify", checkSharePageAccess, (async (req: Request, res: Response) => {
    const customReq = req as CustomRequest;
    if (!customReq.sharePage) {
      return res.status(404).json({ error: "Page not found" });
    }
    const stats = await storage.getPageStats(customReq.sharePage.id);
    res.json({ ...customReq.sharePage, stats });
  }) as RequestHandler);

  // Public share page endpoint
  app.get("/api/p/:slug", (async (req: Request, res: Response) => {
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
        expiresAt: page.expiresAt
      });
    }

    // Record page view
    const ip = req.headers['x-forwarded-for'] as string || req.socket.remoteAddress || '';
    const clientIp = ip.split(',')[0].trim();
    await storage.recordPageView(page.id, clientIp);

    const stats = await storage.getPageStats(page.id);
    res.json({ ...page, stats });
  }) as RequestHandler);

  app.patch("/api/pages/:id", (async (req: CustomRequest, res: Response) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    const parsed = insertSharePageSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json(parsed.error);
    }

    const page = await storage.getSharePage(parseInt(req.params.id));
    if (!page || page.userId !== req.user!.id) return res.sendStatus(404);

    try {
      // Validate fonts if they are being updated
      if (parsed.data.titleFont) {
        const isValidFont = await validateFont(parsed.data.titleFont);
        if (!isValidFont) {
          return res.status(400).json({
            error: "Selected title font must be available in Google Fonts"
          });
        }
      }

      if (parsed.data.descriptionFont) {
        const isValidFont = await validateFont(parsed.data.descriptionFont);
        if (!isValidFont) {
          return res.status(400).json({
            error: "Selected description font must be available in Google Fonts"
          });
        }
      }

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
  }) as RequestHandler);

  app.delete("/api/pages/:id", (async (req: CustomRequest, res: Response) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    const page = await storage.getSharePage(parseInt(req.params.id));
    if (!page || page.userId !== req.user!.id) return res.sendStatus(404);

    await storage.deleteSharePage(page.id);
    res.sendStatus(204);
  }) as RequestHandler);

  // Template endpoints
  app.post("/api/templates", (async (req: CustomRequest, res: Response) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    const parsed = insertTemplateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json(parsed.error);
    }

    const template = await storage.createTemplate(req.user!.id, parsed.data);
    res.status(201).json(template);
  }) as RequestHandler);

  app.get("/api/templates", (async (req: CustomRequest, res: Response) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    const templates = await storage.getUserTemplates(req.user!.id);
    res.json(templates);
  }) as RequestHandler);

  app.get("/api/templates/:id", (async (req: CustomRequest, res: Response) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    const template = await storage.getTemplate(parseInt(req.params.id));
    if (!template || template.userId !== req.user!.id) return res.sendStatus(404);

    res.json(template);
  }) as RequestHandler);

  app.patch("/api/templates/:id", (async (req: CustomRequest, res: Response) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    const parsed = insertTemplateSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json(parsed.error);
    }

    const template = await storage.getTemplate(parseInt(req.params.id));
    if (!template || template.userId !== req.user!.id) return res.sendStatus(404);

    const updatedTemplate = await storage.updateTemplate(template.id, parsed.data);
    res.json(updatedTemplate);
  }) as RequestHandler);

  app.delete("/api/templates/:id", (async (req: CustomRequest, res: Response) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    const template = await storage.getTemplate(parseInt(req.params.id));
    if (!template || template.userId !== req.user!.id) return res.sendStatus(404);

    await storage.deleteTemplate(template.id);
    res.sendStatus(204);
  }) as RequestHandler);

  app.post("/api/templates/:id/duplicate", (async (req: CustomRequest, res: Response) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    const template = await storage.getTemplate(parseInt(req.params.id));
    if (!template) return res.sendStatus(404);

    const newTemplate = await storage.duplicateTemplate(template.id, req.user!.id);
    res.json(newTemplate);
  }) as RequestHandler);

  app.post("/api/templates/:id/create-page", (async (req: CustomRequest, res: Response) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    const template = await storage.getTemplate(parseInt(req.params.id));
    if (!template) return res.sendStatus(404);

    const newPage = await storage.createSharePageFromTemplate(template.id, req.user!.id);
    res.json(newPage);
  }) as RequestHandler);

  // Page Stats endpoints
  app.get("/api/pages/:id/stats", (async (req: CustomRequest, res: Response) => {
    const page = await storage.getSharePage(parseInt(req.params.id));
    if (!page) return res.sendStatus(404);

    // Only allow page owner to see detailed stats
    if (req.isAuthenticated() && page.userId === req.user!.id) {
      const stats = await storage.getPageStats(page.id);
      res.json(stats);
    } else {
      res.sendStatus(403);
    }
  }) as RequestHandler);

  // Annotation endpoints
  app.post("/api/pages/:pageId/files/:fileIndex/annotations", (async (req: CustomRequest, res: Response) => {
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
  }) as RequestHandler);

  app.get("/api/pages/:pageId/files/:fileIndex/annotations", (async (req: CustomRequest, res: Response) => {
    const page = await storage.getSharePage(parseInt(req.params.pageId));
    if (!page) return res.sendStatus(404);

    const annotations = await storage.getAnnotations(
      page.id,
      parseInt(req.params.fileIndex)
    );
    res.json(annotations);
  }) as RequestHandler);

  app.delete("/api/annotations/:id", (async (req: CustomRequest, res: Response) => {
    const userId = req.user?.id;
    await storage.deleteAnnotation(parseInt(req.params.id), userId);
    res.sendStatus(204);
  }) as RequestHandler);

  const httpServer = createServer(app);
  return httpServer;
}