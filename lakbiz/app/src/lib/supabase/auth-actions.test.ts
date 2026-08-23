import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createBrowserClient: vi.fn(),
}));

vi.mock("./client", () => ({
  createBrowserClient: mocks.createBrowserClient,
}));

import {
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

function signInClient({ withSession = true } = {}) {
  const signOut = vi.fn(() => Promise.resolve({ error: null }));
  const signInWithPassword = vi.fn(() =>
    Promise.resolve({
      data: {
        user: withSession ? { id: "user-1", user_metadata: {} } : null,
        session: withSession ? { access_token: "test" } : null,
      },
      error: null,
    }),
  );
  const from = vi.fn(() => {
    throw new Error("Sign-in must not make post-auth table queries");
  });

  return {
    auth: { signInWithPassword, signOut },
    from,
    signOut,
    signInWithPassword,
  };
}

describe("admin-only workspace provisioning", () => {
  beforeEach(() => {
    mocks.createBrowserClient.mockReset();
  });

  it("always refuses public shop signup before touching Supabase", async () => {
    await expect(
      signUpWithShop({
        email: "new@example.com",
        password: "password123",
        shopName: "Client-created shop",
        sector: "grocery",
      }),
    ).rejects.toMatchObject({ code: "auth" });

    expect(mocks.createBrowserClient).not.toHaveBeenCalled();
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

    await expect(ensureUserOrg(client as never, "user-1")).rejects.toMatchObject({
      code: "org",
    });

    expect(client.rpc).not.toHaveBeenCalled();
  });

  it("returns immediately after a successful password exchange without workspace/admin queries", async () => {
    const client = signInClient();
    mocks.createBrowserClient.mockReturnValue(client);

    await expect(signInWithEmail("user@example.com", "password123")).resolves.toMatchObject({
      user: { id: "user-1" },
      session: { access_token: "test" },
    });

    expect(client.signInWithPassword).toHaveBeenCalledWith({
      email: "user@example.com",
      password: "password123",
    });
    expect(client.from).not.toHaveBeenCalled();
    expect(client.signOut).not.toHaveBeenCalled();
  });

  it("rejects a password exchange that does not return a usable session", async () => {
    const client = signInClient({ withSession: false });
    mocks.createBrowserClient.mockReturnValue(client);

    await expect(signInWithEmail("user@example.com", "password123")).rejects.toMatchObject({
      code: "auth",
    });

    expect(client.from).not.toHaveBeenCalled();
    expect(client.signOut).not.toHaveBeenCalled();
  });
});