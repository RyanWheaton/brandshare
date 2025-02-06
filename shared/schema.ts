import { pgTable, text, serial, integer, boolean, jsonb, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  dropboxToken: text("dropbox_token"),
});

// Define the file schema
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

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type SharePage = typeof sharePages.$inferSelect;
export type InsertSharePage = z.infer<typeof insertSharePageSchema>;
export type FileObject = z.infer<typeof fileSchema>;
export type Annotation = typeof annotations.$inferSelect;
export type InsertAnnotation = z.infer<typeof insertAnnotationSchema>;