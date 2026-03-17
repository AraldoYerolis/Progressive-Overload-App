/**
 * noteParser.js
 * ─────────────────────────────────────────────────────────────
 * Rules-based parser that scans free-text notes for training
 * signals and returns structured data the adaptive engine uses
 * to make prescription decisions.
 *
 * Phase 1 notes were stored but not parsed.
 * Phase 2 parses them here — no AI, no external API.
 *
 * Signal types detected:
 *   pain               — sharp/acute pain, injury language
 *   joint_discomfort   — specific joint mentions + discomfort cues
 *   excessive_fatigue  — "wiped", "couldn't finish", "no gas"
 *   soreness           — DOMS, tightness, general soreness
 *   easy_session       — "too easy", "left in tank", "could do more"
 *   grip_limitation    — forearm pump, skin/callus, grip failure
 *   technique_breakdown— form cues, sloppy reps, momentum/kip
 *   poor_sleep         — sleep / recovery language
 *
 * Each detected signal includes:
 *   { type, severity, matchedPattern, rawText }
 *
 * Severity levels (used by AdaptiveEngine for decision weighting):
 *   critical  — pain: immediate reduce / flag
 *   high      — joint_discomfort, excessive_fatigue: reduce or hold
 *   medium    — grip, technique, poor_sleep: hold or small reduce
 *   low       — soreness: caution, don't progress
 *   positive  — easy_session: may progress
 * ─────────────────────────────────────────────────────────────
 */

const NoteParser = (() => {

  // ── Signal type constants ──────────────────────────────────────

  const SIGNALS = {
    PAIN:                'pain',
    JOINT_DISCOMFORT:    'joint_discomfort',
    EXCESSIVE_FATIGUE:   'excessive_fatigue',
    SORENESS:            'soreness',
    EASY_SESSION:        'easy_session',
    GRIP_LIMITATION:     'grip_limitation',
    TECHNIQUE_BREAKDOWN: 'technique_breakdown',
    POOR_SLEEP:          'poor_sleep',
  };

  const SEVERITY = {
    CRITICAL: 'critical',
    HIGH:     'high',
    MEDIUM:   'medium',
    LOW:      'low',
    POSITIVE: 'positive',
  };

  // ── Keyword/pattern definitions ────────────────────────────────
  //
  // Each entry: { type, severity, patterns[] }
  // Patterns are RegExp objects tested against lowercase note text.
  // Ordered from most to least specific within each type.

  const SIGNAL_DEFS = [

    // ── Pain (critical — always act on this)
    {
      type:     SIGNALS.PAIN,
      severity: SEVERITY.CRITICAL,
      patterns: [
        /\bpain\b/,
        /\bhurt(s|ing)?\b/,
        /\bsharp\b/,
        /\bache(s|d|ing)?\b/,
        /\binj(ure|ured|ury)\b/,
        /\btweak(ed|ing)?\b/,
        /\bstrain(ed|ing)?\b/,
        /\bpull(ed)? (a |my )?(muscle|hamstring|bicep|shoulder)\b/,
      ],
    },

    // ── Joint discomfort (high — joint language near discomfort words)
    {
      type:     SIGNALS.JOINT_DISCOMFORT,
      severity: SEVERITY.HIGH,
      patterns: [
        /\belbow\b/,
        /\bshoulder\b/,
        /\bwrist\b/,
        /\bknee\b/,
        /\bjoint\b/,
        /\bclick(ing|ed)?\b/,
        /\bpopping?\b/,
        /\bcreaking?\b/,
        /\bsnap(ping|ped)?\b/,
        /\buncomfortabl(e|y)\b/,
        /\bimpingement\b/,
        /\binflamed?\b/,
      ],
    },

    // ── Excessive fatigue (high)
    {
      type:     SIGNALS.EXCESSIVE_FATIGUE,
      severity: SEVERITY.HIGH,
      patterns: [
        /\bexhausted?\b/,
        /\bexhaustion\b/,
        /\bdrained\b/,
        /\bfatigue[d]?\b/,
        /\bwiped( out)?\b/,
        /\bcrushed\b/,
        /\bcouldn.?t finish\b/,
        /\bno gas\b/,
        /\bburnout\b/,
        /\bno energy\b/,
        /\bspent\b/,
        /\bcouldnt finish\b/,
        /\bgassed\b/,
      ],
    },

    // ── Soreness (low — proceed carefully, no big jumps)
    {
      type:     SIGNALS.SORENESS,
      severity: SEVERITY.LOW,
      patterns: [
        /\bsor(e|eness)\b/,
        /\bdoms\b/,
        /\btightness\b/,
        /\bstiff(ness)?\b/,
        /\bheavy (legs?|arms?|body)\b/,
        /\btender\b/,
        /\bbeaten up\b/,
        /\bnot fresh\b/,
      ],
    },

    // ── Easy session (positive — possible progress signal)
    {
      type:     SIGNALS.EASY_SESSION,
      severity: SEVERITY.POSITIVE,
      patterns: [
        /\btoo easy\b/,
        /\bfelt easy\b/,
        /\bfelt light\b/,
        /\bno problem\b/,
        /\bbreeze\b/,
        /\bbreezy\b/,
        /\bcould.?ve done more\b/,
        /\bcould have done more\b/,
        /\bleft .{0,8} tank\b/,
        /\bmore in .{0,8} tank\b/,
        /\bunder(estimated)?\b/,
        /\bway too easy\b/,
        /\breal(ly)? easy\b/,
        /\bcomfort(able|ably)\b/,
      ],
    },

    // ── Grip limitation (medium — don't progress pulling work)
    {
      type:     SIGNALS.GRIP_LIMITATION,
      severity: SEVERITY.MEDIUM,
      patterns: [
        /\bgrip (fail|slipp|gave)\b/,
        /\bforearm pump\b/,
        /\bforearms? (pumped|burning|cooked)\b/,
        /\bcallus(es)?\b/,
        /\bskin (tore|ripped|split)\b/,
        /\bslipp(ed|ing)\b/,
        /\bgrip$/, // "grip" alone at end of sentence
        /\bgrip issues?\b/,
        /\bhands? (hurt|sore|raw)\b/,
      ],
    },

    // ── Technique breakdown (medium — hold reps, cue form)
    {
      type:     SIGNALS.TECHNIQUE_BREAKDOWN,
      severity: SEVERITY.MEDIUM,
      patterns: [
        /\bform broke\b/,
        /\bform break(ing|s)?\b/,
        /\bform (fell?|fell apart|going)\b/,
        /\bbad form\b/,
        /\bpoor form\b/,
        /\btechnique (broke|fell|bad)\b/,
        /\bsloppy\b/,
        /\bkipp(ing|ed)\b/,
        /\bcheating?\b/,
        /\bswinging?\b/,
        /\btoo much momentum\b/,
        /\bmissed depth\b/,
        /\bhalf reps?\b/,
        /\bshort reps?\b/,
      ],
    },

    // ── Poor sleep / recovery (medium — proceed conservatively)
    {
      type:     SIGNALS.POOR_SLEEP,
      severity: SEVERITY.MEDIUM,
      patterns: [
        /\bno sleep\b/,
        /\bbad sleep\b/,
        /\bpoor sleep\b/,
        /\bsleep deprived\b/,
        /\bunder.?slept\b/,
        /\bgroggy\b/,
        /\bnot (fully )?recovered\b/,
        /\bpoor recovery\b/,
        /\btired\b/,
        /\bsleepy\b/,
        /\bonly .{0,6} hours?\b/, // "only 4 hours", "only 5h"
        /\bdidn.?t sleep\b/,
      ],
    },

  ];

  // ── Core parse function ───────────────────────────────────────

  /**
   * parseNotes(text)
   * Scans a note string for all signal types.
   * Returns an array of detected signal objects.
   *
   * Each signal: { type, severity, matchedPattern, rawText }
   */
  function parseNotes(text) {
    if (!text || typeof text !== 'string' || text.trim().length < 3) return [];

    const lower = text.toLowerCase();
    const detected = [];

    for (const def of SIGNAL_DEFS) {
      for (const rx of def.patterns) {
        if (rx.test(lower)) {
          detected.push({
            type:           def.type,
            severity:       def.severity,
            matchedPattern: rx.source,
            rawText:        text,
          });
          break; // Only add each type once — first match wins
        }
      }
    }

    return detected;
  }

  /**
   * parseAllNotesForLog(workoutLog)
   * Parses both exercise-level and workout-level notes for a full log.
   * Returns {
   *   workoutSignals: Signal[],
   *   exerciseSignals: { [exerciseId]: Signal[] }
   * }
   */
  function parseAllNotesForLog(workoutLog) {
    const result = {
      workoutSignals:   [],
      exerciseSignals:  {},
    };

    if (workoutLog.overallNotes) {
      result.workoutSignals = parseNotes(workoutLog.overallNotes);
    }

    for (const exLog of (workoutLog.exerciseLogs || [])) {
      if (exLog.notes && exLog.notes.trim()) {
        result.exerciseSignals[exLog.exerciseId] = parseNotes(exLog.notes);
      }
    }

    return result;
  }

  // ── Signal inspection helpers ─────────────────────────────────

  /** Returns true if signals[] contains at least one of the given type. */
  function hasSignal(signals, type) {
    return (signals || []).some(s => s.type === type);
  }

  /** Returns the most severe signal from an array. null if empty. */
  function getHighestSeverity(signals) {
    const order = [
      SEVERITY.CRITICAL, SEVERITY.HIGH, SEVERITY.MEDIUM,
      SEVERITY.LOW, SEVERITY.POSITIVE,
    ];
    for (const level of order) {
      if ((signals || []).some(s => s.severity === level)) return level;
    }
    return null;
  }

  /**
   * getSignalSummary(signals)
   * Returns a short human-readable string summarising detected signals.
   * Used in the "Why this changed" explanations.
   */
  function getSignalSummary(signals) {
    if (!signals || signals.length === 0) return '';

    const labels = {
      [SIGNALS.PAIN]:                'pain reported',
      [SIGNALS.JOINT_DISCOMFORT]:    'joint discomfort noted',
      [SIGNALS.EXCESSIVE_FATIGUE]:   'excessive fatigue noted',
      [SIGNALS.SORENESS]:            'soreness present',
      [SIGNALS.EASY_SESSION]:        'session felt easy',
      [SIGNALS.GRIP_LIMITATION]:     'grip limited',
      [SIGNALS.TECHNIQUE_BREAKDOWN]: 'technique breakdown noted',
      [SIGNALS.POOR_SLEEP]:          'poor sleep/recovery noted',
    };

    return signals
      .map(s => labels[s.type] || s.type)
      .filter((v, i, a) => a.indexOf(v) === i) // dedupe
      .join(', ');
  }

  // ── Public API ────────────────────────────────────────────────

  return {
    SIGNALS,
    SEVERITY,
    parseNotes,
    parseAllNotesForLog,
    hasSignal,
    getHighestSeverity,
    getSignalSummary,
  };

})();
