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
    renderChangeReasons(workout, container);  // Phase 2: show adaptations first
    renderSections(workout, container, false);

    if (startBar) startBar.style.display = 'block';
  }

  // ── Phase 2: "Why this changed" card ─────────────────────────

  /**
   * renderChangeReasons(workout, container)
   * If the workout has adaptation change reasons, renders a collapsible
   * "What adapted today" card above the exercise sections.
   */
  function renderChangeReasons(workout, container) {
    const reasons = workout.changeReasons;
    if (!reasons || reasons.length === 0) return;

    const flagConfig = {
      progress: { icon: '✅', label: 'Progressed',  cssClass: 'flag-progress'  },
      hold:     { icon: '⏸',  label: 'Held Steady', cssClass: 'flag-hold'      },
      reduce:   { icon: '📉', label: 'Reduced',     cssClass: 'flag-reduce'    },
      regress:  { icon: '📉', label: 'Stepped Back', cssClass: 'flag-regress'  },
      modified: { icon: '⚠️', label: 'Modified',    cssClass: 'flag-modified'  },
    };

    const rowsHTML = reasons.map(r => {
      const cfg = flagConfig[r.flag] || { icon: '•', label: r.flag, cssClass: '' };

      // Build the change string (e.g. "3×8 → 3×9") only when prescription changed
      let changeStr = '';
      if (r.adaptedFrom && r.adaptedTo) {
        changeStr = `<span class="change-delta">${AdaptiveEngine.formatAdaptationChange(r.adaptedFrom, r.adaptedTo)}</span>`;
      }

      return `
        <div class="change-reason-row ${cfg.cssClass}">
          <div class="change-reason-icon">${cfg.icon}</div>
          <div class="change-reason-body">
            <div class="change-reason-exercise">${r.exerciseName} ${changeStr}</div>
            <div class="change-reason-text">${r.reason}</div>
          </div>
        </div>
      `;
    }).join('');

    const card = document.createElement('div');
    card.className = 'change-reasons-card';
    card.innerHTML = `
      <div class="change-reasons-header" onclick="WorkoutView.toggleChangeReasons(this)">
        <span class="change-reasons-title">↕ What adapted today (${reasons.length})</span>
        <span class="change-reasons-chevron">▾</span>
      </div>
      <div class="change-reasons-body open" id="change-reasons-body">
        ${rowsHTML}
      </div>
    `;
    container.appendChild(card);
  }

  /**
   * toggleChangeReasons(headerEl)
   * Collapses or expands the change reasons list.
   */
  function toggleChangeReasons(headerEl) {
    const body = document.getElementById('change-reasons-body');
    if (!body) return;
    body.classList.toggle('open');
    const chevron = headerEl.querySelector('.change-reasons-chevron');
    if (chevron) chevron.textContent = body.classList.contains('open') ? '▾' : '▸';
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

    // Phase 2: show a small indicator if the prescription was adapted
    const adaptedDot = ex.adaptedFrom
      ? `<span class="adapted-dot" title="${ex.adaptationReason || 'Adapted'}">●</span>`
      : '';

    card.innerHTML = `
      <div class="exercise-card-header">
        <span class="exercise-name">${ex.name} ${adaptedDot}</span>
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
  return { render, toggleChangeReasons };

})();
