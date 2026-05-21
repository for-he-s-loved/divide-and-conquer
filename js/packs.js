// Content packs: questions teachers can author and load into the game.
// Pack format:
//   { id, name, subject, description, builtin?, questions: [Question] }
// Question types:
//   { type: 'mc',     prompt, options: [str,str,str,str], answerIdx: 0..3 }
//   { type: 'short',  prompt, answer: 'string' (case/space-insensitive match) }
//   { type: 'number', prompt, answer: number }
//   { type: 'gen-mult', range: {min, max} }   // legacy auto-generated multiplication

const Packs = {
  STORAGE_KEY: 'dac_packs_v1',
  ACTIVE_KEY: 'dac_active_pack',

  defaults: [
    {
      id: 'builtin-mult',
      name: 'Multiplication Drills',
      subject: 'Math',
      description: 'Auto-generated multiplication, scales per round.',
      builtin: true,
      questions: [
        { type: 'gen-mult', range: { min: 3, max: 6 } },
        { type: 'gen-mult', range: { min: 5, max: 9 } },
        { type: 'gen-mult', range: { min: 7, max: 12 } },
      ],
    },
    {
      id: 'builtin-vocab',
      name: 'SAT Vocabulary',
      subject: 'English',
      description: 'Pick the best definition. Great for English / reading prep.',
      builtin: true,
      questions: [
        { type: 'mc', prompt: 'Ephemeral means:', options: ['Lasting forever', 'Short-lived', 'Very loud', 'Sharply cold'], answerIdx: 1 },
        { type: 'mc', prompt: 'Ubiquitous means:', options: ['Found everywhere', 'Extremely rare', 'Highly toxic', 'Easily broken'], answerIdx: 0 },
        { type: 'mc', prompt: 'Pragmatic means:', options: ['Dreamy', 'Practical', 'Dishonest', 'Generous'], answerIdx: 1 },
        { type: 'mc', prompt: 'Mitigate means:', options: ['Worsen', 'Lessen', 'Confuse', 'Repeat'], answerIdx: 1 },
        { type: 'mc', prompt: 'Candid means:', options: ['Sweet', 'Honest', 'Concealed', 'Angry'], answerIdx: 1 },
        { type: 'mc', prompt: 'Lucid means:', options: ['Clear', 'Lucky', 'Bright red', 'Hostile'], answerIdx: 0 },
        { type: 'mc', prompt: 'Resilient means:', options: ['Fragile', 'Stubborn', 'Bouncing back', 'Stretched'], answerIdx: 2 },
        { type: 'mc', prompt: 'Verbose means:', options: ['Using too few words', 'Using too many words', 'Speaking quietly', 'Speaking truthfully'], answerIdx: 1 },
        { type: 'mc', prompt: 'Ambiguous means:', options: ['Clearly stated', 'Two-handed', 'Open to interpretation', 'Highly skilled'], answerIdx: 2 },
        { type: 'mc', prompt: 'Tenacious means:', options: ['Easily distracted', 'Persistent', 'Tightly woven', 'Tender'], answerIdx: 1 },
      ],
    },
    {
      id: 'builtin-science',
      name: 'Science Quick Facts',
      subject: 'Science',
      description: 'High-school biology, chemistry, and physics basics.',
      builtin: true,
      questions: [
        { type: 'mc', prompt: 'The powerhouse of the cell is the:', options: ['Nucleus', 'Mitochondria', 'Ribosome', 'Vacuole'], answerIdx: 1 },
        { type: 'mc', prompt: 'Water\'s chemical formula:', options: ['H₂O', 'CO₂', 'O₂', 'HO'], answerIdx: 0 },
        { type: 'number', prompt: 'How many planets in our solar system?', answer: 8 },
        { type: 'mc', prompt: 'Force = mass × ?', options: ['Velocity', 'Acceleration', 'Time', 'Distance'], answerIdx: 1 },
        { type: 'mc', prompt: 'DNA stands for:', options: ['Deoxyribonucleic acid', 'Diatomic nucleic acid', 'Dual nucleus assembly', 'Deep neural array'], answerIdx: 0 },
        { type: 'short', prompt: 'The closest star to Earth (one word):', answer: 'sun' },
        { type: 'mc', prompt: 'Sound travels fastest through:', options: ['Air', 'Water', 'Steel', 'Vacuum'], answerIdx: 2 },
        { type: 'number', prompt: 'Boiling point of water in °C:', answer: 100 },
        { type: 'mc', prompt: 'pH of a neutral solution:', options: ['0', '7', '14', '1'], answerIdx: 1 },
        { type: 'short', prompt: 'The chemical symbol for gold:', answer: 'au' },
      ],
    },
    {
      id: 'builtin-history',
      name: 'US History Snapshot',
      subject: 'History',
      description: 'Foundational US history facts.',
      builtin: true,
      questions: [
        { type: 'number', prompt: 'Year the Declaration of Independence was signed:', answer: 1776 },
        { type: 'mc', prompt: 'First US President:', options: ['John Adams', 'Thomas Jefferson', 'George Washington', 'Ben Franklin'], answerIdx: 2 },
        { type: 'mc', prompt: 'The Civil War ended in:', options: ['1812', '1865', '1898', '1945'], answerIdx: 1 },
        { type: 'mc', prompt: 'Author of the Declaration:', options: ['Jefferson', 'Madison', 'Hamilton', 'Adams'], answerIdx: 0 },
        { type: 'number', prompt: 'How many original colonies?', answer: 13 },
        { type: 'mc', prompt: 'The Louisiana Purchase came from:', options: ['Spain', 'France', 'Britain', 'Mexico'], answerIdx: 1 },
        { type: 'mc', prompt: '13th Amendment did what?', options: ['Gave women the vote', 'Abolished slavery', 'Set income tax', 'Ended Prohibition'], answerIdx: 1 },
        { type: 'short', prompt: 'WWII ended in what year? (number):', answer: '1945' },
        { type: 'mc', prompt: 'Author of "I Have a Dream":', options: ['Malcolm X', 'MLK Jr.', 'Frederick Douglass', 'Rosa Parks'], answerIdx: 1 },
        { type: 'number', prompt: 'Year humans first walked on the moon:', answer: 1969 },
      ],
    },
  ],

  loadAll() {
    const custom = this._loadCustom();
    return [...this.defaults, ...custom];
  },

  _loadCustom() {
    try {
      const raw = localStorage.getItem(this.STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) { return []; }
  },

  saveCustom(packs) {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(packs));
  },

  upsert(pack) {
    const custom = this._loadCustom();
    const idx = custom.findIndex(p => p.id === pack.id);
    if (idx >= 0) custom[idx] = pack;
    else custom.push(pack);
    this.saveCustom(custom);
  },

  remove(id) {
    const custom = this._loadCustom().filter(p => p.id !== id);
    this.saveCustom(custom);
  },

  getById(id) {
    return this.loadAll().find(p => p.id === id) || this.defaults[0];
  },

  getActiveId() {
    return localStorage.getItem(this.ACTIVE_KEY) || this.defaults[0].id;
  },

  setActiveId(id) {
    localStorage.setItem(this.ACTIVE_KEY, id);
  },

  getActive() {
    return this.getById(this.getActiveId());
  },

  // The pack actually in use for this game session (may come from remote host)
  activePack: null,

  setSessionPack(pack) { this.activePack = pack; },
  getSessionPack() { return this.activePack || this.getActive(); },

  newCustomPack(name) {
    return {
      id: 'custom-' + Date.now().toString(36),
      name: name || 'Untitled Pack',
      subject: '',
      description: '',
      questions: [],
    };
  },

  exportJson(pack) {
    return JSON.stringify(pack, null, 2);
  },

  importJson(text) {
    const parsed = JSON.parse(text);
    if (!parsed.questions || !Array.isArray(parsed.questions)) {
      throw new Error('Pack JSON missing "questions" array.');
    }
    if (!parsed.id) parsed.id = 'imported-' + Date.now().toString(36);
    if (!parsed.name) parsed.name = 'Imported Pack';
    parsed.builtin = false;
    return parsed;
  },
};
