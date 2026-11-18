// node neko/tools/test.js 300 … index.html のパズル生成を取り出して、答えが1つか・ルールどおりかを確かめる
const fs=require('fs'),path=require('path');
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const src=html.slice(html.indexOf('// ===== GEN START'),html.indexOf('// ===== GEN END'));
const g=new Function(src+';return {generatePuzzle,sizeForLevel,difficultyT,logicSolve,countSolutions};')();
const n=+process.argv[2]||200; let bad=0,worst=0;
for(let lv=1;lv<=n;lv++){
  const N=g.sizeForLevel(lv),t0=Date.now(),p=g.generatePuzzle('nekobakudan-v1-level-'+lv,N,g.difficultyT(lv)),dt=Date.now()-t0; worst=Math.max(worst,dt);
  if(g.countSolutions(N,p.reg,3)!==1||!g.logicSolve(N,p.reg,[]).solved){bad++;console.log('NG',lv);}
  const rs=new Set(p.sol.map(i=>i/N|0)),cs=new Set(p.sol.map(i=>i%N)),gs=new Set(p.sol.map(i=>p.reg[i]));
  if(rs.size!==N||cs.size!==N||gs.size!==N){bad++;console.log('NG rule',lv);}
}
console.log(`${n}レベル確認：NG ${bad}件、いちばん遅い生成 ${worst}ms`);
