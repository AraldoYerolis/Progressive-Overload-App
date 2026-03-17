/**
 * historyView.js
 * ─────────────────────────────────────────────────────────────
 * Renders the History & Progress screen.
 *
 * Sections:
 *   1. Summary stats (total workouts, days trained, streak)
 *   2. Personal best highlights (horizontally scrollable cards)
 *   3. Chronological workout log list (expandable)
 * ─────────────────────────────────────────────────────────────
 */

const HistoryView = (() => {

  /**
   * render()
   * Main entry point — called by App.showScreen('history').
   */
  function render() {
    renderStats();
    renderPRs();
    renderHistoryList();
  }

  // ── 1. Stats ──────────────────────────────────────────────────

  function renderStats() {
    const container = document.getElementById('history-stats');
    if (!container) return;

    const profile      = Storage.getProfile();
    const completedLogs = Storage.getCompletedLogs();
    const streak        = calculateStreak(completedLogs);
    const total         = completedLogs.length;
    const stageLabel    = profile
      ? getStageById(profile.progression.pullUpStage)?.shortLabel || 'Stage 1'
      : '—';

    container.innerHTML = `
      <div class="stat-card">
        <span class="stat-value">${total}</span>
        <span class="stat-label">Workouts</span>
      </div>
      <div class="stat-card">
        <span class="stat-value">${streak}</span>
        <span class="stat-label">Day Streak</span>
      </div>
      <div class="stat-card">
        <span class="stat-value">${stageLabel}</span>
        <span class="stat-label">Current Stage</span>
      </div>
    `;
  }

  // ── 2. PRs ────────────────────────────────────────────────────

  function renderPRs() {
    const container = document.getElementById('history-prs');
    if (!container) return;

    const prs = Storage.getNotablePRs();
    if (!prs.length) {
      container.innerHTML = '';
      return;
    }

    const cards = prs.map(pr => `
      <div class="pr-card">
        <div class="pr-exercise">${pr.label}</div>
        <div class="pr-value">${pr.value}</div>
        <div class="pr-date">${formatDateDisplay(pr.date)}</div>
      </div>
    `).join('');

    container.innerHTML = `
      <div class="pr-section">
        <h3>🏆 Personal Bests</h3>
        <div class="pr-list">${cards}</div>
      </div>
    `;
  }

  // ── 3. History list ───────────────────────────────────────────

  function renderHistoryList() {
    const container  = document.getElementById('history-list');
    const emptyState = document.getElementById('history-empty');
    if (!container) return;

    const logs = Storage.getLogsSorted();

    if (!logs.length) {
      container.innerHTML = '';
      if (emptyState) emptyState.style.display = 'block';
      return;
    }

    if (emptyState) emptyState.style.display = 'none';

    container.innerHTML = logs.map((log, idx) => buildHistoryItemHTML(log, idx)).join('');
  }

  /**
   * buildHistoryItemHTML(log, idx)
   * Returns HTML for one history list item.
   */
  function buildHistoryItemHTML(log, idx) {
    const dateLabel    = formatDateDisplay(log.date);
    const statusIcon   = log.completed ? '✅' : '⏸';
    const statusLabel  = log.completed ? 'Completed' : 'Partial';
    const statusColor  = log.completed ? 'var(--accent-green)' : 'var(--accent-yellow)';

    // Exercise summary
    const exerciseNames = log.exerciseLogs
      .filter(e => e.completed)
      .map(e => e.name)
      .slice(0, 4)
      .join(', ');
    const trailingText = log.exerciseLogs.filter(e => e.completed).length > 4
      ? ` +${log.exerciseLogs.filter(e => e.completed).length - 4} more`
      : '';

    // Duration
    let durationText = '';
    if (log.startedAt && log.finishedAt) {
      const mins = Math.round((log.finishedAt - log.startedAt) / 60000);
      durationText = `${mins} min`;
    }

    // Build detail rows (shown when expanded)
    const detailRows = log.exerciseLogs.map(ex => {
      const topSet = ex.setLogs.reduce((best, s) => {
        const v = s.repsCompleted || s.durationSeconds || 0;
        return v > best ? v : best;
      }, 0);
      const unit = ex.plannedDurationSeconds ? 's' : ' reps';
      const rpeText = ex.rpe ? ` · RPE ${ex.rpe}` : '';
      return `<div>${ex.completed ? '✓' : '✗'} <strong>${ex.name}</strong> — best: ${topSet}${unit}${rpeText}</div>`;
    }).join('');

    const notesSection = log.overallNotes
      ? `<div style="margin-top:8px;padding-top:8px;border-top:1px solid var(--border);
          font-style:italic;color:var(--text-secondary);">"${log.overallNotes}"</div>`
      : '';

    return `
      <div class="history-item" onclick="HistoryView.toggleDetail(${idx})">
        <div class="history-item-header">
          <span class="history-item-date">${dateLabel}</span>
          <span class="history-item-status" style="color:${statusColor}">${statusIcon} ${statusLabel}</span>
        </div>
        <div class="history-item-exercises">${exerciseNames}${trailingText}</div>
        <div class="history-item-meta">
          ${durationText ? `<span class="badge badge-secondary">${durationText}</span>` : ''}
          ${log.exerciseLogs.filter(e=>e.completed).length > 0
            ? `<span class="badge badge-green">${log.exerciseLogs.filter(e=>e.completed).length} exercises</span>`
            : ''}
        </div>
        <div class="history-detail" id="history-detail-${idx}">
          ${detailRows}
          ${notesSection}
        </div>
      </div>
    `;
  }

  /**
   * toggleDetail(idx)
   * Expands or collapses the exercise detail for a history item.
   */
  function toggleDetail(idx) {
    const detail = document.getElementById(`history-detail-${idx}`);
    if (!detail) return;
    detail.classList.toggle('open');
  }

  // ── Streak calculation ────────────────────────────────────────

  /**
   * calculateStreak(sortedLogs)
   * Returns the current consecutive-day training streak.
   */
  function calculateStreak(sortedLogs) {
    if (!sortedLogs.length) return 0;

    const completedDates = [...new Set(sortedLogs.map(l => l.date))].sort().reverse();
    if (!completedDates.length) return 0;

    let streak = 0;
    let checkDate = new Date();
    checkDate.setHours(0, 0, 0, 0);

    for (const dateStr of completedDates) {
      const [y, m, d] = dateStr.split('-').map(Number);
      const logDate = new Date(y, m - 1, d);

      const diffDays = Math.round((checkDate - logDate) / 86400000);

      if (diffDays === 0 || diffDays === 1) {
        streak++;
        checkDate = logDate;
      } else {
        break;
      }
    }

    return streak;
  }

  // ── Public API ────────────────────────────────────────────────
  return { render, toggleDetail };

})();
