import { chromium } from 'playwright-core'

const BASE = process.env.BASE ?? 'http://127.0.0.1:5178'
const DATE = '2026-11-20'
const N = 8

const browser = await chromium.launch({ channel: 'msedge' })
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
const page = await ctx.newPage()
page.on('dialog', (d) => d.accept())

const errors = []
page.on('pageerror', (e) => errors.push('PAGEERROR ' + e.message))
page.on('console', (m) => {
  const t = m.text()
  if (m.type() === 'error' && !/404|502/.test(t)) errors.push(t)
})

const results = []
const check = (n, ok, extra = '') =>
  results.push(`${ok ? 'PASS' : 'FAIL'}  ${n}${extra ? ' :: ' + extra : ''}`)

async function openBatchTab() {
  await page.goto(BASE + '/#/admin', { waitUntil: 'networkidle' })
  await page.waitForTimeout(400)
  await page.getByRole('button', { name: '测试工具' }).click()
  await page.waitForTimeout(300)
  await page.locator('input[type="date"]').fill(DATE)
}

// 登录（数据存在这个 context 的 localStorage 里，桌面/手机两段共用）
await page.goto(BASE + '/#/login', { waitUntil: 'networkidle' })
await page.getByText('点这里填入示例账号').click()
await page.locator('form').getByRole('button', { name: '登录' }).click()
await page.waitForTimeout(900)

// ── 造车
await openBatchTab()
await page.getByRole('button', { name: `${N} 车`, exact: true }).click()
await page.getByRole('button', { name: new RegExp(`造 ${N} 车`) }).click()
await page.waitForTimeout(800)
const adminText = await page.locator('body').innerText()
check(
  '批量造车成功',
  adminText.includes(`已在 ${DATE} 造了 ${N} 车`),
  adminText.match(/已在[^\n]*/)?.[0] ?? '',
)

// ── 桌面端：+N 展开
await page.getByRole('button', { name: /去日历看这天/ }).click()
await page.waitForTimeout(900)
check('跳到日历并定位到该日', page.url().includes(`d=${DATE}`), page.url())

const cell = page.locator('[role="button"]').filter({ hasText: '年轮 拼车' }).first()
const inCell = await cell.locator('a[href^="#/event/"]').count()
check('当天格子只显示前 3 车', inCell === 3, `${inCell} 条`)

const more = page.getByRole('button', { name: `+${N - 3} 全部`, exact: true })
check('格子里出现 +N 全部', (await more.count()) === 1)
await more.click()
await page.waitForTimeout(600)
const dlg = page.locator('[role="dialog"]')
const dlgCards = await dlg.locator('a[href^="#/event/"]').count()
check('桌面端展开当天全部', dlgCards === N, `${dlgCards} 张卡`)
await page.keyboard.press('Escape')
await page.waitForTimeout(400)

// ── 手机端：带 ?d= 进来自动弹层（先离开日历再进来，走一次真实挂载）
await page.setViewportSize({ width: 390, height: 844 })
await page.goto(BASE + '/#/admin', { waitUntil: 'networkidle' })
await page.waitForTimeout(300)
await page.goto(BASE + `/#/calendar?d=${DATE}`, { waitUntil: 'networkidle' })
await page.waitForTimeout(1200)
const mDlg = page.locator('[role="dialog"]')
check('手机端 ?d= 自动弹出当天列表', (await mDlg.count()) === 1)
if (await mDlg.count()) {
  const cards = await mDlg.locator('a[href^="#/event/"]').count()
  check('手机弹层列出全部车', cards === N, `${cards} 张卡`)
  await mDlg.locator('a[href^="#/event/"]').first().click()
  await page.waitForTimeout(700)
  check('从弹层进详情', /#\/event\//.test(page.url()), page.url())
}

// ── 清理
await openBatchTab()
await page.getByRole('button', { name: /清空这天的测试车/ }).click()
await page.waitForTimeout(800)
const cleared = await page.locator('body').innerText()
check('清空这天的测试车', cleared.includes(`已删掉 ${N} 车`), cleared.match(/已删掉[^\n]*/)?.[0] ?? '')

await page.goto(BASE + `/#/calendar?d=${DATE}`, { waitUntil: 'networkidle' })
await page.waitForTimeout(900)
await page.keyboard.press('Escape')
await page.getByRole('button', { name: '月', exact: true }).click()
await page.waitForTimeout(600)
const gone = await page.locator('[role="dialog"]').count()
const dayText = await page.locator('body').innerText()
check(
  '清理后这天没车了',
  gone === 0 && (dayText.includes('没有安排') || dayText.includes('没有符合条件的活动')),
)

console.log(results.join('\n'))
console.log('\nERRORS:', errors.length ? JSON.stringify(errors.slice(0, 5), null, 2) : 'none')
await browser.close()
