import { pgTable, text, serial, integer, boolean, jsonb, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  dropboxToken: text("dropbox_token"),
  resetToken: text("reset_token"),
  resetTokenExpiresAt: timestamp("reset_token_expires_at"),
  emailVerified: boolean("email_verified").default(false).notNull(),
  verificationToken: text("verification_token"),
  verificationTokenExpiresAt: timestamp("verification_token_expires_at"),
  logoUrl: text("logo_url"),
  brandPrimaryColor: text("brand_primary_color").default("#000000"),
  brandSecondaryColor: text("brand_secondary_color").default("#ffffff"),
});

export const fileSchema = z.object({
  name: z.string(),
  preview_url: z.string().optional().default(""),
  url: z.string(),
  isFullWidth: z.boolean().default(false),
  title: z.string().optional(),
  description: z.string().optional(),
  storageType: z.enum(['s3', 'dropbox']).default('dropbox'),
  s3Key: z.string().optional(), // The S3 object key for the file
});

export const sharePageTemplates = pgTable("share_page_templates", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  backgroundColor: text("background_color").default("#ffffff"),
  textColor: text("text_color").default("#000000"),
  titleFont: text("title_font").default("Inter"),
  descriptionFont: text("description_font").default("Inter"),
  files: jsonb("files").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const sharePages = pgTable("share_pages", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  slug: text("slug").notNull().unique(),
  backgroundColor: text("background_color").default("#ffffff"),
  backgroundColorSecondary: text("background_color_secondary"),
  textColor: text("text_color").default("#000000"),
  titleFont: text("title_font").default("Inter").notNull(),
  descriptionFont: text("description_font").default("Inter").notNull(),
  titleFontSize: integer("title_font_size").default(24).notNull(),
  descriptionFontSize: integer("description_font_size").default(16).notNull(),
  logoUrl: text("logo_url"),
  logoSize: integer("logo_size").default(200),
  files: jsonb("files").notNull(),
  lastViewedAt: timestamp("last_viewed_at"),
  password: text("password"),
  expiresAt: timestamp("expires_at"),
  footerBackgroundColor: text("footer_background_color").default("#f3f4f6"),
  footerText: text("footer_text"),
  footerTextColor: text("footer_text_color").default("#000000"),
  showFooter: boolean("show_footer").default(true).notNull(),
  footerLogoUrl: text("footer_logo_url"),
  footerLogoSize: integer("footer_logo_size").default(150),
  footerLogoLink: text("footer_logo_link"),
  buttonBackgroundColor: text("button_background_color").default("#007bff"),
  buttonBorderColor: text("button_border_color").default("#007bff"),
  buttonTextColor: text("button_text_color").default("#ffffff"),
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
  hourlyViews: jsonb("hourly_views").default({}).notNull(),
  locationViews: jsonb("location_views").default({}).notNull(),
  totalViews: integer("total_views").default(0).notNull(),
  totalComments: integer("total_comments").default(0).notNull(),
  lastUpdated: timestamp("last_updated").defaultNow().notNull(),
  uniqueVisitors: jsonb("unique_visitors").default({}).notNull(),
  visitDurations: jsonb("visit_durations").default({}).notNull(),
  averageVisitDuration: integer("average_visit_duration").default(0).notNull(),
});

export const insertTemplateSchema = createInsertSchema(sharePageTemplates).pick({
  title: true,
  description: true,
  backgroundColor: true,
  textColor: true,
  titleFont: true,
  descriptionFont: true,
  files: true,
}).extend({
  files: z.array(fileSchema),
  titleFont: z.string().min(1, "Title font is required"),
  descriptionFont: z.string().min(1, "Description font is required"),
  titleFontSize: z.number().min(12).max(48).optional(),
  descriptionFontSize: z.number().min(12).max(32).optional(),
  backgroundColorSecondary: z.string().optional(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  email: true,
  username: true,
  password: true,
}).extend({
  email: z.string().email("Please enter a valid email address"),
  username: z.string().min(3, "Username must be at least 3 characters"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export const insertSharePageSchema = createInsertSchema(sharePages).pick({
  title: true,
  description: true,
  backgroundColor: true,
  backgroundColorSecondary: true,
  textColor: true,
  titleFont: true,
  descriptionFont: true,
  titleFontSize: true,
  descriptionFontSize: true,
  logoUrl: true,
  logoSize: true,
  files: true,
  password: true,
  expiresAt: true,
  footerBackgroundColor: true,
  footerText: true,
  footerTextColor: true,
  showFooter: true,
  footerLogoUrl: true,
  footerLogoSize: true,
  footerLogoLink: true,
  buttonBackgroundColor: true,
  buttonBorderColor: true,
  buttonTextColor: true,
}).extend({
  files: z.array(fileSchema),
  password: z.string().optional(),
  expiresAt: z.string().optional(),
  backgroundColorSecondary: z.string().optional(),
  logoUrl: z.string().optional(),
  titleFont: z.string().min(1, "Title font is required"),
  descriptionFont: z.string().min(1, "Description font is required"),
  titleFontSize: z.number().min(12).max(48),
  descriptionFontSize: z.number().min(12).max(32),
  logoSize: z.number().min(50).max(800).default(200),
  footerText: z.string().optional(),
  footerBackgroundColor: z.string().optional(),
  footerTextColor: z.string().optional(),
  showFooter: z.boolean().default(true),
  footerLogoUrl: z.string().optional(),
  footerLogoSize: z.number().min(50).max(800).default(150),
  footerLogoLink: z.string().optional(),
  buttonBackgroundColor: z.string().optional(),
  buttonBorderColor: z.string().optional(),
  buttonTextColor: z.string().optional(),
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

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(6, "New password must be at least 6 characters"),
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type SharePage = typeof sharePages.$inferSelect;
export type InsertSharePage = z.infer<typeof insertSharePageSchema>;
export type FileObject = z.infer<typeof fileSchema>;
export type Annotation = typeof annotations.$inferSelect;
export type InsertAnnotation = z.infer<typeof insertAnnotationSchema>;
export type PageStats = typeof pageStats.$inferSelect;
export type ChangePasswordData = z.infer<typeof changePasswordSchema>;
export type SharePageTemplate = typeof sharePageTemplates.$inferSelect;
export type InsertTemplate = z.infer<typeof insertTemplateSchema>;