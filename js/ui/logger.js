/**
 * logger.js
 * ─────────────────────────────────────────────────────────────
 * Manages the "Log Workout" screen.
 *
 * Renders one block per exercise with:
 *   - Planned sets/reps/duration shown as reference
 *   - Input fields for actual reps / time per set
 *   - "Done" toggle button per set (tap to mark complete)
 *   - RPE selector per exercise
 *   - Notes field per exercise (parsed for signals on finish)
 *
 * Phase 2 additions:
 *   - On "Finish", NoteParser runs on all notes and stores
 *     parsedSignals on each ExerciseLog and on the WorkoutLog.
 *   - These signals are read by AdaptiveEngine the next time a
 *     workout is generated.
 *
 * On "Finish", creates and saves a WorkoutLog, updates the
 * user's progression stats, checks for stage advancement,
 * then shows a completion overlay.
 * ─────────────────────────────────────────────────────────────
 */

const Logger = (() => {

  // Active log being built during this session
  let activeLog = null;
  // Map of exerciseId → { rpe, notes, setLogs[] } (in-memory state)
  let exerciseState = {};

  // ── Initialise ────────────────────────────────────────────────

  /**
   * initLog()
   * Called when the user taps "Start Workout".
   * Creates a new WorkoutLog (or resumes an in-progress one).
   */
  function initLog() {
    const workout = Storage.getTodaysWorkout();
    if (!workout) return;

    // Check for an in-progress log from today
    const existing = Storage.getActiveLog();
    if (existing && existing.date === todayISO() && existing.workoutId === workout.id) {
      activeLog = existing;
    } else {
      activeLog = createWorkoutLog({
        workoutId: workout.id,
        date: todayISO(),
        startedAt: Date.now(),
      });
      Storage.saveLog(activeLog);
      Storage.setActiveLogId(activeLog.id);
    }

    // Initialise exercise state from existing log (if resuming)
    exerciseState = {};
    if (activeLog.exerciseLogs && activeLog.exerciseLogs.length > 0) {
      activeLog.exerciseLogs.forEach(el => {
        exerciseState[el.exerciseId] = {
          rpe:     el.rpe,
          notes:   el.notes,
          setLogs: el.setLogs.slice(),
        };
      });
    }

    renderLog(workout);
  }

  // ── Render ────────────────────────────────────────────────────

  /**
   * renderLog(workout)
   * Builds the full log UI from the workout's sections.
   */
  function renderLog(workout) {
    const container = document.getElementById('log-exercise-list');
    if (!container) return;
    container.innerHTML = '';

    workout.sections.forEach(section => {
      if (section.type === SECTION_TYPES.COOLDOWN) return; // skip cooldown in log

      section.exercises.forEach(ex => {
        if (ex.exerciseId === '__cooldown__') return;
        container.appendChild(buildExerciseBlock(ex));
      });
    });
  }

  /**
   * buildExerciseBlock(plannedExercise)
   * Creates a full logging block for one exercise.
   */
  function buildExerciseBlock(ex) {
    const exId = ex.exerciseId;
    const state = exerciseState[exId] || { rpe: null, notes: '', setLogs: [] };

    const sets = ex.sets || 3;
    const isTimeBased = !!ex.durationSeconds;
    const plannedLabel = isTimeBased
      ? `${sets}×${ex.durationSeconds}s`
      : `${sets}×${ex.reps || '?'} reps`;

    // Ensure setLogs has enough entries
    while (state.setLogs.length < sets) {
      state.setLogs.push(createSetLog({ setNumber: state.setLogs.length + 1 }));
    }
    exerciseState[exId] = state;

    // Determine current quick-state for visual highlight
    const allDone    = state.setLogs.length > 0 && state.setLogs.every(s => s.completed);
    const noneDone   = state.setLogs.every(s => !s.completed);
    const quickClass = allDone ? 'qc-state-done' : (!noneDone ? 'qc-state-partial' : '');

    const block = document.createElement('div');
    block.className = `log-exercise-block ${quickClass}`;
    block.id = `log-block-${exId}`;

    // Header
    block.innerHTML = `
      <div class="log-exercise-header">
        <div class="log-exercise-name">${ex.name}</div>
        <div class="log-exercise-planned">Planned: ${plannedLabel}</div>
      </div>
      <div class="log-exercise-body" id="log-body-${exId}">
        ${buildQuickCompletionHTML(exId, state)}
        ${buildSetRowsHTML(ex, state, isTimeBased)}
        ${buildEffortRowHTML(exId, state.rpe)}
        ${buildNotesRowHTML(exId, state.notes)}
        ${buildNoteChipsHTML(exId)}
      </div>
    `;

    return block;
  }

  /**
   * buildQuickCompletionHTML(exerciseId, state)
   * Returns the quick-tap completion state row:
   * [ ✓ All Done ] [ ~ Partial ] [ ✗ Missed ]
   */
  function buildQuickCompletionHTML(exerciseId, state) {
    const allDone  = state.setLogs.length > 0 && state.setLogs.every(s => s.completed);
    const noneDone = state.setLogs.every(s => !s.completed);
    const partial  = !allDone && !noneDone;

    const doneActive    = allDone  ? 'active' : '';
    const partialActive = partial  ? 'active' : '';
    const missedActive  = noneDone && state.setLogs.some(s => s.setNumber > 0) ? '' : '';

    return `
      <div class="quick-completion-row">
        <button class="qc-btn qc-done ${doneActive}"
          id="qc-${exerciseId}-done"
          onclick="Logger.setExerciseQuickState('${exerciseId}', 'done')">✓ All Done</button>
        <button class="qc-btn qc-partial ${partialActive}"
          id="qc-${exerciseId}-partial"
          onclick="Logger.setExerciseQuickState('${exerciseId}', 'partial')">~ Partial</button>
        <button class="qc-btn qc-missed ${missedActive}"
          id="qc-${exerciseId}-missed"
          onclick="Logger.setExerciseQuickState('${exerciseId}', 'missed')">✗ Missed</button>
      </div>
    `;
  }

  /**
   * buildNoteChipsHTML(exerciseId)
   * Returns quick note chips below the notes textarea.
   */
  function buildNoteChipsHTML(exerciseId) {
    const chips = [
      { label: 'Felt easy',        text: 'easy'   },
      { label: 'Hard effort',      text: 'hard'   },
      { label: 'Grip failed',      text: 'grip'   },
      { label: 'Joint discomfort', text: 'joints' },
      { label: 'Still sore',       text: 'sore'   },
      { label: 'Poor sleep',       text: 'tired'  },
    ];
    const btns = chips.map(c =>
      `<button class="note-chip" onclick="Logger.appendNoteChip('${exerciseId}', '${c.text}')">${c.label}</button>`
    ).join('');
    return `<div class="note-chips-row">${btns}</div>`;
  }

  /**
   * buildSetRowsHTML(ex, state, isTimeBased)
   * Returns the HTML for all set input rows.
   */
  function buildSetRowsHTML(ex, state, isTimeBased) {
    let html = `
      <div class="set-row" style="font-size:11px;color:var(--text-muted);padding-bottom:6px;">
        <div>SET</div>
        <div style="text-align:center">${isTimeBased ? 'Planned (s)' : 'Planned'}</div>
        <div style="text-align:center">${isTimeBased ? 'Actual (s)' : 'Actual reps'}</div>
        <div style="text-align:center">Done</div>
      </div>
    `;

    for (let i = 0; i < (ex.sets || 3); i++) {
      const setLog = state.setLogs[i] || {};
      const planned = isTimeBased ? ex.durationSeconds : ex.reps;
      const actualVal = isTimeBased ? (setLog.durationSeconds || '') : (setLog.repsCompleted || '');
      const doneClass = setLog.completed ? 'completed' : '';

      html += `
        <div class="set-row" id="set-row-${ex.exerciseId}-${i}">
          <div class="set-label">S${i + 1}</div>
          <div>
            <input class="set-input" type="number" min="0" value="${planned || ''}"
              placeholder="${planned || ''}" readonly style="color:var(--text-muted);" />
          </div>
          <div>
            <input class="set-input" type="number" min="0"
              placeholder="${planned || 0}"
              value="${actualVal}"
              onchange="Logger.updateSetValue('${ex.exerciseId}', ${i}, '${isTimeBased ? 'durationSeconds' : 'repsCompleted'}', this.value)"
              oninput="Logger.updateSetValue('${ex.exerciseId}', ${i}, '${isTimeBased ? 'durationSeconds' : 'repsCompleted'}', this.value)"
            />
          </div>
          <div>
            <button class="set-done-btn ${doneClass}"
              id="done-btn-${ex.exerciseId}-${i}"
              onclick="Logger.toggleSetDone('${ex.exerciseId}', ${i})">
              ${setLog.completed ? '✓' : '○'}
            </button>
          </div>
        </div>
      `;
    }

    return html;
  }

  /**
   * buildEffortRowHTML(exerciseId, currentRPE)
   * Returns the effort selector row HTML with beginner-friendly labels.
   * Internally still maps to RPE 6–10.
   */
  function buildEffortRowHTML(exerciseId, currentRPE) {
    const effortLevels = [
      { value: 6,  label: '6', sub: 'Easy'    },
      { value: 7,  label: '7', sub: 'Mod'     },
      { value: 8,  label: '8', sub: 'Hard'    },
      { value: 9,  label: '9', sub: 'V.Hard'  },
      { value: 10, label: '10',sub: 'Max'     },
    ];
    const btns = effortLevels.map(e => {
      const selected = currentRPE === e.value ? 'selected' : '';
      return `<button class="effort-btn ${selected}"
        onclick="Logger.setRPE('${exerciseId}', ${e.value})"
        id="rpe-${exerciseId}-${e.value}">
        <span class="effort-num">${e.label}</span>
        <span class="effort-sub">${e.sub}</span>
      </button>`;
    }).join('');

    return `
      <div class="effort-row">
        <span class="effort-label">How hard?</span>
        <div class="effort-btns">${btns}</div>
      </div>
    `;
  }

  /**
   * buildNotesRowHTML(exerciseId, currentNotes)
   */
  function buildNotesRowHTML(exerciseId, currentNotes) {
    return `
      <div class="notes-row">
        <textarea class="notes-input"
          id="notes-${exerciseId}"
          placeholder="Notes — pain, easy, grip, sore, tired, form… (parsed for next session)"
          oninput="Logger.updateNotes('${exerciseId}', this.value)">${currentNotes || ''}</textarea>
      </div>
    `;
  }

  // ── Live update handlers ──────────────────────────────────────

  /**
   * updateSetValue(exerciseId, setIndex, field, value)
   * Called oninput on the actual reps/time field.
   */
  function updateSetValue(exerciseId, setIndex, field, value) {
    ensureExerciseState(exerciseId, setIndex);
    const parsed = parseInt(value, 10);
    exerciseState[exerciseId].setLogs[setIndex][field] = isNaN(parsed) ? null : parsed;
    autosave();
  }

  /**
   * toggleSetDone(exerciseId, setIndex)
   * Toggles the completed state of a set and updates the button UI.
   */
  function toggleSetDone(exerciseId, setIndex) {
    ensureExerciseState(exerciseId, setIndex);
    const setLog = exerciseState[exerciseId].setLogs[setIndex];
    setLog.completed = !setLog.completed;

    const btn = document.getElementById(`done-btn-${exerciseId}-${setIndex}`);
    if (btn) {
      btn.classList.toggle('completed', setLog.completed);
      btn.textContent = setLog.completed ? '✓' : '○';
    }
    autosave();
  }

  /**
   * setRPE(exerciseId, value)
   * Sets the RPE for an exercise.
   */
  function setRPE(exerciseId, value) {
    if (!exerciseState[exerciseId]) {
      exerciseState[exerciseId] = { rpe: null, notes: '', setLogs: [] };
    }
    exerciseState[exerciseId].rpe = value;

    // Update button states
    [6, 7, 8, 9, 10].forEach(v => {
      const btn = document.getElementById(`rpe-${exerciseId}-${v}`);
      if (btn) btn.classList.toggle('selected', v === value);
    });
    autosave();
  }

  /**
   * updateNotes(exerciseId, text)
   */
  function updateNotes(exerciseId, text) {
    if (!exerciseState[exerciseId]) {
      exerciseState[exerciseId] = { rpe: null, notes: '', setLogs: [] };
    }
    exerciseState[exerciseId].notes = text;
    autosave();
  }

  /**
   * setExerciseQuickState(exerciseId, quickState)
   * Sets all sets to done / partial / missed in one tap.
   * 'done'    — all sets completed, pre-fills planned values if empty
   * 'partial' — first half of sets marked done
   * 'missed'  — all sets marked not completed
   */
  function setExerciseQuickState(exerciseId, quickState) {
    ensureExerciseState(exerciseId, 0);
    const state = exerciseState[exerciseId];

    // Resolve the planned exercise for pre-filling values
    const workout = Storage.getTodaysWorkout();
    const ex = workout
      ? workout.sections.flatMap(s => s.exercises).find(e => e.exerciseId === exerciseId)
      : null;

    const total = state.setLogs.length;
    state.setLogs.forEach((setLog, i) => {
      if (quickState === 'done') {
        setLog.completed = true;
        if (ex && !setLog.repsCompleted && ex.reps) setLog.repsCompleted = ex.reps;
        if (ex && !setLog.durationSeconds && ex.durationSeconds) setLog.durationSeconds = ex.durationSeconds;
      } else if (quickState === 'partial') {
        setLog.completed = i < Math.ceil(total / 2);
      } else {
        setLog.completed = false;
      }
    });

    // Refresh set-done button visuals
    state.setLogs.forEach((setLog, i) => {
      const btn = document.getElementById(`done-btn-${exerciseId}-${i}`);
      if (btn) {
        btn.classList.toggle('completed', setLog.completed);
        btn.textContent = setLog.completed ? '✓' : '○';
      }
    });

    // Highlight the selected quick-state button
    ['done', 'partial', 'missed'].forEach(s => {
      const btn = document.getElementById(`qc-${exerciseId}-${s}`);
      if (btn) btn.classList.toggle('active', s === quickState);
    });

    // Add a visual class to the exercise block
    const block = document.getElementById(`log-block-${exerciseId}`);
    if (block) {
      block.classList.remove('qc-state-done', 'qc-state-partial', 'qc-state-missed');
      if (quickState !== 'missed') block.classList.add(`qc-state-${quickState}`);
    }

    autosave();
  }

  /**
   * appendNoteChip(exerciseId, chipText)
   * Appends a quick-note chip keyword to the notes textarea.
   */
  function appendNoteChip(exerciseId, chipText) {
    const textarea = document.getElementById(`notes-${exerciseId}`);
    if (!textarea) return;
    const current = textarea.value.trim();
    textarea.value = current ? `${current}, ${chipText}` : chipText;
    updateNotes(exerciseId, textarea.value);
  }

  /**
   * ensureExerciseState(exerciseId, setIndex)
   * Makes sure exercise state and set array exist.
   */
  function ensureExerciseState(exerciseId, setIndex) {
    if (!exerciseState[exerciseId]) {
      exerciseState[exerciseId] = { rpe: null, notes: '', setLogs: [] };
    }
    while (exerciseState[exerciseId].setLogs.length <= setIndex) {
      exerciseState[exerciseId].setLogs.push(createSetLog({
        setNumber: exerciseState[exerciseId].setLogs.length + 1,
      }));
    }
  }

  // ── Autosave ──────────────────────────────────────────────────

  let _saveTimer = null;

  /**
   * autosave()
   * Debounced save to localStorage — fires 1s after last user input.
   */
  function autosave() {
    clearTimeout(_saveTimer);
    _saveTimer = setTimeout(() => {
      if (activeLog) {
        flushStateToLog();
        Storage.saveLog(activeLog);
      }
    }, 1000);
  }

  /**
   * flushStateToLog()
   * Writes the in-memory exerciseState into the activeLog object.
   */
  function flushStateToLog() {
    if (!activeLog) return;

    const workout = Storage.getTodaysWorkout();
    if (!workout) return;

    const exLogs = [];
    workout.sections.forEach(section => {
      section.exercises.forEach(ex => {
        if (ex.exerciseId === '__cooldown__') return;
        const state = exerciseState[ex.exerciseId] || { rpe: null, notes: '', setLogs: [] };
        const anyCompleted = state.setLogs.some(s => s.completed);

        exLogs.push(createExerciseLog({
          exerciseId:            ex.exerciseId,
          name:                  ex.name,
          plannedSets:           ex.sets,
          plannedReps:           ex.reps,
          plannedDurationSeconds: ex.durationSeconds,
          setLogs:               state.setLogs,
          rpe:                   state.rpe,
          completed:             anyCompleted,
          missed:                false,
          notes:                 state.notes,
        }));
      });
    });

    activeLog.exerciseLogs = exLogs;
  }

  // ── Finish Workout ────────────────────────────────────────────

  /**
   * finishWorkout()
   * Finalises the log, updates progression stats, and shows the completion screen.
   */
  function finishWorkout() {
    if (!activeLog) return;

    // Collect workout-level notes
    const notesEl = document.getElementById('workout-notes');
    activeLog.overallNotes = notesEl ? notesEl.value : '';

    // Flush state into the log
    flushStateToLog();

    activeLog.finishedAt = Date.now();
    activeLog.completed  = true;

    // ── Phase 2: parse all notes and store signals ────────────────
    // This runs NoteParser on every exercise note + the overall note
    // and stores the resulting signals so AdaptiveEngine can read them
    // when generating the next workout.
    parseAndStoreSignals(activeLog);

    Storage.saveLog(activeLog);
    Storage.clearActiveLog();

    // Update profile stats
    updateProgressionStats();

    // Show completion overlay
    showCompletionOverlay();

    activeLog     = null;
    exerciseState = {};
  }

  // ── Phase 2: Note parsing ──────────────────────────────────────

  /**
   * parseAndStoreSignals(log)
   * Runs NoteParser on every note in the log and stores signals
   * directly in the log object (in-place mutation before saving).
   *
   * - log.parsedSignals          ← from overallNotes
   * - log.exerciseLogs[i].parsedSignals ← from each exercise's notes
   */
  function parseAndStoreSignals(log) {
    if (!log) return;

    // Workout-level notes
    log.parsedSignals = NoteParser.parseNotes(log.overallNotes || '');

    // Exercise-level notes
    for (const exLog of (log.exerciseLogs || [])) {
      exLog.parsedSignals = NoteParser.parseNotes(exLog.notes || '');
    }
  }

  /**
   * updateProgressionStats()
   * Increments completion counters and checks for stage advancement.
   */
  function updateProgressionStats() {
    const profile = Storage.getProfile();
    if (!profile) return;

    profile.progression.totalWorkoutsCompleted += 1;
    profile.progression.sessionsSinceStageStart += 1;
    profile.progression.lastWorkoutDate = todayISO();

    // Check stage advancement
    const recentLogs = Storage.getCompletedLogs().slice(0, 5);
    const nextStageId = ProgressionEngine.checkAdvancement(profile, recentLogs);

    if (nextStageId) {
      profile.progression.pullUpStage = nextStageId;
      profile.progression.sessionsSinceStageStart = 0;
      profile._stageAdvanced = nextStageId; // flag for overlay
    } else {
      // Check regression (only if not advancing)
      const prevStageId = ProgressionEngine.checkRegression(profile, recentLogs);
      if (prevStageId) {
        profile.progression.pullUpStage = prevStageId;
        profile.progression.sessionsSinceStageStart = 0;
      }
    }

    Storage.saveProfile(profile);
  }

  /**
   * showCompletionOverlay()
   * Displays the "Well done!" overlay after finishing a workout.
   */
  function showCompletionOverlay() {
    const profile = Storage.getProfile();
    const stageAdvanced = profile && profile._stageAdvanced;

    let extraMessage = '';
    if (stageAdvanced) {
      const newStage = getStageById(stageAdvanced);
      extraMessage = `<div class="badge badge-green" style="font-size:14px;padding:8px 16px;">
        🎯 Stage Advanced: ${newStage ? newStage.label : 'Next Stage'}!
      </div>`;

      // Clear the flag
      delete profile._stageAdvanced;
      Storage.saveProfile(profile);
    }

    const overlay = document.createElement('div');
    overlay.className = 'completion-overlay';
    overlay.id = 'completion-overlay';
    overlay.innerHTML = `
      <div class="completion-icon">🎉</div>
      <h2>Workout Done!</h2>
      <p>Another session in the books. Consistency is everything.</p>
      ${extraMessage}
      <button class="btn btn-primary btn-large" style="margin-top:24px;max-width:280px;"
        onclick="Logger.dismissCompletion()">Back to Today</button>
    `;

    document.body.appendChild(overlay);
  }

  /**
   * dismissCompletion()
   * Removes the completion overlay and navigates back to today screen.
   */
  function dismissCompletion() {
    const overlay = document.getElementById('completion-overlay');
    if (overlay) overlay.remove();
    App.showScreen('today');
  }

  // ── Public API ────────────────────────────────────────────────
  return {
    initLog,
    finishWorkout,
    updateSetValue,
    toggleSetDone,
    setRPE,
    updateNotes,
    dismissCompletion,
    setExerciseQuickState,
    appendNoteChip,
  };

})();
