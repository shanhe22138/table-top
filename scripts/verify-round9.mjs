import { chromium } from 'playwright-core'

const BASE = 'http://127.0.0.1:5178'
const results = []
const errors = []
function check(name, ok, extra = '') {
  results.push(`${ok ? 'PASS' : 'FAIL'} ${name}${extra ? ` :: ${extra}` : ''}`)
}

const browser = await chromium.launch({ channel: 'msedge' })

async function login(page) {
  await page.goto(BASE + '/#/login', { waitUntil: 'networkidle' })
  await page.waitForTimeout(400)
  await page.getByText('点这里填入示例账号').click()
  await page.locator('form').getByRole('button', { name: '登录' }).click()
  await page.waitForTimeout(800)
}

/* 1. 窄屏底部导航 */
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 820 } })
  const page = await ctx.newPage()
  page.on('pageerror', (e) => errors.push('PAGEERROR ' + e.message))
  await login(page)
  await page.waitForTimeout(400)
  const nav = await page.locator('nav.fixed').innerText().catch(() => '')
  const flat = nav.replace(/\s+/g, '|')
  check('窄屏底部导航含 时刻/仓库/站台/我的', ['时刻', '仓库', '站台', '我的'].every((t) => nav.includes(t)), flat)
  check('窄屏底部导航无 搜索', !nav.includes('搜索'))
  check('窄屏底部导航无 后台', !nav.includes('后台'))
  await ctx.close()
}

/* 2. 中屏顶栏 + 常驻搜索 */
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  const page = await ctx.newPage()
  page.on('pageerror', (e) => errors.push('PAGEERROR ' + e.message))
  await login(page)
  await page.waitForTimeout(400)
  const input = page.locator('input[aria-label="搜索"]')
  check('顶栏常驻搜索框存在', (await input.count()) > 0)
  await input.fill('年轮')
  await input.press('Enter')
  await page.waitForTimeout(700)
  check('搜索后跳转搜索页', page.url().includes('/search?q='), page.url())
  const headerNav = await page.locator('header nav').innerText().catch(() => '')
  check('顶栏导航含 时刻/仓库/站台', ['时刻', '仓库', '站台'].every((t) => headerNav.includes(t)), headerNav.replace(/\s+/g, '|'))
  await ctx.close()
}

/* 3. 站台社区：发帖 / 点赞 / 评论 */
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  const page = await ctx.newPage()
  page.on('pageerror', (e) => errors.push('PAGEERROR ' + e.message))
  await login(page)
  await page.goto(BASE + '/#/platform', { waitUntil: 'networkidle' })
  await page.waitForTimeout(700)
  check('站台页可访问', (await page.locator('body').innerText()).includes('站台'))
  const ta = page.locator('#platform-composer')
  await ta.fill('验收动态：今晚有人一起打本吗？')
  await page.getByRole('button', { name: '发布' }).click()
  await page.waitForTimeout(700)
  check('发帖后出现在信息流', (await page.locator('body').innerText()).includes('今晚有人一起打本吗'))

  const likeBtn = page.locator('article button').filter({ hasText: /^赞$/ }).first()
  if (await likeBtn.count()) {
    await likeBtn.click()
    await page.waitForTimeout(400)
    const liked = await page.locator('article button').filter({ hasText: /^1$/ }).count()
    check('点赞后计数变 1', liked > 0)
  } else {
    check('点赞按钮存在', false)
  }

  const cBtn = page.locator('article button').filter({ hasText: /^评论$/ }).first()
  if (await cBtn.count()) {
    await cBtn.click()
    await page.waitForTimeout(300)
    const cinput = page.locator('input[placeholder*="评论"]').first()
    await cinput.fill('同去同去')
    await cinput.press('Enter')
    await page.waitForTimeout(500)
    check('评论成功', (await page.locator('body').innerText()).includes('同去同去'))
  } else {
    check('评论按钮存在', false)
  }
  await ctx.close()
}

/* 4. 日历跟手拖动 + 松手翻页 + 不选中文本 */
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  const page = await ctx.newPage()
  page.on('pageerror', (e) => errors.push('PAGEERROR ' + e.message))
  await login(page)
  await page.goto(BASE + '/#/calendar', { waitUntil: 'networkidle' })
  await page.waitForTimeout(800)
  const period = page.locator('span.min-w-\\[7\\.5rem\\]')
  const p1 = await period.innerText().catch(() => '')
  const box = await page.locator('[data-swipe="month"]').boundingBox()
  if (box) {
    const cx = box.x + box.width / 2
    const cy = box.y + box.height / 2
    await page.mouse.move(cx, cy)
    await page.mouse.down()
    await page.mouse.move(cx - 90, cy, { steps: 8 })
    await page.waitForTimeout(80)
    const tf = await page.locator('[data-swipe="month"] > div').first().evaluate((el) => el.style.transform).catch(() => '')
    check('拖动时日历跟随鼠标', tf.includes('translateX(-'), tf)
    await page.mouse.move(cx - 170, cy, { steps: 6 })
    await page.mouse.up()
    await page.waitForTimeout(700)
    const p2 = await period.innerText().catch(() => '')
    check('松手翻到下一月', p1 !== p2, `${p1} -> ${p2}`)
    const sel = await page.evaluate(() => window.getSelection()?.toString() ?? '')
    check('拖动未选中文本', sel.length === 0, sel)
  } else {
    check('找到月视图容器', false)
  }
  await ctx.close()
}

/* 5. 用户页：UID 复制 + 空展柜不显示 */
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  const page = await ctx.newPage()
  page.on('pageerror', (e) => errors.push('PAGEERROR ' + e.message))
  await login(page)
  const other = await page.evaluate(() => {
    const db = JSON.parse(localStorage.getItem('table-top.db.v3'))
    return db.users.find((u) => u.id !== db.sessionUserId)?.id
  })
  await page.goto(BASE + `/#/u/${other}`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(700)
  const uidBtn = page.locator('button').filter({ hasText: /UID/ }).first()
  check('用户页有 UID 按钮', (await uidBtn.count()) > 0)
  if (await uidBtn.count()) {
    await uidBtn.click()
    await page.waitForTimeout(300)
    check('UID 点击后提示已复制', (await page.locator('body').innerText()).includes('已复制'))
  }
  check('空展柜不显示占位', !(await page.locator('body').innerText()).includes('展柜还是空的'))
  await ctx.close()
}

/* 6. 狼人杀板子：注入数据后用户页/偏好页可见 */
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  const page = await ctx.newPage()
  page.on('pageerror', (e) => errors.push('PAGEERROR ' + e.message))
  await login(page)
  const meId = await page.evaluate(() => {
    const db = JSON.parse(localStorage.getItem('table-top.db.v3'))
    const me = db.users.find((u) => u.id === db.sessionUserId)
    if (!me.prefs.plays.includes('werewolf')) me.prefs.plays.push('werewolf')
    me.prefs.boards = ['预女猎白', '狼美人']
    localStorage.setItem('table-top.db.v3', JSON.stringify(db))
    return me.id
  })
  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForTimeout(600)
  await page.goto(BASE + `/#/u/${meId}`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(600)
  const body = await page.locator('body').innerText()
  check('用户页展示狼人杀板子', body.includes('狼人杀板子') && body.includes('预女猎白'))
  await page.goto(BASE + '/#/me?tab=prefs', { waitUntil: 'networkidle' })
  await page.waitForTimeout(600)
  check('偏好页有板子编辑区', (await page.locator('body').innerText()).includes('板子（狼人杀）'))
  await ctx.close()
}

console.log(results.join('\n'))
console.log('\nERRORS:', errors.length ? JSON.stringify(errors.slice(0, 6), null, 2) : 'none')
const failed = results.filter((r) => r.startsWith('FAIL')).length
console.log(`\nSUMMARY: ${results.length - failed}/${results.length} passed`)
await browser.close()
process.exit(failed ? 1 : 0)
