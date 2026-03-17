/**
 * adaptiveEngine.js
 * ─────────────────────────────────────────────────────────────
 * Rules-based adaptive prescription engine for Phase 2.
 *
 * Given recent performance history and note signals for an
 * exercise, this engine decides how to adjust the prescription
 * for the next session.
 *
 * ── Decision rules (in priority order) ───────────────────────
 *
 *   1. Pain signal detected
 *      → Reduce intensity (reps -2 or duration -10s)
 *      → Flag as 'modified' — always show in change log
 *
 *   2. Joint discomfort signal detected
 *      → Reduce slightly (reps -1 or duration -5s)
 *      → Flag as 'reduce' — show in change log
 *
 *   3. Target missed 2+ sessions in a row
 *      → Regress prescription (reps -2 or sets -1)
 *      → Flag as 'regress' — show in change log
 *
 *   4. Target missed once
 *      a. With fatigue / soreness / poor-sleep signal
 *         → Hold steady — "recovery context"
 *         → Flag as 'hold' — show in change log
 *      b. Without context signals
 *         → Reduce slightly (reps -1)
 *         → Flag as 'reduce'
 *
 *   5. High RPE (≥9) for 2+ recent sessions (even when hitting target)
 *      → Hold steady — "high effort noted"
 *      → Flag as 'hold' — show in change log
 *
 *   6. Grip limitation on a grip-sensitive exercise
 *      → Hold steady — "grip limited"
 *      → Flag as 'hold' — show in change log
 *
 *   7. Technique breakdown noted
 *      → Hold steady — "technique flagged"
 *      → Flag as 'hold' — show in change log
 *
 *   8. Target exceeded for 2+ sessions
 *      → Progress slightly (+1 rep, or +5s, or rest -10s)
 *      → Flag as 'progress' — show in change log
 *
 *   9. Easy session noted for 2+ sessions (with target met)
 *      → Progress slightly
 *      → Flag as 'progress'
 *
 *  10. Normal session (target met, moderate RPE, no signals)
 *      → No change, no notification
 *      → Flag: null (not shown in change log)
 *
 *  11. No history yet
 *      → Use default prescription, no change
 *      → Flag: null
 *
 * ── Hard constraints (never violated) ─────────────────────────
 *   - Only ONE variable changes per session (reps OR sets OR rest)
 *   - Min sets: 2    Max sets: base + 2
 *   - Min reps: 1    Max reps: base + 6
 *   - Min duration: 5s
 *   - Min rest: 30s
 *   - No aggressive jumps in multiple directions
 *
 * ── Grip-sensitive exercises ───────────────────────────────────
 *   All exercises in the pull_up_muscle_up category.
 * ─────────────────────────────────────────────────────────────
 */

const AdaptiveEngine = (() => {

  // ── Constants ─────────────────────────────────────────────────

  // How many sessions to look back when evaluating performance
  const LOOKBACK_SESSIONS = 4;

  // Minimum sessions required before any progression decision
  const MIN_SESSIONS_FOR_PROGRESS = 2;

  // Rep/duration steps
  const REP_STEP_UP   = 1;
  const REP_STEP_DOWN_SMALL = 1;
  const REP_STEP_DOWN_BIG   = 2;
  const DUR_STEP_UP   = 5;   // seconds
  const DUR_STEP_DOWN_SMALL = 5;
  const DUR_STEP_DOWN_BIG   = 10;
  const REST_STEP_DOWN = 10; // seconds

  // Bounds
  const MIN_SETS = 2;
  const MIN_REPS = 1;
  const MIN_DUR  = 5;
  const MIN_REST = 30;


  // ── Main entry point ──────────────────────────────────────────

  /**
   * adaptPrescription(exercise, basePrescription, storageRef)
   *
   * Fetches recent history, builds context, applies rules,
   * and returns an adapted prescription object.
   *
   * basePrescription: { sets, reps, durationSeconds, restSeconds }
   *
   * Returns:
   * {
   *   sets, reps, durationSeconds, restSeconds,
   *   flag:        'progress'|'hold'|'reduce'|'regress'|'modified'|null,
   *   reason:      string | null,
   *   adaptedFrom: { sets, reps, durationSeconds } | null,  // only when prescription changed
   * }
   */
  function adaptPrescription(exercise, basePrescription, storageRef) {
    // Skip non-loggable entries
    if (!exercise || !exercise.id || exercise.id === '__cooldown__') {
      return noChange(basePrescription);
    }

    // Fetch recent sessions for this exercise
    const recentSessions = storageRef.getRecentExercisePerformance(
      exercise.id, LOOKBACK_SESSIONS
    );

    // No history → use defaults, no notification
    if (!recentSessions || recentSessions.length === 0) {
      return noChange(basePrescription);
    }

    // Build structured context from recent sessions
    const ctx = buildContext(recentSessions);

    // Determine if this exercise is grip-sensitive
    const isGripSensitive = exercise.category === 'pull_up_muscle_up';

    // Apply the rule chain and return the result
    return applyRules(ctx, basePrescription, isGripSensitive);
  }

  // ── Context builder ───────────────────────────────────────────

  /**
   * buildContext(recentSessions)
   * Summarises recent sessions into a decision-ready context object.
   *
   * Each session in recentSessions:
   * {
   *   date, plannedSets, plannedReps, plannedDuration,
   *   setsCompleted, maxRepsInSet, avgReps,
   *   maxDurationInSet, rpe, signals: Signal[]
   * }
   */
  function buildContext(sessions) {
    const ctx = {
      sessionCount:        sessions.length,
      hitTargetCount:      0,
      exceededTargetCount: 0,
      missedTargetCount:   0,
      consecutiveMisses:   0,     // most recent streak of misses
      avgRPE:              null,
      highRPESessions:     0,     // sessions with RPE >= 9

      // Signal flags (OR across all sessions in the lookback window)
      hasPainSignal:       false,
      hasJointSignal:      false,
      hasGripSignal:       false,
      hasTechBreakdown:    false,
      hasEasySignal:       false,
      hasFatigueSignal:    false,
      hasSorenessSignal:   false,
      hasSleepSignal:      false,

      // Signal flags from the MOST RECENT session only
      recentHasPain:       false,
      recentHasJoint:      false,

      // Summary strings for "why this changed" text
      signalSummary:       '',
    };

    let rpeTotal = 0;
    let rpeCount = 0;
    let consecutiveMisses = 0;
    let missStreak = true; // will flip to false when a non-miss is found

    for (let i = 0; i < sessions.length; i++) {
      const s = sessions[i];

      // ── Performance classification ──────────────────────────
      const outcome = classifyOutcome(s);

      if (outcome === 'exceeded') ctx.exceededTargetCount++;
      else if (outcome === 'hit')  ctx.hitTargetCount++;
      else if (outcome === 'miss') {
        ctx.missedTargetCount++;
        if (missStreak) consecutiveMisses++;
      }

      // Stop the consecutive miss streak once a non-miss session is found
      if (outcome !== 'miss') missStreak = false;

      // ── RPE ─────────────────────────────────────────────────
      if (s.rpe != null) {
        rpeTotal += s.rpe;
        rpeCount++;
        if (s.rpe >= 9) ctx.highRPESessions++;
      }

      // ── Signals ─────────────────────────────────────────────
      const sigs = s.signals || [];
      const S = NoteParser.SIGNALS;

      if (NoteParser.hasSignal(sigs, S.PAIN))                { ctx.hasPainSignal     = true; if (i === 0) ctx.recentHasPain  = true; }
      if (NoteParser.hasSignal(sigs, S.JOINT_DISCOMFORT))    { ctx.hasJointSignal    = true; if (i === 0) ctx.recentHasJoint = true; }
      if (NoteParser.hasSignal(sigs, S.GRIP_LIMITATION))     { ctx.hasGripSignal     = true; }
      if (NoteParser.hasSignal(sigs, S.TECHNIQUE_BREAKDOWN)) { ctx.hasTechBreakdown  = true; }
      if (NoteParser.hasSignal(sigs, S.EASY_SESSION))        { ctx.hasEasySignal     = true; }
      if (NoteParser.hasSignal(sigs, S.EXCESSIVE_FATIGUE))   { ctx.hasFatigueSignal  = true; }
      if (NoteParser.hasSignal(sigs, S.SORENESS))            { ctx.hasSorenessSignal = true; }
      if (NoteParser.hasSignal(sigs, S.POOR_SLEEP))          { ctx.hasSleepSignal    = true; }
    }

    ctx.consecutiveMisses = consecutiveMisses;
    ctx.avgRPE = rpeCount > 0 ? Math.round(rpeTotal / rpeCount) : null;

    // Build a signal summary string for "why" text
    const allSignals = sessions.flatMap(s => s.signals || []);
    ctx.signalSummary = NoteParser.getSignalSummary(allSignals);

    return ctx;
  }

  /**
   * classifyOutcome(session)
   * Returns 'exceeded' | 'hit' | 'miss' based on session performance.
   *
   * For rep-based exercises:
   *   exceeded = completed all planned sets AND at least one set was 2+ reps over
   *   hit      = completed all planned sets AND reps in range
   *   miss     = didn't complete planned sets OR reps consistently below target
   *
   * For time-based exercises:
   *   exceeded = all sets completed AND best duration > planned + 5s
   *   hit      = all sets completed AND duration in range
   *   miss     = incomplete
   */
  function classifyOutcome(session) {
    const {
      plannedSets, plannedReps, plannedDuration,
      setsCompleted, maxRepsInSet, avgReps, maxDurationInSet,
    } = session;

    if (plannedSets == null || setsCompleted == null) return 'hit'; // no data

    const setsOk = setsCompleted >= plannedSets;

    // Rep-based
    if (plannedReps != null && plannedReps > 0) {
      if (!setsOk) return 'miss';
      if (maxRepsInSet >= plannedReps + 2) return 'exceeded';
      if (avgReps >= plannedReps * 0.85)   return 'hit';
      return 'miss';
    }

    // Time-based
    if (plannedDuration != null && plannedDuration > 0) {
      if (!setsOk) return 'miss';
      if (maxDurationInSet >= plannedDuration + 5) return 'exceeded';
      if (maxDurationInSet >= plannedDuration * 0.85) return 'hit';
      return 'miss';
    }

    // Fallback: if sets completed, call it a hit
    return setsOk ? 'hit' : 'miss';
  }

  // ── Rule chain ────────────────────────────────────────────────

  /**
   * applyRules(ctx, base, isGripSensitive)
   * Applies the prioritised rule chain and returns an adaptation result.
   */
  function applyRules(ctx, base, isGripSensitive) {

    // ── Rule 1: Pain (most recent session) ──────────────────────
    if (ctx.recentHasPain) {
      return reduce(base, 'pain',
        '⚠️ Pain signal detected in recent notes — intensity reduced. Rest if needed; see a professional if it persists.'
      );
    }

    // ── Rule 2: Joint discomfort (most recent session) ───────────
    if (ctx.recentHasJoint) {
      return reduceSlightly(base, 'joint_discomfort',
        `⚠️ Joint discomfort noted — slight reduction to protect the joint.${ctx.signalSummary ? ' (' + ctx.signalSummary + ')' : ''}`
      );
    }

    // ── Rule 3: Consecutive misses ≥ 2 ───────────────────────────
    if (ctx.consecutiveMisses >= 2) {
      return regress(base, 'missed_repeatedly',
        `📉 Target missed ${ctx.consecutiveMisses} sessions in a row — stepping back to rebuild quality.`
      );
    }

    // ── Rule 4: Missed once ───────────────────────────────────────
    if (ctx.missedTargetCount >= 1 && ctx.consecutiveMisses === 1) {
      // With recovery/fatigue context → hold, don't reduce further
      if (ctx.hasFatigueSignal || ctx.hasSorenessSignal || ctx.hasSleepSignal) {
        return hold(base, 'missed_with_context',
          `⏸ Target missed once — but recovery context detected (${ctx.signalSummary || 'fatigue/soreness/sleep'}). Holding prescription.`
        );
      }
      // Without context → slight reduction
      return reduceSlightly(base, 'missed_once',
        '📉 Target missed once — slight reduction to restore consistency.'
      );
    }

    // ── Rule 5: High RPE even when hitting target ─────────────────
    if (ctx.highRPESessions >= 2 && ctx.missedTargetCount === 0) {
      return hold(base, 'high_rpe',
        `⏸ High effort (RPE 9–10) in ${ctx.highRPESessions} recent sessions — holding prescription to avoid overreach.`
      );
    }

    // ── Rule 6: Grip limitation on grip exercise ─────────────────
    if (isGripSensitive && ctx.hasGripSignal) {
      return hold(base, 'grip_limitation',
        '⏸ Grip limitation noted — not progressing pulling work this session.'
      );
    }

    // ── Rule 7: Technique breakdown ───────────────────────────────
    if (ctx.hasTechBreakdown) {
      return hold(base, 'technique_breakdown',
        '⏸ Technique breakdown noted in recent sessions — holding prescription. Prioritise form over load.'
      );
    }

    // ── Rules 8 & 9 require minimum session history ───────────────
    if (ctx.sessionCount < MIN_SESSIONS_FOR_PROGRESS) {
      return noChange(base); // not enough data to decide
    }

    // ── Rule 8: Exceeded target consistently ─────────────────────
    if (ctx.exceededTargetCount >= 2 && ctx.missedTargetCount === 0) {
      return progress(base, 'exceeded_target',
        `✅ Target exceeded in ${ctx.exceededTargetCount} of last ${ctx.sessionCount} sessions — progressing slightly.`
      );
    }

    // ── Rule 9: Consistently easy + met target ────────────────────
    if (ctx.hasEasySignal && ctx.exceededTargetCount >= 1 && ctx.missedTargetCount === 0) {
      return progress(base, 'easy_sessions',
        '✅ Sessions noted as easy — progressing slightly.'
      );
    }

    // ── Rule 10: Normal session — no change ───────────────────────
    return noChange(base);
  }

  // ── Prescription mutators ─────────────────────────────────────
  //
  // Each function returns the full prescription object with
  // metadata for the "why this changed" display.

  /**
   * progress(base, trigger, reason)
   * Add one step to reps or duration. Never change both.
   * If already at rep cap, try reducing rest instead.
   */
  function progress(base, trigger, reason) {
    const from = snapshot(base);

    if (base.reps != null) {
      const maxReps = base.reps + 6; // hard cap
      const newReps = Math.min(base.reps + REP_STEP_UP, maxReps);
      if (newReps > base.reps) {
        return result({ ...base, reps: newReps }, 'progress', reason, from);
      }
      // At cap — try reducing rest
      if (base.restSeconds > MIN_REST + REST_STEP_DOWN) {
        const newRest = base.restSeconds - REST_STEP_DOWN;
        return result({ ...base, restSeconds: newRest }, 'progress',
          reason + ` Rest reduced to ${newRest}s (at rep cap).`, from);
      }
      return noChange(base); // already at max
    }

    if (base.durationSeconds != null) {
      const maxDur = base.durationSeconds + 30;
      const newDur = Math.min(base.durationSeconds + DUR_STEP_UP, maxDur);
      if (newDur > base.durationSeconds) {
        return result({ ...base, durationSeconds: newDur }, 'progress', reason, from);
      }
      return noChange(base);
    }

    return noChange(base);
  }

  /**
   * reduceSlightly(base, trigger, reason)
   * Remove one step from reps/duration. One variable only.
   */
  function reduceSlightly(base, trigger, reason) {
    const from = snapshot(base);

    if (base.reps != null) {
      const newReps = Math.max(base.reps - REP_STEP_DOWN_SMALL, MIN_REPS);
      if (newReps < base.reps) {
        return result({ ...base, reps: newReps }, 'reduce', reason, from);
      }
      // Already at min reps — reduce sets
      const newSets = Math.max(base.sets - 1, MIN_SETS);
      if (newSets < base.sets) {
        return result({ ...base, sets: newSets }, 'reduce',
          reason + ` (Sets reduced to ${newSets}).`, from);
      }
      return noChange(base);
    }

    if (base.durationSeconds != null) {
      const newDur = Math.max(base.durationSeconds - DUR_STEP_DOWN_SMALL, MIN_DUR);
      if (newDur < base.durationSeconds) {
        return result({ ...base, durationSeconds: newDur }, 'reduce', reason, from);
      }
      return noChange(base);
    }

    return noChange(base);
  }

  /**
   * regress(base, trigger, reason)
   * Remove two steps from reps/duration. One variable only.
   */
  function regress(base, trigger, reason) {
    const from = snapshot(base);

    if (base.reps != null) {
      const newReps = Math.max(base.reps - REP_STEP_DOWN_BIG, MIN_REPS);
      if (newReps < base.reps) {
        return result({ ...base, reps: newReps }, 'regress', reason, from);
      }
      // Already at or near min reps — reduce sets
      const newSets = Math.max(base.sets - 1, MIN_SETS);
      if (newSets < base.sets) {
        return result({ ...base, sets: newSets }, 'regress', reason, from);
      }
      return noChange(base);
    }

    if (base.durationSeconds != null) {
      const newDur = Math.max(base.durationSeconds - DUR_STEP_DOWN_BIG, MIN_DUR);
      if (newDur < base.durationSeconds) {
        return result({ ...base, durationSeconds: newDur }, 'regress', reason, from);
      }
      return noChange(base);
    }

    return noChange(base);
  }

  /**
   * reduce(base, trigger, reason)
   * Larger reduction for pain / injury signals.
   */
  function reduce(base, trigger, reason) {
    const from = snapshot(base);

    if (base.reps != null) {
      const newReps = Math.max(base.reps - REP_STEP_DOWN_BIG, MIN_REPS);
      return result({ ...base, reps: newReps }, 'modified', reason, from);
    }

    if (base.durationSeconds != null) {
      const newDur = Math.max(base.durationSeconds - DUR_STEP_DOWN_BIG, MIN_DUR);
      return result({ ...base, durationSeconds: newDur }, 'modified', reason, from);
    }

    // No numeric prescription — just flag the modification
    return result({ ...base }, 'modified', reason, from);
  }

  /**
   * hold(base, trigger, reason)
   * No prescription change, but attach a reason for the change log.
   * adaptedFrom is null because nothing changed.
   */
  function hold(base, trigger, reason) {
    return {
      ...base,
      flag:        'hold',
      reason,
      adaptedFrom: null, // nothing changed — no "from" to show
    };
  }

  /**
   * noChange(base)
   * Default: no adaptation, no change log entry.
   */
  function noChange(base) {
    return {
      ...base,
      flag:        null,
      reason:      null,
      adaptedFrom: null,
    };
  }

  // ── Helpers ───────────────────────────────────────────────────

  /** Snapshot the prescription fields for "adapted from" display. */
  function snapshot(base) {
    return {
      sets:            base.sets,
      reps:            base.reps,
      durationSeconds: base.durationSeconds,
      restSeconds:     base.restSeconds,
    };
  }

  /** Build the final result object. */
  function result(newPrescription, flag, reason, adaptedFrom) {
    return {
      ...newPrescription,
      flag,
      reason,
      adaptedFrom,
    };
  }

  /**
   * formatAdaptationChange(adaptedFrom, adaptedTo)
   * Returns a human-readable string like "3×8 → 3×9" or "3×20s → 3×25s".
   */
  function formatAdaptationChange(from, to) {
    if (!from || !to) return '';
    const fmtPres = (p) => {
      if (p.durationSeconds != null) return `${p.sets}×${p.durationSeconds}s`;
      if (p.reps != null)            return `${p.sets}×${p.reps}`;
      return `${p.sets} sets`;
    };
    return `${fmtPres(from)} → ${fmtPres(to)}`;
  }

  // ── Public API ────────────────────────────────────────────────

  return {
    adaptPrescription,
    buildContext,          // exported for testing / debugging
    classifyOutcome,       // exported for testing / debugging
    formatAdaptationChange,
  };

})();
