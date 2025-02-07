import { users, sharePages, sharePageTemplates, type User, type InsertUser, type SharePage, type InsertSharePage, type Annotation, type InsertAnnotation, type PageStats, type SharePageTemplate, type InsertTemplate } from "@shared/schema";
import session from "express-session";
import { nanoid } from "nanoid";
import { db } from "./db";
import { eq, and, gt } from "drizzle-orm";
import ConnectPgSimple from "connect-pg-simple";
import { pool } from "./db";
import { annotations, pageStats } from "@shared/schema";
import { randomBytes } from "crypto";

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

  getPageStats(sharePageId: number): Promise<PageStats | undefined>;
  recordPageView(sharePageId: number): Promise<void>;
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
      let query = db.delete(annotations).where(eq(annotations.id, id));

      if (userId !== undefined) {
        query = query.where(eq(annotations.userId, userId));
      }
      await query;

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
      backgroundColor: template.backgroundColor,
      textColor: template.textColor,
      files: template.files as any,
    });
  }
}

export const storage = new DatabaseStorage();