// Лёгкий модальный ввод текста вместо window.prompt (тот блокирует поток и не стилизуется).
// Возвращает Promise<string|null>: null — отмена (Escape, клик мимо, «Отмена»).

import {escapeHtml} from '@core/utils'

export function promptDialog(title, defaultValue = '') {
  return new Promise(resolve => {
    const overlay = document.createElement('div')
    overlay.className = 'dialog-overlay'
    overlay.innerHTML = `
      <form class="dialog">
        <label class="dialog__title">${escapeHtml(title)}</label>
        <input class="dialog__input" type="text" value="${escapeHtml(defaultValue)}" />
        <div class="dialog__buttons">
          <button type="button" class="dialog__btn" data-cancel>Отмена</button>
          <button type="submit" class="dialog__btn dialog__btn--primary">ОК</button>
        </div>
      </form>
    `
    const input = overlay.querySelector('input')
    const finish = value => {
      document.removeEventListener('keydown', onKey, true)
      overlay.remove()
      resolve(value)
    }
    const onKey = e => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        finish(null)
      }
    }
    // не даём кликам и клавишам уйти в таблицу под диалогом
    overlay.addEventListener('mousedown', e => {
      e.stopPropagation()
      if (e.target === overlay) {
        finish(null)
      }
    })
    overlay.addEventListener('keydown', e => e.stopPropagation())
    overlay.querySelector('[data-cancel]').addEventListener('click', () => finish(null))
    overlay.querySelector('form').addEventListener('submit', e => {
      e.preventDefault()
      finish(input.value)
    })
    document.addEventListener('keydown', onKey, true)
    document.body.append(overlay)
    input.focus()
    input.select()
  })
}
