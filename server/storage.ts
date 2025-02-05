import { users, sharePages, type User, type InsertUser, type SharePage, type InsertSharePage } from "@shared/schema";
import session from "express-session";
import { nanoid } from "nanoid";
import { db } from "./db";
import { eq } from "drizzle-orm";
import ConnectPgSimple from "connect-pg-simple";
import { pool } from "./db";

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
}

export const storage = new DatabaseStorage();