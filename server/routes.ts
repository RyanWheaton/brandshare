import type { Express, Request, Response, NextFunction, RequestHandler } from "express";
import { createServer, type Server } from "http";
import { setupAuth, hashPassword, comparePasswords } from "./auth";
import { storage } from "./storage";
import { insertSharePageSchema, insertAnnotationSchema, insertTemplateSchema, fileSchema, User, changePasswordSchema } from "@shared/schema";
import { setupDropbox } from "./dropbox";
import session from "express-session";
import { z } from "zod";
import geoip from 'geoip-lite';
import multer from 'multer';
import { uploadFileToS3 } from './s3';
import { uploadFileToS3FromUrl } from './s3';
import { isAllowedFileType, isAllowedMimeType, formatAllowedTypes } from "@shared/file-types";
import { deleteFileFromS3 } from './s3';
import { temporaryUploads, insertTemporaryUploadSchema } from "@shared/schema";
import { add } from "date-fns";

// Configure multer to store files in memory
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB file size limit
  }
});

// Extend Express Request type to include our custom properties
declare module 'express-session' {
  interface SessionData {
    authorizedPages?: number[];
  }
}

// Update the User type to match the schema
interface AuthenticatedRequest extends Request {
  user: User & {
    id: number;
    email: string;
    username: string;
    password: string;
    dropboxToken: string | null;
    resetToken: string | null;
    resetTokenExpiresAt: Date | null;
    emailVerified: boolean;
    logoUrl: string | null;
    brandPrimaryColor: string | null;
    brandSecondaryColor: string | null;
  };
}

interface CustomRequest extends Request {
  user?: AuthenticatedRequest['user'];
  sharePage?: any;
}

type TypedRequestHandler<P = {}, ResBody = any, ReqBody = any> = (
  req: CustomRequest & { params: P; body: ReqBody },
  res: Response<ResBody>,
  next?: NextFunction
) => Promise<void | Response>;

// Middleware to check password protection
async function checkSharePageAccess(req: CustomRequest, res: Response, next: NextFunction) {
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
    req.sharePage = page;
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
    req.sharePage = page;
    return next();
  }

  return res.status(401).json({
    error: "Incorrect password",
    isPasswordProtected: true
  });
}

// Add this function at the top of the file
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
  url: z.string().url(),
  name: z.string()
});

// User profile update schema
const updateProfileSchema = z.object({
  username: z.string().min(1, "Username is required"),
  email: z.string().email("Invalid email address"),
  logoUrl: z.string().optional(),
  brandPrimaryColor: z.string().min(1, "Primary color is required"),
  brandSecondaryColor: z.string().min(1, "Secondary color is required"),
});

function startCleanupJob(app: Express) {
  // Run cleanup every hour
  setInterval(async () => {
    try {
      const expiredUploads = await storage.getExpiredTemporaryUploads();

      // Delete expired files from S3 and database
      await Promise.all(
        expiredUploads.map(async (upload) => {
          try {
            await deleteFileFromS3(upload.fileUrl);
            await storage.deleteTemporaryUpload(upload.id);
            console.log(`Cleaned up expired upload ${upload.id}: ${upload.fileUrl}`);
          } catch (error) {
            console.error(`Failed to delete expired upload ${upload.id}:`, error);
          }
        })
      );
    } catch (error) {
      console.error('Error during automated cleanup:', error);
    }
  }, 60 * 60 * 1000); // Run every hour
}

export function registerRoutes(app: Express): Server {
  // Add health check endpoint as a separate middleware before other routes
  app.get("/api/healthcheck", (req: Request, res: Response) => {
    res.setHeader('Content-Type', 'application/json');
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  setupAuth(app);
  setupDropbox(app);
  startCleanupJob(app); // Start the cleanup job


  // Add user profile update endpoint
  app.patch("/api/user/profile", (async (req: AuthenticatedRequest, res: Response) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const parsed = updateProfileSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error });
      }

      const updatedUser = await storage.updateUser(req.user.id, parsed.data);
      res.json(updatedUser);
    } catch (error) {
      console.error('Error updating user profile:', error);
      res.status(500).json({ 
        error: "Failed to update profile",
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  }) as RequestHandler);


  // Add the change password endpoint
  app.post("/api/change-password", (async (req: CustomRequest, res: Response) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const parsed = changePasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid request data" });
    }

    try {
      const { currentPassword, newPassword } = parsed.data;

      // Verify current password
      const user = await storage.getUser(req.user!.id);
      if (!user || !(await comparePasswords(currentPassword, user.password))) {
        return res.status(400).json({ message: "Current password is incorrect" });
      }

      // Hash new password
      const hashedPassword = await hashPassword(newPassword);

      // Update password
      await storage.updatePassword(user.id, hashedPassword);

      res.json({ message: "Password updated successfully" });
    } catch (error) {
      console.error('Error changing password:', error);
      res.status(500).json({ message: "Failed to change password" });
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

      // Mark uploaded files as saved
      const fileUrls = parsed.data.files
        .filter(file => file.storageType === 's3')
        .map(file => file.url);

      await storage.markTemporaryUploadsAsSaved(fileUrls);

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

  // Add analytics endpoint after other page endpoints
  app.get("/api/pages/:id/analytics", (async (req: CustomRequest, res: Response) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Authentication required" });
    }

    try {
      const pageId = parseInt(req.params.id);
      if (isNaN(pageId)) {
        return res.status(400).json({ error: "Invalid page ID" });
      }

      const page = await storage.getSharePage(pageId);
      if (!page || page.userId !== req.user!.id) {
        return res.status(404).json({ error: "Page not found" });
      }

      const [
        dailyViews,
        hourlyViews,
        locationViews,
        totalComments,
        fileDownloads,
        uniqueVisitors,
        averageVisitDuration,
        dailyVisitDurations
      ] = await Promise.all([
        storage.getDailyViews(page.id),
        storage.getHourlyViews(page.id),
        storage.getLocationViews(page.id),
        storage.getTotalComments(page.id),
        storage.getFileDownloads(page.id),
        storage.getUniqueVisitorCount(page.id),
        storage.getAverageVisitDuration(page.id),
        storage.getDailyVisitDurations(page.id)
      ]);

      const totalUniqueVisitors = Object.values(uniqueVisitors).reduce((sum, count) => sum + count, 0);

      res.setHeader('Content-Type', 'application/json');
      res.json({
        dailyViews: dailyViews || {},
        hourlyViews: hourlyViews || {},
        locationViews: locationViews || {},
        totalComments: totalComments || 0,
        fileDownloads: fileDownloads || {},
        uniqueVisitors: uniqueVisitors || {},
        totalUniqueVisitors,
        averageVisitDuration,
        dailyVisitDurations,
      });
    } catch (error) {
      console.error('Error fetching analytics:', error);
      res.status(500).json({ 
        error: "Failed to fetch analytics data",
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  }) as RequestHandler);

  // Add visit duration tracking to the public share page endpoint
  app.post("/api/p/:slug/visit-duration", (async (req: CustomRequest, res: Response) => {
    try {
      console.log("Recording visit duration for page:", req.params.slug, "Duration:", req.body.duration);

      const page = await storage.getSharePageBySlug(req.params.slug);
      if (!page) {
        console.log("Page not found:", req.params.slug);
        return res.status(404).json({ error: "Page not found" });
      }

      const duration = parseInt(req.body.duration);
      if (isNaN(duration) || duration < 0) {
        console.log("Invalid duration value:", req.body.duration);
        return res.status(400).json({ error: "Invalid duration" });
      }

      // Get client IP for logging
      const ip = req.headers['x-forwarded-for'] as string || req.socket.remoteAddress || '';
      const clientIp = ip.split(',')[0].trim();

      // Get location data using geoip-lite
      const geo = geoip.lookup(clientIp);
      console.log("GeoIP lookup result:", geo);

      let location = null;
      if (geo) {
        location = {
          country: geo.country,
          region: geo.region,
          city: geo.city,
          key: `${geo.country}, ${geo.region}, ${geo.city}`,
          timestamp: new Date().toISOString(),
          latitude: geo.ll[0],
          longitude: geo.ll[1]
        };
        console.log("Processed location data:", location);
      }

      console.log("Recording visit duration:", {
        sharePageId: page.id,
        duration,
        ip: clientIp,
        location,
        timestamp: new Date().toISOString()
      });

      await storage.recordVisitDuration(page.id, duration, clientIp);
      console.log("Successfully recorded visit duration for page:", page.id);

      res.json({ success: true });
    } catch (error) {
      console.error('Error recording visit duration:', error);
      res.status(500).json({ 
        error: "Failed to record visit duration",
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  }) as RequestHandler);

  // Password verification endpoint
  app.post("/api/p/:slug/verify", checkSharePageAccess, (async (req: CustomRequest, res: Response) => {
    const stats = await storage.getPageStats(req.sharePage!.id);
    res.json({ ...req.sharePage, stats });
  }) as RequestHandler);

  // Public share page endpoint
  app.get("/api/p/:slug", (async (req: CustomRequest, res: Response) => {
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
        isPasswordProtected: true
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

    try {
      // Delete all S3 files associated with this page
      const files = page.files as FileObject[];
      if (files && Array.isArray(files)) {
        await Promise.all(
          files
            .filter(file => file.storageType === 's3' && file.url)
            .map(file => deleteFileFromS3(file.url))
        );
      }

      // Then delete the page itself
      await storage.deleteSharePage(page.id);
      res.sendStatus(204);
    } catch (error) {
      console.error('Error deleting share page and associated files:', error);
      res.status(500).json({ 
        error: "Failed to delete share page and associated files",
        details: error instanceof Error ? error.message : "Unknown error" 
      });
    }
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

  // File upload endpoint for S3
  app.post('/api/upload', (async (req: CustomRequest, res: Response) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Authentication required" });
    }

    console.log('Received file upload request');

    // Use multer to handle the file upload
    upload.single('file')(req, res, async (err) => {
      if (err instanceof multer.MulterError) {
        console.error('Multer error:', err);
        return res.status(400).json({ 
          error: "File upload error",
          details: err.message 
        });
      } else if (err) {
        console.error('Unexpected error during file upload:', err);
        return res.status(500).json({ 
          error: "Failed to process file upload",
          details: err instanceof Error ? err.message : "Unknown error"
        });
      }

      // Check if we have a file
      if (!req.file) {
        console.error('No file in request');
        return res.status(400).json({ error: "No file provided" });
      }

      // Validate file type
      if (!isAllowedMimeType(req.file.mimetype)) {
        console.error('Invalid file type:', req.file.mimetype);
        return res.status(400).json({ 
          error: "Unsupported file type",
          details: formatAllowedTypes()
        });
      }

      // Additional validation for file extension
      if (!isAllowedFileType(req.file.originalname, req.file.mimetype)) {
        console.error('Invalid file extension:', req.file.originalname);
        return res.status(400).json({ 
          error: "Invalid file extension",
          details: formatAllowedTypes()
        });
      }

      try {
        const url = await uploadFileToS3(
          req.file.buffer,
          req.file.originalname,
          req.file.mimetype
        );

        // Track the temporary upload
        const expiresAt = add(new Date(), { hours: 24 }); // Expire after 24 hours
        await storage.createTemporaryUpload({
          userId: req.user!.id,
          fileUrl: url,
          fileName: req.file.originalname,
          expiresAt
        });

        console.log('File successfully uploaded to S3:', url);
        res.json({ url });
      } catch (error) {
        console.error('Error uploading to S3:', error);
        res.status(500).json({ 
          error: "Failed to upload file to S3",
          details: error instanceof Error ? error.message : "Unknown error"
        });
      }
    });
  }) as RequestHandler);

  // Add cleanup endpoint for temporary uploads
  app.post("/api/uploads/cleanup", async (req: CustomRequest, res: Response) => {
    try {
      const expiredUploads = await storage.getExpiredTemporaryUploads();

      // Delete expired files from S3 and database
      await Promise.all(
        expiredUploads.map(async (upload) => {
          try {
            await deleteFileFromS3(upload.fileUrl);
            await storage.deleteTemporaryUpload(upload.id);
          } catch (error) {
            console.error(`Failed to delete expired upload ${upload.id}:`, error);
          }
        })
      );

      res.json({ message: "Cleanup completed successfully" });
    } catch (error) {
      console.error('Error during cleanup:', error);
      res.status(500).json({ error: "Failed to clean up temporary uploads" });
    }
  });


  // Add Dropbox URL validation schema and new endpoint for uploading Dropbox files to S3
  app.post('/api/upload/dropbox', (async (req: CustomRequest, res: Response) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Authentication required" });
    }

    try {
      const parsed = dropboxUrlSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid request data" });
      }

      const { url, name } = parsed.data;

      // Validate file type based on extension
      const ext = name.split('.').pop()?.toLowerCase() || '';
      let mimeType = '';

      // Determine MIME type based on extension
      if (['jpg', 'jpeg'].includes(ext)) mimeType = 'image/jpeg';
      else if (ext === 'png') mimeType = 'image/png';
      else if (ext === 'gif') mimeType = 'image/gif';
      else if (ext === 'svg') mimeType = 'image/svg+xml';
      else if (ext === 'webp') mimeType = 'image/webp';
      else if (ext === 'pdf') mimeType = 'application/pdf';
      else if (ext === 'mp4') mimeType = 'video/mp4';
      else if (ext === 'mov') mimeType = 'video/quicktime';
      else if (ext === 'avi') mimeType = 'video/x-msvideo';
      else if (ext === 'mkv') mimeType = 'video/x-matroska';


      if (!isAllowedFileType(name, mimeType)) {
        return res.status(400).json({
          error: "Unsupported file type",
          details: formatAllowedTypes()
        });
      }

      console.log('Starting Dropbox to S3 transfer:', { url, name });

      const s3Url = await uploadFileToS3FromUrl(url, name);
      console.log('Successfully transferred file to S3:', s3Url);

      res.json({ url: s3Url });
    } catch (error) {
      console.error('Error transferring Dropbox file to S3:', error);
      res.status(500).json({
        error: "Failed to transfer file to S3",
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  }) as RequestHandler);

  const httpServer = createServer(app);
  return httpServer;
}

interface FileObject {
  id: number;
  url: string | null;
  name: string;
  size: number;
  type: string;
  storageType: string;
}