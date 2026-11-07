import { chromium } from 'playwright-core'

const BASE = process.env.BASE ?? 'http://127.0.0.1:5178'
const browser = await chromium.launch({ channel: 'msedge' })
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } })
const page = await ctx.newPage()

const errors = []
page.on('console', (m) => {
  if (m.type() === 'error' && !m.text().includes('404')) errors.push(m.text())
})
page.on('pageerror', (e) => errors.push('PAGEERROR ' + e.message))

const results = []
function check(name, ok, extra = '') {
  results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? ' :: ' + extra : ''}`)
}

// 1. 登录
await page.goto(BASE + '/#/login', { waitUntil: 'networkidle' })
await page.getByText('点这里填入示例账号').click()
await page.locator('form').getByRole('button', { name: '登录' }).click()
await page.waitForTimeout(900)
check('登录成功', (await page.locator('header').innerText()).includes('阿') || page.url().includes('calendar'))

// 2. 上车
await page.goto(BASE + '/#/event/e13', { waitUntil: 'networkidle' })
await page.waitForTimeout(400)
const beforeText = await page.locator('body').innerText()
check('活动页显示空位', beforeText.includes('2/6'), beforeText.match(/\d\/6/)?.[0] ?? '')
await page.getByRole('button', { name: /我要上车/ }).click()
await page.waitForTimeout(600)
const afterText = await page.locator('body').innerText()
check('上车后座位变化', afterText.includes('3/6'), afterText.match(/\d\/6/)?.[0] ?? '')

// 3. 上车后刷新仍保留（持久化）
await page.reload({ waitUntil: 'networkidle' })
await page.waitForTimeout(500)
check('刷新后仍在上车名单', (await page.locator('body').innerText()).includes('3/6'))

// 4. 写评测
await page.goto(BASE + '/#/game/s03', { waitUntil: 'networkidle' })
await page.waitForTimeout(300)
await page.getByRole('button', { name: /写评测/ }).click()
await page.waitForTimeout(400)
await page.locator('textarea').fill('自动化测试写的一条评测，机制很扎实。')
await page.getByRole('button', { name: '发布评测' }).click()
await page.waitForTimeout(700)
check('评测发布成功', (await page.locator('body').innerText()).includes('自动化测试写的一条评测'))

// 5. 加入展柜
await page.getByRole('button', { name: /加入展柜/ }).click()
await page.waitForTimeout(600)
await page.goto(BASE + '/#/me', { waitUntil: 'networkidle' })
await page.waitForTimeout(400)
check('展柜新增条目', (await page.locator('body').innerText()).includes('曦和失焰'))

// 6. 发车
await page.goto(BASE + '/#/create', { waitUntil: 'networkidle' })
await page.waitForTimeout(300)
await page.getByPlaceholder('比如：周五晚 · 年轮 硬核车').fill('冒烟测试局')
await page.getByPlaceholder('比如：叁号推理馆 · 陆家嘴').fill('测试场地 A')
await page.getByRole('button', { name: /发车，生成上车链接/ }).click()
await page.waitForTimeout(900)
const createdUrl = page.url()
check('发车后跳转到活动页', /#\/event\//.test(createdUrl), createdUrl)
check('新活动标题正确', (await page.locator('body').innerText()).includes('冒烟测试局'))

// 7. 分享链接可打开
const shareUrl = await page.evaluate(() => {
  const raw = localStorage.getItem('table-top.db.v3')
  const db = JSON.parse(raw)
  const ev = db.events.find((e) => e.title === '冒烟测试局')
  return `/#/join/${ev.shareCode}`
})
await page.goto(BASE + shareUrl, { waitUntil: 'networkidle' })
await page.waitForTimeout(700)
check('分享链接跳到活动页', /#\/event\//.test(page.url()), page.url())

// 8. 列表视图
await page.goto(BASE + '/#/calendar', { waitUntil: 'networkidle' })
await page.getByRole('button', { name: /列表/ }).click()
await page.waitForTimeout(500)
check('列表视图渲染', (await page.locator('body').innerText()).includes('场'))

// 9. 退出登录后受保护页面跳登录
await page.goto(BASE + '/#/me', { waitUntil: 'networkidle' })
await page.getByRole('button', { name: /设置/ }).click()
await page.waitForTimeout(300)
await page.getByRole('button', { name: /退出登录/ }).click()
await page.waitForTimeout(500)
await page.goto(BASE + '/#/me', { waitUntil: 'networkidle' })
await page.waitForTimeout(400)
check('未登录访问我的页显示登录', (await page.locator('body').innerText()).includes('登录后查看你的展柜'))

console.log(results.join('\n'))
console.log('\nCONSOLE_ERRORS:', errors.length ? JSON.stringify(errors.slice(0, 10), null, 2) : 'none')
await browser.close()
