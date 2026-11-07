import { chromium } from 'playwright-core'

const BASE = process.env.BASE ?? 'http://127.0.0.1:5178'
const browser = await chromium.launch({ channel: 'msedge' })
const results = []
const check = (n, ok, extra = '') =>
  results.push(`${ok ? 'PASS' : 'FAIL'}  ${n}${extra ? ' :: ' + extra : ''}`)

const errors = []
async function newPage(w, h) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h } })
  const p = await ctx.newPage()
  p.on('pageerror', (e) => errors.push('PAGEERROR ' + e.message))
  p.on('console', (m) => {
    const t = m.text()
    if (m.type() === 'error' && !/404|502/.test(t)) errors.push(t)
  })
  await p.goto(BASE + '/#/calendar', { waitUntil: 'networkidle' })
  await p.waitForTimeout(700)
  return p
}

// ── 桌面端：日历格里的标题本身就是链接
const d = await newPage(1280, 900)
const links = d.locator('a[href^="#/event/"]')
const n = await links.count()
check('桌面端日历内有活动标题链接', n > 0, `${n} 个`)
const firstTitle = (await links.first().innerText()).trim()
await links.first().click()
await d.waitForTimeout(600)
check('点标题直接进详情页', /#\/event\/e_|#\/event\/e\d/.test(d.url()), d.url())
check('详情页标题与所点条目一致', (await d.locator('body').innerText()).includes(firstTitle.slice(0, 4)), firstTitle)
// 详情页有返回按钮
check('详情页有返回入口', (await d.getByRole('button', { name: /返回|日历/ }).count()) > 0)

// 悬停高亮：hover 后背景类变化（仅确认可 hover 且不报错）
await d.goto(BASE + '/#/calendar', { waitUntil: 'networkidle' })
await d.waitForTimeout(500)
await d.locator('a[href^="#/event/"]').first().hover()
await d.waitForTimeout(200)
check('标题可悬停无报错', errors.length === 0, errors[0] ?? '')

// ── 手机端：点有活动的日期 → 弹层列出当天车 → 点卡片进详情
const m = await newPage(390, 844)
// 窄屏默认是列表视图，先切回月视图才有日期格
await m.getByRole('button', { name: '月', exact: true }).click()
await m.waitForTimeout(600)
const cells = m.locator('[role="button"][tabindex="0"]')
const total = await cells.count()
let opened = false
let targetIdx = -1
for (let i = 0; i < total; i++) {
  const dots = await cells.nth(i).locator('span.h-1\\.5').count()
  if (dots > 0) {
    targetIdx = i
    await cells.nth(i).click()
    await m.waitForTimeout(500)
    opened = await m.getByText(/场 · 点一下看详情/).count() > 0
    if (opened) break
  }
}
check('手机端点日期弹出当天车列表', opened, `cell#${targetIdx}`)
if (opened) {
  const cards = m.locator('[role="dialog"] a[href^="#/event/"]')
  const cardCount = await cards.count()
  check('弹层里可点进详情', cardCount > 0, `${cardCount} 个可点卡片`)
  if (cardCount) {
    await cards.first().click()
    await m.waitForTimeout(700)
    check('手机端点卡片进入详情页', /#\/event\//.test(m.url()), m.url())
  }
}

console.log(results.join('\n'))
console.log('\nERRORS:', errors.length ? JSON.stringify(errors.slice(0, 5), null, 2) : 'none')
await browser.close()
