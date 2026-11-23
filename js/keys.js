// キー設定（2026-11-23 本人「設定でキーを変更できるように」）。動作ごとに主キーと予備キーの2つ。ブラウザに保存する
// マウス（左: 握って離して投げる／右: 着く所を見る・転がす）は変えない
export const ACTIONS = [
  ['fwd', '前へ', ['KeyW', 'ArrowUp']], ['back', '後ろへ', ['KeyS', 'ArrowDown']], ['left', '左へ', ['KeyA', 'ArrowLeft']], ['right', '右へ', ['KeyD', 'ArrowRight']],
  ['run', '走る', ['ShiftLeft', 'ShiftRight']], ['jump', '跳ぶ（車ではブレーキ）', ['Space']], ['crouch', 'しゃがむ', ['KeyC']],
  ['pick', '足元の爆弾を拾って投げ返す', ['KeyE']], ['det', '付けた粘着を起爆', ['KeyQ']], ['veh', '軽トラに乗る・降りる／輸送機から降りる・傘を開く', ['KeyF']], ['map', '島の地図を出す・しまう', ['KeyM']], ['again', 'やられた後にもう一回', ['KeyR']],
  ['s1', '手投げに持ち替え', ['Digit1']], ['s2', '煙に持ち替え', ['Digit2']], ['s3', '粘着に持ち替え', ['Digit3']], ['s4', '火炎瓶に持ち替え', ['Digit4']], ['s5', '地雷に持ち替え', ['Digit5']],
]
// Ctrl・⌘ は割り当てない（Ctrl+W でタブが閉じる）。Esc はマウスを外す・設定を閉じるのに使う
export const BANNED = new Set(['ControlLeft', 'ControlRight', 'MetaLeft', 'MetaRight', 'Escape', 'OSLeft', 'OSRight'])
const STORE = 'fi_keys_v1'

export class Keys {
  constructor() {
    this.map = {}
    for (const [id, , def] of ACTIONS) this.map[id] = [def[0] || null, def[1] || null]
    try { const s = JSON.parse(localStorage.getItem(STORE) || 'null'); if (s) for (const id in s) if (this.map[id] && Array.isArray(s[id])) this.map[id] = [s[id][0] || null, s[id][1] || null] } catch {}
    this.rebuild()
  }
  rebuild() { this.byCode = new Map(); for (const id in this.map) for (const c of this.map[id]) if (c) { if (!this.byCode.has(c)) this.byCode.set(c, []); this.byCode.get(c).push(id) } }
  save() { try { localStorage.setItem(STORE, JSON.stringify(this.map)) } catch {} }
  // そのキーがその動作か
  is(code, id) { const l = this.byCode.get(code); return !!(l && l.includes(id)) }
  // 押されている間か（keys は押されているキーの集まり）
  down(keys, id) { const m = this.map[id]; return !!((m[0] && keys[m[0]]) || (m[1] && keys[m[1]])) }
  // 付け替え。ほかの動作で使っているキーなら、そちらから外す
  set(id, slot, code) {
    if (code) for (const k in this.map) for (let i = 0; i < 2; i++) if (this.map[k][i] === code && !(k === id && i === slot)) this.map[k][i] = null
    this.map[id][slot] = code || null
    this.rebuild(); this.save()
  }
  reset() { for (const [id, , def] of ACTIONS) this.map[id] = [def[0] || null, def[1] || null]; this.rebuild(); this.save() }
  // 画面に出す字（主キー）
  label(id) { const m = this.map[id]; return keyName(m[0] || m[1]) }
}
export function keyName(code) {
  if (!code) return '－'
  if (code.startsWith('Key')) return code.slice(3)
  if (code.startsWith('Digit')) return code.slice(5)
  if (code.startsWith('Numpad')) return 'テンキー' + code.slice(6)
  const t = { Space: 'Space', ShiftLeft: '左Shift', ShiftRight: '右Shift', AltLeft: '左Alt', AltRight: '右Alt', ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', Tab: 'Tab', Enter: 'Enter', Backspace: 'BS', CapsLock: 'Caps', Backquote: '`', Minus: '-', Equal: '=', BracketLeft: '[', BracketRight: ']', Semicolon: ';', Quote: "'", Comma: ',', Period: '.', Slash: '/', Backslash: '\\', IntlRo: 'ろ', IntlYen: '¥' }
  return t[code] || code
}

// 設定画面（タイトルと、試合中にマウスを外した時の右上のボタンから開く）
export class KeyPanel {
  constructor(keys, onChange) {
    this.keys = keys; this.onChange = onChange; this.wait = null
    const el = this.el = document.createElement('section'); el.id = 'keys'
    el.innerHTML = `<div class="kbox"><h2>キー設定</h2><p class="kn">ボタンを押してから、使いたいキーを押す。BS で外す・Esc でやめる。マウスは 左: 握って投げる／右: 着く所を見る（変えられない）</p><div class="ktab"></div><div class="krow"><button class="kreset">初期に戻す</button><button class="kclose">閉じる</button></div></div>`
    document.body.appendChild(el)
    el.querySelector('.kreset').addEventListener('click', () => { this.keys.reset(); this.draw(); this.onChange() })
    el.querySelector('.kclose').addEventListener('click', () => this.close())
    // 待っている間のキーは、ゲームより先に受け取る
    addEventListener('keydown', e => {
      if (!this.el.classList.contains('show')) return
      e.preventDefault(); e.stopImmediatePropagation()
      if (!this.wait) { if (e.code === 'Escape') this.close(); return }
      const [id, slot] = this.wait
      if (e.code === 'Escape') { this.wait = null; this.draw(); return }
      if (BANNED.has(e.code)) { this.flash('Ctrl・⌘・Esc は使えません'); return }
      this.keys.set(id, slot, e.code === 'Backspace' ? null : e.code)
      this.wait = null; this.draw(); this.onChange()
    }, true)
    this.draw()
  }
  flash(t) { const n = this.el.querySelector('.kn'); n.textContent = t; n.classList.add('warn'); clearTimeout(this._ft); this._ft = setTimeout(() => { n.classList.remove('warn'); n.textContent = 'ボタンを押してから、使いたいキーを押す。BS で外す・Esc でやめる。マウスは 左: 握って投げる／右: 着く所を見る（変えられない）' }, 1600) }
  draw() {
    const t = this.el.querySelector('.ktab')
    t.innerHTML = ACTIONS.map(([id, name]) => `<div class="kr"><span>${name}</span>${[0, 1].map(s => `<button data-id="${id}" data-s="${s}" class="${this.wait && this.wait[0] === id && this.wait[1] === s ? 'wait' : ''}">${this.wait && this.wait[0] === id && this.wait[1] === s ? 'キーを押す' : keyName(this.keys.map[id][s])}</button>`).join('')}</div>`).join('')
    t.querySelectorAll('button').forEach(b => b.addEventListener('click', () => { this.wait = [b.dataset.id, +b.dataset.s]; this.draw() }))
  }
  open() { document.exitPointerLock?.(); this.wait = null; this.draw(); this.el.classList.add('show') }
  close() { this.wait = null; this.el.classList.remove('show') }
  get isOpen() { return this.el.classList.contains('show') }
}
