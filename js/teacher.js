// Teacher authoring panel. Lists packs, edits questions, imports/exports JSON.

const Teacher = {
  selectedPackId: null,

  open() {
    document.getElementById('content-modal').classList.remove('hidden');
    if (!this.selectedPackId) this.selectedPackId = Packs.getActiveId();
    this.renderPackList();
    this.renderEditor();
  },

  close() {
    document.getElementById('content-modal').classList.add('hidden');
    App.refreshActivePackBar();
  },

  newPack() {
    const pack = Packs.newCustomPack('My Course Pack');
    pack.questions.push({ type: 'mc', prompt: 'Sample: 2 + 2 = ?', options: ['3', '4', '5', '6'], answerIdx: 1 });
    Packs.upsert(pack);
    this.selectedPackId = pack.id;
    this.renderPackList();
    this.renderEditor();
  },

  _subjectIcon(subject) {
    const s = (subject || '').toLowerCase();
    if (s.includes('math')) return { icon: '🧮', tint: 'sky' };
    if (s.includes('engl') || s.includes('lang') || s.includes('vocab') || s.includes('read')) return { icon: '📖', tint: 'amber' };
    if (s.includes('sci') || s.includes('bio') || s.includes('chem') || s.includes('phys')) return { icon: '🔬', tint: 'emerald' };
    if (s.includes('hist') || s.includes('social')) return { icon: '🏛️', tint: 'rose' };
    if (s.includes('art') || s.includes('music')) return { icon: '🎨', tint: 'violet' };
    if (s.includes('code') || s.includes('cs') || s.includes('comput')) return { icon: '💻', tint: 'cyan' };
    return { icon: '📚', tint: 'slate' };
  },

  renderPackList() {
    const list = document.getElementById('pack-list-items');
    list.innerHTML = '';
    const activeId = Packs.getActiveId();
    Packs.loadAll().forEach((p) => {
      const div = document.createElement('div');
      div.className = 'pack-list-item' + (p.id === this.selectedPackId ? ' selected' : '');
      const isActive = p.id === activeId;
      const { icon, tint } = this._subjectIcon(p.subject);
      div.dataset.tint = tint;
      div.innerHTML = `
        <div class="pack-list-icon tint-${tint}">${icon}</div>
        <div class="pack-list-main">
          <div class="pack-list-name">
            <span>${App.escape(p.name)}</span>
            ${isActive ? '<span class="pack-active-tag">● in use</span>' : ''}
          </div>
          <div class="pack-list-meta">
            <span>${App.escape(p.subject || 'General')}</span>
            <span class="dot-sep">·</span>
            <span>${p.questions.length} ${p.questions.length === 1 ? 'question' : 'questions'}</span>
            ${p.builtin ? '<span class="builtin-chip">built-in</span>' : ''}
          </div>
        </div>
      `;
      div.onclick = () => {
        this.selectedPackId = p.id;
        this.renderPackList();
        this.renderEditor();
      };
      list.appendChild(div);
    });
  },

  renderEditor() {
    const editor = document.getElementById('pack-editor');
    if (!this.selectedPackId) {
      editor.innerHTML = `
        <div class="pack-editor-empty">
          <div class="empty-icon">📚</div>
          <h3>Select a pack to view or edit</h3>
          <p>Pick a built-in pack on the left, or create a new one to author your own course questions.</p>
        </div>`;
      return;
    }
    const pack = Packs.getById(this.selectedPackId);
    const readonly = !!pack.builtin;
    const activeId = Packs.getActiveId();
    const isActive = pack.id === activeId;
    const { icon, tint } = this._subjectIcon(pack.subject);

    const typeCounts = pack.questions.reduce((acc, q) => { acc[q.type] = (acc[q.type] || 0) + 1; return acc; }, {});
    const typeLabel = {
      'mc': 'Multiple Choice', 'short': 'Short Answer', 'number': 'Number', 'gen-mult': 'Auto-Mult'
    };
    const typeBadges = Object.keys(typeCounts).map(t =>
      `<span class="type-badge type-${t}">${typeLabel[t] || t} · ${typeCounts[t]}</span>`
    ).join('');

    editor.innerHTML = `
      <div class="editor-hero tint-${tint}">
        <div class="editor-hero-icon">${icon}</div>
        <div class="editor-hero-text">
          <input class="pack-name-input" id="pack-name" placeholder="Pack name" value="${App.escape(pack.name)}" ${readonly ? 'disabled' : ''} />
          <div class="editor-hero-meta">
            <input class="pack-subject-input" id="pack-subject" placeholder="Subject (e.g. Algebra II)" value="${App.escape(pack.subject || '')}" ${readonly ? 'disabled' : ''} />
            ${isActive ? '<span class="active-chip">● Currently in use</span>' : ''}
            ${readonly ? '<span class="builtin-chip large">built-in · read-only</span>' : ''}
          </div>
          <input class="pack-desc-input" id="pack-description" placeholder="Short description (visible to other teachers)" value="${App.escape(pack.description || '')}" ${readonly ? 'disabled' : ''} />
        </div>
      </div>

      <div class="editor-stats">
        <div class="stat-card">
          <div class="stat-num">${pack.questions.length}</div>
          <div class="stat-label">Question${pack.questions.length === 1 ? '' : 's'}</div>
        </div>
        <div class="stat-types">${typeBadges || '<span class="muted">No questions yet</span>'}</div>
        <div class="editor-actions">
          <button id="use-pack-btn" class="big-btn ${isActive ? '' : 'primary'}" type="button" ${isActive ? 'disabled' : ''}>${isActive ? '✓ In Use' : '✓ Use This Pack'}</button>
          <button id="export-pack-btn" class="ghost-btn small" type="button">⬆ Export</button>
          ${readonly ? '' : '<button id="delete-pack-btn" type="button" class="ghost-btn small danger">🗑 Delete</button>'}
        </div>
      </div>

      <div class="question-list-header">
        <h3>Questions</h3>
        ${readonly ? '' : `
          <div class="quick-add-row">
            <span class="quick-add-label">Quick add:</span>
            <button class="chip-btn" type="button" data-add="mc">+ Multiple Choice</button>
            <button class="chip-btn" type="button" data-add="short">+ Short Answer</button>
            <button class="chip-btn" type="button" data-add="number">+ Number</button>
            <button class="chip-btn" type="button" data-add="gen-mult">+ Auto-Math</button>
          </div>`}
      </div>

      <div id="question-list"></div>

      ${pack.questions.length === 0 && !readonly ? `
        <div class="empty-questions">
          <div class="empty-icon">✏️</div>
          <h4>No questions yet</h4>
          <p>Click any "+ Quick add" button above, or use the buttons below to start.</p>
        </div>` : ''}

      ${readonly ? `
        <button id="duplicate-pack-btn" type="button" class="big-btn primary">📋 Duplicate to customize this pack</button>
      ` : ''}
    `;

    this.renderQuestions(pack, readonly);

    document.getElementById('use-pack-btn').onclick = () => this.useSelected();
    document.getElementById('export-pack-btn').onclick = () => this.exportSelected();
    if (readonly) {
      document.getElementById('duplicate-pack-btn').onclick = () => this.duplicateSelected();
    } else {
      const delBtn = document.getElementById('delete-pack-btn');
      if (delBtn) delBtn.onclick = () => this.deleteSelected();
      editor.querySelectorAll('.chip-btn[data-add]').forEach(b => {
        b.onclick = () => this.addQuestion(b.dataset.add);
      });
      ['pack-name', 'pack-subject', 'pack-description'].forEach(id => {
        document.getElementById(id).addEventListener('input', () => this.saveMeta());
      });
    }
  },

  _typeMeta(type) {
    return {
      'mc':       { label: 'Multiple Choice', icon: '◧', color: 'mc' },
      'short':    { label: 'Short Answer',    icon: '✎', color: 'short' },
      'number':   { label: 'Number',          icon: '#', color: 'number' },
      'gen-mult': { label: 'Auto-Math',       icon: '×', color: 'gen' },
    }[type] || { label: type, icon: '?', color: 'mc' };
  },

  renderQuestions(pack, readonly) {
    const list = document.getElementById('question-list');
    list.innerHTML = '';
    pack.questions.forEach((q, i) => {
      const meta = this._typeMeta(q.type);
      const row = document.createElement('div');
      row.className = 'qcard qcard-' + meta.color;
      row.innerHTML = `
        <div class="qcard-rail">
          <span class="qcard-num">${i + 1}</span>
          <span class="qcard-type-icon" title="${meta.label}">${meta.icon}</span>
        </div>
        <div class="qcard-body">
          <div class="qcard-header">
            <select class="q-type" data-i="${i}" ${readonly ? 'disabled' : ''}>
              <option value="mc" ${q.type === 'mc' ? 'selected' : ''}>◧ Multiple Choice</option>
              <option value="short" ${q.type === 'short' ? 'selected' : ''}>✎ Short Answer</option>
              <option value="number" ${q.type === 'number' ? 'selected' : ''}>#  Number</option>
              <option value="gen-mult" ${q.type === 'gen-mult' ? 'selected' : ''}>× Auto-Multiplication</option>
            </select>
            ${readonly ? '' : `
              <div class="qcard-actions">
                <button type="button" class="icon-btn q-move-up" data-i="${i}" title="Move up">↑</button>
                <button type="button" class="icon-btn q-move-dn" data-i="${i}" title="Move down">↓</button>
                <button type="button" class="icon-btn danger q-remove" data-i="${i}" title="Remove">✕</button>
              </div>`}
          </div>
          <div class="question-row-body" id="q-body-${i}"></div>
        </div>
      `;
      list.appendChild(row);
      this.renderQuestionBody(pack, q, i, readonly);
    });

    if (!readonly) {
      list.querySelectorAll('.q-type').forEach(sel => {
        sel.onchange = (e) => this.changeType(parseInt(e.target.dataset.i), e.target.value);
      });
      list.querySelectorAll('.q-remove').forEach(btn => {
        btn.onclick = (e) => this.removeQuestion(parseInt(e.currentTarget.dataset.i));
      });
      list.querySelectorAll('.q-move-up').forEach(btn => {
        btn.onclick = (e) => this.moveQuestion(parseInt(e.currentTarget.dataset.i), -1);
      });
      list.querySelectorAll('.q-move-dn').forEach(btn => {
        btn.onclick = (e) => this.moveQuestion(parseInt(e.currentTarget.dataset.i), 1);
      });
    }
  },

  renderQuestionBody(pack, q, i, readonly) {
    const body = document.getElementById(`q-body-${i}`);
    const disabled = readonly ? 'disabled' : '';
    if (q.type === 'mc') {
      body.innerHTML = `
        <label class="field-label">Question</label>
        <textarea class="q-prompt" rows="2" data-i="${i}" placeholder="What's the question?" ${disabled}>${App.escape(q.prompt || '')}</textarea>
        <label class="field-label">Options <span class="muted">— click the circle to mark correct</span></label>
        <div class="mc-options-stack">
          ${[0,1,2,3].map(j => {
            const isCorrect = q.answerIdx === j;
            return `
              <div class="mc-edit-row ${isCorrect ? 'is-correct' : ''}">
                <button type="button" class="mc-correct-btn ${isCorrect ? 'on' : ''}" data-i="${i}" data-j="${j}" title="Mark as correct">
                  <span class="mc-letter-pill">${'ABCD'[j]}</span>
                  <span class="mc-check">${isCorrect ? '✓' : ''}</span>
                </button>
                <input class="q-option" data-i="${i}" data-j="${j}" placeholder="Option ${'ABCD'[j]}" value="${App.escape((q.options && q.options[j]) || '')}" ${disabled} />
              </div>`;
          }).join('')}
        </div>
      `;
    } else if (q.type === 'short') {
      body.innerHTML = `
        <label class="field-label">Question</label>
        <textarea class="q-prompt" rows="2" data-i="${i}" placeholder="What's the question?" ${disabled}>${App.escape(q.prompt || '')}</textarea>
        <label class="field-label">Correct answer <span class="muted">— case & spaces ignored</span></label>
        <input class="q-answer" data-i="${i}" placeholder="e.g. mitochondria" value="${App.escape(q.answer || '')}" ${disabled} />
      `;
    } else if (q.type === 'number') {
      body.innerHTML = `
        <label class="field-label">Question</label>
        <textarea class="q-prompt" rows="2" data-i="${i}" placeholder="What's the question?" ${disabled}>${App.escape(q.prompt || '')}</textarea>
        <label class="field-label">Correct answer</label>
        <input class="q-answer" type="number" data-i="${i}" placeholder="A number" value="${q.answer != null ? q.answer : ''}" ${disabled} />
      `;
    } else if (q.type === 'gen-mult') {
      body.innerHTML = `
        <div class="auto-math-note">
          <span class="auto-math-icon">×</span>
          <div>
            <strong>Auto-generated multiplication</strong>
            <p>Each gate gets a fresh <em>a × b</em> problem in the range you set.</p>
          </div>
        </div>
        <div class="range-row">
          <label class="range-field">
            <span>Min factor</span>
            <input class="q-rmin" type="number" data-i="${i}" value="${q.range ? q.range.min : 3}" ${disabled} />
          </label>
          <label class="range-field">
            <span>Max factor</span>
            <input class="q-rmax" type="number" data-i="${i}" value="${q.range ? q.range.max : 7}" ${disabled} />
          </label>
        </div>
      `;
    }

    if (readonly) return;

    body.querySelectorAll('.q-prompt').forEach(el => el.addEventListener('input', (e) => this.updateField(parseInt(e.target.dataset.i), 'prompt', e.target.value)));
    body.querySelectorAll('.q-answer').forEach(el => el.addEventListener('input', (e) => this.updateField(parseInt(e.target.dataset.i), 'answer', e.target.value)));
    body.querySelectorAll('.q-option').forEach(el => el.addEventListener('input', (e) => this.updateOption(parseInt(e.target.dataset.i), parseInt(e.target.dataset.j), e.target.value)));
    body.querySelectorAll('.mc-correct-btn').forEach(el => el.addEventListener('click', (e) => {
      const btn = e.currentTarget;
      this.updateField(parseInt(btn.dataset.i), 'answerIdx', parseInt(btn.dataset.j));
      this.renderQuestionBody(pack, pack.questions[parseInt(btn.dataset.i)], parseInt(btn.dataset.i), false);
    }));
    body.querySelectorAll('.q-rmin').forEach(el => el.addEventListener('input', (e) => this.updateRange(parseInt(e.target.dataset.i), 'min', parseInt(e.target.value))));
    body.querySelectorAll('.q-rmax').forEach(el => el.addEventListener('input', (e) => this.updateRange(parseInt(e.target.dataset.i), 'max', parseInt(e.target.value))));
  },

  moveQuestion(i, dir) {
    this._mutateSelected((pack) => {
      const j = i + dir;
      if (j < 0 || j >= pack.questions.length) return;
      const tmp = pack.questions[i];
      pack.questions[i] = pack.questions[j];
      pack.questions[j] = tmp;
    });
    this.renderEditor();
  },

  _mutateSelected(fn) {
    const pack = Packs.getById(this.selectedPackId);
    if (pack.builtin) return;
    fn(pack);
    Packs.upsert(pack);
  },

  saveMeta() {
    this._mutateSelected((pack) => {
      pack.name = document.getElementById('pack-name').value;
      pack.subject = document.getElementById('pack-subject').value;
      pack.description = document.getElementById('pack-description').value;
    });
    this.renderPackList();
  },

  addQuestion(type) {
    type = type || 'mc';
    this._mutateSelected((pack) => {
      if (type === 'mc') pack.questions.push({ type: 'mc', prompt: '', options: ['', '', '', ''], answerIdx: 0 });
      else if (type === 'short') pack.questions.push({ type: 'short', prompt: '', answer: '' });
      else if (type === 'number') pack.questions.push({ type: 'number', prompt: '', answer: 0 });
      else if (type === 'gen-mult') pack.questions.push({ type: 'gen-mult', range: { min: 3, max: 7 } });
    });
    this.renderEditor();
  },

  removeQuestion(i) {
    this._mutateSelected((pack) => { pack.questions.splice(i, 1); });
    this.renderEditor();
  },

  changeType(i, type) {
    this._mutateSelected((pack) => {
      const old = pack.questions[i];
      if (type === 'mc') pack.questions[i] = { type, prompt: old.prompt || '', options: ['', '', '', ''], answerIdx: 0 };
      else if (type === 'short') pack.questions[i] = { type, prompt: old.prompt || '', answer: '' };
      else if (type === 'number') pack.questions[i] = { type, prompt: old.prompt || '', answer: 0 };
      else if (type === 'gen-mult') pack.questions[i] = { type, range: { min: 3, max: 7 } };
    });
    this.renderEditor();
  },

  updateField(i, field, value) {
    this._mutateSelected((pack) => { pack.questions[i][field] = value; });
    this.renderPackList();
  },

  updateOption(i, j, value) {
    this._mutateSelected((pack) => {
      pack.questions[i].options = pack.questions[i].options || ['', '', '', ''];
      pack.questions[i].options[j] = value;
    });
  },

  updateRange(i, key, value) {
    this._mutateSelected((pack) => {
      pack.questions[i].range = pack.questions[i].range || { min: 3, max: 7 };
      pack.questions[i].range[key] = value;
    });
  },

  useSelected() {
    Packs.setActiveId(this.selectedPackId);
    Packs.setSessionPack(Packs.getById(this.selectedPackId));
    this.renderPackList();
    this.renderEditor();
    App.refreshActivePackBar();
    SFX.correct();
  },

  exportSelected() {
    const pack = Packs.getById(this.selectedPackId);
    const blob = new Blob([Packs.exportJson(pack)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(pack.name || 'pack').toLowerCase().replace(/\s+/g, '-')}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 200);
  },

  deleteSelected() {
    const pack = Packs.getById(this.selectedPackId);
    if (pack.builtin) return;
    if (!confirm(`Delete pack "${pack.name}"? This cannot be undone.`)) return;
    Packs.remove(this.selectedPackId);
    this.selectedPackId = Packs.defaults[0].id;
    this.renderPackList();
    this.renderEditor();
  },

  duplicateSelected() {
    const orig = Packs.getById(this.selectedPackId);
    const copy = JSON.parse(JSON.stringify(orig));
    copy.id = 'custom-' + Date.now().toString(36);
    copy.name = orig.name + ' (Copy)';
    copy.builtin = false;
    Packs.upsert(copy);
    this.selectedPackId = copy.id;
    this.renderPackList();
    this.renderEditor();
  },

  handleImport(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const pack = Packs.importJson(ev.target.result);
        Packs.upsert(pack);
        this.selectedPackId = pack.id;
        this.renderPackList();
        this.renderEditor();
      } catch (err) {
        alert('Import failed: ' + err.message);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  },
};
