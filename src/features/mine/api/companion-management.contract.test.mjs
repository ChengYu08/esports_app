import assert from "node:assert/strict";
import test from "node:test";
import {
  createCompanionManagementApi,
  formatManagementNumber,
  walletNextPage,
} from "./companion-management.contract.ts";

const context = { userId: "51", clubId: "100", gameId: "8" };
const token = "test-session";
function setup(data) {
  const calls = [];
  const api = createCompanionManagementApi(async (path, options) => {
    calls.push({ path, ...options });
    return { code: "SUCCESS", data };
  });
  return { api, calls };
}

test("management reads use PC endpoints, authenticated identity and actual response data", async () => {
  const { api, calls } = setup({
    games: [{ gameId: 8, gameName: "测试游戏" }, { gameId: 0 }],
  });
  assert.deepEqual(await api.games(context, token), [
    { gameId: 8, gameName: "测试游戏" },
  ]);
  await api.gameDetail(context, token);
  await api.services(context, token);
  await api.wallet(token);
  await api.orderStat(token);
  assert.deepEqual(
    calls.map(({ path, method, body }) => ({ path, method, body })),
    [
      {
        path: "/client/v1/companion/public/detail",
        method: "POST",
        body: { clubId: 100, userId: 51 },
      },
      {
        path: "/client/v1/companion/public/game/detail",
        method: "POST",
        body: { clubId: 100, userId: 51, gameId: 8 },
      },
      {
        path: "/client/v1/companion/companion/getCompanionGameModeLevelServiceList",
        method: "POST",
        body: { clubId: 100, companionUserId: 51, gameId: 8 },
      },
      { path: "/client/v1/companion/wallet/result", method: "GET", body: undefined },
      { path: "/client/v1/companion/order/stat", method: "GET", body: undefined },
    ],
  );
  assert.ok(calls.every((call) => call.token === token));
});

test("writes send exact SKU, game and media fields with no invented action wrapper", async () => {
  const { api, calls } = setup(null);
  await api.updateService(context, token, 71, false);
  await api.updateIntro(context, token, "真实简介");
  await api.updateVoice(context, token, "https://cdn.example/voice.m4a", 12);
  await api.addImage(context, token, "https://cdn.example/image.jpg");
  await api.deleteImage(token, 81);
  assert.deepEqual(
    calls.map(({ path, body }) => ({ path, body })),
    [
      {
        path: "/client/v1/companion/game/updateServiceStatus",
        body: { clubId: 100, gameId: 8, companionServiceId: 71, enabled: false },
      },
      {
        path: "/client/v1/companion/game/updateSkillIntro",
        body: { clubId: 100, gameId: 8, skillIntro: "真实简介" },
      },
      {
        path: "/client/v1/companion/game/updateVoice",
        body: {
          clubId: 100,
          gameId: 8,
          voiceUrl: "https://cdn.example/voice.m4a",
          voiceDurationSeconds: 12,
        },
      },
      {
        path: "/client/v1/companion/game/addImage",
        body: { clubId: 100, gameId: 8, imageUrl: "https://cdn.example/image.jpg" },
      },
      { path: "/client/v1/companion/game/deleteImage", body: { imageId: 81 } },
    ],
  );
});

test("server failures and missing financial data are errors, never fake zero balances", async () => {
  const failing = createCompanionManagementApi(async () => ({
    code: "DENIED",
    info: "没有权限",
  }));
  await assert.rejects(failing.wallet(token), /没有权限/);
  await assert.rejects(failing.updateService(context, token, 71, true), /没有权限/);
  const { api, calls } = setup(null);
  await assert.rejects(api.wallet(token), /未返回数据/);
  await assert.rejects(api.orderStat(""), /请先登录/);
  assert.equal(calls.length, 1);
  await assert.rejects(api.games({ ...context, clubId: "" }, token), /信息不完整/);
  assert.equal(formatManagementNumber(undefined), "--");
  assert.equal(formatManagementNumber("not-a-number"), "--");
  assert.equal(formatManagementNumber(0, 2), "0.00");
  assert.equal(formatManagementNumber("58.25", 2), "58.25");
});

test("ledger uses backend transaction filters and handles all pagination end conditions", async () => {
  const { api, calls } = setup({ records: [] });
  await api.walletPage(token, 2, "ORDER_INCOME");
  await api.walletPage(token, 1);
  assert.deepEqual(calls[0].body, {
    page: 2,
    pageSize: 20,
    action: { transactionType: "ORDER_INCOME" },
  });
  assert.deepEqual(calls[1].body, { page: 1, pageSize: 20, action: {} });
  const records = Array.from({ length: 20 }, (_, id) => ({ id }));
  assert.equal(walletNextPage({ records, total: 21 }, 1), 2);
  assert.equal(walletNextPage({ records: [{ id: 21 }], total: 21 }, 2), undefined);
  assert.equal(walletNextPage({ records, pages: 1 }, 1), undefined);
  assert.equal(walletNextPage({ records }, 1), 2);
  assert.equal(walletNextPage({ records: [], total: 21 }, 2), undefined);
});

test("intro accepts 140 Unicode characters and rejects empty or over-limit text before sending", async () => {
  const { api, calls } = setup(true);
  for (const char of ["介", "😀"]) {
    await api.updateIntro(context, token, char.repeat(140));
    assert.equal(calls.at(-1).body.skillIntro, char.repeat(140));
    const count = calls.length;
    await assert.rejects(api.updateIntro(context, token, char.repeat(141)), /最多140字/);
    assert.equal(calls.length, count);
  }
  await assert.rejects(api.updateIntro(context, token, "   "), /请输入/);
});

test("intro preserves server edit-frequency rejection instead of reporting a successful save", async () => {
  const api = createCompanionManagementApi(async () => ({
    code: "FAIL", info: "7天内最多修改3次简介",
  }));
  await assert.rejects(api.updateIntro(context, token, "新简介"), /7天内最多修改3次简介/);
});
