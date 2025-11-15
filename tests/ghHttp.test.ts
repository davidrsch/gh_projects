import { ghHttpGraphQL } from "../src/lib/ghHttp";

jest.mock("@octokit/graphql", () => {
  // create a mock 'graphql' export with a .defaults method
  const mockClient = jest.fn(async (q: any, v: any) => {
    return { viewer: { login: "mock-user" }, query: q, variables: v };
  });
  const graphql = {
    defaults: jest.fn(() => mockClient),
  };
  return { graphql };
});

describe("ghHttpGraphQL", () => {
  it("returns wrapped data when token provided", async () => {
    const res = await ghHttpGraphQL("query { viewer { login } }", undefined, {
      token: "fake-token",
      timeoutMs: 1000,
    });
    expect(res).toBeDefined();
    expect(res.data).toBeDefined();
    expect((res.data as any).viewer.login).toBe("mock-user");
  });

  it("throws when token missing", async () => {
    await expect(
      // @ts-ignore - intentionally omit token
      ghHttpGraphQL("query { viewer { login } }", undefined, {}),
    ).rejects.toHaveProperty("code", "EINVAL");
  });

  it("maps timeout errors to ETIMEDOUT", async () => {
    const { graphql } = require("@octokit/graphql");
    const timeoutErr: any = new Error("request timed out");
    timeoutErr.code = "ETIMEDOUT";
    graphql.defaults.mockReturnValueOnce(async () => {
      throw timeoutErr;
    });

    await expect(
      ghHttpGraphQL("query { viewer { login } }", undefined, {
        token: "fake-token",
        timeoutMs: 10,
      }),
    ).rejects.toHaveProperty("code", "ETIMEDOUT");
  });

  it("maps 401/unauthorized to EPERM", async () => {
    const { graphql } = require("@octokit/graphql");
    const unauth: any = new Error("Unauthorized");
    unauth.status = 401;
    graphql.defaults.mockReturnValueOnce(async () => {
      throw unauth;
    });

    await expect(
      ghHttpGraphQL("query { viewer { login } }", undefined, {
        token: "fake-token",
      }),
    ).rejects.toHaveProperty("code", "EPERM");
  });
});
