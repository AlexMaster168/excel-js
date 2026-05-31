function toButton(button) {
  const meta = `
    data-type="button"
    data-value='${JSON.stringify(button.value)}'
  `
  return `
    <div 
      class="button ${button.active ? 'active' : ''}"
      ${meta}
    >
      <i 
        class="material-icons"
        ${meta}
      >${button.icon}</i>
    </div>
  `
}

export function createToolbar(s) {
  const buttons = [
    {
      value: {textAlign: 'left'},
      icon: 'format_align_left',
      active: s['textAlign'] === 'left'
    },
    {
      value: {textAlign: 'center'},
      icon: 'format_align_justify',
      active: s['textAlign'] === 'center'
    },
    {
      value: {textAlign: 'right'},
      icon: 'format_align_right',
      active: s['textAlign'] === 'right'
    },
    {
      value: {fontWeight: s['fontWeight'] === 'bold' ? 'normal' : 'bold'},
      icon: 'format_bold',
      active: s['fontWeight'] === 'bold'
    },
    {
      value: {
        textDecoration: s['textDecoration'] === 'underline'
          ? 'none'
          : 'underline'
      },
      icon: 'format_underlined',
      active: s['textDecoration'] === 'underline'
    },
    {
      value: {fontStyle: s['fontStyle'] === 'italic' ? 'normal' : 'italic'},
      icon: 'format_italic',
      active: s['fontStyle'] === 'italic'
    }
  ]
  const insert = [
    {action: 'insert-table', icon: 'grid_on', title: 'Оформить как таблицу'},
    {action: 'chart-bar', icon: 'bar_chart', title: 'График: столбцы'},
    {action: 'chart-line', icon: 'show_chart', title: 'График: линия'},
    {action: 'chart-pie', icon: 'pie_chart', title: 'График: круговая'}
  ]
      .map(b => `
    <div class="button" data-action="${b.action}" title="${b.title}">
      <i class="material-icons" data-action="${b.action}">${b.icon}</i>
    </div>
  `)
      .join('')
  return buttons.map(toButton).join('') +
    `<div class="toolbar-sep"></div>` + insert
}
