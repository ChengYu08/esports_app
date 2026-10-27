import assert from "node:assert/strict";
import test from "node:test";
import {
  createProfileContract,
  getProfileRouteParams,
  getFirstProfileGameId,
} from "./profile.contract.ts";

test("loads companion profile detail and maps supported games", async () => {
  const requests = [];
  const api = createProfileContract(async (path, options) => {
    requests.push({ path, options });
    return {
      success: true,
      code: "SUCCESS",
      info: "操作成功",
      data: {
        userId: 50100028,
        nickname: "函数_打手1号",
        signature: "特别猛",
        headImage: "avatar.jpg",
        sex: 2,
        companion: true,
        birth: "1999-10-20",
        followCount: 3,
        fansCount: 9,
        profileId: 16,
        clubId: 1000003,
        clubName: "三角函数俱乐部",
        logoUrl: "club.png",
        orderNoticeUrl: "notice.html",
        orderCount: 5,
        onlineStatus: 1,
        gameStatus: 0,
        games: [
          { companionGameId: 30, gameId: 11, gameName: "三角洲行动手游", iconUrl: "game.png", backgroundUrl: "bg.png" },
        ],
      },
    };
  });

  const result = await api.fetchProfileDetail({ clubId: "1000003", userId: "50100028" });

  assert.equal(result.nickname, "函数_打手1号");
  assert.equal(result.clubName, "三角函数俱乐部");
  assert.deepEqual(result.games, [{
    companionGameId: 30,
    gameId: 11,
    gameName: "三角洲行动手游",
    iconUrl: "game.png",
    backgroundUrl: "bg.png",
  }]);
  assert.deepEqual(requests, [{
    path: "/client/v1/companion/public/detail",
    options: { method: "POST", body: { userId: 50100028 } },
  }]);
});

test("loads selected game detail and maps images and service cards", async () => {
  const requests = [];
  const api = createProfileContract(async (path, options) => {
    requests.push({ path, options });
    return {
      success: true,
      code: "SUCCESS",
      data: {
        companionGameId: 30,
        userId: 50100028,
        clubId: 1000003,
        gameId: 11,
        gameName: "三角洲行动手游",
        iconUrl: "game.png",
        backgroundUrl: "bg.png",
        skillIntro: "秒接单",
        voiceUrl: "voice.m4a",
        voiceDurationSeconds: 6,
        images: [
          { id: 12, imageUrl: "work-b.jpg", sortNo: 2 },
          { id: 11, imageUrl: "work-a.jpg", sortNo: 1 },
        ],
        skillCards: [
          {
            companionServiceId: 69,
            gameId: "11",
            gameModeId: 20,
            modeName: "活动单",
            gameLevelId: 35,
            levelName: "活动单",
            clubGameServiceId: 24,
            price: 990,
            orderCount: 1,
          },
        ],
      },
    };
  });

  const result = await api.fetchProfileGameDetail({ clubId: "1000003", userId: "50100028", gameId: "11" });

  assert.equal(result.skillIntro, "秒接单");
  assert.deepEqual(result.images.map((item) => item.imageUrl), ["work-a.jpg", "work-b.jpg"]);
  assert.equal(result.skillCards[0].price, 990);
  assert.deepEqual(requests, [{
    path: "/client/v1/companion/public/game/detail",
    options: { method: "POST", body: { clubId: 1000003, userId: 50100028, gameId: 11 } },
  }]);
});

test("loads reviews for the selected companion game", async () => {
  const requests = [];
  const api = createProfileContract(async (path, options) => {
    requests.push({ path, options });
    return {
      success: true,
      code: "SUCCESS",
      data: {
        page: 1,
        totalPages: 1,
        total: 1,
        records: [
          {
            id: 4,
            orderNo: "DJ20260929153050019840",
            buyerNickname: "直接猛攻- -",
            buyerAvatar: "avatar.jpg",
            anonymous: false,
            rating: 5,
            content: "少啊等阿萨德阿萨德按时大打算",
            imageUrls: ["review-a.png", "review-b.png"],
            evaluatedTime: "2026-09-29T15:45:27",
          },
        ],
      },
    };
  });

  const result = await api.fetchProfileReviews({ gameId: "11", companionUserId: "50100028" });

  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].buyerNickname, "直接猛攻- -");
  assert.deepEqual(result.items[0].imageUrls, ["review-a.png", "review-b.png"]);
  assert.equal(result.hasMore, false);
  assert.deepEqual(requests, [{
    path: "/client/v1/afterSale/public/review/page",
    options: {
      method: "POST",
      body: { page: 1, pageSize: 20, action: { gameId: 11, companionUserId: 50100028 } },
    },
  }]);
});

test("derives route prerequisites before enabling profile requests", () => {
  assert.deepEqual(getProfileRouteParams({ clubId: "1000003", userId: "50100028" }), {
    clubId: "1000003",
    userId: "50100028",
  });
  assert.equal(getProfileRouteParams({ clubId: "1000003" }), null);
  assert.deepEqual(getProfileRouteParams({ userId: "50100028" }), { userId: "50100028" });
  assert.equal(getProfileRouteParams({ clubId: ["1000003"], userId: ["50100028"] }), null);
});

test("loads a regular user's own homepage without a club or explicit route ID", async () => {
  const params = getProfileRouteParams({}, "50100029");
  assert.deepEqual(params, { userId: "50100029" });
  const requests = [];
  const api = createProfileContract(async (path, options) => {
    requests.push({ path, options });
    return {
      code: "SUCCESS",
      data: { userId: 50100029, nickname: "普通用户", followCount: 7, fansCount: 3 },
    };
  });

  const profile = await api.fetchProfileDetail(params);

  assert.equal(profile.userId, 50100029);
  assert.equal(profile.followCount, 7);
  assert.equal(profile.fansCount, 3);
  assert.equal(profile.clubId, 0);
  assert.deepEqual(profile.games, []);
  assert.deepEqual(requests, [{
    path: "/client/v1/companion/public/detail",
    options: { method: "POST", body: { userId: 50100029 } },
  }]);
});

test("keeps the viewed user's ID ahead of the current user and requires login for a route-less homepage", () => {
  assert.deepEqual(getProfileRouteParams({ userId: "50100030" }, "50100029"), { userId: "50100030" });
  assert.equal(getProfileRouteParams({}), null);
  assert.equal(getProfileRouteParams({ userId: ["50100030"] }, "50100029"), null);
});

test("selects the first supported game for initial profile content", () => {
  assert.equal(getFirstProfileGameId([{ gameId: 11, gameName: "三角洲行动手游", companionGameId: 30 }]), "11");
  assert.equal(getFirstProfileGameId([]), "");
});
