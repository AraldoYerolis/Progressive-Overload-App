/**
 * storage.js
 * ─────────────────────────────────────────────────────────────
 * Thin wrapper around localStorage.
 * All data is serialised as JSON under namespaced keys.
 *
 * Key schema:
 *   apc_profile       → UserProfile object
 *   apc_workouts      → { [id]: Workout }
 *   apc_logs          → { [id]: WorkoutLog }
 *   apc_notes         → { [id]: Note }
 *   apc_current_wo    → id of today's generated workout (string | null)
 *   apc_active_log    → id of the in-progress log (string | null)
 *   apc_onboarded     → 'true' | 'false'
 * ─────────────────────────────────────────────────────────────
 */

const Storage = (() => {

  // ── Key constants ────────────────────────────────────────────
  const KEYS = {
    PROFILE:        'apc_profile',
    WORKOUTS:       'apc_workouts',
    LOGS:           'apc_logs',
    NOTES:          'apc_notes',
    CURRENT_WO:     'apc_current_wo',
    ACTIVE_LOG:     'apc_active_log',
    ONBOARDED:      'apc_onboarded',
  };

  // ── Low-level helpers ────────────────────────────────────────

  function _get(key) {
    try {
      const raw = localStorage.getItem(key);
      return raw !== null ? JSON.parse(raw) : null;
    } catch (e) {
      console.warn(`[Storage] Failed to read key "${key}":`, e);
      return null;
    }
  }

  function _set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.warn(`[Storage] Failed to write key "${key}":`, e);
    }
  }

  function _remove(key) {
    localStorage.removeItem(key);
  }


  // ── Onboarding flag ──────────────────────────────────────────

  function isOnboarded() {
    return _get(KEYS.ONBOARDED) === true;
  }

  function setOnboarded(value = true) {
    _set(KEYS.ONBOARDED, value);
  }


  // ── User Profile ─────────────────────────────────────────────

  function getProfile() {
    return _get(KEYS.PROFILE);
  }

  function saveProfile(profile) {
    profile.updatedAt = Date.now();
    _set(KEYS.PROFILE, profile);
  }


  // ── Workouts ─────────────────────────────────────────────────

  function getAllWorkouts() {
    return _get(KEYS.WORKOUTS) || {};
  }

  function getWorkout(id) {
    const all = getAllWorkouts();
    return all[id] || null;
  }

  function saveWorkout(workout) {
    const all = getAllWorkouts();
    all[workout.id] = workout;
    _set(KEYS.WORKOUTS, all);
  }

  /** Returns today's pre-generated workout if it exists, else null. */
  function getTodaysWorkout() {
    const id = _get(KEYS.CURRENT_WO);
    if (!id) return null;
    const wo = getWorkout(id);
    // Only valid if it was generated for today
    if (wo && wo.date === todayISO()) return wo;
    return null;
  }

  function setCurrentWorkoutId(id) {
    _set(KEYS.CURRENT_WO, id);
  }


  // ── Workout Logs ─────────────────────────────────────────────

  function getAllLogs() {
    return _get(KEYS.LOGS) || {};
  }

  function getLog(id) {
    const all = getAllLogs();
    return all[id] || null;
  }

  function saveLog(log) {
    const all = getAllLogs();
    all[log.id] = log;
    _set(KEYS.LOGS, all);
  }

  /** Returns the currently active (in-progress) log, or null. */
  function getActiveLog() {
    const id = _get(KEYS.ACTIVE_LOG);
    if (!id) return null;
    return getLog(id);
  }

  function setActiveLogId(id) {
    _set(KEYS.ACTIVE_LOG, id);
  }

  function clearActiveLog() {
    _remove(KEYS.ACTIVE_LOG);
  }

  /**
   * Returns all logs sorted by date descending.
   * Each log is the full WorkoutLog object.
   */
  function getLogsSorted() {
    const all = getAllLogs();
    return Object.values(all).sort((a, b) => {
      // Sort by date string desc, then by finishedAt desc
      if (b.date !== a.date) return b.date.localeCompare(a.date);
      return (b.finishedAt || 0) - (a.finishedAt || 0);
    });
  }

  /**
   * Returns all completed logs (for stats / history).
   */
  function getCompletedLogs() {
    return getLogsSorted().filter(l => l.completed);
  }


  // ── Notes ────────────────────────────────────────────────────

  function getAllNotes() {
    return _get(KEYS.NOTES) || {};
  }

  function saveNote(note) {
    const all = getAllNotes();
    all[note.id] = note;
    _set(KEYS.NOTES, all);
  }


  // ── Stats helpers ─────────────────────────────────────────────

  /**
   * Returns the best (highest) logged value for a given exercise id and metric.
   * metric: 'repsCompleted' | 'durationSeconds'
   */
  function getPersonalBest(exerciseId, metric = 'repsCompleted') {
    const logs = getCompletedLogs();
    let best = null;
    let bestDate = null;

    for (const log of logs) {
      for (const exLog of log.exerciseLogs) {
        if (exLog.exerciseId !== exerciseId) continue;
        for (const setLog of exLog.setLogs) {
          const val = setLog[metric];
          if (val !== null && val !== undefined && (best === null || val > best)) {
            best = val;
            bestDate = log.date;
          }
        }
      }
    }
    return best !== null ? { value: best, date: bestDate } : null;
  }

  /**
   * Returns an array of { date, value } data points for an exercise/metric.
   * Useful for simple progress charting later.
   */
  function getExerciseHistory(exerciseId, metric = 'repsCompleted') {
    const logs = getCompletedLogs();
    const points = [];

    for (const log of logs) {
      for (const exLog of log.exerciseLogs) {
        if (exLog.exerciseId !== exerciseId) continue;
        const maxVal = exLog.setLogs.reduce((mx, s) => {
          const v = s[metric];
          return (v !== null && v > mx) ? v : mx;
        }, 0);
        if (maxVal > 0) {
          points.push({ date: log.date, value: maxVal });
        }
      }
    }
    return points.sort((a, b) => a.date.localeCompare(b.date));
  }

  /**
   * Returns notable PRs suitable for display on the History screen.
   * Returns up to `limit` exercises with their best performance.
   */
  function getNotablePRs(limit = 6) {
    const keyExercises = [
      { id: 'strict_pullup',     label: 'Pull-Up',        metric: 'repsCompleted' },
      { id: 'dead_hang',         label: 'Dead Hang',      metric: 'durationSeconds' },
      { id: 'pullup_top_hold',   label: 'Top Hold',       metric: 'durationSeconds' },
      { id: 'full_pushup',       label: 'Push-Up',        metric: 'repsCompleted' },
      { id: 'chest_to_bar_pullup', label: 'C2B Pull-Up',  metric: 'repsCompleted' },
      { id: 'explosive_pullup',  label: 'Explosive PU',   metric: 'repsCompleted' },
    ];

    return keyExercises
      .map(ex => {
        const pb = getPersonalBest(ex.id, ex.metric);
        if (!pb) return null;
        const unit = ex.metric === 'durationSeconds' ? 's' : ' reps';
        return { label: ex.label, value: `${pb.value}${unit}`, date: pb.date };
      })
      .filter(Boolean)
      .slice(0, limit);
  }


  // ── Phase 2: Adaptive engine helpers ──────────────────────────

  /**
   * getRecentExercisePerformance(exerciseId, limit = 4)
   * Returns an array of recent session performance objects for a
   * given exercise, sorted most-recent-first.
   *
   * Each entry:
   * {
   *   date,
   *   plannedSets, plannedReps, plannedDuration,
   *   setsCompleted,    — sets where completed === true
   *   maxRepsInSet,     — best rep count in a single completed set
   *   avgReps,          — average reps across completed sets
   *   maxDurationInSet, — best duration in a single completed set
   *   rpe,              — exercise RPE (null if not set)
   *   signals,          — Signal[] (exercise-level + workout-level, parsed live)
   * }
   *
   * Backward-compatible: parses notes on the fly if parsedSignals
   * are not stored in the log (Phase 1 logs).
   */
  function getRecentExercisePerformance(exerciseId, limit = 4) {
    const logs = getCompletedLogs(); // already sorted date desc
    const results = [];

    for (const log of logs) {
      if (results.length >= limit) break;

      const exLog = log.exerciseLogs.find(e => e.exerciseId === exerciseId);
      if (!exLog) continue;

      // ── Set-level metrics ──────────────────────────────────────
      const completedSets = exLog.setLogs.filter(s => s.completed);
      const setsCompleted = completedSets.length;

      const repValues  = completedSets.map(s => s.repsCompleted || 0).filter(v => v > 0);
      const durValues  = completedSets.map(s => s.durationSeconds || 0).filter(v => v > 0);

      const maxRepsInSet     = repValues.length  ? Math.max(...repValues)  : 0;
      const avgReps          = repValues.length  ? Math.round(repValues.reduce((a, b) => a + b, 0) / repValues.length) : 0;
      const maxDurationInSet = durValues.length  ? Math.max(...durValues)  : 0;

      // ── Signals ────────────────────────────────────────────────
      // Use stored parsedSignals if available (Phase 2 logs),
      // otherwise parse notes on the fly (Phase 1 logs).
      const exSignals = (exLog.parsedSignals && exLog.parsedSignals.length > 0)
        ? exLog.parsedSignals
        : NoteParser.parseNotes(exLog.notes || '');

      const woSignals = (log.parsedSignals && log.parsedSignals.length > 0)
        ? log.parsedSignals
        : NoteParser.parseNotes(log.overallNotes || '');

      const allSignals = [...exSignals, ...woSignals];

      results.push({
        date:             log.date,
        plannedSets:      exLog.plannedSets,
        plannedReps:      exLog.plannedReps,
        plannedDuration:  exLog.plannedDurationSeconds,
        setsCompleted,
        maxRepsInSet,
        avgReps,
        maxDurationInSet,
        rpe:              exLog.rpe,
        signals:          allSignals,
      });
    }

    return results;
  }


  // ── Full reset ───────────────────────────────────────────────

  function resetAll() {
    Object.values(KEYS).forEach(k => _remove(k));
  }


  // ── Public API ───────────────────────────────────────────────

  return {
    // Onboarding
    isOnboarded,
    setOnboarded,

    // Profile
    getProfile,
    saveProfile,

    // Workouts
    getAllWorkouts,
    getWorkout,
    saveWorkout,
    getTodaysWorkout,
    setCurrentWorkoutId,

    // Logs
    getAllLogs,
    getLog,
    saveLog,
    getActiveLog,
    setActiveLogId,
    clearActiveLog,
    getLogsSorted,
    getCompletedLogs,

    // Notes
    getAllNotes,
    saveNote,

    // Stats
    getPersonalBest,
    getExerciseHistory,
    getNotablePRs,

    // Phase 2: Adaptive engine
    getRecentExercisePerformance,

    // Reset
    resetAll,

    // Expose keys for debugging
    KEYS,
  };

})();
