let gameData = {};
let currentTarget = 'player'; // 'player' or enemy ID

document.addEventListener('DOMContentLoaded', async () => {
  const response = await window.api.getGameData();
  if (response.success) {
    gameData = response.data;
    initNav();
    renderEditor();
  } else {
    document.getElementById('editor-container').innerHTML = `<div class="status-msg error">Failed to load data: ${response.error}</div>`;
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
  // Sort enemies by category or alphabetically
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

async function saveAndPush() {
  const statusMsg = document.getElementById('status-msg');
  statusMsg.textContent = 'Saving and pushing to GitHub...';
  statusMsg.className = 'status-msg loading';
  
  const jsonStr = JSON.stringify(gameData, null, 2);
  const response = await window.api.saveGameData(jsonStr);
  
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
