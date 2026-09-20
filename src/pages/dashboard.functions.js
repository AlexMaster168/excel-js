import { storage, escapeHtml } from "../core/utils"

function toHTML(key){
    let model = null
    try {
        model = storage(key)
    } catch (e) {
        model = null // битый JSON в localStorage не должен ронять дашборд
    }
    // Ключ хранится как 'excel' + id (без двоеточия) — раньше split(':') давал undefined.
    const id = key.replace('excel', '')
    if(!model || typeof model !== 'object'){
        return ''
    }
    return `

    <li class="db__record">
        <a href="#excel/${encodeURIComponent(id)}">${escapeHtml(model.title)}</a>
        <strong>${new Date(model.openedDate).toLocaleDateString()}</strong>
    </li>
    `
}

function getAllKeys(){
    const keys = []
    for(let i = 0; i < localStorage.length; i++){
        const key = localStorage.key(i)
        if(!key.startsWith('excel')){
            continue
        }
        keys.push(key)
    }
    return keys
}

export function createRecordsTable(){
    const keys = getAllKeys()
    if(!keys.length){
        return `
        <p>Вы пока не создали ни одной таблицы</p>
        `
    }
    
    return`
    <div class="db__list-header">
        <span>Название</span>
        <span>Дата открытия</span>
      </div>

      <ul class="db__list">
        ${keys.map(toHTML).join('')}
      </ul>
    `
}