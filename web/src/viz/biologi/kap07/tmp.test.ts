import { it } from 'vitest';
import { solveTissue, tissueAt, healedTime } from './model';
it('explore', () => {
  for (const m of [{onkogen:false,tsg:false},{onkogen:true,tsg:false},{onkogen:false,tsg:true},{onkogen:true,tsg:true}]) {
    for (const damage of [false, true]) {
      const r = solveTissue({ ...m, wound: 0.5, damage });
      const row = [0,5,10,15,20,25,30].map(t => tissueAt(r,t)).map(v => `${(v.total*100).toFixed(0)}(${(v.mutant*100).toFixed(1)})`).join(' ');
      console.log(JSON.stringify(m), damage, healedTime(r)?.toFixed(1), row);
    }
  }
});
