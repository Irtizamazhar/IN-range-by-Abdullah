import bcrypt from "bcryptjs";
import { isPreviewEmailAllowed, isValidPreviewPasswordHash } from "@/lib/private-launch/session";

/** A fixed hash keeps rejected email checks on the bcrypt path. */
const DUMMY_BCRYPT_HASH = "$2b$12$QPsnLPsXDmWop537RVbpc.sIfmyG/w2LATsj/za4UYi.DBm9i6k3u";

/** Preview access is a separate shared credential; it never grants an app role. */
export async function verifyTeamCredentials(
  rawEmail: string,
  password: string,
  env: NodeJS.ProcessEnv = process.env,
): Promise<string | null> {
  const email = rawEmail.trim().toLowerCase();
  const allowed = isPreviewEmailAllowed(email, env);
  const hash = env.PREVIEW_PASSWORD_HASH?.trim();
  const validHash = isValidPreviewPasswordHash(hash);
  const matches = await bcrypt.compare(password || "x", allowed && validHash ? hash! : DUMMY_BCRYPT_HASH);
  return allowed && validHash && matches ? email : null;
}
