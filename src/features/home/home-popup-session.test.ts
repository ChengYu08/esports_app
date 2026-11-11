import { beforeEach, describe, expect, it } from "vitest";

import {
  hasHomePopupShownThisSession,
  markHomePopupShownThisSession,
  resetHomePopupShownThisSessionForTests,
} from "./home-popup-session";

describe("home-popup-session", () => {
  beforeEach(() => {
    resetHomePopupShownThisSessionForTests();
  });

  it("默认未展示", () => {
    expect(hasHomePopupShownThisSession()).toBe(false);
  });

  it("标记后本进程视为已展示", () => {
    markHomePopupShownThisSession();
    expect(hasHomePopupShownThisSession()).toBe(true);
  });
});
