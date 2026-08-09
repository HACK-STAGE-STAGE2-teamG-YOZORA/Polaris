import assert from "node:assert/strict";

import {
  CACHE_KEYS,
  clearCache,
  invalidateAnalysisSessionCaches,
  invalidateCompanyCaches,
  invalidateEsCaches,
  invalidateExperienceCaches,
  readCache,
  setCacheOwner,
  writeCache,
} from "../src/lib/api/cache.ts";

// 全キーへ値を入れる。無効化の対象・非対象を1回で確認するために使う
function fillAll(): void {
  writeCache(CACHE_KEYS.dashboard, "dashboard");
  writeCache(CACHE_KEYS.analysisSessions, "sessions");
  writeCache(CACHE_KEYS.experiences("ALL"), "experiences-all");
  writeCache(CACHE_KEYS.experiences("CONFIRMED"), "experiences-confirmed");
  writeCache(CACHE_KEYS.esRevisionContext(null), "es-hub");
  writeCache(CACHE_KEYS.esRevisionContext("doc-1"), "es-doc-1");
}

// 所有者が未確定のあいだは保存しない（誰のデータか分からない値を再利用させない）
clearCache();
writeCache(CACHE_KEYS.dashboard, "leaked");
assert.equal(readCache(CACHE_KEYS.dashboard), null, "所有者未確定のうちはキャッシュしないこと");

setCacheOwner("user-1");
writeCache(CACHE_KEYS.dashboard, "user-1-dashboard");
assert.equal(readCache(CACHE_KEYS.dashboard), "user-1-dashboard");

// 同じユーザーの再確認では保持したままにする（タブ移動のたびに捨てない）
setCacheOwner("user-1");
assert.equal(readCache(CACHE_KEYS.dashboard), "user-1-dashboard", "同一ユーザーではキャッシュを保持すること");

// 別ユーザーへ切り替わったら前のユーザーのデータを残さない
setCacheOwner("user-2");
assert.equal(readCache(CACHE_KEYS.dashboard), null, "ユーザーが変わったらキャッシュを捨てること");

// ログアウト・401では全消去し、所有者も未確定へ戻す
setCacheOwner("user-2");
fillAll();
clearCache();
assert.equal(readCache(CACHE_KEYS.dashboard), null, "ログアウト時に全消去すること");
writeCache(CACHE_KEYS.dashboard, "after-logout");
assert.equal(readCache(CACHE_KEYS.dashboard), null, "消去後は所有者が未確定へ戻ること");

// 経験の作成・更新・削除: カード一覧・ESの根拠候補・ホームを作り直す
setCacheOwner("user-3");
fillAll();
invalidateExperienceCaches();
assert.equal(readCache(CACHE_KEYS.experiences("ALL")), null);
assert.equal(readCache(CACHE_KEYS.experiences("CONFIRMED")), null);
assert.equal(readCache(CACHE_KEYS.esRevisionContext(null)), null);
assert.equal(readCache(CACHE_KEYS.esRevisionContext("doc-1")), null);
assert.equal(readCache(CACHE_KEYS.dashboard), null);
assert.equal(readCache(CACHE_KEYS.analysisSessions), "sessions", "経験の変更でセッション一覧まで捨てないこと");

// 企業の作成・更新・企業情報の取り込み: ES画面の企業一覧だけを作り直す
fillAll();
invalidateCompanyCaches();
assert.equal(readCache(CACHE_KEYS.esRevisionContext(null)), null);
assert.equal(readCache(CACHE_KEYS.esRevisionContext("doc-1")), null);
assert.equal(readCache(CACHE_KEYS.experiences("ALL")), "experiences-all", "企業の変更で経験一覧まで捨てないこと");
assert.equal(readCache(CACHE_KEYS.dashboard), "dashboard", "企業の変更でホームまで捨てないこと");

// ES文書の作成・更新・検査・推敲: ES画面とホームの保存済みES要約を作り直す
fillAll();
invalidateEsCaches();
assert.equal(readCache(CACHE_KEYS.esRevisionContext(null)), null);
assert.equal(readCache(CACHE_KEYS.esRevisionContext("doc-1")), null);
assert.equal(readCache(CACHE_KEYS.dashboard), null);
assert.equal(readCache(CACHE_KEYS.experiences("ALL")), "experiences-all", "ESの変更で経験一覧まで捨てないこと");

// チャットの開始・送信・4軸評価・確定: セッション一覧・カード一覧・ホームを作り直す
fillAll();
invalidateAnalysisSessionCaches();
assert.equal(readCache(CACHE_KEYS.analysisSessions), null);
assert.equal(readCache(CACHE_KEYS.experiences("ALL")), null);
assert.equal(readCache(CACHE_KEYS.dashboard), null);
assert.equal(readCache(CACHE_KEYS.esRevisionContext("doc-1")), "es-doc-1", "チャットの変更でES画面まで捨てないこと");

clearCache();

console.log("Tab navigation cache contracts: OK");
