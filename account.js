// GAMES 共通アカウント（ユーザー名だけ）
// ほかのゲームは <script src="../account.js"></script> を読んで GAMES_ACC.name() を使うだけ。
// 中身は localStorage の 'games-account' に {name, key, shared} があるだけで、名前以外は何も持たない。
(function () {
  const KEY = 'games-account';
  function read() { try { return JSON.parse(localStorage.getItem(KEY) || 'null') || null; } catch (e) { return null; } }
  window.GAMES_ACC = {
    KEY,
    get: read,
    name() { const a = read(); return (a && a.name) || ''; },
    // 何も入っていない入力欄に名前を入れる
    fill(input) { if (input && !input.value) input.value = this.name(); },
  };
})();
