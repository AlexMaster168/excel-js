import { storage } from "../core/utils"

function toHTML(key){
    const model = storage(key)
    // Ключ хранится как 'excel' + id (без двоеточия) — раньше split(':') давал undefined.
    const id = key.replace('excel', '')
    if(!model){
        return ''
    }
    return `

    <li class="db__record">
        <a href="#excel/${id}">${model.title}</a>
        <strong>${new Date(model.openedDate).toLocaleDateString()}</strong>
    </li>
    `
}

function getAllKeys(){
    const keys = []
    for(let i = 0; i < localStorage.length; i++){
        const key = localStorage.key(i)
        if(!key.includes('excel')){
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