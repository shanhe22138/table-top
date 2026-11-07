/**
 * 第五轮 26 条需求的验收脚本。
 * 跑之前先起 dev server：npm run dev -- --port 5178
 */
import { chromium } from 'playwright-core'

const BASE = process.env.BASE ?? 'http://127.0.0.1:5178'
const browser = await chromium.launch({ channel: 'msedge' })
const results = []
const check = (n, ok, extra = '') =>
  results.push(`${ok ? 'PASS' : 'FAIL'}  ${n}${extra ? ' :: ' + extra : ''}`)

const errors = []
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
const page = await ctx.newPage()
page.on('pageerror', (e) => errors.push('PAGEERROR ' + e.message))
page.on('console', (m) => {
  const t = m.text()
  if (m.type() === 'error' && !/404|502/.test(t)) errors.push(t)
})

const body = () => page.locator('body').innerText()

async function go(hash, wait = 700) {
  await page.goto(`${BASE}/${hash}`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(wait)
}

async function login() {
  await go('/#/login')
  await page.getByText('点这里填入示例账号').click()
  await page.locator('form').getByRole('button', { name: '登录' }).click()
  await page.waitForTimeout(900)
}

await login()

/* ───────── 1. 仓库：类型 tab 只保留三项 ───────── */
await go('/#/library')
const tabRow = page.locator('div.no-scrollbar.mb-3').first()
const tabs = (await tabRow.locator('button').allInnerTexts()).map((s) => s.trim())
check('类型 tab 只有 全部/剧本杀/桌游', tabs.length === 3 && tabs.join() === '全部,剧本杀,桌游', tabs.join(' / '))

/* ───────── 2. 榜单：三列并列 + 热度数字 ───────── */
let text = await body()
check('榜单有社交推理列', text.includes('社交推理'))
check('榜单展示热度数字', /热度/.test(text) || /\b\d{1,3}\b/.test(text))
check('榜单标题含 Top', /Top\s?\d/.test(text))
// 三列在同一行：桌游 / 剧本杀 / 社交推理 的标题 y 坐标接近
const colTops = await page.evaluate(() => {
  const out = []
  for (const kw of ['桌游', '剧本杀', '社交推理']) {
    const els = Array.from(document.querySelectorAll('h2,h3,div'))
    const hit = els.find((e) => e.textContent?.trim().startsWith(kw) && e.children.length <= 2)
    if (hit) out.push(Math.round(hit.getBoundingClientRect().top))
  }
  return out
})
check(
  '三列并列排布',
  colTops.length === 3 && Math.max(...colTops) - Math.min(...colTops) < 40,
  colTops.join(','),
)

/* ───────── 3. 桌游标签不含儿童/家庭 ───────── */
await go('/#/library?kind=board')
text = await body()
check('桌游没有「儿童」标签', !text.includes('儿童'))
check('桌游没有「家庭」标签', !text.includes('家庭'))

/* ───────── 4. 剧本名统一书名号 ───────── */
await go('/#/library?kind=script')
text = await body()
check('剧本列表出现书名号', text.includes('《'))

/* ───────── 5. 个人页统计口径 ───────── */
await go('/#/me')
text = await body()
check('统计为玩过的桌游/剧本/其他', text.includes('玩过的桌游') && text.includes('玩过的剧本') && text.includes('玩过的其他'))
check('去掉了常玩人数', !text.includes('常玩人数'))
check('去掉「带了几年」', !text.includes('带了几年'))
check('不再统计展柜数量', !/展柜\s*\d+/.test(text))
check('有他人视角入口', (await page.locator('a[href^="#/u/"]').count()) > 0)

/* ───────── 6. 设置页：隐私标题 ───────── */
await go('/#/me?tab=settings')
text = await body()
check('隐私标题改为「别人能看到我哪些信息」', text.includes('别人能看到我哪些信息'))
check('没有「谁能看到我的信息」', !text.includes('谁能看到我的信息'))

/* ───────── 6b. 偏好页：不限按钮 / 双滑块 + 手填 ───────── */
await go('/#/me?tab=prefs')
text = await body()
check('有「喜欢的角色」配置块', text.includes('喜欢的角色'))
check('「爱演」已改为「喜欢」', !text.includes('爱演'))
const unlimitedBtn = page.getByRole('button', { name: /设为不限|当前不限/ })
check('「不限」是可点按钮', (await unlimitedBtn.count()) > 0)

const dual = page.locator('input.dual-range')
check('舒适时长是双滑块', (await dual.count()) === 2, `${await dual.count()} 个`)
const bubbles = await page.evaluate(() => {
  const el = document.querySelector('input.dual-range')
  const box = el?.parentElement
  if (!box) return []
  return Array.from(box.querySelectorAll(':scope > span'))
    .map((s) => s.textContent?.trim() ?? '')
    .filter(Boolean)
})
check('两个手柄各有一个数值气泡', bubbles.length === 2, bubbles.join(' | '))

const loInput = page.locator('input[type=number][aria-label="时长下限"]')
const hiInput = page.locator('input[type=number][aria-label="时长上限"]')
check('舒适时长可以手填数字', (await loInput.count()) === 1 && (await hiInput.count()) === 1)
await loInput.fill('2')
await loInput.press('Enter')
await page.waitForTimeout(350)
const loRangeVal = await page.locator('input.dual-range').first().inputValue()
check('手填下限后滑块同步', loRangeVal === '120', `滑块=${loRangeVal}`)

/* ───────── 7. 发车页：预计时长单滑块 + 手填双向 ───────── */
await go('/#/create?game=s01')
const single = page.locator('input.single-range')
check('预计时长只有一个滑块', (await single.count()) === 1)
await page.locator('input[type=number][aria-label="时长"]').fill('2.5')
await page.locator('input[type=number][aria-label="时长"]').press('Enter')
await page.waitForTimeout(350)
check('填 2.5 小时后滑块到 150', (await single.inputValue()) === '150', await single.inputValue())
await single.fill('90')
await page.waitForTimeout(300)
check('拖滑块后输入框变 1.5', (await page.locator('input[type=number][aria-label="时长"]').inputValue()) === '1.5')

/* ───────── 8. 详情页：主持人/玩家可点进资料页 ───────── */
await go('/#/calendar')
const firstEvent = await page.locator('a[href^="#/event/"]').first().getAttribute('href')
await go(`/${firstEvent}`)
const hostLink = await page.locator('a[href^="#/u/"]').count()
check('活动详情有主持人资料页链接', hostLink > 0, `${hostLink} 个用户链接`)
text = await body()
check('活动详情剧本名带书名号', text.includes('《'))
// 点主持人进资料页
await page.locator('a[href^="#/u/"]').first().click()
await page.waitForTimeout(700)
check('点击后进入资料页', page.url().includes('#/u/'), page.url())
text = await body()
check('资料页展示昵称与统计', text.includes('@') && (text.includes('玩过的桌游') || text.includes('展柜')))

/* ───────── 9. 条目详情：标题带书名号 ───────── */
await go('/#/game/s01')
text = await body()
check('剧本详情标题带书名号', (await page.locator('h1').first().innerText()).includes('《'))

/* ───────── 10. 后台：条目编辑入口 ───────── */
await go('/#/admin?tab=manage')
const editBtns = page.locator('button[aria-label^="编辑"]')
check('条目管理有编辑按钮', (await editBtns.count()) > 0, `${await editBtns.count()} 个`)
await editBtns.first().click()
await page.waitForTimeout(400)
text = await body()
check('点编辑打开编辑表单', text.includes('保存') && text.includes('封面'))

/* ───────── 11. 榜单面板：整框选月份 + 整月导入 ───────── */
await go('/#/admin?tab=chart')
const monthBtn = page.locator('button[aria-label="选择月份"]')
check('期号是整框可点', (await monthBtn.count()) === 1)
await monthBtn.click()
await page.waitForTimeout(400)
const monthCells = await page.locator('div.grid.grid-cols-4 > button').count()
check('点开弹出 12 个月格', monthCells === 12, `${monthCells} 个`)
check('弹层里没有右侧日历按钮', (await page.locator('button[aria-label="选择月份"] >> nth=0').count()) === 1)
await page.keyboard.press('Escape')
await page.waitForTimeout(300)

await page.locator('textarea').first().fill(
  '# 桌游\n盖亚计划 | 88 | 稳定在榜\n阿瓦隆 | 70\n\n# 剧本杀\n年轮 | 92\n\n# 社交推理\n血染钟楼 80',
)
await page.waitForTimeout(400)
text = await body()
check('一次导入整月数据', /解析到 桌游 2 条/.test(text), text.match(/解析到[^\n]*/)?.[0] ?? '')
check('社交推理热度可填数字', (await page.locator('input[type=number]').count()) >= 3)

/* ───────── 12. 操作日志按权限筛选 ───────── */
await go('/#/admin?tab=logs')
text = await body()
check('日志有权限筛选', text.includes('普通操作') && text.includes('需要权限'))
const rowSel = 'div.space-y-1 > div'
const allRows = await page.locator(rowSel).count()
await page.getByRole('button', { name: /^需要权限/ }).click()
await page.waitForTimeout(400)
const adminRows = await page.locator(rowSel).count()
check('筛选后条数变少', adminRows > 0 && adminRows < allRows, `${allRows} → ${adminRows}`)
await page.getByRole('button', { name: /^普通操作/ }).click()
await page.waitForTimeout(400)
const userRows = await page.locator(rowSel).count()
check('普通操作与需要权限互斥', userRows > 0 && userRows !== adminRows, `${adminRows} / ${userRows}`)

/* ───────── 13. 封面上传：端侧压缩 + 拉伸开关 ───────── */
await go('/#/admin?tab=new')
const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFklEQVQIW2P8z8Dwn4EIwDiqEF0hAG3wBQGvzG7iAAAAAElFTkSuQmCC',
  'base64',
)
await page.locator('input[type=file]').first().setInputFiles({ name: 'a.png', mimeType: 'image/png', buffer: png })
await page.waitForTimeout(900)
text = await body()
check('上传后提示会压缩', /压到\s?\d+×\d+/.test(text))
check('出现「拉伸铺满」开关', text.includes('拉伸铺满'))
await page.getByRole('button', { name: '拉伸铺满' }).click()
await page.waitForTimeout(400)
check('开关可切换为已拉伸', (await body()).includes('已拉伸铺满'))

/* ───────── 14. 日历：窄屏列表 / 卡片视图 / 隐藏空日 / 鼠标拖拽 ───────── */
const narrow = await ctx.newPage()
await narrow.setViewportSize({ width: 390, height: 780 })
await narrow.goto(`${BASE}/#/calendar`, { waitUntil: 'networkidle' })
await narrow.waitForTimeout(800)
const narrowText = await narrow.locator('body').innerText()
check('窄屏默认列表视图', narrowText.includes('列表') && narrowText.includes('卡片'))
await narrow.getByRole('button', { name: '卡片' }).click()
await narrow.waitForTimeout(600)
const cardLinks = await narrow.locator('a[href^="#/event/"]').count()
check('可切到卡片视图', cardLinks > 0, `${cardLinks} 张卡片`)
await narrow.getByRole('button', { name: '周' }).click()
await narrow.waitForTimeout(600)
check('周视图有「只看有车的日子」', (await narrow.locator('body').innerText()).includes('只看有车的日子'))
await narrow.getByText('只看有车的日子').click()
await narrow.waitForTimeout(500)
check('隐藏空日后仍能渲染', (await narrow.locator('body').innerText()).length > 50)
await narrow.close()

await go('/#/calendar')
const labelBefore = await page.locator('button[aria-label="下个月"]').locator('xpath=..').innerText()
const grid = page.locator('[data-swipe="month"]')
const box = await grid.boundingBox()
await page.mouse.move(box.x + box.width * 0.75, box.y + box.height * 0.5)
await page.mouse.down()
await page.mouse.move(box.x + box.width * 0.25, box.y + box.height * 0.5, { steps: 10 })
await page.mouse.up()
await page.waitForTimeout(700)
const labelAfter = await page.locator('button[aria-label="下个月"]').locator('xpath=..').innerText()
check('鼠标拖动可以切月', labelBefore !== labelAfter, `${labelBefore.replace(/\s+/g, '')} → ${labelAfter.replace(/\s+/g, '')}`)

/* ───────── 15. 展柜卡片可编辑内容 ───────── */
await go('/#/me?tab=showcase')
await page.getByRole('button', { name: /^编辑$/ }).first().click()
await page.waitForTimeout(400)
const editCard = page.locator('button[aria-label^="编辑「"]').first()
check('编辑态卡片可点开', (await editCard.count()) > 0)
await editCard.click()
await page.waitForTimeout(500)
text = await body()
check('打开「修改展柜内容」', text.includes('修改展柜内容'))
const nameInput = page.locator('div[role=dialog], .fixed').locator('input').first()
await nameInput.fill('改过的名字')
await page.getByRole('button', { name: '保存' }).click()
await page.waitForTimeout(600)
check('保存后卡片内容更新', (await body()).includes('改过的名字'))

check('没有运行时错误', errors.length === 0, errors.slice(0, 3).join(' | '))

console.log(results.join('\n'))
const fails = results.filter((r) => r.startsWith('FAIL'))
console.log(`\n${results.length - fails.length}/${results.length} PASS`)
await browser.close()
process.exit(fails.length ? 1 : 0)
