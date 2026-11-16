import {z} from 'zod';

// Frozen strict capability-collection v1 consumer contract used by sealwork 0.2.48.
// Keep host-consumed metadata compatible; CLI capabilities own optional extensions.
export const collectionManifestSchema = z.object({
  schemaVersion: z.literal(1), kind: z.literal("capability-collection"),
  id: z.string().regex(/^[a-z][a-z0-9.-]{2,100}$/), name: z.string().min(1).max(100),
  description: z.string().min(1).max(400), entry: z.string().regex(/^[a-zA-Z0-9_./-]+\.m?js$/),
  platforms: z.array(z.enum(["darwin", "win32", "linux"])).min(1),
  autoUpdate: z.object({ channel: z.literal("latest"), compatibility: z.literal("semver") }).strict(),
}).strict();
