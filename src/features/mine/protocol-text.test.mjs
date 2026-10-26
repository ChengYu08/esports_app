import assert from "node:assert/strict";
import test from "node:test";
import { protocolHtmlToText } from "./protocol-text.ts";

test("keeps agreement paragraphs, list text and encoded punctuation readable", () => {
  assert.equal(
    protocolHtmlToText('<h2>陪玩师协议</h2><p>甲方&nbsp;&amp;&nbsp;乙方<br>须知&#xff1a;</p><ul><li>第一项</li><li>&lt;约定&gt;</li></ul>'),
    "陪玩师协议\n\n甲方 & 乙方\n须知：\n\n• 第一项\n\n• <约定>",
  );
});

test("omits script, style and comments without crashing on invalid character codes", () => {
  assert.equal(protocolHtmlToText('<style>body{color:red}</style><!--注释--><script>alert(1)</script><p>正文&#99999999;&#xD800;</p>'), "正文");
  assert.equal(protocolHtmlToText("<p>&nbsp;</p>"), "");
});
