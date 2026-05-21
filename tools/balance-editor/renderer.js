let gameData = {};
let updatesData = [];
let currentTarget = 'player'; // 'player', 'updates', or enemy ID

document.addEventListener('DOMContentLoaded', async () => {
  const response = await window.api.getGameData();
  const updatesResponse = await window.api.getUpdatesData();
  
  if (response.success && updatesResponse.success) {
    gameData = response.data;
    updatesData = updatesResponse.data;
    initNav();
    renderEditor();
  } else {
    const errorMsg = !response.success ? response.error : updatesResponse.error;
    document.getElementById('editor-container').innerHTML = `<div class="status-msg error">Failed to load data: ${errorMsg}</div>`;
  }

  document.getElementById('save-btn').addEventListener('click', saveAndPush);
});

function initNav() {
  const playerNav = document.getElementById('player-nav');
  playerNav.addEventListener('click', (e) => {
    if (e.target.tagName === 'LI') {
      clearNavActive();
      e.target.classList.add('active');
      currentTarget = 'player';
      renderEditor();
    }
  });

  const enemiesNav = document.getElementById('enemies-nav');
  const enemyIds = Object.keys(gameData.enemies).sort();
  
  enemyIds.forEach(id => {
    const li = document.createElement('li');
    li.dataset.target = id;
    li.textContent = gameData.enemies[id].name || id;
    enemiesNav.appendChild(li);
  });

  enemiesNav.addEventListener('click', (e) => {
    if (e.target.tagName === 'LI') {
      clearNavActive();
      e.target.classList.add('active');
      currentTarget = e.target.dataset.target;
      renderEditor();
    }
  });

  const updatesNav = document.getElementById('updates-nav');
  updatesNav.addEventListener('click', (e) => {
    if (e.target.tagName === 'LI') {
      clearNavActive();
      e.target.classList.add('active');
      currentTarget = 'updates';
      renderEditor();
    }
  });
}

function clearNavActive() {
  document.querySelectorAll('.nav-section li').forEach(li => li.classList.remove('active'));
}

function renderEditor() {
  const container = document.getElementById('editor-container');
  container.innerHTML = ''; // Clear

  if (currentTarget === 'player') {
    if (!gameData.player) {
      gameData.player = { hp: 100, speed: 5, skills: {} }; // Fallback
    }
    container.appendChild(buildFormSection('Base Stats', gameData.player, ['hp', 'speed', 'attackCooldownMs', 'projectileSpeed', 'projectileLifetime', 'hitboxRadius']));
    container.appendChild(buildFormSection('Leveling', gameData.player, ['xpToFirstLevel', 'xpMultiplier', 'levelHpMultiplier', 'upgradeLevels']));
    
    if (gameData.player.skills) {
      container.appendChild(buildNestedObjectForm('Skills', gameData.player.skills));
    }
  } else if (currentTarget === 'updates') {
    renderUpdatesManager();
  } else {
    // Enemy
    const enemy = gameData.enemies[currentTarget];
    container.appendChild(buildFormSection('Enemy Identity', enemy, ['id', 'name', 'category']));
    container.appendChild(buildFormSection('Base Stats', enemy.stats, Object.keys(enemy.stats)));
    if (enemy.scaling) {
      container.appendChild(buildFormSection('Scaling Per Level', enemy.scaling, Object.keys(enemy.scaling)));
    }
    if (enemy.ai) {
      container.appendChild(buildFormSection('AI Profile', enemy.ai, ['profile', 'aggroRange', 'retreatRange', 'idealRange']));
    }
    if (enemy.spawn) {
      container.appendChild(buildFormSection('Spawn Configuration', enemy.spawn, Object.keys(enemy.spawn)));
    }
  }
}

function buildFormSection(title, dataObj, fields) {
  const section = document.createElement('div');
  section.className = 'form-section';
  
  const h2 = document.createElement('h2');
  h2.textContent = title;
  section.appendChild(h2);

  fields.forEach(field => {
    if (dataObj[field] !== undefined) {
      section.appendChild(buildInput(field, dataObj[field], (val) => {
        dataObj[field] = val;
      }));
    }
  });

  return section;
}

function buildNestedObjectForm(title, parentObj) {
  const section = document.createElement('div');
  section.className = 'form-section';
  
  const h2 = document.createElement('h2');
  h2.textContent = title;
  section.appendChild(h2);

  for (const [key, obj] of Object.entries(parentObj)) {
    const nested = document.createElement('div');
    nested.className = 'nested-section';
    const h4 = document.createElement('h4');
    h4.textContent = key.toUpperCase();
    nested.appendChild(h4);

    for (const [subKey, val] of Object.entries(obj)) {
      if (typeof val !== 'object') {
        nested.appendChild(buildInput(subKey, val, (newVal) => {
          obj[subKey] = newVal;
        }));
      }
    }
    section.appendChild(nested);
  }

  return section;
}

function buildInput(labelStr, value, onChange) {
  const group = document.createElement('div');
  group.className = 'form-group';

  const label = document.createElement('label');
  label.textContent = labelStr;
  group.appendChild(label);

  const isArray = Array.isArray(value);
  const type = typeof value;

  let input;
  
  if (type === 'boolean') {
    input = document.createElement('select');
    const optTrue = document.createElement('option'); optTrue.value = 'true'; optTrue.text = 'true';
    const optFalse = document.createElement('option'); optFalse.value = 'false'; optFalse.text = 'false';
    input.appendChild(optTrue); input.appendChild(optFalse);
    input.value = value.toString();
    input.addEventListener('change', (e) => onChange(e.target.value === 'true'));
  } else if (isArray) {
    input = document.createElement('input');
    input.type = 'text';
    input.value = value.join(', ');
    input.addEventListener('change', (e) => {
      const arr = e.target.value.split(',').map(s => {
        const trimmed = s.trim();
        return isNaN(Number(trimmed)) ? trimmed : Number(trimmed);
      });
      onChange(arr);
    });
  } else {
    input = document.createElement('input');
    input.type = type === 'number' ? 'number' : 'text';
    if (type === 'number') input.step = 'any';
    input.value = value;
    input.addEventListener('change', (e) => {
      let val = e.target.value;
      if (type === 'number') val = Number(val);
      onChange(val);
    });
  }

  group.appendChild(input);
  return group;
}

function renderUpdatesManager() {
  const container = document.getElementById('editor-container');
  container.innerHTML = '';

  const section = document.createElement('div');
  section.className = 'form-section';
  
  const header = document.createElement('div');
  header.style.display = 'flex';
  header.style.justifyContent = 'space-between';
  header.style.alignItems = 'center';
  header.style.marginBottom = '20px';
  header.style.borderBottom = '1px solid var(--border)';
  header.style.paddingBottom = '10px';

  const h2 = document.createElement('h2');
  h2.textContent = 'Game Updates & News';
  h2.style.border = 'none';
  h2.style.margin = '0';
  h2.style.padding = '0';
  header.appendChild(h2);

  const addBtn = document.createElement('button');
  addBtn.className = 'save-btn';
  addBtn.style.margin = '0';
  addBtn.style.padding = '8px 16px';
  addBtn.innerHTML = '⚡ Add Update';
  addBtn.addEventListener('click', () => showUpdateForm());
  header.appendChild(addBtn);

  section.appendChild(header);

  if (!updatesData || updatesData.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.style.padding = '40px 0';
    empty.textContent = 'No updates recorded. Click "Add Update" to create one.';
    section.appendChild(empty);
  } else {
    const tableContainer = document.createElement('div');
    tableContainer.style.overflowX = 'auto';

    const table = document.createElement('table');
    table.className = 'updates-table';

    const thead = document.createElement('thead');
    thead.innerHTML = `
      <tr>
        <th>Date</th>
        <th>Type</th>
        <th>Target</th>
        <th>Description</th>
        <th style="text-align: center; width: 120px;">Actions</th>
      </tr>
    `;
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    const sortedUpdates = [...updatesData].sort((a, b) => new Date(b.date) - new Date(a.date));

    sortedUpdates.forEach(update => {
      const tr = document.createElement('tr');
      const d = new Date(update.date);
      const dateStr = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
      
      const typeClass = (update.type || '').toLowerCase();
      
      tr.innerHTML = `
        <td style="white-space: nowrap; color: var(--text-muted);">${dateStr}</td>
        <td><span class="badge badge-${typeClass}">${update.type}</span></td>
        <td style="font-weight: 600; color: #fff;">${update.target}</td>
        <td style="color: var(--text-muted); max-width: 300px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${update.description}</td>
        <td style="text-align: center;">
          <button class="action-btn edit-btn" data-id="${update.id}">Edit</button>
          <button class="action-btn delete-btn" data-id="${update.id}">Delete</button>
        </td>
      `;

      tr.querySelector('.edit-btn').addEventListener('click', () => showUpdateForm(update));
      tr.querySelector('.delete-btn').addEventListener('click', () => deleteUpdate(update.id));

      tbody.appendChild(tr);
    });

    table.appendChild(tbody);
    tableContainer.appendChild(table);
    section.appendChild(tableContainer);
  }

  container.appendChild(section);
}

function showUpdateForm(editItem = null) {
  const container = document.getElementById('editor-container');
  container.innerHTML = '';

  const section = document.createElement('div');
  section.className = 'form-section';

  const h2 = document.createElement('h2');
  h2.textContent = editItem ? 'Edit Update Entry' : 'New Update Entry';
  section.appendChild(h2);

  const form = document.createElement('form');
  form.id = 'update-form';
  form.style.display = 'flex';
  form.style.flexDirection = 'column';
  form.style.gap = '15px';

  const dateVal = editItem ? editItem.date : new Date().toISOString();
  form.appendChild(buildFormGroup('Date (ISO)', 'date', 'text', dateVal, 'e.g. 2026-05-21T21:40:00.000Z'));

  const typeGroup = document.createElement('div');
  typeGroup.className = 'form-group';
  typeGroup.innerHTML = `
    <label>Type</label>
    <select id="update-type" style="width: 100%;">
      <option value="Buff">Buff</option>
      <option value="Nerf">Nerf</option>
      <option value="Novidade">Novidade</option>
      <option value="Ajuste">Ajuste</option>
      <option value="Correção">Correção</option>
    </select>
  `;
  form.appendChild(typeGroup);
  if (editItem) {
    typeGroup.querySelector('select').value = editItem.type;
  }

  const targetVal = editItem ? editItem.target : '';
  form.appendChild(buildFormGroup('Target / Object', 'target', 'text', targetVal, 'e.g. Player, Lich King, Geral'));

  const descGroup = document.createElement('div');
  descGroup.className = 'form-group';
  descGroup.style.alignItems = 'start';
  descGroup.innerHTML = `
    <label>Description</label>
    <textarea id="update-description" rows="5" style="
      background-color: var(--bg-input);
      border: 1px solid var(--border);
      color: var(--text-main);
      padding: 10px 15px;
      border-radius: 6px;
      font-family: inherit;
      font-size: 0.95rem;
      width: 100%;
      resize: vertical;
    " placeholder="Describe the changes (e.g. Reduzido cooldown de 5s para 4s)"></textarea>
  `;
  if (editItem) {
    descGroup.querySelector('textarea').value = editItem.description;
  }
  form.appendChild(descGroup);

  const actions = document.createElement('div');
  actions.style.display = 'flex';
  actions.style.gap = '10px';
  actions.style.marginTop = '10px';

  const saveBtn = document.createElement('button');
  saveBtn.type = 'button';
  saveBtn.className = 'save-btn';
  saveBtn.style.margin = '0';
  saveBtn.textContent = editItem ? 'Update' : 'Add';
  saveBtn.addEventListener('click', () => {
    const date = document.getElementById('update-date').value;
    const type = document.getElementById('update-type').value;
    const target = document.getElementById('update-target').value;
    const description = document.getElementById('update-description').value;

    if (!target || !description) {
      alert('Please fill in both Target and Description!');
      return;
    }

    if (editItem) {
      const idx = updatesData.findIndex(u => u.id === editItem.id);
      if (idx !== -1) {
        updatesData[idx] = { ...editItem, date, type, target, description };
      }
    } else {
      updatesData.push({
        id: Date.now().toString(),
        date,
        type,
        target,
        description
      });
    }

    renderUpdatesManager();
  });
  actions.appendChild(saveBtn);

  const cancelBtn = document.createElement('button');
  cancelBtn.type = 'button';
  cancelBtn.className = 'action-btn';
  cancelBtn.style.background = '#475569';
  cancelBtn.style.color = '#fff';
  cancelBtn.style.padding = '10px 20px';
  cancelBtn.style.border = 'none';
  cancelBtn.style.borderRadius = '6px';
  cancelBtn.style.cursor = 'pointer';
  cancelBtn.textContent = 'Cancel';
  cancelBtn.addEventListener('click', () => {
    renderUpdatesManager();
  });
  actions.appendChild(cancelBtn);

  form.appendChild(actions);
  section.appendChild(form);
  container.appendChild(section);
}

function buildFormGroup(labelStr, id, type, value, placeholder = '') {
  const group = document.createElement('div');
  group.className = 'form-group';
  group.innerHTML = `
    <label>${labelStr}</label>
    <input type="${type}" id="update-${id}" value="${value}" placeholder="${placeholder}" style="width: 100%;"/>
  `;
  return group;
}

function deleteUpdate(id) {
  if (confirm('Are you sure you want to delete this update entry?')) {
    updatesData = updatesData.filter(u => u.id !== id);
    renderUpdatesManager();
  }
}

async function saveAndPush() {
  const statusMsg = document.getElementById('status-msg');
  statusMsg.textContent = 'Saving and pushing to GitHub...';
  statusMsg.className = 'status-msg loading';
  
  const gameDataStr = JSON.stringify(gameData, null, 2);
  const updatesDataStr = JSON.stringify(updatesData, null, 2);
  const response = await window.api.saveAllData(gameDataStr, updatesDataStr);
  
  if (response.success) {
    statusMsg.textContent = response.message || response.warning;
    statusMsg.className = 'status-msg success';
  } else {
    statusMsg.textContent = `Error: ${response.error}`;
    statusMsg.className = 'status-msg error';
  }

  setTimeout(() => {
    if (statusMsg.className.includes('success')) {
      statusMsg.textContent = '';
    }
  }, 5000);
}
