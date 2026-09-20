import { AppError } from "@/lib/errors";

/**
 * Buffer GraphQL API (offiziell, siehe developers.buffer.com):
 * - Endpoint: https://api.buffer.com (POST, Authorization: Bearer <API-Key>)
 * - Videos werden per öffentlich erreichbarer URL in `assets: [{video:{url}}]`
 *   übergeben – Buffer holt sich die Datei direkt von unserem Server.
 */
const ENDPOINT = "https://api.buffer.com";

async function bufferGraphql<T>(token: string, query: string, variables?: Record<string, unknown>): Promise<T> {
  if (!token) throw new AppError("BUFFER_TOKEN_MISSING");

  let res: Response;
  try {
    res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ query, variables }),
    });
  } catch (e) {
    throw new AppError("BUFFER_HTTP", e instanceof Error ? e.message : undefined);
  }

  if (res.status === 401 || res.status === 403) throw new AppError("BUFFER_INVALID_TOKEN", undefined, 401);

  let json: { data?: T; errors?: { message?: string }[] } | null = null;
  try {
    json = await res.json();
  } catch {
    throw new AppError("BUFFER_HTTP", `HTTP ${res.status}`);
  }

  if (json?.errors?.length) {
    throw new AppError("BUFFER_GRAPHQL", json.errors.map((e) => e.message).join(" | ").slice(0, 240), 502);
  }
  if (!json?.data) throw new AppError("BUFFER_HTTP", `HTTP ${res.status}: leere Antwort`, 502);
  return json.data;
}

export interface BufferChannel {
  id: string;
  name: string;
  displayName?: string;
  service?: string;
  avatar?: string;
  isDisconnected?: boolean;
  organizationId?: string;
}

interface AccountData {
  account?: { organizations?: { id: string; name?: string }[] };
}

export async function fetchBufferChannels(token: string): Promise<BufferChannel[]> {
  const account = await bufferGraphql<AccountData>(
    token,
    `query { account { organizations { id name } } }`
  );
  const orgs = account.account?.organizations ?? [];
  if (orgs.length === 0) return [];

  const all: BufferChannel[] = [];
  for (const org of orgs) {
    const data = await bufferGraphql<{ channels?: BufferChannel[] }>(
      token,
      `query GetChannels($organizationId: String!) {
        channels(organizationId: $organizationId) {
          id name displayName service avatar isDisconnected
        }
      }`,
      { organizationId: org.id }
    ).catch(() => ({ channels: [] as BufferChannel[] }));
    for (const ch of data.channels ?? []) all.push({ ...ch, organizationId: org.id });
  }
  return all;
}

export type BufferMode = "now" | "queue" | "scheduled";

interface CreatePostData {
  createPost?: { post?: { id?: string; dueAt?: string; status?: string }; message?: string };
}

export async function createBufferPost(
  token: string,
  opts: {
    channelId: string;
    text: string;
    videoUrl: string;
    mode: BufferMode;
    dueAt?: string; // ISO 8601 UTC
  }
): Promise<{ postId: string; dueAt?: string; status?: string }> {
  if (!opts.channelId) throw new AppError("BUFFER_CHANNEL_MISSING");

  const modeMap: Record<BufferMode, string> = {
    now: "shareNow",
    queue: "addToQueue",
    scheduled: "customScheduled",
  };

  const input: Record<string, unknown> = {
    channelId: opts.channelId,
    text: opts.text,
    schedulingType: "automatic",
    mode: modeMap[opts.mode],
    assets: [{ video: { url: opts.videoUrl } }],
  };
  if (opts.mode === "scheduled") {
    if (!opts.dueAt) throw new AppError("BUFFER_GRAPHQL", "Kein Zeitpunkt für die Planung angegeben");
    input.dueAt = opts.dueAt;
  }

  const data = await bufferGraphql<CreatePostData>(
    token,
    `mutation CreatePost($input: CreatePostInput!) {
      createPost(input: $input) {
        ... on PostActionSuccess { post { id dueAt status } }
        ... on MutationError { message }
      }
    }`,
    { input }
  );

  const result = data.createPost;
  if (!result?.post?.id) {
    throw new AppError("BUFFER_GRAPHQL", result?.message || "Unbekannte Buffer-Antwort", 502);
  }
  return { postId: result.post.id, dueAt: result.post.dueAt, status: result.post.status };
}
