import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import { insertSharePageSchema, insertAnnotationSchema } from "@shared/schema";
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
    res.json(pages);
  });

  app.get("/api/pages/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    const page = await storage.getSharePage(parseInt(req.params.id));
    if (!page || page.userId !== req.user.id) return res.sendStatus(404);
    res.json(page);
  });

  app.get("/api/p/:slug", async (req, res) => {
    const page = await storage.getSharePageBySlug(req.params.slug);
    if (!page) return res.sendStatus(404);
    res.json(page);
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
    res.json(updatedPage);
  });

  app.delete("/api/pages/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    const page = await storage.getSharePage(parseInt(req.params.id));
    if (!page || page.userId !== req.user.id) return res.sendStatus(404);

    await storage.deleteSharePage(page.id);
    res.sendStatus(204);
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