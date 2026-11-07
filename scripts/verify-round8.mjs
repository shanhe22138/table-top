import { chromium } from 'playwright-core'

const BASE = process.env.BASE ?? 'http://127.0.0.1:5178'
const browser = await chromium.launch({ channel: 'msedge' })
const results = []
const check = (n, ok, extra = '') =>
  results.push(`${ok ? 'PASS' : 'FAIL'}  ${n}${extra ? ' :: ' + extra : ''}`)
const errors = []
function newCtx(w, h) {
  return browser.newContext({ viewport: { width: w, height: h } })
}
async function login(page) {
  await page.goto(BASE + '/#/login', { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  await page.getByText('点这里填入示例账号').click()
  await page.locator('form').getByRole('button', { name: '登录' }).click()
  await page.waitForTimeout(800)
}

/* ───────── #30 窄屏 / 中屏导航栏 ───────── */
{
  const ctx = await newCtx(390, 844)
  const page = await ctx.newPage()
  page.on('pageerror', (e) => errors.push('PAGEERROR ' + e.message))
  await login(page)
  await page.goto(BASE + '/#/calendar', { waitUntil: 'networkidle' })
  await page.waitForTimeout(600)
  // 窄屏底部导航应可见，且含搜索 / 后台
  const bottomNav = page.locator('nav').filter({ hasText: /搜索|后台/ }).first()
  const bottomCount = await bottomNav.count()
  check('窄屏(390) 底部导航含 搜索/后台', bottomCount > 0,
    bottomCount ? (await bottomNav.innerText()).replace(/\n/g, ' ').slice(0, 40) : 'no nav')
  await ctx.close()
}
{
  const ctx = await newCtx(1024, 800)
  const page = await ctx.newPage()
  page.on('pageerror', (e) => errors.push('PAGEERROR ' + e.message))
  await login(page)
  await page.goto(BASE + '/#/calendar', { waitUntil: 'networkidle' })
  await page.waitForTimeout(600)
  const bottomNav = page.locator('nav').filter({ hasText: /搜索|后台/ }).first()
  const bottomCount = await bottomNav.count()
  check('中屏(1024) 底部导航仍在（顶栏+底栏并存，后台入口可见）', bottomCount > 0,
    bottomCount ? 'visible' : 'missing')
  await ctx.close()
}

/* ───────── #33 日历：拖动翻页 + 不选中文本 + 滑入动效 ───────── */
{
  const ctx = await newCtx(1280, 900)
  const page = await ctx.newPage()
  page.on('pageerror', (e) => errors.push('PAGEERROR ' + e.message))
  await login(page)
  await page.goto(BASE + '/#/calendar', { waitUntil: 'networkidle' })
  await page.waitForTimeout(700)
  const wrap = page.locator('[data-swipe="month"]')
  await wrap.waitFor({ state: 'visible' })
  const labelBefore = (await page.locator('span.min-w-\\[7\\.5rem\\]').innerText()).trim()
  // 清空可能存在的选区
  await page.evaluate(() => window.getSelection()?.removeAllRanges())
  const box = await wrap.boundingBox()
  const cy = box.y + box.height / 2
  const x1 = box.x + box.width * 0.35
  const x2 = box.x + box.width * 0.35 - 140 // 向左拖 > 80px → 上一月
  await page.mouse.move(x1, cy)
  await page.mouse.down()
  await page.mouse.move(x2, cy, { steps: 12 })
  await page.mouse.up()
  await page.waitForTimeout(500)
  const labelAfter = (await page.locator('span.min-w-\\[7\\.5rem\\]').innerText()).trim()
  check('日历拖动翻页（月份标签变化）', labelBefore !== labelAfter, `${labelBefore} → ${labelAfter}`)
  const sel = await page.evaluate(() => window.getSelection()?.toString() ?? '')
  check('日历拖动未选中文本（getSelection 为空）', sel.trim() === '', `selection="${sel}"`)
  // 动效类：翻页后内容容器应带 anim-slide-* 类（检查 keyed 容器存在动画类）
  const animOk = await page.evaluate(() => {
    const el = document.querySelector('[data-swipe="month"] > div')
    return !!el && /anim-slide-(next|prev)/.test(el.className)
  })
  check('日历翻页容器带滑入动效类', animOk)
  await ctx.close()
}

/* ───────── #23 仓库推荐栏鼠标拖动 ───────── */
{
  const ctx = await newCtx(1280, 900)
  const page = await ctx.newPage()
  page.on('pageerror', (e) => errors.push('PAGEERROR ' + e.message))
  await login(page)
  await page.goto(BASE + '/#/store', { waitUntil: 'networkidle' })
  await page.waitForTimeout(800)
  const row = page.locator('[data-drag="featured"]')
  await row.waitFor({ state: 'visible' })
  const before = await row.evaluate((el) => el.scrollLeft)
  const box = await row.boundingBox()
  const cy = box.y + box.height / 2
  const x1 = box.x + box.width - 60
  const x2 = box.x + 60
  await page.mouse.move(x1, cy)
  await page.mouse.down()
  await page.mouse.move(x2, cy, { steps: 14 })
  await page.mouse.up()
  await page.waitForTimeout(400)
  const after = await row.evaluate((el) => el.scrollLeft)
  check('仓库推荐栏鼠标拖动可横向滚动', after !== before, `scrollLeft ${before} → ${after}`)
  await ctx.close()
}

/* ───────── #28 用户主页：UID 常驻 + 点赞 ───────── */
{
  const ctx = await newCtx(1024, 800)
  const page = await ctx.newPage()
  page.on('pageerror', (e) => errors.push('PAGEERROR ' + e.message))
  await login(page)
  // 取一个非自己的用户 id（当前登录用户记录在 db.sessionUserId）
  const targetId = await page.evaluate(() => {
    const db = JSON.parse(localStorage.getItem('table-top.db.v3'))
    const meId = db.sessionUserId
    const other = db.users.find((u) => u.id !== meId)
    return other ? other.id : null
  })
  check('存在可访问的其他用户', !!targetId, targetId ?? '')
  if (targetId) {
    await page.goto(BASE + `/#/u/${targetId}`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(700)
    const body = await page.locator('body').innerText()
    check('用户主页展示不可隐藏的 UID', /UID/i.test(body), body.match(/UID[^A-Za-z0-9]*[A-Z0-9]+/)?.[0] ?? '')
    // 点赞按钮（爱心）
    const likeBtn = page.getByRole('button', { name: /点赞/ }).first()
    const likeCount = await likeBtn.count()
    check('用户主页有点赞按钮（匿名）', likeCount > 0)
    if (likeCount) {
      await likeBtn.click()
      await page.waitForTimeout(400)
      check('点赞后无报错', errors.length === 0)
    }
  }
  await ctx.close()
}

/* ───────── #31/#32 心测 + 候补位 控件与渲染 ───────── */
{
  const ctx = await newCtx(1280, 900)
  const page = await ctx.newPage()
  page.on('pageerror', (e) => errors.push('PAGEERROR ' + e.message))
  await login(page)
  // 发车页应出现「候补位」步进器（无需先选本）
  await page.goto(BASE + '/#/create', { waitUntil: 'networkidle' })
  await page.waitForTimeout(700)
  const createBody = await page.locator('body').innerText()
  check('发车页含「候补位」配置', createBody.includes('候补位'))
  // 选一个本子后，心测区才会出现（上车心测开关）
  const chooseBtn = page.getByRole('button', { name: /从仓库选|换一个/ }).first()
  if (await chooseBtn.count()) {
    await chooseBtn.click()
    await page.waitForTimeout(500)
    // 选第一个本子（排除 Sheet 自带的「关闭」按钮）
    const firstGame = page
      .locator('[role="dialog"] button:not([aria-label="关闭"])')
      .first()
    if (await firstGame.count()) {
      await firstGame.click()
      await page.waitForTimeout(500)
    }
  }
  const afterPick = await page.locator('body').innerText()
  check('选本后发车页含「上车心测」配置', afterPick.includes('上车心测'))
  check('选本后发车页无报错', errors.length === 0)

  // 进入一个已有活动，确认座位网格渲染（无报错）
  await page.goto(BASE + '/#/event/e13', { waitUntil: 'networkidle' })
  await page.waitForTimeout(700)
  const evBody = await page.locator('body').innerText()
  check('活动详情页渲染（含人数/座位）', /\d+\/\d+/.test(evBody), evBody.match(/\d+\/\d+/)?.[0] ?? '')
  check('活动详情无报错', errors.length === 0)
  await ctx.close()
}

console.log(results.join('\n'))
console.log('\nERRORS:', errors.length ? JSON.stringify(errors.slice(0, 8), null, 2) : 'none')
await browser.close()
