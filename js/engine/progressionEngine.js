/**
 * progressionEngine.js
 * ─────────────────────────────────────────────────────────────
 * Rules-based progression engine.
 *
 * Responsibilities:
 *   1. Determine the correct pull-up stage from ability inputs (onboarding).
 *   2. Evaluate whether a user has met the criteria to advance to the next stage.
 *   3. Evaluate whether a user should be sent back (regression).
 *   4. Select the primary exercises for a session given the current stage.
 *   5. Select accessory exercises for secondary goals.
 *
 * Phase 1 Notes:
 *   - All logic is transparent, rules-based, and easily editable.
 *   - No ML, no LLM, no black-box decisions.
 *   - "Advance" decisions are conservative — require 2+ sessions meeting criteria.
 *   - "Regress" decisions happen if user logs RPE 9–10 for 2+ sessions.
 * ─────────────────────────────────────────────────────────────
 */

const ProgressionEngine = (() => {

  // ── Stage advancement criteria ────────────────────────────────
  // Each rule describes what a user must demonstrate BEFORE advancing.
  // These are checked against the workout log history.
  //
  // Format:
  //   stageId → { advanceCriteria: fn(recentLogs) → bool, regressionCriteria: fn → bool }

  const STAGE_RULES = {

    dead_hang_base: {
      label: 'Dead Hang Base',
      description: 'Build grip and shoulder stability with hangs and scapular pulls.',
      entryCriteria: 'Cannot perform an unassisted pull-up.',
      advanceCriteria(recentLogs) {
        // Advance when: dead_hang ≥ 30s for 2 sessions, scapular_pull 3×8 for 2 sessions
        const hangSessions = countSessionsWithMetric(recentLogs, 'dead_hang', 'durationSeconds', 30);
        const scapSessions = countSessionsWithReps(recentLogs, 'scapular_pull', 3, 8);
        return hangSessions >= 2 && scapSessions >= 2;
      },
      regressionCriteria: null, // first stage — can't go lower
      primaryExercises: ['dead_hang', 'scapular_pull', 'active_hang'],
      warmupIncludes: ['jumping_jacks_warmup', 'arm_circles_warmup', 'wrist_circles_warmup'],
    },

    assisted_volume: {
      label: 'Assisted Volume',
      description: 'Build pull-up volume with band assistance or negatives.',
      entryCriteria: 'Can dead hang 30s+ and perform controlled scapular pulls.',
      advanceCriteria(recentLogs) {
        // Advance when: band_pullup or jumping_negative — 3×5 quality reps for 3 sessions
        const bandSessions = countSessionsWithReps(recentLogs, 'band_assisted_pullup_light', 3, 5);
        const negSessions  = countSessionsWithReps(recentLogs, 'jumping_pullup_negative', 3, 5);
        return (bandSessions + negSessions) >= 3;
      },
      regressionCriteria(recentLogs) {
        // Regress if consistent RPE 9–10 with no improvement
        return countHighRPE(recentLogs, 'band_assisted_pullup_heavy', 9) >= 3;
      },
      primaryExercises: ['band_assisted_pullup_heavy', 'band_assisted_pullup_medium', 'jumping_pullup_negative'],
      warmupIncludes: ['jumping_jacks_warmup', 'arm_circles_warmup', 'wrist_circles_warmup', 'bodyweight_row_warmup'],
    },

    strict_strength: {
      label: 'Strict Pull-Up Strength',
      description: 'Build raw strict pull-up reps and top hold strength.',
      entryCriteria: 'Can perform at least 1–2 strict pull-ups.',
      advanceCriteria(recentLogs) {
        // Advance when: strict_pullup 3×5+ reps for 3 sessions, top_hold 5s+ for 2 sessions
        const pullupSessions = countSessionsWithReps(recentLogs, 'strict_pullup', 3, 5);
        const holdSessions   = countSessionsWithMetric(recentLogs, 'pullup_top_hold', 'durationSeconds', 5);
        return pullupSessions >= 3 && holdSessions >= 2;
      },
      regressionCriteria(recentLogs) {
        return countHighRPE(recentLogs, 'strict_pullup', 10) >= 2;
      },
      primaryExercises: ['strict_pullup', 'pullup_top_hold'],
      warmupIncludes: ['jumping_jacks_warmup', 'arm_circles_warmup', 'wrist_circles_warmup'],
    },

    chest_to_bar: {
      label: 'Chest-to-Bar',
      description: 'Develop above-bar pulling power for the muscle-up pull phase.',
      entryCriteria: 'Can perform 5+ strict pull-ups with good form.',
      advanceCriteria(recentLogs) {
        // Advance when: chest_to_bar 3 reps per set for 4 sessions
        const c2bSessions = countSessionsWithReps(recentLogs, 'chest_to_bar_pullup', 3, 3);
        return c2bSessions >= 4;
      },
      regressionCriteria(recentLogs) {
        return countHighRPE(recentLogs, 'chest_to_bar_pullup', 10) >= 3;
      },
      primaryExercises: ['chest_to_bar_pullup', 'strict_pullup', 'pullup_top_hold'],
      warmupIncludes: ['jumping_jacks_warmup', 'arm_circles_warmup', 'wrist_circles_warmup'],
    },

    explosive_pull: {
      label: 'Explosive Pull Power',
      description: 'Develop the explosive hip drive and pull needed for muscle-up.',
      entryCriteria: 'Can consistently hit chest-to-bar pull-ups.',
      advanceCriteria(recentLogs) {
        // Advance when: explosive_pullup 3 reps per set for 4 sessions
        const expSessions = countSessionsWithReps(recentLogs, 'explosive_pullup', 3, 3);
        return expSessions >= 4;
      },
      regressionCriteria(recentLogs) {
        return countHighRPE(recentLogs, 'explosive_pullup', 10) >= 2;
      },
      primaryExercises: ['explosive_pullup', 'hip_pop_pullup', 'chest_to_bar_pullup'],
      warmupIncludes: ['jumping_jacks_warmup', 'arm_circles_warmup', 'wrist_circles_warmup'],
    },

    transition_readiness: {
      label: 'Transition Readiness',
      description: 'Practice the wrist-over and catch phase of the muscle-up.',
      entryCriteria: 'Can perform explosive pull-ups with hips near bar height.',
      advanceCriteria(recentLogs) {
        const transitionSessions = countSessionsWithReps(recentLogs, 'straight_bar_transition_drill', 3, 4);
        const negativeSessions   = countSessionsWithReps(recentLogs, 'muscle_up_negative', 3, 3);
        return transitionSessions >= 3 && negativeSessions >= 3;
      },
      regressionCriteria(recentLogs) {
        return countHighRPE(recentLogs, 'muscle_up_negative', 10) >= 3;
      },
      primaryExercises: ['straight_bar_transition_drill', 'muscle_up_negative', 'explosive_pullup'],
      warmupIncludes: ['jumping_jacks_warmup', 'arm_circles_warmup', 'wrist_circles_warmup'],
    },

    dip_support_prep: {
      label: 'Dip Support Prep',
      description: 'Build the dip and pressing strength required to complete a muscle-up.',
      entryCriteria: 'Understands the transition; needs pressing strength for lock-out.',
      advanceCriteria(recentLogs) {
        const dipSessions  = countSessionsWithReps(recentLogs, 'parallel_bar_dip', 3, 5);
        const straightSessions = countSessionsWithReps(recentLogs, 'straight_bar_dip', 2, 4);
        return dipSessions >= 3 && straightSessions >= 2;
      },
      regressionCriteria(recentLogs) {
        return countHighRPE(recentLogs, 'parallel_bar_dip', 10) >= 3;
      },
      primaryExercises: ['dip_support_hold', 'parallel_bar_dip', 'straight_bar_dip', 'muscle_up_negative'],
      warmupIncludes: ['jumping_jacks_warmup', 'arm_circles_warmup', 'wrist_circles_warmup'],
    },

    muscle_up_readiness: {
      label: 'Muscle-Up Readiness',
      description: 'Attempt and refine full muscle-up movement.',
      entryCriteria: 'All prerequisite strength and movement patterns established.',
      advanceCriteria: null, // final stage
      regressionCriteria(recentLogs) {
        // Regress to transition work if consistently failing
        const failedAttempts = countFailedAttempts(recentLogs, 'ring_muscle_up_attempt') +
                               countFailedAttempts(recentLogs, 'straight_bar_muscle_up_attempt');
        return failedAttempts >= 6;
      },
      primaryExercises: ['ring_muscle_up_attempt', 'straight_bar_muscle_up_attempt', 'muscle_up_negative', 'straight_bar_dip'],
      warmupIncludes: ['jumping_jacks_warmup', 'arm_circles_warmup', 'wrist_circles_warmup'],
    },

  };

  // ── Stage determination from ability inputs ───────────────────

  /**
   * determineStartingStage(ability)
   * Reads the user's ability profile and returns the appropriate stage id.
   * Called once during onboarding.
   *
   * Conservative: better to start lower than higher.
   */
  function determineStartingStage(ability) {
    const { maxPullUps, deadHangSeconds, topHoldSeconds,
            explosiveLevel, bandPullUps } = ability;

    // Stage 7: Muscle-Up Readiness
    if (explosiveLevel >= 3 && maxPullUps >= 11) {
      return PULL_UP_STAGES.MUSCLE_UP_READINESS.id;
    }

    // Stage 6: Dip Support Prep
    if (explosiveLevel >= 2 && maxPullUps >= 6) {
      return PULL_UP_STAGES.DIP_SUPPORT_PREP.id;
    }

    // Stage 5: Transition Readiness
    if (explosiveLevel >= 2 && maxPullUps >= 6) {
      return PULL_UP_STAGES.TRANSITION_READINESS.id;
    }

    // Stage 4: Explosive Pull
    if (maxPullUps >= 6 && topHoldSeconds >= 5) {
      return PULL_UP_STAGES.EXPLOSIVE_PULL.id;
    }

    // Stage 3: Chest-to-Bar
    if (maxPullUps >= 5) {
      return PULL_UP_STAGES.CHEST_TO_BAR.id;
    }

    // Stage 2: Strict Strength
    if (maxPullUps >= 1) {
      return PULL_UP_STAGES.STRICT_STRENGTH.id;
    }

    // Stage 1: Assisted Volume
    if (deadHangSeconds >= 15 || bandPullUps === 'medium' || bandPullUps === 'light') {
      return PULL_UP_STAGES.ASSISTED_VOLUME.id;
    }

    // Stage 0: Dead Hang Base (default)
    return PULL_UP_STAGES.DEAD_HANG_BASE.id;
  }

  // ── Stage advancement / regression ───────────────────────────

  /**
   * checkAdvancement(profile, recentLogs)
   * Returns the new stage id if advancement criteria are met, else null.
   * "Recent logs" = last 5 completed sessions.
   */
  function checkAdvancement(profile, recentLogs) {
    const currentStageId = profile.progression.pullUpStage;
    const rule = STAGE_RULES[currentStageId];

    if (!rule || !rule.advanceCriteria) return null; // final stage

    const recent = recentLogs.slice(0, 5);
    if (rule.advanceCriteria(recent)) {
      const currentStage = getStageById(currentStageId);
      const nextStage = Object.values(PULL_UP_STAGES)
        .find(s => s.index === currentStage.index + 1);
      return nextStage ? nextStage.id : null;
    }
    return null;
  }

  /**
   * checkRegression(profile, recentLogs)
   * Returns the previous stage id if regression criteria are met, else null.
   */
  function checkRegression(profile, recentLogs) {
    const currentStageId = profile.progression.pullUpStage;
    const rule = STAGE_RULES[currentStageId];

    if (!rule || !rule.regressionCriteria) return null;

    const recent = recentLogs.slice(0, 5);
    if (rule.regressionCriteria(recent)) {
      const currentStage = getStageById(currentStageId);
      if (currentStage.index === 0) return null; // already at base
      const prevStage = Object.values(PULL_UP_STAGES)
        .find(s => s.index === currentStage.index - 1);
      return prevStage ? prevStage.id : null;
    }
    return null;
  }

  // ── Primary exercise selection ────────────────────────────────

  /**
   * selectPrimaryExercises(stageId, userEquipment, sessionMinutes)
   * Returns an ordered array of exercise objects for the main block.
   * Filters out exercises that require unavailable equipment.
   */
  function selectPrimaryExercises(stageId, userEquipment, sessionMinutes) {
    const rule = STAGE_RULES[stageId];
    if (!rule) return [];

    // Get all candidate exercise ids for this stage
    const candidates = rule.primaryExercises;

    // Filter by equipment availability
    const available = candidates
      .map(id => ExerciseLibrary[id])
      .filter(Boolean)
      .filter(ex => exerciseMatchesEquipment(ex, userEquipment));

    // For shorter sessions, take fewer exercises
    const maxExercises = sessionMinutes <= 20 ? 2 : sessionMinutes <= 25 ? 3 : 4;

    return available.slice(0, maxExercises);
  }

  /**
   * selectAccessoryExercises(secondaryGoals, userEquipment, minutesRemaining)
   * Returns accessory exercises to fit in remaining session time.
   * Conservative — 1 exercise per secondary goal, max 3 accessories total.
   */
  function selectAccessoryExercises(secondaryGoals, userEquipment, minutesRemaining, profile) {
    if (minutesRemaining < 5 || !secondaryGoals.length) return [];

    const accessories = [];
    const maxAccessories = minutesRemaining >= 10 ? 3 : 1;

    for (const goal of secondaryGoals) {
      if (accessories.length >= maxAccessories) break;

      const exercise = pickAccessoryExercise(goal, userEquipment, profile);
      if (exercise) accessories.push(exercise);
    }

    return accessories;
  }

  /**
   * Picks the most appropriate accessory exercise for a secondary goal
   * based on the user's current ability.
   */
  function pickAccessoryExercise(goal, userEquipment, profile) {
    const ability = profile.ability;

    switch (goal) {
      case SECONDARY_GOALS.SQUAT_THRUST_PUSHUP: {
        if (ability.maxSquatThrust >= 10) return ExerciseLibrary.squat_thrust_pushup_combo;
        if (ability.maxPushUps >= 10)    return ExerciseLibrary.squat_thrust_pushup_combo;
        if (ability.maxPushUps >= 5)     return ExerciseLibrary.full_pushup;
        return ExerciseLibrary.incline_pushup;
      }

      case SECONDARY_GOALS.CALVES: {
        if (ability.singleLegCalf >= 15) return ExerciseLibrary.single_leg_calf_raise;
        if (ability.singleLegCalf >= 5)  return ExerciseLibrary.single_leg_calf_raise_assisted;
        return ExerciseLibrary.double_leg_calf_raise;
      }

      case SECONDARY_GOALS.TIBIALIS: {
        if (ability.tibialisRaises >= 25) return ExerciseLibrary.tibialis_raise_standing;
        if (ability.tibialisRaises >= 10) return ExerciseLibrary.tibialis_raise_standing;
        return ExerciseLibrary.tibialis_raise_seated;
      }

      case SECONDARY_GOALS.CORE: {
        if (ability.maxPullUps >= 3) return ExerciseLibrary.hanging_knee_raise;
        return ExerciseLibrary.hollow_body_hold;
      }

      default:
        return null;
    }
  }

  // ── Session time estimation ───────────────────────────────────

  /**
   * Estimates the time (minutes) a list of exercises will take,
   * including prescribed sets, rest, and a small transition buffer.
   */
  function estimateExerciseTime(exercises) {
    let totalSeconds = 0;

    for (const ex of exercises) {
      const sets       = ex.defaultSets || 3;
      const repTime    = ex.defaultDuration || (ex.defaultReps ? ex.defaultReps * 4 : 30);
      const restTime   = ex.restSeconds || 60;
      const setTime    = sets * (repTime + restTime);
      const transition = 30; // setup / transition buffer per exercise
      totalSeconds += setTime + transition;
    }

    return Math.ceil(totalSeconds / 60);
  }

  // ── Prescription helpers ──────────────────────────────────────

  /**
   * getSessionVolume(stageId, sessionMinutes)
   * Returns adjusted set/rep prescriptions based on stage and time available.
   * More time = slightly more volume; always conservative.
   */
  function getSessionVolume(stageId, sessionMinutes) {
    const volumeMap = {
      dead_hang_base:       { sets: 3, repMultiplier: 1.0 },
      assisted_volume:      { sets: sessionMinutes >= 25 ? 4 : 3, repMultiplier: 1.0 },
      strict_strength:      { sets: sessionMinutes >= 25 ? 4 : 3, repMultiplier: 1.0 },
      chest_to_bar:         { sets: 4, repMultiplier: 1.0 },
      explosive_pull:       { sets: 3, repMultiplier: 1.0 }, // keep explosive work low volume
      transition_readiness: { sets: 4, repMultiplier: 1.0 },
      dip_support_prep:     { sets: 3, repMultiplier: 1.0 },
      muscle_up_readiness:  { sets: 3, repMultiplier: 1.0 }, // quality only
    };
    return volumeMap[stageId] || { sets: 3, repMultiplier: 1.0 };
  }

  // ── Log analysis helpers ──────────────────────────────────────

  /**
   * Count how many sessions in recentLogs include exerciseId
   * with at least `minSets` sets reaching `minDuration` seconds.
   */
  function countSessionsWithMetric(logs, exerciseId, metric, minValue) {
    return logs.filter(log => {
      if (!log.completed) return false;
      const exLog = log.exerciseLogs.find(e => e.exerciseId === exerciseId);
      if (!exLog) return false;
      const qualifying = exLog.setLogs.filter(s => s[metric] >= minValue);
      return qualifying.length >= 1;
    }).length;
  }

  /**
   * Count how many sessions have at least `minSets` sets with `minReps` reps
   * for a given exercise.
   */
  function countSessionsWithReps(logs, exerciseId, minSets, minReps) {
    return logs.filter(log => {
      if (!log.completed) return false;
      const exLog = log.exerciseLogs.find(e => e.exerciseId === exerciseId);
      if (!exLog) return false;
      const qualifying = exLog.setLogs.filter(s => (s.repsCompleted || 0) >= minReps);
      return qualifying.length >= minSets;
    }).length;
  }

  /**
   * Count how many sessions had high RPE for an exercise.
   */
  function countHighRPE(logs, exerciseId, minRPE) {
    return logs.filter(log => {
      if (!log.completed) return false;
      const exLog = log.exerciseLogs.find(e => e.exerciseId === exerciseId);
      return exLog && exLog.rpe && exLog.rpe >= minRPE;
    }).length;
  }

  /**
   * Count sessions where the exercise was marked "completed" = false (failed attempt).
   */
  function countFailedAttempts(logs, exerciseId) {
    return logs.filter(log => {
      if (!log.completed) return false;
      const exLog = log.exerciseLogs.find(e => e.exerciseId === exerciseId);
      return exLog && !exLog.completed;
    }).length;
  }

  // ── Public API ────────────────────────────────────────────────

  return {
    STAGE_RULES,
    determineStartingStage,
    checkAdvancement,
    checkRegression,
    selectPrimaryExercises,
    selectAccessoryExercises,
    estimateExerciseTime,
    getSessionVolume,
    pickAccessoryExercise,
  };

})();
