import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import { insertSharePageSchema, insertAnnotationSchema, insertTemplateSchema } from "@shared/schema";
import { setupDropbox } from "./dropbox";

export function registerRoutes(app: Express): Server {
  setupAuth(app);
  setupDropbox(app);

  // Share Pages CRUD
  app.post("/api/pages", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    const parsed = insertSharePageSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json(parsed.error);
    }

    const page = await storage.createSharePage(req.user.id, parsed.data);
    res.status(201).json(page);
  });

  app.get("/api/pages", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    const pages = await storage.getUserSharePages(req.user.id);

    // Get stats for each page
    const pagesWithStats = await Promise.all(
      pages.map(async (page) => {
        const stats = await storage.getPageStats(page.id);
        return { ...page, stats };
      })
    );

    res.json(pagesWithStats);
  });

  app.get("/api/pages/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    const page = await storage.getSharePage(parseInt(req.params.id));
    if (!page || page.userId !== req.user.id) return res.sendStatus(404);

    const stats = await storage.getPageStats(page.id);
    res.json({ ...page, stats });
  });

  app.get("/api/p/:slug", async (req, res) => {
    const page = await storage.getSharePageBySlug(req.params.slug);
    if (!page) return res.sendStatus(404);

    // Record page view
    await storage.recordPageView(page.id);

    const stats = await storage.getPageStats(page.id);
    res.json({ ...page, stats });
  });

  app.patch("/api/pages/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    const parsed = insertSharePageSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json(parsed.error);
    }

    const page = await storage.getSharePage(parseInt(req.params.id));
    if (!page || page.userId !== req.user.id) return res.sendStatus(404);

    const updatedPage = await storage.updateSharePage(page.id, parsed.data);
    const stats = await storage.getPageStats(updatedPage.id);
    res.json({ ...updatedPage, stats });
  });

  app.delete("/api/pages/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    const page = await storage.getSharePage(parseInt(req.params.id));
    if (!page || page.userId !== req.user.id) return res.sendStatus(404);

    await storage.deleteSharePage(page.id);
    res.sendStatus(204);
  });

  // Template endpoints
  app.post("/api/templates", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    const parsed = insertTemplateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json(parsed.error);
    }

    const template = await storage.createTemplate(req.user.id, parsed.data);
    res.status(201).json(template);
  });

  app.get("/api/templates", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    const templates = await storage.getUserTemplates(req.user.id);
    res.json(templates);
  });

  app.get("/api/templates/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    const template = await storage.getTemplate(parseInt(req.params.id));
    if (!template || template.userId !== req.user.id) return res.sendStatus(404);

    res.json(template);
  });

  app.patch("/api/templates/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    const parsed = insertTemplateSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json(parsed.error);
    }

    const template = await storage.getTemplate(parseInt(req.params.id));
    if (!template || template.userId !== req.user.id) return res.sendStatus(404);

    const updatedTemplate = await storage.updateTemplate(template.id, parsed.data);
    res.json(updatedTemplate);
  });

  app.delete("/api/templates/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    const template = await storage.getTemplate(parseInt(req.params.id));
    if (!template || template.userId !== req.user.id) return res.sendStatus(404);

    await storage.deleteTemplate(template.id);
    res.sendStatus(204);
  });

  app.post("/api/templates/:id/duplicate", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    const template = await storage.getTemplate(parseInt(req.params.id));
    if (!template) return res.sendStatus(404);

    const newTemplate = await storage.duplicateTemplate(template.id, req.user.id);
    res.json(newTemplate);
  });

  app.post("/api/templates/:id/create-page", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    const template = await storage.getTemplate(parseInt(req.params.id));
    if (!template) return res.sendStatus(404);

    const newPage = await storage.createSharePageFromTemplate(template.id, req.user.id);
    res.json(newPage);
  });

  // Page Stats endpoints
  app.get("/api/pages/:id/stats", async (req, res) => {
    const page = await storage.getSharePage(parseInt(req.params.id));
    if (!page) return res.sendStatus(404);

    // Only allow page owner to see detailed stats
    if (req.isAuthenticated() && page.userId === req.user.id) {
      const stats = await storage.getPageStats(page.id);
      res.json(stats);
    } else {
      res.sendStatus(403);
    }
  });

  // Annotation endpoints
  app.post("/api/pages/:pageId/files/:fileIndex/annotations", async (req, res) => {
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

  app.get("/api/pages/:pageId/files/:fileIndex/annotations", async (req, res) => {
    const page = await storage.getSharePage(parseInt(req.params.pageId));
    if (!page) return res.sendStatus(404);

    const annotations = await storage.getAnnotations(
      page.id,
      parseInt(req.params.fileIndex)
    );
    res.json(annotations);
  });

  app.delete("/api/annotations/:id", async (req, res) => {
    const userId = req.user?.id;
    await storage.deleteAnnotation(parseInt(req.params.id), userId);
    res.sendStatus(204);
  });

  const httpServer = createServer(app);
  return httpServer;
}