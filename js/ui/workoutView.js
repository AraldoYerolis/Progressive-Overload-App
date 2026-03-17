/**
 * workoutView.js
 * ─────────────────────────────────────────────────────────────
 * Renders the "Today's Workout" screen.
 *
 * Reads today's generated workout from storage and builds
 * the full card-based workout display with exercise prescriptions,
 * coaching cues, and rest times.
 * ─────────────────────────────────────────────────────────────
 */

const WorkoutView = (() => {

  /**
   * render()
   * Main entry point — called by App.showScreen('today').
   */
  function render() {
    updateDateHeader();

    const workout = Storage.getTodaysWorkout();
    const container = document.getElementById('today-workout-container');
    const emptyState = document.getElementById('today-empty');
    const startBar = document.getElementById('start-workout-bar');

    if (!workout) {
      // Generate one now if missing
      const generated = WorkoutGenerator.generateWorkout(false);
      if (!generated) {
        container.innerHTML = '';
        if (emptyState) emptyState.style.display = 'block';
        if (startBar)   startBar.style.display = 'none';
        return;
      }
      renderWorkout(generated);
      return;
    }

    if (emptyState) emptyState.style.display = 'none';
    renderWorkout(workout);
  }

  /**
   * renderWorkout(workout)
   * Builds all workout section cards and injects them into the DOM.
   */
  function renderWorkout(workout) {
    const container = document.getElementById('today-workout-container');
    const startBar  = document.getElementById('start-workout-bar');

    // Update header badges
    const durationEl = document.getElementById('today-duration');
    const stageEl    = document.getElementById('today-stage');
    if (durationEl) durationEl.textContent = `${workout.estimatedMinutes} min`;
    if (stageEl)    stageEl.textContent    = getStageLabelShort(workout.pullUpStage);

    // Check if this workout was already logged today
    const todayLog = getTodayLog(workout.id);
    const isCompleted = todayLog && todayLog.completed;

    if (isCompleted) {
      container.innerHTML = `
        <div class="card" style="text-align:center; padding:24px;">
          <div style="font-size:40px;margin-bottom:12px;">✅</div>
          <h3 style="color:var(--accent-green);margin-bottom:8px;">Workout Complete!</h3>
          <p style="color:var(--text-secondary);font-size:14px;">Great work today. Rest up and come back tomorrow.</p>
        </div>
      `;
      if (startBar) startBar.style.display = 'none';
      renderSections(workout, container, true);
      return;
    }

    container.innerHTML = '';
    renderSections(workout, container, false);

    if (startBar) startBar.style.display = 'block';
  }

  /**
   * renderSections(workout, container, readOnly)
   * Renders each workout section as a card.
   */
  function renderSections(workout, container, readOnly) {
    workout.sections.forEach(section => {
      const sectionEl = document.createElement('div');
      sectionEl.className = 'workout-section';

      // Section header
      const sectionIconMap = {
        warmup:    '🔥',
        main:      '💪',
        accessory: '➕',
        cooldown:  '🧘',
      };
      const icon = sectionIconMap[section.type] || '▸';
      const badgeText = `~${section.estimatedMinutes} min`;

      sectionEl.innerHTML = `
        <div class="workout-section-header">
          <h3>${icon} ${section.label}</h3>
          <span class="section-badge">${badgeText}</span>
        </div>
      `;

      // Exercise cards
      section.exercises.forEach(ex => {
        sectionEl.appendChild(buildExerciseCard(ex, section.type));
      });

      container.appendChild(sectionEl);
    });
  }

  /**
   * buildExerciseCard(plannedExercise, sectionType)
   * Creates a single exercise card element.
   */
  function buildExerciseCard(ex, sectionType) {
    const card = document.createElement('div');
    card.className = 'exercise-card';

    // Special rendering for cooldown marker
    if (ex.exerciseId === '__cooldown__') {
      card.innerHTML = `
        <div class="exercise-card-header">
          <span class="exercise-name">${ex.name}</span>
          <span class="exercise-prescription">~2 min</span>
        </div>
        <div class="exercise-cue">${ex.notes || 'Stretch, breathe, recover.'}</div>
      `;
      return card;
    }

    const prescription = buildPrescriptionText(ex);
    const restText     = ex.restSeconds > 0 ? `Rest: ${formatRestTime(ex.restSeconds)}` : '';

    card.innerHTML = `
      <div class="exercise-card-header">
        <span class="exercise-name">${ex.name}</span>
        <span class="exercise-prescription">${prescription}</span>
      </div>
      ${ex.notes ? `<div class="exercise-cue">"${ex.notes}"</div>` : ''}
      ${restText ? `<div class="exercise-rest">⏱ ${restText}</div>` : ''}
    `;

    return card;
  }

  /**
   * buildPrescriptionText(plannedExercise)
   * Formats the sets/reps/duration into a human-readable string.
   * e.g. "3×8", "3×20s", "4×5"
   */
  function buildPrescriptionText(ex) {
    const sets = ex.sets || 3;
    if (ex.durationSeconds) {
      return `${sets}×${ex.durationSeconds}s`;
    }
    if (ex.reps) {
      return `${sets}×${ex.reps}`;
    }
    return `${sets} sets`;
  }

  /**
   * Returns a human-readable rest time.
   * e.g. 90 → '1:30', 60 → '60s'
   */
  function formatRestTime(seconds) {
    if (seconds >= 60) {
      const m = Math.floor(seconds / 60);
      const s = seconds % 60;
      return s > 0 ? `${m}:${String(s).padStart(2, '0')}` : `${m} min`;
    }
    return `${seconds}s`;
  }

  /**
   * getStageLabelShort(stageId)
   */
  function getStageLabelShort(stageId) {
    const stage = getStageById(stageId);
    return stage ? stage.shortLabel : 'Training';
  }

  /**
   * updateDateHeader()
   * Sets the date display in the today screen header.
   */
  function updateDateHeader() {
    const el = document.getElementById('today-date');
    if (!el) return;
    const now = new Date();
    el.textContent = now.toLocaleDateString('en-US', {
      weekday: 'long', month: 'long', day: 'numeric'
    });
  }

  /**
   * getTodayLog(workoutId)
   * Returns today's completed log for this workout if it exists.
   */
  function getTodayLog(workoutId) {
    const today = todayISO();
    const logs = Storage.getLogsSorted();
    return logs.find(l => l.date === today && l.workoutId === workoutId) || null;
  }

  // ── Public API ────────────────────────────────────────────────
  return { render };

})();
