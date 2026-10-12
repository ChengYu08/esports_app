import assert from "node:assert/strict";
import test from "node:test";
import { createRankingContract, getRankingParams, getRankingProfileParams } from "./ranking.contract.ts";
import { DEFAULT_RANKING_FILTERS, formatRankingMetric, getRankingRulesTitle } from "../ranking.config.ts";

const filters = { boardCode: "TURNOVER", rankType: "WEEKLY", gameId: "8" };

test("defaults match the PC board, period, and all-games filter", () => {
  assert.deepEqual(DEFAULT_RANKING_FILTERS, { boardCode: "ORDER_RECEIVE", rankType: "DAILY", gameId: "0" });
});

test("public ranking requests preserve filters and normalize decimal and ID strings", async () => {
  const api = createRankingContract(async (path, options) => {
    assert.equal(path, "/client/v1/rank/top?boardCode=TURNOVER&rankType=WEEKLY&gameId=8");
    assert.equal(options, undefined);
    return { code: "SUCCESS", data: [{ rankNo: 2, userId: 42, nickname: "小盼", avatar: "", clubId: 7, clubName: "盼之", metricValue: "12980.5", distanceToPrev: "0" }] };
  });
  const [row] = await api.fetchTop(filters);
  assert.equal(row.userId, "42");
  assert.equal(row.clubId, "7");
  assert.equal(row.metricValue, 12980.5);
  assert.equal(row.distanceToPrev, 0);
  assert.deepEqual(getRankingProfileParams(row), { userId: "42", clubId: "7" });
});

test("GOD resets the request game dimension without changing the selected game", async () => {
  const selected = { ...filters, boardCode: "GOD" };
  assert.equal(getRankingParams(selected).gameId, "0");
  assert.equal(selected.gameId, "8");
  const api = createRankingContract(async (path) => {
    assert.match(path, /boardCode=GOD&rankType=WEEKLY&gameId=0$/);
    return { code: "SUCCESS", data: [] };
  });
  assert.deepEqual(await api.fetchTop(selected), []);
});

test("first-place gap remains absent and missing clubs cannot open the viewer's own profile", async () => {
  const api = createRankingContract(async () => ({ code: "SUCCESS", data: [{ rankNo: 1, userId: "42", nickname: "", clubId: null, clubName: null, metricValue: 20, distanceToPrev: null }] }));
  const [row] = await api.fetchTop(filters);
  assert.equal(row.distanceToPrev, null);
  assert.equal(row.nickname, "未命名用户");
  assert.equal(getRankingProfileParams(row), null);
});

test("my rank uses the business token and respects backend visibility and unranked state", async () => {
  const api = createRankingContract(async (path, options) => {
    assert.equal(path, "/client/v1/rank/myRank?boardCode=TURNOVER&rankType=WEEKLY&gameId=8");
    assert.deepEqual(options, { token: "test-token" });
    return { code: "SUCCESS", data: { visible: true, rankNo: null, metricValue: "0" } };
  });
  assert.deepEqual(await api.fetchMyRank(filters, "test-token"), { visible: true, rankNo: null, metricValue: 0 });
  await assert.rejects(api.fetchMyRank(filters, ""), /请先登录/);
  const hidden = createRankingContract(async () => ({ code: "SUCCESS", data: { visible: false, rankNo: null, metricValue: 0 } }));
  assert.equal((await hidden.fetchMyRank(filters, "test-token")).visible, false);
});

test("successful empty data differs from business or transport failures", async () => {
  const empty = createRankingContract(async () => ({ code: "SUCCESS", data: null }));
  assert.deepEqual(await empty.fetchTop(filters), []);
  const failed = createRankingContract(async () => ({ code: "ERROR", info: "服务暂不可用" }));
  await assert.rejects(failed.fetchTop(filters), /服务暂不可用/);
  await assert.rejects(failed.fetchMyRank(filters, "test-token"), /服务暂不可用/);
  await assert.rejects(failed.fetchGames(), /服务暂不可用/);
  const network = createRankingContract(async () => { throw new Error("网络错误"); });
  await assert.rejects(network.fetchTop(filters), /网络错误/);
});

test("games reuse Home's normalized cache shape and contain only API-provided games", async () => {
  const api = createRankingContract(async (path) => {
    assert.equal(path, "/client/v1/game/public/games");
    return { code: "SUCCESS", data: [{ id: "8", gameName: "三角洲行动", iconUrl: "game.png" }] };
  });
  assert.deepEqual(await api.fetchGames(), [{ id: 8, name: "三角洲行动", iconUrl: "game.png", backgroundUrl: undefined, category: undefined }]);
});

test("display units and rules titles match PC for each board and period", () => {
  assert.equal(formatRankingMetric(1234, "ORDER_RECEIVE"), "1,234 单");
  assert.equal(formatRankingMetric(0, "ORDER_RECEIVE"), "0 单");
  assert.equal(formatRankingMetric(999, "GOD"), "999");
  assert.equal(formatRankingMetric(1000, "GOD"), "1K");
  assert.equal(formatRankingMetric(1250, "GOD"), "1.3K");
  assert.equal(formatRankingMetric(9999, "TURNOVER"), "9999");
  assert.equal(formatRankingMetric(10000, "TURNOVER"), "1万");
  assert.equal(formatRankingMetric(12500, "TURNOVER"), "1.3万");
  assert.equal(getRankingRulesTitle("ORDER_RECEIVE", "DAILY"), "接单榜（日榜）规则");
  assert.equal(getRankingRulesTitle("TURNOVER", "WEEKLY"), "流水榜（周榜）规则");
  assert.equal(getRankingRulesTitle("GOD", "WEEKLY"), "榜单说明");
});
