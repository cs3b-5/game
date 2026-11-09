// 経済コア（ゲームとシミュレーションで共通）
const LAYERS = [
  { name: '表土', hp: 3, val: 1 },
  { name: '岩盤', hp: 16.5, val: 10 },
  { name: '水晶洞', hp: 90.75, val: 100 },
  { name: '地底湖', hp: 499.1, val: 1000 },
  { name: 'マグマ層', hp: 2745, val: 1e+04 },
  { name: '古代遺跡', hp: 1.51e+04, val: 1e+05 },
  { name: 'マントル', hp: 8.304e+04, val: 1e+06 },
  { name: 'コア', hp: 4.567e+05, val: 1e+07 },
];
const DRILL = [150, 3.3e+03, 7.26e+04, 1.6e+06, 3.51e+07, 3.09e+08, 2.55e+09, 1.87e+10];  // 最後はコアを砕く値段   // 次の層へ降りる値段
const UP = {
  pick:  { base: 8,   r: 1.7,  max: 99 },   // つるはし：威力×1.5
  drone: { base: 30,  r: 1.27, max: 99 },   // ドローン＋1台
  mod:   { base: 300, r: 5,  max: 99 },   // ドローン改造：威力×2
  vein:  { base: 60,  r: 3.2,  max: 8 },    // 鉱脈探知：レア鉱石の出やすさ
};
const upCost = (k, lv) => UP[k].base * Math.pow(UP[k].r, lv);
const pickDps = lv => 2 * Math.pow(1.5, lv);
const droneDps = lv => 1 * Math.pow(2, lv);
const oreChance = lv => 0.12 + 0.06 * lv;          // 鉱石ブロックの割合
const ORE_MULT = 6;                                // 鉱石は普通の6倍（平均）
const avgVal = (layer, vein) => LAYERS[layer].val * (1 + oreChance(vein) * (ORE_MULT - 1));
if (typeof module !== 'undefined') module.exports = { LAYERS, DRILL, UP, upCost, pickDps, droneDps, oreChance, ORE_MULT, avgVal };
