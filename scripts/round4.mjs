import { chromium } from 'playwright-core'

const BASE = process.env.BASE ?? 'http://127.0.0.1:5178'
const browser = await chromium.launch({ channel: 'msedge' })
const results = []
const check = (n, ok, extra = '') =>
  results.push(`${ok ? 'PASS' : 'FAIL'}  ${n}${extra ? ' :: ' + extra : ''}`)

const errors = []
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, hasTouch: true })
const page = await ctx.newPage()
page.on('pageerror', (e) => errors.push('PAGEERROR ' + e.message))
page.on('console', (m) => {
  const t = m.text()
  if (m.type() === 'error' && !/404|502/.test(t)) errors.push(t)
})

async function login() {
  await page.goto(BASE + '/#/login', { waitUntil: 'networkidle' })
  await page.getByText('点这里填入示例账号').click()
  await page.locator('form').getByRole('button', { name: '登录' }).click()
  await page.waitForTimeout(900)
}

// ── 1. 顶栏头像二级菜单
await login()
await page.locator('button[aria-label="账号菜单"]').click()
await page.waitForTimeout(250)
const menuText = await page.getByRole('menu').innerText()
check('头像菜单有我的主页', menuText.includes('我的主页'))
check('头像菜单有偏好与隐私', menuText.includes('偏好与隐私'))
check('头像菜单有管理后台（站长可见）', menuText.includes('管理后台'))
check('头像菜单有操作日志', menuText.includes('操作日志'))
check('头像菜单有退出登录', menuText.includes('退出登录'))
check('桌面导航不再有「我的」标签', !(await page.locator('header nav').innerText()).includes('我的'))
await page.keyboard.press('Escape')

// ── 2. 周视图
await page.goto(BASE + '/#/calendar', { waitUntil: 'networkidle' })
await page.waitForTimeout(600)
await page.getByRole('button', { name: /^周$/ }).click()
await page.waitForTimeout(500)
const weekBox = await page.locator('text=看整月').count()
check('切到周视图', weekBox > 0)
const dayCells = await page.locator('a[href^="#/event/"]').count()
check('周视图里能看到活动', dayCells > 0, `${dayCells} 个活动链接`)

// ── 3. 滑动切月
await page.getByRole('button', { name: /^月$/ }).click()
await page.waitForTimeout(400)
const beforeLabel = await page.locator('span.font-display.text-\\[15px\\]').first().innerText()
await page.evaluate(() => {
  const el = document.querySelector('[data-swipe="month"]')
  if (!el) return
  const mk = (type, x, y) => {
    const t = new Touch({ identifier: 1, target: el, clientX: x, clientY: y })
    return new TouchEvent(type, {
      touches: type === 'touchend' ? [] : [t],
      changedTouches: [t],
      bubbles: true,
    })
  }
  el.dispatchEvent(mk('touchstart', 320, 420))
  el.dispatchEvent(mk('touchend', 160, 424))
})
await page.waitForTimeout(500)
const afterLabel = await page.locator('span.font-display.text-\\[15px\\]').first().innerText()
check('向左滑动切到下个月', beforeLabel !== afterLabel, `${beforeLabel} → ${afterLabel}`)

// ── 4. 偏好：玩法与按类型分开的设置
await page.goto(BASE + '/#/me?tab=prefs', { waitUntil: 'networkidle' })
await page.waitForTimeout(500)
const prefText = await page.locator('body').innerText()
for (const w of ['狼人杀', '血染钟楼', '阿瓦隆', '海龟汤', '跑团', '卡牌对战']) {
  check(`玩什么里有「${w}」`, prefText.includes(w))
}
check('偏好有舒适时长', prefText.includes('舒适时长'))
check('偏好有剧本杀分区', prefText.includes('剧本杀'))
check('剧本杀难度用「硬核」描述', prefText.includes('硬核'))
check('桌游难度用 BGG 说法', prefText.includes('中重') || prefText.includes('重度'))

// ── 5. 展柜：编辑模式 + 二次确认
await page.goto(BASE + '/#/me', { waitUntil: 'networkidle' })
await page.waitForTimeout(500)
const removeBefore = await page.getByRole('button', { name: /^移除「/ }).count()
check('非编辑态没有移除按钮', removeBefore === 0)
await page.getByRole('button', { name: '编辑', exact: true }).first().click()
await page.waitForTimeout(400)
const removeAfter = await page.getByRole('button', { name: /^移除「/ }).count()
check('编辑态出现移除按钮', removeAfter > 0, `${removeAfter} 个`)
if (removeAfter > 0) {
  await page.getByRole('button', { name: /^移除「/ }).first().click()
  await page.waitForTimeout(400)
  const dialog = await page.getByRole('alertdialog').count()
  check('点移除先弹二次确认', dialog === 1)
  await page.getByRole('alertdialog').getByRole('button', { name: '取消' }).click()
  await page.waitForTimeout(300)
  const stillThere = await page.getByRole('button', { name: /^移除「/ }).count()
  check('取消后条目还在', stillThere === removeAfter)
}

// ── 6. 管理后台
await page.goto(BASE + '/#/admin', { waitUntil: 'networkidle' })
await page.waitForTimeout(500)
const adminText = await page.locator('body').innerText()
for (const t of ['新增条目', '批量导入', '条目管理', '月度榜单', '地点与分类', '权限', '操作日志']) {
  check(`后台有「${t}」`, adminText.includes(t))
}

// ── 7. 榜单导入
await page.getByRole('button', { name: '月度榜单' }).click()
await page.waitForTimeout(300)
// 期号改成整框可点的月份选择器
await page.locator('button[aria-label="选择月份"]').click()
await page.waitForTimeout(350)
await page.getByRole('button', { name: '12 月', exact: true }).click()
await page.waitForTimeout(300)
// 整月数据一次贴完：分区 + 每行「名字 | 热度」
await page.locator('textarea').first().fill(
  '# 桌游\n卡坦岛 | 86 | 新榜首\n璀璨宝石 | 72\n农场主 | 65\n花砖物语 | 60\n车票之旅 | 55\n\n# 剧本杀\n年轮 | 90\n漓川怪谈簿 | 78\n舍离 | 70',
)
await page.waitForTimeout(400)
await page.getByRole('button', { name: /导入并更新推荐位/ }).click()
await page.waitForTimeout(900)
const chartMsg = await page.locator('body').innerText()
check('榜单导入成功提示', chartMsg.includes('已更新 2026-12'), chartMsg.match(/已更新[^\n]*/)?.[0] ?? '')
check('榜单里出现新名字', chartMsg.includes('卡坦岛'))

// ── 8. 仓库展示月榜
await page.goto(BASE + '/#/library', { waitUntil: 'networkidle' })
await page.waitForTimeout(600)
const libText = await page.locator('body').innerText()
check('仓库显示本月榜', libText.includes('2026 年 12 月榜') || libText.includes('月榜'), libText.match(/[\d]+ 年 [\d]+ 月榜/)?.[0] ?? '')
check('仓库榜单里有桌游 Top5', libText.includes('桌游 Top5'))
check('仓库榜单里有剧本杀 Top3', libText.includes('剧本杀 Top3'))
check('仓库榜单里有社交推理热度', libText.includes('社交推理热度'))
check('仓库里管理员能看到录入入口', libText.includes('录入条目'))

// ── 9. 操作日志
await page.goto(BASE + '/#/admin?tab=logs', { waitUntil: 'networkidle' })
await page.waitForTimeout(500)
const logText = await page.locator('body').innerText()
check('日志记录了导入榜单', logText.includes('导入榜单') || logText.includes('更新榜单'))
check('日志记录了操作者', logText.includes('阿盐'))

// ── 10. 普通用户看不到后台
await page.evaluate(() => localStorage.removeItem('table-top.token'))
await page.goto(BASE + '/#/login', { waitUntil: 'networkidle' })
await page.getByRole('button', { name: '注册' }).click()
await page.waitForTimeout(300)
await page.locator('input').nth(0).fill('路人甲')
await page.locator('input').nth(1).fill('passerby1')
await page.locator('input').nth(2).fill('pass1234')
await page.locator('form').getByRole('button', { name: /注册并登录/ }).click()
await page.waitForTimeout(1000)
const headerText = await page.locator('header').innerText()
check('新用户顶栏没有后台入口', !headerText.includes('后台'))
await page.locator('button[aria-label="账号菜单"]').click()
await page.waitForTimeout(250)
const menu2 = await page.getByRole('menu').innerText()
check('新用户菜单里没有管理后台', !menu2.includes('管理后台'))
check('新用户菜单里没有操作日志', !menu2.includes('操作日志'))
await page.keyboard.press('Escape')

await page.goto(BASE + '/#/admin', { waitUntil: 'networkidle' })
await page.waitForTimeout(500)
const blocked = await page.locator('body').innerText()
check('新用户直接访问后台被拦', blocked.includes('只有管理员能进'))

// ── 11. 仓库不显示录入入口
await page.goto(BASE + '/#/library', { waitUntil: 'networkidle' })
await page.waitForTimeout(500)
check('新用户在仓库看不到录入入口', !(await page.locator('body').innerText()).includes('录入条目'))

console.log(results.join('\n'))
console.log('\nERRORS:', errors.length ? JSON.stringify(errors.slice(0, 6), null, 2) : 'none')
await browser.close()
