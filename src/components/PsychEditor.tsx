import { Button, Field } from './ui'
import { Icon } from './Icons'
import type { PsychTest, PsychQuestion, PsychOption } from '../types'

let counter = 0
function nid(prefix: string) {
  counter += 1
  return `${prefix}_${Date.now().toString(36)}${counter}`
}

function newQuestion(): PsychQuestion {
  return {
    id: nid('q'),
    text: '',
    options: [
      { id: nid('o'), label: '', tag: '' },
      { id: nid('o'), label: '', tag: '' },
    ],
  }
}

/**
 * 编辑一份心测问卷（车头可基于默认题库改编，管理员可维护入库）。
 * 受控组件：通过 onChange 把最新值抛给父级。
 */
export function PsychEditor({
  value,
  onChange,
}: {
  value: PsychTest
  onChange: (t: PsychTest) => void
}) {
  const patch = (p: Partial<PsychTest>) => onChange({ ...value, ...p })

  const setQuestion = (i: number, q: Partial<PsychQuestion>) =>
    patch({ questions: value.questions.map((x, j) => (j === i ? { ...x, ...q } : x)) })

  const setOption = (i: number, j: number, o: Partial<PsychOption>) =>
    setQuestion(i, {
      options: value.questions[i].options.map((x, k) => (k === j ? { ...x, ...o } : x)),
    })

  const addQuestion = () => patch({ questions: [...value.questions, newQuestion()] })
  const removeQuestion = (i: number) =>
    patch({ questions: value.questions.filter((_, j) => j !== i) })

  const addOption = (i: number) =>
    setQuestion(i, {
      options: [...value.questions[i].options, { id: nid('o'), label: '', tag: '' }],
    })
  const removeOption = (i: number, j: number) =>
    setQuestion(i, { options: value.questions[i].options.filter((_, k) => k !== j) })

  return (
    <div className="space-y-3">
      <Field label="问卷标题">
        <input
          value={value.title}
          onChange={(e) => patch({ title: e.target.value })}
          placeholder="比如：年轮 · 角色适配问卷"
        />
      </Field>

      <div className="space-y-3">
        {value.questions.map((q, i) => (
          <div key={q.id} className="rounded-xl border border-line bg-surface/50 p-3">
            <div className="mb-2 flex items-center gap-2">
              <span className="text-[11px] text-faint">问题 {i + 1}</span>
              <button
                onClick={() => removeQuestion(i)}
                className="ml-auto rounded p-1 text-faint hover:text-seal"
                aria-label="删除问题"
              >
                <Icon name="trash" size={14} />
              </button>
            </div>
            <input
              value={q.text}
              onChange={(e) => setQuestion(i, { text: e.target.value })}
              placeholder="输入问题，比如：复盘时你更愿意…"
              className="mb-2"
            />
            <div className="space-y-2">
              {q.options.map((o, j) => (
                <div key={o.id} className="flex items-center gap-2">
                  <input
                    value={o.label}
                    onChange={(e) => setOption(i, j, { label: e.target.value })}
                    placeholder={`选项 ${j + 1}`}
                    className="min-w-0 flex-1 !py-1.5 !text-[12.5px]"
                  />
                  <input
                    value={o.tag ?? ''}
                    onChange={(e) => setOption(i, j, { tag: e.target.value || undefined })}
                    placeholder="性格标签"
                    className="w-[88px] !py-1.5 !text-[12px]"
                    title="该选项映射的性格标签，车头可据此分配角色（选填）"
                  />
                  <button
                    onClick={() => removeOption(i, j)}
                    className="rounded p-1 text-faint hover:text-seal"
                    aria-label="删除选项"
                  >
                    <Icon name="close" size={13} />
                  </button>
                </div>
              ))}
            </div>
            <button
              onClick={() => addOption(i)}
              className="mt-2 inline-flex items-center gap-1 text-[11.5px] text-brass/90 hover:text-brass"
            >
              <Icon name="plus" size={12} /> 加一个选项
            </button>
          </div>
        ))}
      </div>

      <Button variant="ghost" size="sm" onClick={addQuestion}>
        <Icon name="plus" size={13} /> 加一个问题
      </Button>
    </div>
  )
}
