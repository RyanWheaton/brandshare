import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import { insertSharePageSchema } from "@shared/schema";
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

  const httpServer = createServer(app);
  return httpServer;
}