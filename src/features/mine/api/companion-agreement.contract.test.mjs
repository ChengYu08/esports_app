import assert from "node:assert/strict";
import test from "node:test";
import { createCompanionAgreementApi } from "./companion-agreement.contract.ts";

const protocol = { id: 17, code: "user_playmate", title: "陪玩师协议", version: "2", content: "<p>协议正文</p>" };

test("accepted accounts need no protocol; status uses authenticated Web endpoint", async () => {
  const api = createCompanionAgreementApi(async (path, options) => {
    assert.equal(path, "/client/v1/protocol/getAcceptanceStatus");
    assert.equal(options.token, "account-a");
    assert.equal(options.method, "POST");
    assert.deepEqual(options.body, { code: "user_playmate" });
    return { code: "SUCCESS", data: { accepted: true, protocol: null } };
  });
  assert.deepEqual(await api.status("account-a"), { accepted: true, protocol: null });
});

test("first confirmation persists exact protocol and is independent per account", async () => {
  const accepted = new Set();
  const api = createCompanionAgreementApi(async (path, options) => {
    if (path.endsWith("/accept")) {
      assert.deepEqual(options.body, { code: "user_playmate", agreementId: 17, version: "2" });
      accepted.add(options.token);
      return { code: "SUCCESS", data: true };
    }
    return { code: "SUCCESS", data: { accepted: accepted.has(options.token), protocol } };
  });
  const first = await api.status("account-a");
  assert.equal(first.accepted, false);
  assert.equal(first.protocol.content, "协议正文");
  assert.equal((await api.status("account-a")).accepted, false); // 仅进入协议页不算已同意
  await api.accept("account-a", first.protocol);
  assert.equal((await api.status("account-a")).accepted, true);
  assert.equal((await api.status("account-b")).accepted, false);
});

test("rejected confirmations and unavailable protocols never count as success", async () => {
  for (const response of [
    { code: "SUCCESS", data: false },
    { code: "FAIL", info: "协议已更新，请重新阅读后确认" },
  ]) {
    const api = createCompanionAgreementApi(async () => response);
    await assert.rejects(api.accept("account-a", protocol), /协议/);
  }
  const api = createCompanionAgreementApi(async () => ({ code: "SUCCESS", data: { accepted: false, protocol: null } }));
  await assert.rejects(api.status("account-a"), /暂未发布/);
  await assert.rejects(api.status(""), /登录/);
  await assert.rejects(api.accept("", protocol), /登录/);
});
