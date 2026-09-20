import { integer, jsonb, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

/** Key/Value-Ablage für alle App-Einstellungen (inkl. API-Keys, nur serverseitig). */
export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

/** Protokoll aller Buffer-Postings (geplant, gesendet, Fehler). */
export const bufferJobs = pgTable("buffer_jobs", {
  id: serial("id").primaryKey(),
  bayIndex: integer("bay_index"),
  title: text("title"),
  channelId: text("channel_id"),
  mode: text("mode").notNull(),
  status: text("status").notNull(), // success | error
  bufferPostId: text("buffer_post_id"),
  dueAt: text("due_at"),
  message: text("message"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
