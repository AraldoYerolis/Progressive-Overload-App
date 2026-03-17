/**
 * onboarding.js
 * ─────────────────────────────────────────────────────────────
 * Manages the multi-step onboarding flow.
 *
 * Steps:
 *   1  — Welcome / intro
 *   2  — Primary goal selection
 *   3  — Secondary goals (multi-select)
 *   4  — Equipment (multi-select)
 *   5  — Session time + ability inputs
 *
 * On finish: creates a UserProfile, determines starting stage,
 * generates the first workout, and hands off to the main app.
 * ─────────────────────────────────────────────────────────────
 */

const Onboarding = (() => {

  let currentStep = 1;
  const TOTAL_STEPS = 5;

  // Temporary state accumulated across steps
  const state = {
    primaryGoal:    null,
    secondaryGoals: [],
    equipment:      [EQUIPMENT.PULL_UP_BAR], // pull-up bar pre-selected
    sessionTime:    20,
  };

  // ── Navigation ────────────────────────────────────────────────

  function nextStep() {
    if (currentStep === TOTAL_STEPS) {
      finish();
      return;
    }
    goToStep(currentStep + 1);
  }

  function prevStep() {
    if (currentStep <= 1) return;
    goToStep(currentStep - 1);
  }

  function goToStep(n) {
    const current = document.querySelector(`.onboarding-step[data-step="${currentStep}"]`);
    const next    = document.querySelector(`.onboarding-step[data-step="${n}"]`);
    if (!next) return;

    if (current) current.classList.remove('active');
    next.classList.add('active');
    currentStep = n;

    // Scroll to top of container
    const container = document.querySelector('.onboarding-container');
    if (container) container.scrollTop = 0;
  }

  // ── Step 2: Primary goal ──────────────────────────────────────

  function selectPrimaryGoal(btn) {
    // Deselect all
    document.querySelectorAll('#primary-goal-grid .option-card').forEach(b => {
      b.classList.remove('selected');
    });
    btn.classList.add('selected');
    state.primaryGoal = btn.dataset.value;

    // Enable Next button
    const nextBtn = document.getElementById('goal-next-btn');
    if (nextBtn) nextBtn.disabled = false;
  }

  // ── Step 3: Secondary goals ───────────────────────────────────

  function toggleSecondaryGoal(btn) {
    btn.classList.toggle('selected');
    const val = btn.dataset.value;
    if (btn.classList.contains('selected')) {
      if (!state.secondaryGoals.includes(val)) state.secondaryGoals.push(val);
    } else {
      state.secondaryGoals = state.secondaryGoals.filter(g => g !== val);
    }
  }

  // ── Step 4: Equipment ─────────────────────────────────────────

  function toggleEquipment(btn) {
    btn.classList.toggle('selected');
    const val = btn.dataset.value;
    if (btn.classList.contains('selected')) {
      if (!state.equipment.includes(val)) state.equipment.push(val);
    } else {
      // Don't remove pull-up bar (required for main goal)
      if (val === EQUIPMENT.PULL_UP_BAR) {
        btn.classList.add('selected');
        return;
      }
      state.equipment = state.equipment.filter(e => e !== val);
    }
  }

  // ── Step 5: Session time ──────────────────────────────────────

  function selectTime(btn) {
    document.querySelectorAll('.time-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    state.sessionTime = parseInt(btn.dataset.value, 10);
  }

  // ── Collect ability inputs ────────────────────────────────────

  function collectAbilityInputs() {
    const val = id => {
      const el = document.getElementById(id);
      return el ? el.value : null;
    };

    return {
      maxPullUps:       parseInt(val('input-max-pullups'), 10)  || 0,
      deadHangSeconds:  parseInt(val('input-dead-hang'), 10)    || 0,
      topHoldSeconds:   parseInt(val('input-top-hold'), 10)     || 0,
      bandPullUps:      val('input-band-pullups') || 'none',
      explosiveLevel:   parseInt(val('input-explosive'), 10)    || 0,
      dipStrength:      parseInt(val('input-dips'), 10)         || 0,
      maxPushUps:       parseInt(val('input-pushups'), 10)      || 0,
      maxSquatThrust:   parseInt(val('input-squat-thrust'), 10) || 0,
      singleLegCalf:    parseInt(val('input-calf'), 10)         || 0,
      tibialisRaises:   parseInt(val('input-tibialis'), 10)     || 0,
    };
  }

  // ── Finish: build profile + generate workout ──────────────────

  function finish() {
    const ability = collectAbilityInputs();

    // Determine starting stage from ability
    const startingStageId = ProgressionEngine.determineStartingStage(ability);

    // Build the user profile
    const profile = createUserProfile({
      primaryGoal:         state.primaryGoal || GOALS.MUSCLE_UP,
      secondaryGoals:      state.secondaryGoals,
      equipment:           state.equipment,
      sessionTimeTarget:   state.sessionTime,
      ability,
      progression: {
        pullUpStage:              startingStageId,
        sessionsSinceStageStart:  0,
        lastWorkoutDate:          null,
        totalWorkoutsCompleted:   0,
        consecutiveDays:          0,
      },
    });

    // Persist
    Storage.saveProfile(profile);
    Storage.setOnboarded(true);

    // Generate first workout
    WorkoutGenerator.generateWorkout(true);

    // Transition to main app
    App.launchMainApp();
  }

  // ── Public API ────────────────────────────────────────────────

  return {
    nextStep,
    prevStep,
    goToStep,
    selectPrimaryGoal,
    toggleSecondaryGoal,
    toggleEquipment,
    selectTime,
    finish,
  };

})();
