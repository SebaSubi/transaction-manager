import "server-only";

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";

import { env } from "@/lib/env";
import * as schema from "@/lib/db/schema";
import { assertPooledNeonUrl } from "@/lib/db/pooledUrl";

export { assertPooledNeonUrl };

assertPooledNeonUrl(env.DATABASE_URL);

const sql = neon(env.DATABASE_URL);

export const db = drizzle(sql, { schema });
