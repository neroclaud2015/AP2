"""Publish saved browser acceptance artifacts only; no ingestion or PDF processing."""
from pathlib import Path
import json,shutil,html
root=Path(__file__).resolve().parents[1]
source=root/'docs/evidence/phase2c';target=root/'public/evidence/phase2c';target.mkdir(parents=True,exist_ok=True)
report=json.loads((source/'browser-acceptance.json').read_text())
preview=json.loads((source/'production-preview/browser-acceptance.json').read_text())
assert report['passed']==19 and all(report['checks'].values()) and not report['page_errors']
assert preview['passed']==18 and all(preview['checks'].values()) and not preview['page_errors']
for name in ['browser-acceptance.json','original-result.png','modultest-result.png','dashboard-mobile.png','timing-sources.json','arbeitsplanung-official-time.png','funktionsanalyse-official-time.png']:
 shutil.copy2(source/name,target/name)
shutil.copy2(source/'production-preview/browser-acceptance.json',target/'production-preview.json')
labels=['四个主入口与精简导航','自由学习先看解答再自评','原卷真实题序、空白开始、交卷前隐藏答案','作答与当前题刷新恢复','暂停与继续持久保存','自由学习与考试间前进后退','105 分钟到时提示，不自动交卷','未评 U 题保持待评分','官方图片来源与可修改自评','Kurztest 无重复、保留题型比例','取消重开时保留原会话','重开保留旧会话为已放弃','多标签页冲突拒绝覆盖','FA Standardtest 为 12+4 题','FA 原卷与 Dashboard 继续入口','慢存储下刷新提示保护输入','Kurztest 交卷与 U 题自评','Standardtest 交卷与官方来源','学习及 Review 数据隔离，手机无横向溢出']
rows=''.join('<li>✓ '+html.escape(label)+'</li>' for label in labels)
page=f"""<!doctype html><html lang="zh"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Phase 2C · 浏览器验收</title>
<style>body{{font:17px/1.7 system-ui,sans-serif;color:#193f35;background:#f4f7f1;margin:0}}main{{max-width:1020px;margin:auto;padding:32px 22px}}a{{color:#17594c}}h1{{font-size:32px}}section{{background:white;border:1px solid #d1ddc8;border-radius:14px;padding:24px;margin:24px 0}}li{{margin:8px 0}}img{{display:block;max-width:100%;height:auto;border:1px solid #dde4d8;margin:18px auto}}.mobile{{max-width:390px}}.links{{display:flex;gap:24px;flex-wrap:wrap}}small{{color:#536d60}}</style><main>
<a href="../../?view=start">← 正式网站 / Start</a><h1>Phase 2C · 浏览器验收证据</h1>
<p>范围仅限 Sommer 2017 Arbeitsplanung / Funktionsanalyse。使用真实题库和隔离浏览器测试档案；没有扫描 PDF，也没有处理 WiSo 或 Winter。</p>
<section><h2>验证结果</h2><p>19/19 浏览器检查通过，25 项单元测试、43 项 Python 数据回归通过。生产构建预览通过 18/18 项完整流程；慢存储离开保护另在开发环境注入延迟验证。</p><div class="links"><a href="browser-acceptance.json">19 项浏览器记录</a><a href="production-preview.json">生产预览记录</a><a href="https://github.com/neroclaud2015/AP2/blob/main/scripts/browser_phase2c.cjs">可重复执行的验收脚本</a></div><ul>{rows}</ul></section>
<section><h2>原卷交卷结果</h2><p>未答、答错、部分正确与待评分分开。结果按题计数，不冒充官方加权成绩。截图的超时由测试模拟。</p><a href="original-result.png">查看完整截图</a><img src="original-result.png" alt="原卷结果及官方来源"></section>
<section><h2>Modultest 交卷与自评</h2><p>Kurztest：6 道 MC + 2 道 U；Standardtest：12 + 4。只从现有 Sommer 2017 模块选题，使用可复现种子。</p><a href="modultest-result.png">查看完整截图</a><img src="modultest-result.png" alt="模块测试结果与 U 题官方解答"></section>
<section><h2>手机 Dashboard</h2><p>未完成会话优先显示 Fortsetzen；自由练习与考试记录独立保存。</p><img class="mobile" src="dashboard-mobile.png" alt="手机 Dashboard"></section>
<section><h2>官方时长来源</h2><p>原有缓存中两个模块的物理第 2 页均明确：Teil A + B 合计 105 分钟。没有重新读取或扫描 PDF。</p><a href="timing-sources.json">页码与来源哈希</a><h3>Arbeitsplanung</h3><img src="arbeitsplanung-official-time.png" alt="AP 官方 105 分钟"><h3>Funktionsanalyse</h3><img src="funktionsanalyse-official-time.png" alt="FA 官方 105 分钟"></section>
<small>WiSo / Winter 保持 Blocked。未建立 taxonomy、自适应计划或 AI 新题。</small></main></html>"""
(target/'index.html').write_text(page,encoding='utf8')
print(target)
