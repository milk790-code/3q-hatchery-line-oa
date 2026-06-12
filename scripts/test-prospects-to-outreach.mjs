// 橋接驗證:PROSPECTS.md(正本)→ outreach 匯入格式(零依賴;改橋接或改名單格式前必跑)
// 用法:node scripts/test-prospects-to-outreach.mjs
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseProspects } from './prospects-to-outreach.mjs';

let passed = 0, failed = 0;
function ok(cond, name, extra) { if (cond) { passed++; console.log('  ✅', name); } else { failed++; console.error('  ❌', name, extra ?? ''); } }

const md = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'PROSPECTS.md'), 'utf8');
const leads = parseProspects(md);
const by = (p) => leads.filter((l) => l.pool === p);
const find = (src) => leads.find((l) => l.src === src);

// ① 母數:107 家(A72/B20/C15),src 唯一
ok(leads.length === 107, '① 共 107 家', leads.length);
ok(by('A').length === 72 && by('B').length === 20 && by('C').length === 15, '① A72/B20/C15', `${by('A').length}/${by('B').length}/${by('C').length}`);
ok(new Set(leads.map((l) => l.src)).size === leads.length, '① src 無重複');

// ② A 池映射:store_type/biz/area
const dawn = find('A#27');
ok(dawn && dawn.name.includes('DAWN'), '② A#27 = DAWN', dawn?.name);
ok(dawn.ig === 'dawn_car_wash', '② A#27 抓到 IG handle', dawn.ig);
ok(dawn.store_type === '汽車美容' && dawn.biz === 'car' && dawn.area === '台中', '② A 池 store_type/biz/area');

// ③ founded_year 只抓明寫年份:#68 時圓 2013 創立;B#1 ORA 2026 新開幕;沒寫的留空
ok(find('A#68').founded_year === 2013, '③ A#68 2013 創立', find('A#68').founded_year);
ok(find('B#1').founded_year === 2026, '③ B#1 2026 新開幕', find('B#1').founded_year);
ok(find('A#1').founded_year === undefined, '③ 沒明寫年份不編造', find('A#1').founded_year);

// ④ biz 關鍵字:B 池咖啡店=food;B#1 ORA Studio 無餐飲字=other(不猜)
ok(find('B#2').biz === 'food', '④ B#2 Peakless(自烘咖啡)= food', find('B#2').biz);
ok(find('B#1').biz === 'other', '④ B#1 ORA Studio 不猜 = other', find('B#1').biz);
ok(find('C#1').biz === 'food', '④ C#1 魚刺人雞蛋糕 = food', find('C#1').biz);
ok(find('C#2').biz === 'other', '④ C#2 Kou Jewellery(手作飾品)= other', find('C#2').biz);

// ⑤ note 帶來源編號+信心+門面+切角(預熱情報)
ok(find('A#1').note.startsWith('[A#1|★3]') && find('A#1').note.includes('|'), '⑤ note 格式 [池#編號|★信心] 門面|切角', find('A#1').note.slice(0, 30));
ok(leads.every((l) => l.note.length <= 200), '⑤ note ≤200 字(worker 截斷上限)');

// ⑥ 全 107 家欄位健全:有 src/name/pool/batch/area/biz
ok(leads.every((l) => l.src && l.name && ['A', 'B', 'C'].includes(l.pool) && l.batch >= 1 && l.area && l.biz), '⑥ 全數欄位健全');
ok(leads.every((l) => l.area === '台中'), '⑥ 本批名單全為台中(local_sbir 可用)');

console.log(`\n${failed === 0 ? '🟢' : '🔴'} ${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
