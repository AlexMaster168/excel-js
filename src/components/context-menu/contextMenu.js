// Лёгкое контекстное меню. Не привязано к фреймворку — рисует div в body,
// сам закрывается по клику вне, Escape или выбору пункта.
// items: [{label, onClick, danger?} | {divider:true}]

let activeMenu = null
let cleanup = null

export function closeContextMenu() {
  if (activeMenu) {
    activeMenu.remove()
    activeMenu = null
  }
  if (cleanup) {
    cleanup()
    cleanup = null
  }
}

export function showContextMenu(x, y, items) {
  closeContextMenu()

  const el = document.createElement('div')
  el.className = 'context-menu'
  el.innerHTML = items
      .map((it, i) =>
        it.divider
          ? '<div class="context-menu__divider"></div>'
          : `<div class="context-menu__item${it.danger ? ' danger' : ''}"
                  data-idx="${i}">${it.label}</div>`)
      .join('')

  // не даём клику «провалиться» в таблицу и снять выделение
  el.addEventListener('mousedown', e => e.stopPropagation())
  el.addEventListener('click', e => {
    const node = e.target.closest('[data-idx]')
    if (!node) {
      return
    }
    const item = items[+node.dataset.idx]
    closeContextMenu()
    if (item && typeof item.onClick === 'function') {
      item.onClick()
    }
  })

  document.body.appendChild(el)

  // позиционируем у курсора, корректируя выход за экран
  let left = x
  let top = y
  const rect = el.getBoundingClientRect()
  if (left + rect.width > window.innerWidth) {
    left = Math.max(4, window.innerWidth - rect.width - 4)
  }
  if (top + rect.height > window.innerHeight) {
    top = Math.max(4, window.innerHeight - rect.height - 4)
  }
  el.style.left = left + 'px'
  el.style.top = top + 'px'

  const onDocMousedown = ev => {
    if (!el.contains(ev.target)) {
      closeContextMenu()
    }
  }
  const onKey = ev => {
    if (ev.key === 'Escape') {
      closeContextMenu()
    }
  }
  // в следующем тике, чтобы не поймать текущий правый клик
  setTimeout(() => {
    document.addEventListener('mousedown', onDocMousedown)
    document.addEventListener('keydown', onKey)
  }, 0)
  cleanup = () => {
    document.removeEventListener('mousedown', onDocMousedown)
    document.removeEventListener('keydown', onKey)
  }

  activeMenu = el
}
