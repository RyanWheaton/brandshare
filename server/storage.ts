import { users, sharePages, sharePageTemplates, type User, type InsertUser, type SharePage, type InsertSharePage, type Annotation, type InsertAnnotation, type PageStats, type SharePageTemplate, type InsertTemplate } from "@shared/schema";
import session from "express-session";
import { nanoid } from "nanoid";
import { db } from "./db";
import { eq, and, gt } from "drizzle-orm";
import ConnectPgSimple from "connect-pg-simple";
import { pool } from "./db";
import { annotations, pageStats } from "@shared/schema";
import { randomBytes } from "crypto";
import geoip from 'geoip-lite';

const PgSession = ConnectPgSimple(session);

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUserDropboxToken(userId: number, token: string): Promise<User>;
  createSharePage(userId: number, page: InsertSharePage): Promise<SharePage>;
  getSharePage(id: number): Promise<SharePage | undefined>;
  getSharePageBySlug(slug: string): Promise<SharePage | undefined>;
  getUserSharePages(userId: number): Promise<SharePage[]>;
  updateSharePage(id: number, page: Partial<InsertSharePage>): Promise<SharePage>;
  deleteSharePage(id: number): Promise<void>;

  createAnnotation(sharePageId: number, userId: number | null, annotation: InsertAnnotation): Promise<Annotation>;
  getAnnotations(sharePageId: number, fileIndex: number): Promise<Annotation[]>;
  deleteAnnotation(id: number, userId?: number): Promise<void>;

  getPageStats(sharePageId: number): Promise<PageStats | undefined>;
  recordPageView(sharePageId: number, ip?: string): Promise<void>;
  updateCommentCount(sharePageId: number, increment: boolean): Promise<void>;

  createPasswordResetToken(username: string): Promise<string | null>;
  getUserByResetToken(token: string): Promise<User | undefined>;
  updatePassword(userId: number, newPassword: string): Promise<User>;

  sessionStore: session.Store;

  createTemplate(userId: number, template: InsertTemplate): Promise<SharePageTemplate>;
  getTemplate(id: number): Promise<SharePageTemplate | undefined>;
  getUserTemplates(userId: number): Promise<SharePageTemplate[]>;
  updateTemplate(id: number, template: Partial<InsertTemplate>): Promise<SharePageTemplate>;
  deleteTemplate(id: number): Promise<void>;
  duplicateTemplate(id: number, userId: number): Promise<SharePageTemplate>;
  createSharePageFromTemplate(templateId: number, userId: number): Promise<SharePage>;
  verifyEmail(token: string): Promise<User | undefined>;
  resendVerificationEmail(userId: number): Promise<string | null>;
  deleteUser(userId: number): Promise<void>;
  getDailyViews(sharePageId: number): Promise<Record<string, number>>;
  getHourlyViews(sharePageId: number): Promise<Record<string, number>>;
  getLocationViews(sharePageId: number): Promise<Record<string, any>>;
  getTotalComments(sharePageId: number): Promise<number>;
  getFileDownloads(sharePageId: number): Promise<Record<string, number>>;
  updateUser(userId: number, updates: Partial<User>): Promise<User>;
  getUniqueVisitorCount(sharePageId: number): Promise<Record<string, number>>;
  recordVisitDuration(sharePageId: number, duration: number, ip?: string): Promise<void>;
  getAverageVisitDuration(sharePageId: number): Promise<number>;
  getDailyVisitDurations(sharePageId: number): Promise<Record<string, number[]>>;
  getAllUsersWithStats(): Promise<(User & { totalSharePages: number; totalFiles: number; totalStorage: number })[]>;
}

export class DatabaseStorage implements IStorage {
  sessionStore: session.Store;

  constructor() {
    this.sessionStore = new PgSession({
      pool,
      tableName: "session",
      createTableIfMissing: true,
    });
  }

  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async updateUserDropboxToken(userId: number, token: string): Promise<User> {
    const [user] = await db
      .update(users)
      .set({ dropboxToken: token })
      .where(eq(users.id, userId))
      .returning();
    return user;
  }

  async createSharePage(userId: number, page: InsertSharePage): Promise<SharePage> {
    const slug = nanoid(10);
    const [sharePage] = await db
      .insert(sharePages)
      .values({
        ...page,
        userId,
        slug,
        description: page.description ?? null,
        backgroundColor: page.backgroundColor ?? "#ffffff",
        textColor: page.textColor ?? "#000000",
        titleFont: page.titleFont ?? "Inter",
        descriptionFont: page.descriptionFont ?? "Inter",
        titleFontSize: page.titleFontSize ?? 24,
        descriptionFontSize: page.descriptionFontSize ?? 16,
        logoUrl: page.logoUrl ?? null,
        logoSize: page.logoSize ?? 200,
        password: page.password || null,
        expiresAt: page.expiresAt ? new Date(page.expiresAt) : null,
      })
      .returning();

    // Initialize stats
    await db.insert(pageStats).values({
      sharePageId: sharePage.id,
      dailyViews: {},
      totalViews: 0,
      totalComments: 0,
      uniqueVisitors: {},
    });

    return sharePage;
  }

  async getSharePage(id: number): Promise<SharePage | undefined> {
    const [page] = await db.select().from(sharePages).where(eq(sharePages.id, id));
    return page;
  }

  async getSharePageBySlug(slug: string): Promise<SharePage | undefined> {
    const [page] = await db.select().from(sharePages).where(eq(sharePages.slug, slug));
    return page;
  }

  async getUserSharePages(userId: number): Promise<SharePage[]> {
    return db.select().from(sharePages).where(eq(sharePages.userId, userId));
  }

  async updateSharePage(id: number, updates: Partial<InsertSharePage>): Promise<SharePage> {
    const [page] = await db
      .update(sharePages)
      .set({
        ...updates,
        description: updates.description ?? undefined,
        backgroundColor: updates.backgroundColor ?? undefined,
        backgroundColorSecondary: updates.backgroundColorSecondary ?? undefined,
        textColor: updates.textColor ?? undefined,
        titleFont: updates.titleFont ? updates.titleFont : "Inter",
        descriptionFont: updates.descriptionFont ? updates.descriptionFont : "Inter",
        titleFontSize: typeof updates.titleFontSize === 'number' ? updates.titleFontSize : 24,
        descriptionFontSize: typeof updates.descriptionFontSize === 'number' ? updates.descriptionFontSize : 16,
        logoUrl: updates.logoUrl ?? undefined,
        logoSize: typeof updates.logoSize === 'number' ? updates.logoSize : undefined,
        password: updates.password ?? undefined,
        expiresAt: updates.expiresAt ? new Date(updates.expiresAt) : undefined,
      })
      .where(eq(sharePages.id, id))
      .returning();
    return page;
  }

  async deleteSharePage(id: number): Promise<void> {
    await db.delete(sharePages).where(eq(sharePages.id, id));
  }

  async createAnnotation(sharePageId: number, userId: number | null, annotation: InsertAnnotation): Promise<Annotation> {
    const [result] = await db
      .insert(annotations)
      .values({
        ...annotation,
        sharePageId,
        userId: userId || undefined,
      })
      .returning();

    await this.updateCommentCount(sharePageId, true);

    return result;
  }

  async getAnnotations(sharePageId: number, fileIndex: number): Promise<Annotation[]> {
    return db
      .select()
      .from(annotations)
      .where(
        and(
          eq(annotations.sharePageId, sharePageId),
          eq(annotations.fileIndex, fileIndex)
        )
      );
  }

  async deleteAnnotation(id: number, userId?: number): Promise<void> {
    const [annotation] = await db
      .select()
      .from(annotations)
      .where(eq(annotations.id, id));

    if (!annotation) return;

    if (userId !== undefined) {
      await db
        .delete(annotations)
        .where(
          and(
            eq(annotations.id, id),
            eq(annotations.userId, userId)
          )
        );
    } else {
      await db
        .delete(annotations)
        .where(eq(annotations.id, id));
    }

    await this.updateCommentCount(annotation.sharePageId, false);
  }

  async getPageStats(sharePageId: number): Promise<PageStats | undefined> {
    const [stats] = await db
      .select()
      .from(pageStats)
      .where(eq(pageStats.sharePageId, sharePageId));
    return stats;
  }

  async recordPageView(sharePageId: number, ip?: string): Promise<void> {
    const today = new Date().toISOString().split('T')[0];
    const hour = new Date().getHours();
    const timestamp = new Date().toISOString();
    const [currentStats] = await db
      .select()
      .from(pageStats)
      .where(eq(pageStats.sharePageId, sharePageId));

    console.log('Recording page view with IP:', ip); // Debug log

    let location = null;
    if (ip) {
      console.log('Looking up location for IP:', ip); // Debug log
      const geo = geoip.lookup(ip);
      console.log('GeoIP lookup result:', geo); // Debug log

      if (geo) {
        // Ensure we have meaningful location data
        const countryName = geo.country || 'Unknown Country';
        const regionName = geo.region || 'Unknown Region';
        const cityName = geo.city || 'Unknown City';

        // Create a more descriptive location key
        const locationKey = [countryName, regionName, cityName]
          .filter(part => part && part !== 'Unknown Country' && part !== 'Unknown Region' && part !== 'Unknown City')
          .join(', ') || 'Location not available';

        location = {
          country: countryName,
          region: regionName,
          city: cityName,
          key: locationKey,
          timestamp,
          latitude: geo.ll ? geo.ll[0] : null,
          longitude: geo.ll ? geo.ll[1] : null
        };
      }
    }

    console.log('Processed location data:', location); // Debug log

    if (!currentStats) {
      // Create new stats entry
      const initialStats = {
        sharePageId,
        dailyViews: { [today]: 1 },
        hourlyViews: { [hour]: 1 },
        locationViews: location ? {
          [location.key]: {
            views: 1,
            lastView: timestamp,
            details: location // Store full location details
          }
        } : {},
        totalViews: 1,
        totalComments: 0,
        uniqueVisitors: ip ? { [today]: [ip] } : {},
      };

      console.log('Creating new stats entry:', initialStats); // Debug log
      await db.insert(pageStats).values(initialStats);
    } else {
      const dailyViews = currentStats.dailyViews as Record<string, number>;
      const hourlyViews = (currentStats.hourlyViews as Record<string, number>) || {};
      const locationViews = (currentStats.locationViews as Record<string, any>) || {};
      const uniqueVisitors = (currentStats.uniqueVisitors as Record<string, string[]>) || {};

      dailyViews[today] = (dailyViews[today] || 0) + 1;
      hourlyViews[hour] = (hourlyViews[hour] || 0) + 1;

      if (location) {
        locationViews[location.key] = {
          views: (locationViews[location.key]?.views || 0) + 1,
          lastView: timestamp,
          details: location // Store full location details
        };
      }

      // Track unique visitors
      if (ip) {
        if (!uniqueVisitors[today]) {
          uniqueVisitors[today] = [ip];
        } else if (!uniqueVisitors[today].includes(ip)) {
          uniqueVisitors[today].push(ip);
        }
      }

      const updatedStats = {
        dailyViews,
        hourlyViews,
        locationViews,
        uniqueVisitors,
        totalViews: currentStats.totalViews + 1,
        lastUpdated: new Date(),
      };

      console.log('Updating stats:', updatedStats); // Debug log
      await db
        .update(pageStats)
        .set(updatedStats)
        .where(eq(pageStats.sharePageId, sharePageId));
    }
  }

  async updateCommentCount(sharePageId: number, increment: boolean): Promise<void> {
    const [currentStats] = await db
      .select()
      .from(pageStats)
      .where(eq(pageStats.sharePageId, sharePageId));

    if (!currentStats) {
      await db.insert(pageStats).values({
        sharePageId,
        dailyViews: {},
        totalViews: 0,
        totalComments: increment ? 1 : 0,
        uniqueVisitors: {},
      });
    } else {
      await db
        .update(pageStats)
        .set({
          totalComments: currentStats.totalComments + (increment ? 1 : -1),
          lastUpdated: new Date(),
        })
        .where(eq(pageStats.sharePageId, sharePageId));
    }
  }

  async createPasswordResetToken(username: string): Promise<string | null> {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.username, username));

    if (!user) return null;

    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 3600000);

    const [updatedUser] = await db
      .update(users)
      .set({
        resetToken: token,
        resetTokenExpiresAt: expiresAt,
      })
      .where(eq(users.id, user.id))
      .returning();

    return updatedUser ? token : null;
  }

  async getUserByResetToken(token: string): Promise<User | undefined> {
    const [user] = await db
      .select()
      .from(users)
      .where(
        and(
          eq(users.resetToken, token),
          gt(users.resetTokenExpiresAt!, new Date())
        )
      );

    return user;
  }

  async updatePassword(userId: number, newPassword: string): Promise<User> {
    const [user] = await db
      .update(users)
      .set({
        password: newPassword,
        resetToken: null,
        resetTokenExpiresAt: null,
      })
      .where(eq(users.id, userId))
      .returning();

    return user;
  }


  async createTemplate(userId: number, template: InsertTemplate): Promise<SharePageTemplate> {
    const [newTemplate] = await db
      .insert(sharePageTemplates)
      .values({
        ...template,
        userId,
        description: template.description ?? null,
        backgroundColor: template.backgroundColor ?? "#ffffff",
        textColor: template.textColor ?? "#000000",
      })
      .returning();
    return newTemplate;
  }

  async getTemplate(id: number): Promise<SharePageTemplate | undefined> {
    const [template] = await db
      .select()
      .from(sharePageTemplates)
      .where(eq(sharePageTemplates.id, id));
    return template;
  }

  async getUserTemplates(userId: number): Promise<SharePageTemplate[]> {
    return db
      .select()
      .from(sharePageTemplates)
      .where(eq(sharePageTemplates.userId, userId));
  }

  async updateTemplate(id: number, updates: Partial<InsertTemplate>): Promise<SharePageTemplate> {
    const [template] = await db
      .update(sharePageTemplates)
      .set({
        ...updates,
        description: updates.description ?? undefined,
        backgroundColor: updates.backgroundColor ?? undefined,
        textColor: updates.textColor ?? undefined,
        updatedAt: new Date(),
      })
      .where(eq(sharePageTemplates.id, id))
      .returning();
    return template;
  }

  async deleteTemplate(id: number): Promise<void> {
    await db.delete(sharePageTemplates).where(eq(sharePageTemplates.id, id));
  }

  async duplicateTemplate(id: number, userId: number): Promise<SharePageTemplate> {
    const template = await this.getTemplate(id);
    if (!template) {
      throw new Error("Template not found");
    }

    const [newTemplate] = await db
      .insert(sharePageTemplates)
      .values({
        userId,
        title: `${template.title} (Copy)`,
        description: template.description,
        backgroundColor: template.backgroundColor,
        textColor: template.textColor,
        files: template.files,
      })
      .returning();
    return newTemplate;
  }

  async createSharePageFromTemplate(templateId: number, userId: number): Promise<SharePage> {
    const template = await this.getTemplate(templateId);
    if (!template) {
      throw new Error("Template not found");
    }

    return this.createSharePage(userId, {
      title: template.title,
      description: template.description || undefined,
      backgroundColor: template.backgroundColor || "#ffffff",
      textColor: template.textColor || "#000000",
      titleFont: template.titleFont || "Inter",
      descriptionFont: template.descriptionFont || "Inter",
      titleFontSize: 24,
      descriptionFontSize: 16,
      files: template.files as any,
    });
  }

  async verifyEmail(token: string): Promise<User | undefined> {
    const [user] = await db
      .select()
      .from(users)
      .where(
        and(
          eq(users.verificationToken, token),
          gt(users.verificationTokenExpiresAt!, new Date())
        )
      );

    if (!user) return undefined;

    const [updatedUser] = await db
      .update(users)
      .set({
        emailVerified: true,
        verificationToken: null,
        verificationTokenExpiresAt: null,
      })
      .where(eq(users.id, user.id))
      .returning();

    return updatedUser;
  }

  async resendVerificationEmail(userId: number): Promise<string | null> {
    const user = await this.getUser(userId);
    if (!user || user.emailVerified) return null;

    const verificationToken = randomBytes(32).toString('hex');
    const verificationTokenExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const [updatedUser] = await db
      .update(users)
      .set({
        verificationToken,
        verificationTokenExpiresAt,
      })
      .where(eq(users.id, userId))
      .returning();

    return updatedUser ? verificationToken : null;
  }

  async deleteUser(userId: number): Promise<void> {
    await db.delete(users).where(eq(users.id, userId));
  }

  async getAllUsersWithStats(): Promise<(User & { totalSharePages: number; totalFiles: number; totalStorage: number })[]> {
    const dbUsers = await db.select().from(users);

    const usersWithStats = await Promise.all(
      dbUsers.map(async (user) => {
        const pages = await db
          .select()
          .from(sharePages)
          .where(eq(sharePages.userId, user.id));

        // Calculate total files and storage across all pages
        let totalFiles = 0;
        let totalStorage = 0;

        for (const page of pages) {
          const files = page.files as { name: string; url: string; size?: number }[];
          totalFiles += files.length;

          // Sum up file sizes if available, estimate if not
          totalStorage += files.reduce((acc, file) => {
            // If size is available in metadata, use it
            if (file.size) {
              return acc + file.size;
            }
            // Otherwise provide a conservative estimate (1MB per file)
            return acc + 1024 * 1024;
          }, 0);
        }

        return {
          ...user,
          totalSharePages: pages.length,
          totalFiles,
          // Convert to MB for display
          totalStorage: Math.round(totalStorage / (1024 * 1024))
        };
      })
    );

    return usersWithStats;
  }

  async getDailyViews(sharePageId: number): Promise<Record<string, number>> {
    const stats = await this.getPageStats(sharePageId);
    return stats?.dailyViews || {};
  }

  async getHourlyViews(sharePageId: number): Promise<Record<string, number>> {
    const stats = await this.getPageStats(sharePageId);
    return stats?.hourlyViews || {};
  }

  async getLocationViews(sharePageId: number): Promise<Record<string, any>> {
    const stats = await this.getPageStats(sharePageId);
    return stats?.locationViews || {};
  }

  async getTotalComments(sharePageId: number): Promise<number> {
    const stats = await this.getPageStats(sharePageId);
    return stats?.totalComments || 0;
  }

  async getFileDownloads(sharePageId: number): Promise<Record<string, number>> {
    const stats = await this.getPageStats(sharePageId);
    return stats?.fileDownloads || {};
  }

  async updateUser(userId: number, updates: Partial<User>): Promise<User> {
    console.log('Updating user with data:', updates);
    const [user] = await db
      .update(users)
      .set({
        email: updates.email,
        username: updates.username,
        logoUrl: updates.logoUrl,
        brandPrimaryColor: updates.brandPrimaryColor,
        brandSecondaryColor: updates.brandSecondaryColor,
      })
      .where(eq(users.id, userId))
      .returning();
    console.log('Updated user result:', user);
    return user;
  }

  async getUniqueVisitorCount(sharePageId: number): Promise<Record<string, number>> {
    const stats = await this.getPageStats(sharePageId);
    if (!stats) return {};

    const uniqueVisitors = stats.uniqueVisitors as Record<string, string[]>;
    return Object.fromEntries(
      Object.entries(uniqueVisitors).map(([date, ips]) => [date, ips.length])
    );
  }

  async recordVisitDuration(sharePageId: number, duration: number, ip?: string): Promise<void> {
    // Validate duration to prevent NaN
    if (isNaN(duration) || !Number.isFinite(duration)) {
      console.warn('Invalid duration value:', duration);
      return;
    }

    const today = new Date().toISOString().split('T')[0];
    const timestamp = new Date().toISOString();
    let location = null;

    if (ip) {
      const geo = geoip.lookup(ip);
      if (geo) {
        const locationKey = [geo.country, geo.region, geo.city].filter(Boolean).join(', ');
        location = {
          country: geo.country || null,
          region: geo.region || null,
          city: geo.city || null,
          key: locationKey,
          timestamp
        };
      }
    }

    console.log('Recording visit duration:', {
      sharePageId,
      duration,
      ip,
      location,
      timestamp
    });

    const [currentStats] = await db
      .select()
      .from(pageStats)
      .where(eq(pageStats.sharePageId, sharePageId));

    if (!currentStats) {
      await db.insert(pageStats).values({
        sharePageId,
        dailyViews: {},
        totalViews: 0,
        totalComments: 0,
        uniqueVisitors: {},
        visitDurations: {
          [today]: [{
            duration,
            timestamp,
            location: location || { city: null, region: null, country: null, key: 'Location not available' }
          }]
        },
        averageVisitDuration: duration,
      });
    } else {
      const visitDurations = currentStats.visitDurations as Record<string, any[]> || {};

      if (!visitDurations[today]) {
        visitDurations[today] = [];
      }
      visitDurations[today].push({
        duration,
        timestamp,
        location: location || { city: null, region: null, country: null, key: 'Location not available' }
      });

      // Calculate new average
      const allDurations = Object.values(visitDurations)
        .flat()
        .map(visit => visit.duration)
        .filter(d => !isNaN(d) && Number.isFinite(d));

      const newAverage = allDurations.length > 0
        ? Math.round(allDurations.reduce((sum, dur) => sum + dur, 0) / allDurations.length)
        : 0;

      console.log('Updating visit duration stats:', {
        visitDurations,
        newAverage
      });

      await db
        .update(pageStats)
        .set({
          visitDurations,
          averageVisitDuration: newAverage,
          lastUpdated: new Date(),
        })
        .where(eq(pageStats.sharePageId, sharePageId));
    }
  }

  async getAverageVisitDuration(sharePageId: number): Promise<number> {
    const stats = await this.getPageStats(sharePageId);
    return stats?.averageVisitDuration || 0;
  }

  async getDailyVisitDurations(sharePageId: number): Promise<Record<string, number[]>> {
    const stats = await this.getPageStats(sharePageId);
    return (stats?.visitDurations as Record<string, number[]>) || {};
  }
}

export const storage = new DatabaseStorage();