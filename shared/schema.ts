import { pgTable, text, serial, integer, boolean, jsonb, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  dropboxToken: text("dropbox_token"),
  resetToken: text("reset_token"),
  resetTokenExpiresAt: timestamp("reset_token_expires_at"),
});

export const fileSchema = z.object({
  name: z.string(),
  preview_url: z.string(),
  url: z.string(),
  isFullWidth: z.boolean().default(false),
});

export const sharePages = pgTable("share_pages", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  slug: text("slug").notNull().unique(),
  backgroundColor: text("background_color").default("#ffffff"),
  textColor: text("text_color").default("#000000"),
  files: jsonb("files").notNull(),
  lastViewedAt: timestamp("last_viewed_at"),
});

export const annotations = pgTable("annotations", {
  id: serial("id").primaryKey(),
  sharePageId: integer("share_page_id").notNull(),
  fileIndex: integer("file_index").notNull(),
  userId: integer("user_id"),
  guestName: text("guest_name"),
  content: text("content").notNull(),
  positionX: integer("position_x").notNull(),
  positionY: integer("position_y").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const pageStats = pgTable("page_stats", {
  id: serial("id").primaryKey(),
  sharePageId: integer("share_page_id").notNull().unique(),
  dailyViews: jsonb("daily_views").default({}).notNull(),
  totalViews: integer("total_views").default(0).notNull(),
  totalComments: integer("total_comments").default(0).notNull(),
  lastUpdated: timestamp("last_updated").defaultNow().notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
}).extend({
  username: z.string().min(3, "Username must be at least 3 characters"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export const insertSharePageSchema = createInsertSchema(sharePages).pick({
  title: true,
  description: true,
  backgroundColor: true,
  textColor: true,
  files: true,
}).extend({
  files: z.array(fileSchema),
});

export const insertAnnotationSchema = createInsertSchema(annotations).pick({
  fileIndex: true,
  content: true,
  positionX: true,
  positionY: true,
  guestName: true,
});

export const requestPasswordResetSchema = z.object({
  username: z.string().email("Must be a valid email address"),
});

export const resetPasswordSchema = z.object({
  token: z.string(),
  newPassword: z.string().min(6, "Password must be at least 6 characters"),
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type SharePage = typeof sharePages.$inferSelect;
export type InsertSharePage = z.infer<typeof insertSharePageSchema>;
export type FileObject = z.infer<typeof fileSchema>;
export type Annotation = typeof annotations.$inferSelect;
export type InsertAnnotation = z.infer<typeof insertAnnotationSchema>;
export type PageStats = typeof pageStats.$inferSelect;