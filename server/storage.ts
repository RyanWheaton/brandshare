import { users, sharePages, type User, type InsertUser, type SharePage, type InsertSharePage, type Annotation, type InsertAnnotation, pageStats, type PageStats } from "@shared/schema";
import session from "express-session";
import { nanoid } from "nanoid";
import { db } from "./db";
import { eq, and } from "drizzle-orm";
import ConnectPgSimple from "connect-pg-simple";
import { pool } from "./db";
import { annotations } from "@shared/schema";

const PgSession = ConnectPgSimple(session);

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
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

  // New methods for stats
  getPageStats(sharePageId: number): Promise<PageStats | undefined>;
  recordPageView(sharePageId: number): Promise<void>;
  updateCommentCount(sharePageId: number, increment: boolean): Promise<void>;

  sessionStore: session.Store;
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
      })
      .returning();

    // Initialize stats for the new page
    await db.insert(pageStats).values({
      sharePageId: sharePage.id,
      dailyViews: {},
      totalViews: 0,
      totalComments: 0,
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
        textColor: updates.textColor ?? undefined,
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

    // Increment comment count
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

    if (annotation) {
      const query = db.delete(annotations).where(eq(annotations.id, id));
      if (userId) {
        query.where(eq(annotations.userId, userId));
      }
      await query;

      // Decrement comment count
      await this.updateCommentCount(annotation.sharePageId, false);
    }
  }

  async getPageStats(sharePageId: number): Promise<PageStats | undefined> {
    const [stats] = await db
      .select()
      .from(pageStats)
      .where(eq(pageStats.sharePageId, sharePageId));
    return stats;
  }

  async recordPageView(sharePageId: number): Promise<void> {
    const today = new Date().toISOString().split('T')[0];
    const [currentStats] = await db
      .select()
      .from(pageStats)
      .where(eq(pageStats.sharePageId, sharePageId));

    if (!currentStats) {
      // Initialize stats if they don't exist
      await db.insert(pageStats).values({
        sharePageId,
        dailyViews: { [today]: 1 },
        totalViews: 1,
        totalComments: 0,
      });
    } else {
      const dailyViews = currentStats.dailyViews as Record<string, number>;
      dailyViews[today] = (dailyViews[today] || 0) + 1;

      await db
        .update(pageStats)
        .set({
          dailyViews,
          totalViews: currentStats.totalViews + 1,
          lastUpdated: new Date(),
        })
        .where(eq(pageStats.sharePageId, sharePageId));
    }
  }

  async updateCommentCount(sharePageId: number, increment: boolean): Promise<void> {
    const [currentStats] = await db
      .select()
      .from(pageStats)
      .where(eq(pageStats.sharePageId, sharePageId));

    if (!currentStats) {
      // Initialize stats if they don't exist
      await db.insert(pageStats).values({
        sharePageId,
        dailyViews: {},
        totalViews: 0,
        totalComments: increment ? 1 : 0,
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
}

export const storage = new DatabaseStorage();