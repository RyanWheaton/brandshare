import { users, sharePages, type User, type InsertUser, type SharePage, type InsertSharePage } from "@shared/schema";
import session from "express-session";
import createMemoryStore from "memorystore";
import { nanoid } from "nanoid";

const MemoryStore = createMemoryStore(session);

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

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private sharePages: Map<number, SharePage>;
  private currentUserId: number;
  private currentSharePageId: number;
  sessionStore: session.Store;

  constructor() {
    this.users = new Map();
    this.sharePages = new Map();
    this.currentUserId = 1;
    this.currentSharePageId = 1;
    this.sessionStore = new MemoryStore({
      checkPeriod: 86400000,
    });
  }

  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.currentUserId++;
    const user = { ...insertUser, id, dropboxToken: null };
    this.users.set(id, user);
    return user;
  }

  async updateUserDropboxToken(userId: number, token: string): Promise<User> {
    const user = await this.getUser(userId);
    if (!user) throw new Error("User not found");

    const updatedUser = { ...user, dropboxToken: token };
    this.users.set(userId, updatedUser);
    return updatedUser;
  }

  async createSharePage(userId: number, page: InsertSharePage): Promise<SharePage> {
    const id = this.currentSharePageId++;
    const slug = nanoid(10);
    const sharePage = {
      ...page,
      id,
      userId,
      slug,
      description: page.description ?? null,
      backgroundColor: page.backgroundColor ?? "#ffffff",
      textColor: page.textColor ?? "#000000",
    };
    this.sharePages.set(id, sharePage);
    return sharePage;
  }

  async getSharePage(id: number): Promise<SharePage | undefined> {
    return this.sharePages.get(id);
  }

  async getSharePageBySlug(slug: string): Promise<SharePage | undefined> {
    return Array.from(this.sharePages.values()).find(
      (page) => page.slug === slug,
    );
  }

  async getUserSharePages(userId: number): Promise<SharePage[]> {
    return Array.from(this.sharePages.values()).filter(
      (page) => page.userId === userId,
    );
  }

  async updateSharePage(id: number, updates: Partial<InsertSharePage>): Promise<SharePage> {
    const page = await this.getSharePage(id);
    if (!page) throw new Error("Share page not found");

    const updatedPage = {
      ...page,
      ...updates,
      description: updates.description ?? page.description,
      backgroundColor: updates.backgroundColor ?? page.backgroundColor,
      textColor: updates.textColor ?? page.textColor,
    };
    this.sharePages.set(id, updatedPage);
    return updatedPage;
  }

  async deleteSharePage(id: number): Promise<void> {
    this.sharePages.delete(id);
  }
}

export const storage = new MemStorage();