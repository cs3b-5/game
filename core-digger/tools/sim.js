const E = require('./econ.js');
const S = { money: 0, layer: 0, lv: { pick: 0, drone: 0, mod: 0, vein: 0 } };
const dt = 0.5; let t = 0; const log = [];
// 手で掘る：ブロック1個の時間＝硬さ/威力＋狙う手間0.7秒。ドローン：硬さ/威力＋移動1.2秒
function rate(s) {
  const L = E.LAYERS[s.layer], v = E.avgVal(s.layer, s.lv.vein);
  const hand = v / (L.hp / E.pickDps(s.lv.pick) + 0.7);
  const drone = s.lv.drone * v / (L.hp / E.droneDps(s.lv.mod) + 1.2);
  return hand + drone;
}
while (t < 3 * 3600 && S.layer < E.LAYERS.length - 1 || (S.layer === E.LAYERS.length - 1 && !S.done)) {
  S.money += rate(S) * dt; t += dt;
  if (S.layer === E.LAYERS.length - 1 && S.money >= E.DRILL[7]) { S.done = true; log.push(`コア制覇 ${(t / 60).toFixed(1)}分`); break; }
  for (let k = 0; k < 20; k++) {
    if (S.layer < E.DRILL.length && S.money >= E.DRILL[S.layer]) { S.money -= E.DRILL[S.layer]; S.layer++; log.push(`${E.LAYERS[S.layer].name} ${(t / 60).toFixed(1)}分`); continue; }
    let best = null, bs = Infinity; const r0 = rate(S);
    for (const key of Object.keys(E.UP)) {
      if (S.lv[key] >= E.UP[key].max) continue;
      const c = E.upCost(key, S.lv[key]); S.lv[key]++; const g = rate(S) - r0; S.lv[key]--;
      if (g > 0 && c / g < bs) { bs = c / g; best = { key, c }; }
    }
    // 次の層の値段まで貯める方が早いなら買わない
    if (best && S.money >= best.c && (S.layer >= E.DRILL.length || (E.DRILL[S.layer] - S.money + best.c) / (r0 + 1e-9) > best.c / (rate({ ...S, lv: { ...S.lv, [best.key]: S.lv[best.key] + 1 } }) - r0) )) { S.money -= best.c; S.lv[best.key]++; } else break;
  }
}
console.log(log.join(' / '));
console.log('最終', JSON.stringify(S.lv));
