import { beforeEach, describe, expect, it, vi } from "vitest";

const createBrowserClient = vi.fn();

vi.mock("./client", () => ({
  createBrowserClient,
}));

import {
  AuthFlowError,
  ensureUserOrg,
  signInWithEmail,
  signUpWithShop,
} from "./auth-actions";

type QueryResult<T> = Promise<{ data: T; error: null }>;

function orgLookupClient(rows: Array<{ organization_id: string }> = []) {
  const rpc = vi.fn();
  const limit = vi.fn((): QueryResult<typeof rows> => Promise.resolve({ data: rows, error: null }));
  const eq = vi.fn(() => ({ limit }));
  const select = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ select }));
  return { from, rpc, select, eq, limit };
}

function signInClient({ platformAdmin = false, orgId = null as string | null } = {}) {
  const signOut = vi.fn(() => Promise.resolve({ error: null }));
  const signInWithPassword = vi.fn(() =>
    Promise.resolve({
      data: { user: { id: "user-1", user_metadata: {} }, session: { access_token: "test" } },
      error: null,
    }),
  );
  const orgLimit = vi.fn(() =>
    Promise.resolve({ data: orgId ? [{ organization_id: orgId }] : [], error: null }),
  );

  const from = vi.fn((table: string) => {
    if (table === "platform_admins") {
      return {
        select: vi.fn(() => ({
          maybeSingle: vi.fn(() =>
            Promise.resolve({
              data: platformAdmin ? { user_id: "user-1" } : null,
              error: null,
            }),
          ),
        })),
      };
    }
    if (table === "org_members") {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({ limit: orgLimit })),
        })),
      };
    }
    throw new Error(`Unexpected table ${table}`);
  });

  return {
    auth: { signInWithPassword, signOut },
    from,
    signOut,
    signInWithPassword,
    orgLimit,
  };
}

describe("admin-only workspace provisioning", () => {
  beforeEach(() => {
    createBrowserClient.mockReset();
  });

  it("always refuses public shop signup before touching Supabase", async () => {
    await expect(
      signUpWithShop({
        email: "new@example.com",
        password: "password123",
        shopName: "Client-created shop",
        sector: "grocery",
      }),
    ).rejects.toMatchObject<AuthFlowError>({ code: "auth" });

    expect(createBrowserClient).not.toHaveBeenCalled();
  });

  it("returns an already assigned workspace without invoking a bootstrap RPC", async () => {
    const client = orgLookupClient([{ organization_id: "org-existing" }]);

    await expect(
      ensureUserOrg(client as never, "user-1", {
        shopName: "Ignored",
        sector: "pharmacy",
      }),
    ).resolves.toBe("org-existing");

    expect(client.rpc).not.toHaveBeenCalled();
  });

  it("refuses to create a workspace when a user has no membership", async () => {
    const client = orgLookupClient([]);

    await expect(ensureUserOrg(client as never, "user-1")).rejects.toMatchObject<AuthFlowError>({
      code: "org",
    });

    expect(client.rpc).not.toHaveBeenCalled();
  });

  it("signs out a normal authenticated user who has no assigned workspace", async () => {
    const client = signInClient({ platformAdmin: false, orgId: null });
    createBrowserClient.mockReturnValue(client);

    await expect(signInWithEmail("user@example.com", "password123")).rejects.toMatchObject<AuthFlowError>({
      code: "org",
    });

    expect(client.signOut).toHaveBeenCalledTimes(1);
  });

  it("allows a platform administrator to sign in without a shop membership", async () => {
    const client = signInClient({ platformAdmin: true, orgId: null });
    createBrowserClient.mockReturnValue(client);

    await expect(signInWithEmail("admin@example.com", "password123")).resolves.toMatchObject({
      user: { id: "user-1" },
    });

    expect(client.signOut).not.toHaveBeenCalled();
    expect(client.orgLimit).not.toHaveBeenCalled();
  });
});
