// Deterministic question dispenser. Pulls from the active content pack.
// Each (gateId, playerId, levelIdx) gets a stable question via seeded indexing.

const Questions = {
  generate(gateId, playerId, levelIdx) {
    const pack = Packs.getSessionPack();
    const qs = pack.questions || [];
    if (qs.length === 0) {
      return this._fallback(gateId, playerId);
    }
    const seed = gateId * 1000 + playerId * 37 + levelIdx * 13 + 7;
    const idx = this._hash(seed) % qs.length;
    const q = qs[idx];

    if (q.type === 'gen-mult') {
      return this._genMultiplication(gateId, playerId, q.range || { min: 3, max: 7 });
    }

    if (q.type === 'mc') {
      return {
        type: 'mc',
        gateId, playerId,
        prompt: q.prompt,
        options: q.options,
        answerIdx: q.answerIdx,
      };
    }

    if (q.type === 'short') {
      return {
        type: 'short',
        gateId, playerId,
        prompt: q.prompt,
        answer: String(q.answer || '').trim().toLowerCase(),
      };
    }

    if (q.type === 'number') {
      return {
        type: 'number',
        gateId, playerId,
        prompt: q.prompt,
        answer: Number(q.answer),
      };
    }

    return this._fallback(gateId, playerId);
  },

  _genMultiplication(gateId, playerId, range) {
    const seed = gateId * 1000 + playerId * 7 + 3;
    const span = range.max - range.min + 1;
    const a = range.min + this._hash(seed) % span;
    const b = range.min + this._hash(seed + 1) % span;
    return {
      type: 'number',
      gateId, playerId,
      prompt: `${a} × ${b} = ?`,
      answer: a * b,
    };
  },

  _fallback(gateId, playerId) {
    return this._genMultiplication(gateId, playerId, { min: 3, max: 7 });
  },

  // Check an answer. Returns boolean.
  check(q, raw) {
    if (q.type === 'mc') {
      return Number(raw) === q.answerIdx;
    }
    if (q.type === 'short') {
      return String(raw || '').trim().toLowerCase() === q.answer;
    }
    if (q.type === 'number') {
      const n = parseFloat(raw);
      return !isNaN(n) && Math.abs(n - q.answer) < 1e-6;
    }
    return false;
  },

  _hash(n) {
    let x = (n + 0x9E3779B9) | 0;
    x = Math.imul(x ^ (x >>> 16), 0x85EBCA6B);
    x = Math.imul(x ^ (x >>> 13), 0xC2B2AE35);
    x = (x ^ (x >>> 16)) >>> 0;
    return x;
  },
};
