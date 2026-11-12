// CPU 同士で試合して、打率や点数がそれっぽいか見る：node tools/sim.mjs [試合数]
import { readFileSync } from 'fs';
const E = await import('data:text/javascript,' + encodeURIComponent(readFileSync(new URL('../engine.js', import.meta.url), 'utf8')));
const N = +process.argv[2] || 200, rng = E.rngOf(12345);
let st = { pa: 0, h: 0, hr: 0, k: 0, bb: 0, runs: 0, pitches: 0, games: 0, res: {} };
for (let g = 0; g < N; g++) {
  let S = E.newGame(E.TEAMS[g % 4].id, E.TEAMS[(g + 1) % 4].id, 9);
  while (!S.over) {
    const pit = E.curPitcher(S), { idx, team } = E.curBatter(S), bat = E.batterOf(team, idx);
    const c = E.cpuPitch(pit, S, rng), p = E.makePitch(pit, c.type, c.tx, c.ty, rng, 1, S, bat);
    const sw = E.cpuSwing(p, bat, S, rng, 1);
    const r = E.resolveSwing(p, bat, sw, rng, S);
    let ev = r;
    if (r.kind === 'inplay') {
      const ball = E.flight(r.v, r.la, r.sp);
      const ft = E.teamById(S.top ? S.home : S.away);
      const j = E.judge(ball, E.FIELDERS, E.defsOf(ft), bat, S, rng);
      ev = { kind: 'inplay', ...j };
      st.res[j.res] = (st.res[j.res] || 0) + 1;
    }
    S = E.applyEvent(S, ev); st.pitches++; if (S.last.relief) st.relief = (st.relief || 0) + 1;
    if (S.last.pa) { st.pa++; const m = S.last.msg; if (/ヒット|ベース|ホームラン|内野安打/.test(m)) st.h++; if (/ホームラン/.test(m)) st.hr++; if (/三振/.test(m)) st.k++; if (/フォア/.test(m)) st.bb++; }
  }
  st.runs += S.score[0] + S.score[1]; st.games++; st.err = (st.err || 0) + (S.err || 0); st.pcs = (st.pcs || 0) + S.pc[0] + S.pc[1];
}
console.log({ 打率: (st.h / (st.pa - st.bb)).toFixed(3), 一試合の点: (st.runs / N / 2).toFixed(2), 本塁打率: (st.hr / st.pa).toFixed(3), 三振率: (st.k / st.pa).toFixed(3), 四球率: (st.bb / st.pa).toFixed(3), 一打席の球数: (st.pitches / st.pa).toFixed(2), 継投した試合: ((st.relief || 0) / N / 2).toFixed(2), 一試合のエラー: ((st.err || 0) / N).toFixed(2) }, st.res);
