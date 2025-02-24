import { Dropbox } from "dropbox";
import type { Express, Request, Response } from "express";
import { storage } from "./storage";
import type { User } from "@shared/schema";

const DROPBOX_APP_KEY = process.env.DROPBOX_APP_KEY!;
const DROPBOX_APP_SECRET = process.env.DROPBOX_APP_SECRET!;
const PORT = process.env.PORT || 5000;

interface DropboxAuthRequest extends Request {
  user?: User;
  isAuthenticated(): boolean;
}

// Get the full Replit URL for the callback
const REDIRECT_URI = process.env.REPLIT_DEV_DOMAIN 
  ? `https://${process.env.REPLIT_DEV_DOMAIN}/api/dropbox/callback`
  : `http://localhost:${PORT}/api/dropbox/callback`;

export function setupDropbox(app: Express) {
  app.get("/api/dropbox/auth", async (req: DropboxAuthRequest, res: Response) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    try {
      const authUrl = `https://www.dropbox.com/oauth2/authorize?response_type=code&client_id=${DROPBOX_APP_KEY}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}`;
      console.log("Constructed Redirect URI:", REDIRECT_URI);
      console.log("Generated auth URL:", authUrl);
      res.json({ url: authUrl });
    } catch (error) {
      console.error("Error generating auth URL:", error);
      res.status(500).json({ error: "Failed to generate auth URL" });
    }
  });

  app.get("/api/dropbox/callback", async (req: DropboxAuthRequest, res: Response) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const code = req.query.code as string;

    if (!code) {
      console.error("No authorization code received");
      return res.redirect("/?dropbox=error");
    }

    try {
      const params = new URLSearchParams({
        code,
        grant_type: 'authorization_code',
        client_id: DROPBOX_APP_KEY,
        client_secret: DROPBOX_APP_SECRET,
        redirect_uri: REDIRECT_URI,
      });

      const tokenResponse = await fetch('https://api.dropboxapi.com/oauth2/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      });

      if (!tokenResponse.ok) {
        throw new Error(`Token exchange failed: ${tokenResponse.statusText}`);
      }

      const result = await tokenResponse.json();
      const user = await storage.updateUserDropboxToken(req.user!.id, result.access_token);
      res.redirect("/?dropbox=connected");
    } catch (error) {
      console.error("Dropbox OAuth error:", error);
      res.redirect("/?dropbox=error");
    }
  });

  app.get("/api/dropbox/files", async (req: DropboxAuthRequest, res: Response) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const user = await storage.getUser(req.user!.id);
    if (!user?.dropboxToken) return res.status(401).send("Dropbox not connected");

    try {
      const dbx = new Dropbox({ accessToken: user.dropboxToken });
      const response = await dbx.filesListFolder({ path: "" });

      // Filter for supported file types (images, PDFs, videos)
      const supportedFiles = response.result.entries.filter(entry => {
        if (entry[".tag"] !== "file") return false;
        const ext = entry.name.toLowerCase().split('.').pop();
        return getAllowedExtensions().includes(ext || "");
      });

      res.json(supportedFiles);
    } catch (error) {
      console.error("Dropbox API error:", error);
      res.status(500).send("Failed to fetch Dropbox files");
    }
  });
}

const getAllowedExtensions = () => ["jpg", "jpeg", "png", "gif", "pdf", "mp4", "mov"];