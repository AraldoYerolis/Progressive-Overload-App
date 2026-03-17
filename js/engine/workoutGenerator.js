/**
 * workoutGenerator.js
 * ─────────────────────────────────────────────────────────────
 * Assembles complete Workout objects from the progression engine
 * output and the user's profile.
 *
 * Generation logic (in order):
 *   1. Read user profile (stage, goals, equipment, time target)
 *   2. Build warm-up section (always ~5 min)
 *   3. Build main block (primary goal exercises for current stage)
 *   4. If time remains, add accessory block (secondary goals)
 *   5. Optionally add a cooldown note
 *   6. Store the workout in localStorage
 *
 * Phase 1 constraints:
 *   - Always conservative — default to fewer sets / lower reps
 *   - No randomisation beyond exercise order where allowed
 *   - Same exercises each session unless stage changes (Phase 2 adds variation)
 * ─────────────────────────────────────────────────────────────
 */

const WorkoutGenerator = (() => {

  // ── Time budgets (in minutes) ─────────────────────────────────
  const WARMUP_MINUTES    = 5;
  const COOLDOWN_MINUTES  = 2;  // just a reminder card, not real exercises
  const TRANSITION_BUFFER = 1;  // buffer per block

  // ── Main entry point ──────────────────────────────────────────

  /**
   * generateWorkout(forceNew = false)
   * Generates today's workout and saves it to storage.
   * If a workout already exists for today and forceNew is false, returns existing.
   *
   * Returns the Workout object.
   */
  function generateWorkout(forceNew = false) {
    // Return cached workout if already generated today
    if (!forceNew) {
      const existing = Storage.getTodaysWorkout();
      if (existing) return existing;
    }

    const profile = Storage.getProfile();
    if (!profile) {
      console.warn('[WorkoutGenerator] No profile found — cannot generate workout.');
      return null;
    }

    const stageId       = profile.progression.pullUpStage;
    const equipment     = profile.equipment;
    const timeTarget    = profile.sessionTimeTarget || 20;
    const secondaryGoals = profile.secondaryGoals || [];

    // Time budget
    let minutesRemaining = timeTarget - WARMUP_MINUTES - COOLDOWN_MINUTES;

    // ── 1. Warm-up ───────────────────────────────────────────────
    const warmupExercises = getWarmupExercises(equipment);
    const warmupSection = createWorkoutSection({
      type: SECTION_TYPES.WARMUP,
      label: 'Warm-Up',
      estimatedMinutes: WARMUP_MINUTES,
      exercises: warmupExercises.map(ex => buildPlannedExercise(ex, {
        sets: ex.defaultSets,
        reps: ex.defaultReps,
        duration: ex.defaultDuration,
      })),
    });

    // ── 2. Main block ────────────────────────────────────────────
    const volumeConfig   = ProgressionEngine.getSessionVolume(stageId, timeTarget);
    const primaryExercises = ProgressionEngine.selectPrimaryExercises(
      stageId, equipment, minutesRemaining
    );

    const mainExercisesPlanned = primaryExercises.map(ex =>
      buildPlannedExercise(ex, {
        sets: volumeConfig.sets,
        reps: ex.defaultReps,
        duration: ex.defaultDuration,
      })
    );

    const mainTimeUsed = ProgressionEngine.estimateExerciseTime(primaryExercises);
    minutesRemaining -= mainTimeUsed + TRANSITION_BUFFER;

    const mainSection = createWorkoutSection({
      type: SECTION_TYPES.MAIN,
      label: 'Main Work — ' + getStageLabelShort(stageId),
      estimatedMinutes: mainTimeUsed,
      exercises: mainExercisesPlanned,
    });

    // ── 3. Accessory block (if time allows) ──────────────────────
    const sections = [warmupSection, mainSection];

    if (secondaryGoals.length > 0 && minutesRemaining >= 5) {
      const accessoryExercises = ProgressionEngine.selectAccessoryExercises(
        secondaryGoals, equipment, minutesRemaining, profile
      );

      if (accessoryExercises.length > 0) {
        const accessoryPlanned = accessoryExercises.map(ex =>
          buildPlannedExercise(ex, {
            sets: ex.defaultSets,
            reps: ex.defaultReps,
            duration: ex.defaultDuration,
          })
        );

        const accessoryTime = ProgressionEngine.estimateExerciseTime(accessoryExercises);

        sections.push(createWorkoutSection({
          type: SECTION_TYPES.ACCESSORY,
          label: 'Accessory',
          estimatedMinutes: accessoryTime,
          exercises: accessoryPlanned,
        }));
      }
    }

    // ── 4. Cooldown note ─────────────────────────────────────────
    sections.push(createWorkoutSection({
      type: SECTION_TYPES.COOLDOWN,
      label: 'Cooldown',
      estimatedMinutes: COOLDOWN_MINUTES,
      exercises: [{
        exerciseId: '__cooldown__',
        name: 'Cooldown & Stretch',
        sets: 1,
        reps: null,
        durationSeconds: 120,
        restSeconds: 0,
        notes: 'Chest opener, lat stretch, wrist flexor stretch, 2 min deep breathing.',
      }],
    }));

    // ── 5. Assemble and save ─────────────────────────────────────
    const totalMinutes = sections.reduce((sum, s) => sum + s.estimatedMinutes, 0);

    const workout = createWorkout({
      date: todayISO(),
      pullUpStage: stageId,
      primaryGoal: profile.primaryGoal,
      estimatedMinutes: Math.min(totalMinutes, timeTarget),
      sections,
    });

    Storage.saveWorkout(workout);
    Storage.setCurrentWorkoutId(workout.id);

    return workout;
  }

  // ── Build helpers ─────────────────────────────────────────────

  /**
   * buildPlannedExercise(exercise, overrides)
   * Converts a library exercise entry into a PlannedExercise with
   * prescribed sets/reps for this session.
   */
  function buildPlannedExercise(exercise, overrides = {}) {
    return createPlannedExercise({
      exerciseId:      exercise.id,
      name:            exercise.name,
      sets:            overrides.sets  || exercise.defaultSets  || 3,
      reps:            overrides.reps  !== undefined ? overrides.reps  : exercise.defaultReps,
      durationSeconds: overrides.duration !== undefined ? overrides.duration : exercise.defaultDuration,
      restSeconds:     exercise.restSeconds || 60,
      notes:           exercise.cue || '',
    });
  }

  /**
   * getStageLabelShort(stageId)
   * Returns the short display label for a stage.
   */
  function getStageLabelShort(stageId) {
    const stage = getStageById(stageId);
    return stage ? stage.label : 'Training';
  }

  // ── Public API ────────────────────────────────────────────────

  return {
    generateWorkout,
    buildPlannedExercise,
  };

})();
