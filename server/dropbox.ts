import { Dropbox } from "dropbox";
import type { Express } from "express";
import { storage } from "./storage";

const DROPBOX_APP_KEY = process.env.DROPBOX_APP_KEY!;
const DROPBOX_APP_SECRET = process.env.DROPBOX_APP_SECRET!;

// Get the full Replit URL for the callback
const REDIRECT_URI = process.env.REPLIT_DEV_DOMAIN 
  ? `https://${process.env.REPLIT_DEV_DOMAIN}/api/dropbox/callback`
  : 'http://localhost:5000/api/dropbox/callback';

export function setupDropbox(app: Express) {
  app.get("/api/dropbox/auth", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    try {
      const dbx = new Dropbox({
        clientId: DROPBOX_APP_KEY,
      });

      // Changed to use the authorization code flow
      const authUrl = `https://www.dropbox.com/oauth2/authorize?response_type=code&client_id=${DROPBOX_APP_KEY}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}`;
      console.log("Constructed Redirect URI:", REDIRECT_URI);
      console.log("Generated auth URL:", authUrl);
      res.json({ url: authUrl });
    } catch (error) {
      console.error("Error generating auth URL:", error);
      res.status(500).json({ error: "Failed to generate auth URL" });
    }
  });

  app.get("/api/dropbox/callback", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const code = req.query.code as string;

    try {
      const dbx = new Dropbox({
        clientId: DROPBOX_APP_KEY,
        clientSecret: DROPBOX_APP_SECRET,
      });

      const response = await dbx.auth.getAccessTokenFromCode(REDIRECT_URI, code);
      const { result } = response;

      const user = await storage.updateUserDropboxToken(req.user.id, result.access_token);
      res.redirect("/?dropbox=connected");
    } catch (error) {
      console.error("Dropbox OAuth error:", error);
      res.redirect("/?dropbox=error");
    }
  });

  app.get("/api/dropbox/files", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const user = await storage.getUser(req.user.id);
    if (!user?.dropboxToken) return res.status(401).send("Dropbox not connected");

    try {
      const dbx = new Dropbox({ accessToken: user.dropboxToken });
      const response = await dbx.filesListFolder({ path: "" });

      // Filter for supported file types (images, PDFs, videos)
      const supportedFiles = response.result.entries.filter(entry => {
        if (entry[".tag"] !== "file") return false;
        const ext = entry.name.toLowerCase().split('.').pop();
        return ["jpg", "jpeg", "png", "gif", "pdf", "mp4", "mov"].includes(ext || "");
      });

      res.json(supportedFiles);
    } catch (error) {
      console.error("Dropbox API error:", error);
      res.status(500).send("Failed to fetch Dropbox files");
    }
  });
}