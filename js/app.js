/**
 * app.js
 * ─────────────────────────────────────────────────────────────
 * Main application controller.
 *
 * Responsibilities:
 *   - Initialise the app on page load
 *   - Route to onboarding vs. main app
 *   - Handle screen switching within the main app
 *   - Manage the log screen initialisation handoff
 *   - Provide the global resetApp() function
 *   - Seed demo data for testing
 * ─────────────────────────────────────────────────────────────
 */

const App = (() => {

  let currentScreen = 'today';

  // ── Initialise ────────────────────────────────────────────────

  /**
   * init()
   * Called on DOMContentLoaded.
   * Checks onboarding state and routes accordingly.
   */
  function init() {
    if (Storage.isOnboarded()) {
      launchMainApp();
    } else {
      showOnboarding();
    }
  }

  /**
   * showOnboarding()
   * Shows the onboarding screen, hides the main app.
   */
  function showOnboarding() {
    document.getElementById('screen-onboarding').style.display = 'block';
    document.getElementById('screen-main').style.display = 'none';
  }

  /**
   * launchMainApp()
   * Transitions from onboarding (or cold start) to the main app shell.
   * Generates a workout if one doesn't exist for today.
   */
  function launchMainApp() {
    document.getElementById('screen-onboarding').style.display = 'none';
    document.getElementById('screen-main').style.display = 'block';

    // Ensure today's workout exists
    WorkoutGenerator.generateWorkout(false);

    // Show the today screen
    showScreen('today');
  }

  // ── Screen routing ────────────────────────────────────────────

  /**
   * showScreen(screenName)
   * Switches the active main screen and calls the screen's render function.
   *
   * screenName: 'today' | 'log' | 'history' | 'settings'
   */
  function showScreen(screenName) {
    // Hide all main screens
    document.querySelectorAll('.main-screen').forEach(el => {
      el.classList.remove('active');
    });

    // Update bottom nav tabs (all except 'log' which has no nav tab)
    document.querySelectorAll('.nav-tab').forEach(tab => {
      tab.classList.toggle('active', tab.dataset.screen === screenName);
    });

    const targetEl = document.getElementById(`screen-${screenName}`);
    if (!targetEl) {
      console.warn(`[App] Screen not found: ${screenName}`);
      return;
    }

    targetEl.classList.add('active');
    currentScreen = screenName;

    // Scroll screen content to top
    const content = targetEl.querySelector('.screen-content');
    if (content) content.scrollTop = 0;

    // Call each screen's render / init function
    switch (screenName) {
      case 'today':
        WorkoutView.render();
        break;

      case 'log':
        Logger.initLog();
        break;

      case 'history':
        HistoryView.render();
        break;

      case 'settings':
        SettingsView.render();
        break;
    }
  }

  // ── Reset ─────────────────────────────────────────────────────

  /**
   * resetApp()
   * Full reset — clears all localStorage data and reloads to onboarding.
   */
  function resetApp() {
    const confirmed = window.confirm(
      'Reset the app? This will delete ALL your data including workout history. This cannot be undone.'
    );
    if (!confirmed) return;

    Storage.resetAll();
    window.location.reload();
  }

  // ── Seed Demo Data ────────────────────────────────────────────

  /**
   * seedDemoData()
   * Seeds the app with a realistic beginner-intermediate user profile
   * for demonstration and testing purposes.
   *
   * Call from console: App.seedDemoData()
   */
  function seedDemoData() {
    // Demo profile: 6 weeks of training, currently at strict_strength stage
    const profile = createUserProfile({
      primaryGoal: GOALS.MUSCLE_UP,
      secondaryGoals: [
        SECONDARY_GOALS.SQUAT_THRUST_PUSHUP,
        SECONDARY_GOALS.CALVES,
        SECONDARY_GOALS.TIBIALIS,
      ],
      equipment: [
        EQUIPMENT.PULL_UP_BAR,
        EQUIPMENT.RESISTANCE_BANDS,
        EQUIPMENT.DIP_BARS,
        EQUIPMENT.BOX_OR_BENCH,
      ],
      sessionTimeTarget: 25,
      ability: {
        maxPullUps:       3,
        deadHangSeconds:  45,
        topHoldSeconds:   5,
        bandPullUps:      'light',
        explosiveLevel:   0,
        dipStrength:      1,
        maxPushUps:       15,
        maxSquatThrust:   10,
        singleLegCalf:    5,
        tibialisRaises:   10,
      },
      progression: {
        pullUpStage: PULL_UP_STAGES.STRICT_STRENGTH.id,
        sessionsSinceStageStart: 4,
        lastWorkoutDate: getPastDateISO(1), // trained yesterday
        totalWorkoutsCompleted: 14,
        consecutiveDays: 4,
      },
    });

    Storage.saveProfile(profile);
    Storage.setOnboarded(true);

    // Seed some historical workout logs
    seedDemoLogs(profile);

    // Generate today's workout
    WorkoutGenerator.generateWorkout(true);

    console.log('[App] Demo data seeded. Reloading…');
    window.location.reload();
  }

  /**
   * seedDemoLogs(profile)
   * Creates realistic historical workout logs for the demo user.
   */
  function seedDemoLogs(profile) {
    const demoSessions = [
      // Session 1 — 14 days ago (dead_hang_base stage)
      {
        daysAgo: 14,
        stage: 'dead_hang_base',
        exercises: [
          { id: 'dead_hang',    sets: 3, metric: 'durationSeconds', values: [20, 18, 15], rpe: 7 },
          { id: 'scapular_pull', sets: 3, metric: 'repsCompleted',   values: [6, 5, 5],   rpe: 6 },
        ],
      },
      // Session 2
      {
        daysAgo: 12,
        stage: 'dead_hang_base',
        exercises: [
          { id: 'dead_hang',    sets: 3, metric: 'durationSeconds', values: [25, 22, 20], rpe: 7 },
          { id: 'scapular_pull', sets: 3, metric: 'repsCompleted',   values: [8, 7, 7],   rpe: 6 },
        ],
      },
      // Session 3 — moved to assisted_volume
      {
        daysAgo: 10,
        stage: 'assisted_volume',
        exercises: [
          { id: 'band_assisted_pullup_heavy', sets: 4, metric: 'repsCompleted', values: [6, 5, 5, 4], rpe: 8 },
          { id: 'dead_hang',                  sets: 2, metric: 'durationSeconds', values: [30, 28],    rpe: 5 },
        ],
      },
      // Session 4
      {
        daysAgo: 8,
        stage: 'assisted_volume',
        exercises: [
          { id: 'jumping_pullup_negative', sets: 3, metric: 'repsCompleted', values: [5, 5, 5], rpe: 8 },
          { id: 'full_pushup',             sets: 3, metric: 'repsCompleted', values: [12, 10, 10], rpe: 6 },
        ],
      },
      // Session 5 — moved to strict_strength
      {
        daysAgo: 6,
        stage: 'strict_strength',
        exercises: [
          { id: 'strict_pullup',   sets: 3, metric: 'repsCompleted', values: [2, 2, 1], rpe: 9 },
          { id: 'pullup_top_hold', sets: 3, metric: 'durationSeconds', values: [5, 4, 3], rpe: 8 },
        ],
      },
      // Session 6
      {
        daysAgo: 4,
        stage: 'strict_strength',
        exercises: [
          { id: 'strict_pullup',              sets: 4, metric: 'repsCompleted',   values: [3, 2, 2, 2],  rpe: 8 },
          { id: 'pullup_top_hold',             sets: 3, metric: 'durationSeconds', values: [6, 5, 5],     rpe: 7 },
          { id: 'single_leg_calf_raise_assisted', sets: 3, metric: 'repsCompleted', values: [8, 7, 7],   rpe: 5 },
        ],
      },
      // Session 7
      {
        daysAgo: 2,
        stage: 'strict_strength',
        exercises: [
          { id: 'strict_pullup',   sets: 4, metric: 'repsCompleted',   values: [4, 3, 3, 2], rpe: 8 },
          { id: 'pullup_top_hold', sets: 3, metric: 'durationSeconds', values: [7, 6, 6],     rpe: 7 },
          { id: 'squat_thrust_pushup_combo', sets: 3, metric: 'repsCompleted', values: [6, 5, 5], rpe: 6 },
        ],
      },
      // Session 8 — yesterday
      {
        daysAgo: 1,
        stage: 'strict_strength',
        exercises: [
          { id: 'strict_pullup',   sets: 4, metric: 'repsCompleted',   values: [5, 4, 3, 3], rpe: 8 },
          { id: 'pullup_top_hold', sets: 3, metric: 'durationSeconds', values: [8, 7, 7],     rpe: 7 },
          { id: 'tibialis_raise_seated', sets: 2, metric: 'repsCompleted', values: [20, 20],  rpe: 3 },
        ],
      },
    ];

    demoSessions.forEach(session => {
      const dateStr = getPastDateISO(session.daysAgo);
      const startTs = Date.now() - (session.daysAgo * 86400000);

      // Build a minimal workout object for this historical session
      const workoutId = generateId('wo');
      const workout = createWorkout({
        id: workoutId,
        date: dateStr,
        pullUpStage: session.stage,
        primaryGoal: GOALS.MUSCLE_UP,
        estimatedMinutes: 25,
        sections: [],
      });
      Storage.saveWorkout(workout);

      // Build the log
      const exLogs = session.exercises.map(ex => {
        const libEx = ExerciseLibrary[ex.id];
        const setLogs = ex.values.map((v, i) => {
          const setLog = createSetLog({ setNumber: i + 1, completed: true });
          setLog[ex.metric] = v;
          return setLog;
        });
        return createExerciseLog({
          exerciseId:  ex.id,
          name:        libEx ? libEx.name : ex.id,
          plannedSets: ex.sets,
          setLogs,
          rpe:         ex.rpe,
          completed:   true,
        });
      });

      const log = createWorkoutLog({
        workoutId,
        date:       dateStr,
        startedAt:  startTs,
        finishedAt: startTs + (25 * 60000),
        completed:  true,
        exerciseLogs: exLogs,
        overallNotes: session.daysAgo === 1 ? 'Felt strong today. Pull-ups getting cleaner.' : '',
      });

      Storage.saveLog(log);
    });
  }

  // ── Date helper ───────────────────────────────────────────────

  /**
   * Returns an ISO date string `daysAgo` days before today.
   */
  function getPastDateISO(daysAgo) {
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  // ── DOMContentLoaded ──────────────────────────────────────────

  document.addEventListener('DOMContentLoaded', init);

  // ── Public API ────────────────────────────────────────────────
  return {
    init,
    showOnboarding,
    launchMainApp,
    showScreen,
    resetApp,
    seedDemoData,
    getPastDateISO,
  };

})();
