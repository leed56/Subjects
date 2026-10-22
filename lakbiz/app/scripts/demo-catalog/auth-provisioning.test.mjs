import { describe, expect, it, vi } from "vitest";
import { ensureDemoStaff } from "./importer.mjs";

function queryResult(value) {
  return {
    select() { return this; },
    eq() { return this; },
    async maybeSingle() { return value; },
    then(resolve) { return Promise.resolve(value).then(resolve); },
  };
}

function makeClient({
  users = [],
  platformAdmin = null,
  memberships = [],
  membershipInsertError = null,
  createdUser = { id: "new-user", email: "cashier@example.test" },
} = {}) {
  const inserted = [];
  const deletedUsers = [];
  return {
    inserted,
    deletedUsers,
    auth: {
      admin: {
        listUsers: vi.fn(async () => ({ data: { users }, error: null })),
        createUser: vi.fn(async () => ({ data: { user: createdUser }, error: null })),
        deleteUser: vi.fn(async (id) => { deletedUsers.push(id); return { data: {}, error: null }; }),
      },
    },
    from(table) {
      if (table === "platform_admins") {
        const value = { data: platformAdmin, error: null };
        return queryResult(value);
      }
      if (table === "org_members") {
        return {
          select() { return this; },
          eq() { return Promise.resolve({ data: memberships, error: null }); },
          async insert(row) {
            inserted.push(row);
            return { error: membershipInsertError };
          },
        };
      }
      throw new Error(`Unexpected table ${table}`);
    },
  };
}

const spec = {
  orgId: "00000000-0000-4000-8000-000000000001",
  email: "cashier@example.test",
  password: "strong-demo-password",
  role: "cashier",
  displayName: "LakBiz Demo Cashier",
};

describe("demo cashier Auth provisioning", () => {
  it("refuses to reuse a platform-admin identity", async () => {
    const user = { id: "admin-user", email: spec.email };
    const client = makeClient({ users: [user], platformAdmin: { user_id: user.id } });
    await expect(ensureDemoStaff(client, spec)).rejects.toThrow(/platform-admin identity/i);
    expect(client.inserted).toHaveLength(0);
  });

  it("creates a new Auth user and exactly one cashier membership", async () => {
    const client = makeClient();
    const result = await ensureDemoStaff(client, spec);
    expect(result).toEqual({ userId: "new-user", created: true, role: "cashier" });
    expect(client.inserted).toEqual([{
      organization_id: spec.orgId,
      user_id: "new-user",
      role: "cashier",
    }]);
    expect(client.deletedUsers).toHaveLength(0);
  });

  it("deletes a newly created Auth user if membership insertion fails", async () => {
    const client = makeClient({ membershipInsertError: { message: "simulated membership failure" } });
    await expect(ensureDemoStaff(client, spec)).rejects.toThrow(/simulated membership failure/);
    expect(client.deletedUsers).toEqual(["new-user"]);
  });

  it("is idempotent for an existing cashier already attached to the same shop", async () => {
    const user = { id: "existing-cashier", email: spec.email };
    const client = makeClient({
      users: [user],
      memberships: [{ organization_id: spec.orgId, role: "cashier" }],
    });
    const result = await ensureDemoStaff(client, spec);
    expect(result).toEqual({ userId: user.id, created: false, role: "cashier" });
    expect(client.inserted).toHaveLength(0);
  });
});
