/**
 * settingsView.js
 * ─────────────────────────────────────────────────────────────
 * Renders the Settings & Profile screen.
 *
 * Displays:
 *   - Current profile summary (goal, stage, time target)
 *   - Stage progress bar
 *   - Editable ability metrics
 *   - Secondary goals editor
 *   - Session time target editor
 *   - Reset / danger zone
 * ─────────────────────────────────────────────────────────────
 */

const SettingsView = (() => {

  /**
   * render()
   * Main entry point — called by App.showScreen('settings').
   */
  function render() {
    const container = document.getElementById('settings-container');
    if (!container) return;

    const profile = Storage.getProfile();
    if (!profile) {
      container.innerHTML = '<p style="color:var(--text-secondary)">No profile found.</p>';
      return;
    }

    container.innerHTML = buildSettingsHTML(profile);
  }

  /**
   * buildSettingsHTML(profile)
   * Returns the full settings screen HTML.
   */
  function buildSettingsHTML(profile) {
    const stage = getStageById(profile.progression.pullUpStage);
    const stageIndex = stage ? stage.index : 0;
    const totalStages = PULL_UP_STAGE_COUNT;
    const progressPct = Math.round(((stageIndex + 1) / totalStages) * 100);

    const primaryGoalLabel = {
      muscle_up:       'Muscle-Up',
      pull_ups:        'Pull-Up Strength',
      general_fitness: 'General Fitness',
    }[profile.primaryGoal] || profile.primaryGoal;

    const equipmentLabels = {
      pull_up_bar:      'Pull-Up Bar',
      resistance_bands: 'Resistance Bands',
      dip_bars:         'Dip Bars',
      weight_vest:      'Weight Vest',
      gymnastic_rings:  'Gymnastic Rings',
      box_or_bench:     'Box / Bench',
    };
    const equip = (profile.equipment || [])
      .map(e => equipmentLabels[e] || e).join(', ');

    const secGoalLabels = {
      squat_thrust_pushup: 'Squat Thrust + Push-Up',
      calves:              'Calves',
      tibialis:            'Tibialis',
      core:                'Core',
    };
    const secGoals = (profile.secondaryGoals || [])
      .map(g => secGoalLabels[g] || g).join(', ') || 'None';

    return `
      <!-- Profile Summary -->
      <div class="card settings-section">
        <h3>Profile Summary</h3>
        <div class="settings-row">
          <span class="settings-row-label">Primary Goal</span>
          <span class="settings-row-value">${primaryGoalLabel}</span>
        </div>
        <div class="settings-row">
          <span class="settings-row-label">Session Time</span>
          <span class="settings-row-value">${profile.sessionTimeTarget} min</span>
        </div>
        <div class="settings-row">
          <span class="settings-row-label">Equipment</span>
          <span class="settings-row-value" style="text-align:right;max-width:60%;font-size:12px;">${equip}</span>
        </div>
        <div class="settings-row">
          <span class="settings-row-label">Secondary Goals</span>
          <span class="settings-row-value" style="text-align:right;max-width:60%;font-size:12px;">${secGoals}</span>
        </div>
        <div class="settings-row">
          <span class="settings-row-label">Total Workouts</span>
          <span class="settings-row-value">${profile.progression.totalWorkoutsCompleted}</span>
        </div>
      </div>

      <!-- Progression Stage -->
      <div class="card settings-section">
        <h3>Pull-Up Progression</h3>
        <div class="settings-row">
          <span class="settings-row-label">Current Stage</span>
          <span class="settings-row-value">${stage ? stage.label : '—'}</span>
        </div>
        <div class="settings-row">
          <span class="settings-row-label">Sessions at Stage</span>
          <span class="settings-row-value">${profile.progression.sessionsSinceStageStart}</span>
        </div>
        <div class="stage-progress-container" style="margin-top:8px;">
          <div class="stage-progress-label">
            <span>Stage ${stageIndex + 1} of ${totalStages}</span>
            <span>${progressPct}% to Muscle-Up</span>
          </div>
          <div class="stage-progress-bar">
            <div class="stage-progress-fill" style="width:${progressPct}%"></div>
          </div>
        </div>
        ${buildStageRulesCard(profile.progression.pullUpStage)}
      </div>

      <!-- Update Ability -->
      <div class="card settings-section">
        <h3>Update Ability</h3>
        <p style="font-size:13px;color:var(--text-secondary);margin-bottom:12px;">
          Re-evaluate after a few weeks of training.
        </p>
        ${buildAbilityEditFields(profile.ability)}
        <button class="btn btn-primary" style="margin-top:12px;width:100%;"
          onclick="SettingsView.saveAbility()">Save Ability</button>
      </div>

      <!-- Session Time -->
      <div class="card settings-section">
        <h3>Session Time</h3>
        <div class="time-selector" id="settings-time-selector">
          <button class="time-btn ${profile.sessionTimeTarget === 20 ? 'selected' : ''}"
            data-value="20" onclick="SettingsView.selectTime(this)">20 min</button>
          <button class="time-btn ${profile.sessionTimeTarget === 25 ? 'selected' : ''}"
            data-value="25" onclick="SettingsView.selectTime(this)">25 min</button>
          <button class="time-btn ${profile.sessionTimeTarget === 30 ? 'selected' : ''}"
            data-value="30" onclick="SettingsView.selectTime(this)">30 min</button>
        </div>
        <button class="btn btn-secondary" style="margin-top:12px;width:100%;"
          onclick="SettingsView.saveTime()">Save Time</button>
      </div>

      <!-- Regenerate Workout -->
      <div class="card settings-section">
        <h3>Workout</h3>
        <button class="btn btn-secondary" style="width:100%;"
          onclick="SettingsView.regenerateWorkout()">🔄 Regenerate Today's Workout</button>
      </div>
    `;
  }

  /**
   * buildStageRulesCard(stageId)
   * Shows the current stage description and advancement criteria.
   */
  function buildStageRulesCard(stageId) {
    const rule = ProgressionEngine.STAGE_RULES[stageId];
    if (!rule) return '';
    return `
      <div style="margin-top:12px;padding-top:12px;border-top:1px solid var(--border);">
        <div style="font-size:12px;color:var(--text-secondary);margin-bottom:4px;">Focus:</div>
        <div style="font-size:13px;margin-bottom:8px;">${rule.description}</div>
        <div style="font-size:12px;color:var(--text-secondary);margin-bottom:4px;">Entry Criteria:</div>
        <div style="font-size:13px;">${rule.entryCriteria}</div>
      </div>
    `;
  }

  /**
   * buildAbilityEditFields(ability)
   * Returns editable form fields for ability metrics.
   */
  function buildAbilityEditFields(ability) {
    return `
      <div class="form-group">
        <label>Max strict pull-ups</label>
        <select id="settings-max-pullups">
          <option value="0"  ${ability.maxPullUps === 0  ? 'selected' : ''}>0 — cannot do one yet</option>
          <option value="1"  ${ability.maxPullUps === 1  ? 'selected' : ''}>1–2 reps</option>
          <option value="3"  ${ability.maxPullUps === 3  ? 'selected' : ''}>3–5 reps</option>
          <option value="6"  ${ability.maxPullUps === 6  ? 'selected' : ''}>6–10 reps</option>
          <option value="11" ${ability.maxPullUps === 11 ? 'selected' : ''}>11–15 reps</option>
          <option value="16" ${ability.maxPullUps === 16 ? 'selected' : ''}>16+ reps</option>
        </select>
      </div>
      <div class="form-group">
        <label>Dead hang hold time (seconds)</label>
        <select id="settings-dead-hang">
          <option value="0"  ${ability.deadHangSeconds === 0  ? 'selected' : ''}>Under 15 seconds</option>
          <option value="15" ${ability.deadHangSeconds === 15 ? 'selected' : ''}>15–30 seconds</option>
          <option value="30" ${ability.deadHangSeconds === 30 ? 'selected' : ''}>30–60 seconds</option>
          <option value="60" ${ability.deadHangSeconds === 60 ? 'selected' : ''}>60+ seconds</option>
        </select>
      </div>
      <div class="form-group">
        <label>Explosive pull-up level</label>
        <select id="settings-explosive">
          <option value="0" ${ability.explosiveLevel === 0 ? 'selected' : ''}>Cannot do explosive yet</option>
          <option value="1" ${ability.explosiveLevel === 1 ? 'selected' : ''}>Hip-pop / kip only</option>
          <option value="2" ${ability.explosiveLevel === 2 ? 'selected' : ''}>Chest-to-bar pull-ups</option>
          <option value="3" ${ability.explosiveLevel === 3 ? 'selected' : ''}>Can get above bar momentarily</option>
        </select>
      </div>
      <div class="form-group">
        <label>Dip strength</label>
        <select id="settings-dips">
          <option value="0"  ${ability.dipStrength === 0  ? 'selected' : ''}>Cannot dip yet</option>
          <option value="1"  ${ability.dipStrength === 1  ? 'selected' : ''}>1–3 reps</option>
          <option value="5"  ${ability.dipStrength === 5  ? 'selected' : ''}>5–10 reps</option>
          <option value="10" ${ability.dipStrength === 10 ? 'selected' : ''}>10+ reps</option>
        </select>
      </div>
    `;
  }

  // ── Action handlers ───────────────────────────────────────────

  /**
   * saveAbility()
   * Reads ability fields, updates profile, optionally recalculates stage.
   */
  function saveAbility() {
    const profile = Storage.getProfile();
    if (!profile) return;

    const get = id => {
      const el = document.getElementById(id);
      return el ? parseInt(el.value, 10) || 0 : 0;
    };

    profile.ability.maxPullUps     = get('settings-max-pullups');
    profile.ability.deadHangSeconds = get('settings-dead-hang');
    profile.ability.explosiveLevel  = get('settings-explosive');
    profile.ability.dipStrength     = get('settings-dips');

    Storage.saveProfile(profile);
    showToast('Ability updated ✓');
  }

  let _selectedTime = null;

  function selectTime(btn) {
    document.querySelectorAll('#settings-time-selector .time-btn').forEach(b => {
      b.classList.remove('selected');
    });
    btn.classList.add('selected');
    _selectedTime = parseInt(btn.dataset.value, 10);
  }

  function saveTime() {
    const profile = Storage.getProfile();
    if (!profile) return;

    if (_selectedTime) {
      profile.sessionTimeTarget = _selectedTime;
      Storage.saveProfile(profile);
    }
    showToast('Session time saved ✓');
  }

  function regenerateWorkout() {
    WorkoutGenerator.generateWorkout(true);
    showToast('Workout regenerated ✓');
    // Refresh the today screen after a short delay
    setTimeout(() => App.showScreen('today'), 600);
  }

  // ── Toast helper ──────────────────────────────────────────────

  function showToast(message) {
    const existing = document.getElementById('settings-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.id = 'settings-toast';
    toast.style.cssText = `
      position: fixed;
      bottom: 80px;
      left: 50%;
      transform: translateX(-50%);
      background: var(--bg-card);
      border: 1px solid var(--accent-green);
      color: var(--accent-green);
      padding: 10px 20px;
      border-radius: 20px;
      font-size: 14px;
      font-weight: 600;
      z-index: 999;
      animation: fadeIn 0.2s ease;
    `;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 2500);
  }

  // ── Public API ────────────────────────────────────────────────
  return {
    render,
    saveAbility,
    selectTime,
    saveTime,
    regenerateWorkout,
    showToast,
  };

})();
