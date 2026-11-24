// 日英の切り替え（2026-11-24 英語版）: ?lang=en / ?lang=ja が最優先。無ければブラウザの言語が ja 以外なら英語
const q = new URLSearchParams(location.search).get('lang')
export const LANG = q === 'en' || q === 'ja' ? q : ((navigator.languages && navigator.languages[0]) || navigator.language || 'ja').toLowerCase().startsWith('ja') ? 'ja' : 'en'
export const EN = LANG === 'en'
// L('日本語', 'English')
export const L = (ja, en) => EN ? en : ja
// 色の名前（車と CPU の名前に使う）
const COLORS = { 'あなた': 'You', '白': 'White', '赤': 'Red', '青': 'Blue', '黄': 'Yellow', '緑': 'Green', '橙': 'Orange', '黒': 'Black', '銀': 'Silver', '水色': 'Sky', '紫': 'Purple', '茶': 'Brown', '桃': 'Pink', '灰': 'Gray', '錆': 'Rust', '藍': 'Navy', '若草': 'Lime', 'クリーム': 'Cream', '自転車': 'Bike' }
export const NAME = n => EN ? (COLORS[n] || n) : n
// 画面の文字（index.html）: data-en を持つ要素は英語の時に中身を入れ替える
export function applyPage() {
  document.documentElement.lang = LANG
  if (!EN) return
  for (const el of document.querySelectorAll('[data-en]')) el.innerHTML = el.dataset.en
  for (const el of document.querySelectorAll('[data-en-label]')) el.setAttribute('aria-label', el.dataset.enLabel)
  if (document.body.dataset.enTitle) document.title = document.body.dataset.enTitle
}
