import { chromium } from 'playwright-core'

const BASE = process.env.BASE ?? 'http://127.0.0.1:8788'
const browser = await chromium.launch({ channel: 'msedge' })

const results = []
function check(name, ok, extra = '') {
  results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? ' :: ' + extra : ''}`)
}

async function newUser(tag) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto(BASE + '/#/login', { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: '注册' }).click()
  await page.getByPlaceholder('比如：阿盐').fill(tag)
  await page.getByPlaceholder('比如：ayan').fill(tag.toLowerCase())
  await page.getByPlaceholder('设置一个密码').fill('pass123456')
  await page.locator('form').getByRole('button', { name: '注册并登录' }).click()
  await page.waitForTimeout(1400)
  return { ctx, page, errors }
}

/** 直接打接口，模拟绕过 UI 的越权尝试 */
async function api(page, path, body) {
  return page.evaluate(
    async ([p, b]) => {
      const token = localStorage.getItem('table-top.token')
      const res = await fetch(p, {
        method: b ? 'POST' : 'GET',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: b ? JSON.stringify(b) : undefined,
      })
      const text = await res.text()
      let json = null
      try {
        json = JSON.parse(text)
      } catch {
        /* 非 JSON */
      }
      return { status: res.status, json, text: text.slice(0, 120) }
    },
    [path, body ?? null],
  )
}

/* ── 1. 第一个注册的人是站长 */
const a = await newUser('甲玩家')
check('A 注册成功', !a.page.url().includes('login'), a.page.url())

await a.page.locator('button[aria-label="账号菜单"]').click()
await a.page.waitForTimeout(250)
const aMenu = await a.page.getByRole('menu').innerText()
check('首位注册者自动成为站长', aMenu.includes('管理后台'), aMenu.replace(/\n/g, ' / '))
await a.page.keyboard.press('Escape')

/* ── 2. 站长导入示例条目（写 games 需要管理员） */
await a.page.goto(BASE + '/#/admin', { waitUntil: 'networkidle' })
await a.page.waitForTimeout(400)
await a.page.getByRole('button', { name: '条目管理' }).click()
await a.page.waitForTimeout(300)
await a.page.getByRole('button', { name: '导入示例条目' }).click()
await a.page.waitForTimeout(1600)
await a.page.goto(BASE + '/#/store', { waitUntil: 'networkidle' })
await a.page.waitForTimeout(800)
const storeText = await a.page.locator('body').innerText()
check('示例条目已入库', storeText.includes('年轮') && storeText.includes('卡坦岛'))

/* ── 3. 站长发车 */
await a.page.goto(BASE + '/#/create', { waitUntil: 'networkidle' })
await a.page.waitForTimeout(400)
await a.page.getByPlaceholder('比如：周五晚 · 年轮 硬核车').fill('跨浏览器测试局')
await a.page.getByPlaceholder('比如：叁号推理馆 · 陆家嘴').fill('测试场地 B')
await a.page.getByRole('button', { name: /发车，生成上车链接/ }).click()
await a.page.waitForTimeout(1600)
const eventUrl = a.page.url()
check('A 发车成功', /#\/event\//.test(eventUrl), eventUrl)

/* ── 4. 第二个注册的人是普通用户 */
const b = await newUser('乙玩家')
check('B 注册成功', !b.page.url().includes('login'), b.page.url())
await b.page.locator('button[aria-label="账号菜单"]').click()
await b.page.waitForTimeout(250)
const bMenu = await b.page.getByRole('menu').innerText()
check('普通用户菜单里没有管理后台', !bMenu.includes('管理后台'), bMenu.replace(/\n/g, ' / '))
check('普通用户菜单里没有操作日志', !bMenu.includes('操作日志'))
await b.page.keyboard.press('Escape')

await b.page.goto(BASE + '/#/admin', { waitUntil: 'networkidle' })
await b.page.waitForTimeout(700)
const bAdminText = await b.page.locator('body').innerText()
check(
  '普通用户直接访问后台被拦',
  /只有管理员能进|没有权限|无权|仅管理员/.test(bAdminText),
  bAdminText.replace(/\n/g, ' ').slice(0, 40),
)

await b.page.goto(BASE + '/#/store', { waitUntil: 'networkidle' })
await b.page.waitForTimeout(800)
check(
  '普通用户在仓库看不到录入入口',
  (await b.page.getByRole('link', { name: /录入条目/ }).count()) === 0,
)

/* ── 5. B 能看到并上 A 的车 */
await b.page.goto(eventUrl, { waitUntil: 'networkidle' })
await b.page.waitForTimeout(1000)
const bText = await b.page.locator('body').innerText()
check('B 能看到 A 开的局', bText.includes('跨浏览器测试局'))
check('B 看到的团长是 A', bText.includes('甲玩家'))
const joinBtn = b.page.getByRole('button', { name: /我要上车/ })
check('B 看到上车按钮', (await joinBtn.count()) > 0)
if (await joinBtn.count()) {
  await joinBtn.click()
  await b.page.waitForTimeout(1400)
  check('B 上车后变 2/6', (await b.page.locator('body').innerText()).includes('2/6'))
}
await a.page.reload({ waitUntil: 'networkidle' })
await a.page.waitForTimeout(1200)
const aText = await a.page.locator('body').innerText()
check('A 看到 B 已上车', aText.includes('2/6') && aText.includes('乙玩家'))

/* ── 6. 越权：普通用户写 games / charts / settings */
const bGame = await api(b.page, '/api/sync', {
  ops: [{ t: 'insert', table: 'games', row: { id: 'g_hack', name: '偷加的条目', kind: 'board' } }],
})
check('B 往仓库塞条目被拒绝', bGame.status >= 400, `HTTP ${bGame.status} ${bGame.json?.error ?? ''}`)

const bChart = await api(b.page, '/api/sync', {
  ops: [{ t: 'insert', table: 'charts', row: { id: 'c_hack', period: '2026-12', entries: [] } }],
})
check('B 改月度榜单被拒绝', bChart.status >= 400, `HTTP ${bChart.status} ${bChart.json?.error ?? ''}`)

const bSettings = await api(b.page, '/api/sync', {
  ops: [{ t: 'update', table: 'settings', id: 'app', patch: { locations: ['黑客城'] } }],
})
check('B 改站点配置被拒绝', bSettings.status >= 400, `HTTP ${bSettings.status} ${bSettings.json?.error ?? ''}`)

/* ── 7. 越权：自己给自己升权限 */
const selfPromo = await api(b.page, '/api/sync', {
  ops: [{ t: 'update', table: 'users', id: 'self', patch: { role: 'admin' } }],
})
check(
  '普通用户不能自己升管理员',
  selfPromo.status >= 400,
  `HTTP ${selfPromo.status} ${selfPromo.json?.error ?? ''}`,
)

/* ── 8. 越权：改别人的车 */
const hack = await b.page.evaluate(async (url) => {
  const id = url.split('/event/')[1]
  const token = localStorage.getItem('table-top.token')
  const res = await fetch('/api/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ ops: [{ t: 'update', table: 'events', id, patch: { title: '被篡改了' } }] }),
  })
  return { status: res.status, body: (await res.text()).slice(0, 120) }
}, eventUrl)
check('B 改别人活动标题被拒绝', hack.status >= 400, `HTTP ${hack.status} ${hack.body}`)

/* ── 9. 日志身份以服务端为准 */
const bId = await b.page.evaluate(async () => {
  const token = localStorage.getItem('table-top.token')
  const res = await fetch('/api/state', { headers: { Authorization: `Bearer ${token}` } })
  const data = await res.json()
  const me = data.users?.find((u) => u.username === '乙玩家')
  return me?.id ?? null
})
check('拿到 B 的用户 id', !!bId, bId ?? '')

const logSpoof = await api(b.page, '/api/sync', {
  ops: [
    {
      t: 'insert',
      table: 'logs',
      row: {
        id: 'l_spoof_' + Date.now(),
        userId: 'u_fake',
        userName: '假管理员',
        action: '修改条目',
        at: '2000-01-01T00:00:00.000Z',
      },
    },
  ],
})
check('日志可以追加（身份由服务端覆盖）', logSpoof.status === 200, `HTTP ${logSpoof.status}`)

/* ── 10. 站长授予 B 管理员 */
const grant = await api(a.page, '/api/sync', {
  ops: [{ t: 'update', table: 'users', id: bId, patch: { role: 'admin' } }],
})
check('站长能把别人设为管理员', grant.status === 200, `HTTP ${grant.status} ${grant.json?.error ?? ''}`)

await b.page.reload({ waitUntil: 'networkidle' })
await b.page.waitForTimeout(1400)
await b.page.locator('button[aria-label="账号菜单"]').click()
await b.page.waitForTimeout(250)
const bMenu2 = await b.page.getByRole('menu').innerText()
check('B 升管理员后菜单出现管理后台', bMenu2.includes('管理后台'))
await b.page.keyboard.press('Escape')

const bGame2 = await api(b.page, '/api/sync', {
  ops: [{ t: 'insert', table: 'games', row: { id: 'g_ok', name: '管理员加的条目', kind: 'board' } }],
})
check('B 升管理员后能写仓库', bGame2.status === 200, `HTTP ${bGame2.status} ${bGame2.json?.error ?? ''}`)

/* ── 11. 管理员也不能改站长 / 不能碰别人的号 */
const ownerMove = await api(b.page, '/api/sync', {
  ops: [{ t: 'update', table: 'settings', id: 'app', patch: { ownerId: bId } }],
})
check(
  '管理员不能把自己变成站长',
  ownerMove.status >= 400,
  `HTTP ${ownerMove.status} ${ownerMove.json?.error ?? ''}`,
)

const promoteOther = await api(b.page, '/api/sync', {
  ops: [{ t: 'update', table: 'users', id: 'u_someone_else', patch: { role: 'admin' } }],
})
check(
  '管理员不能授予别人管理员',
  promoteOther.status >= 400,
  `HTTP ${promoteOther.status} ${promoteOther.json?.error ?? ''}`,
)

/* ── 12. 会话保持 + 日志落地 */
await a.page.goto(BASE + '/#/me', { waitUntil: 'networkidle' })
await a.page.waitForTimeout(900)
check('A 刷新后仍是登录态', (await a.page.locator('body').innerText()).includes('甲玩家'))

await a.page.goto(BASE + '/#/admin?tab=logs', { waitUntil: 'networkidle' })
await a.page.waitForTimeout(1400)
const logText = await a.page.locator('body').innerText()
check('站长能看操作日志', /操作日志/.test(logText))
check('日志记录了这次写操作', /乙玩家|管理员加的条目|修改条目/.test(logText), logText.slice(0, 60))

console.log(results.join('\n'))
const fails = results.filter((r) => r.startsWith('FAIL')).length
console.log(`\n${results.length - fails}/${results.length} PASS`)
console.log('PAGE_ERRORS:', [...a.errors, ...b.errors].slice(0, 5))
await browser.close()
