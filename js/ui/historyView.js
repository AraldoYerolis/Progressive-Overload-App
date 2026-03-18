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
    renderAdaptationTrends();
    renderHistoryList();
  }

  // ── 1. Stats ──────────────────────────────────────────────────

  function renderStats() {
    const container = document.getElementById('history-stats');
    if (!container) return;

    const profile       = Storage.getProfile();
    const completedLogs = Storage.getCompletedLogs();
    const allLogs       = Storage.getLogsSorted();
    const streak        = calculateStreak(completedLogs);
    const total         = completedLogs.length;
    const stageLabel    = profile
      ? getStageById(profile.progression.pullUpStage)?.shortLabel || 'Stage 1'
      : '—';

    // Completion rate: sessions completed in last 28 days
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 28);
    const cutoffISO = cutoff.toISOString().slice(0, 10);
    const recentAll  = allLogs.filter(l => l.date >= cutoffISO);
    const recentDone = recentAll.filter(l => l.completed);
    const completionRate = recentAll.length > 0
      ? Math.round((recentDone.length / recentAll.length) * 100)
      : 0;
    const completionLabel = recentAll.length > 0
      ? `${completionRate}%`
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
      <div class="stat-card">
        <span class="stat-value">${completionLabel}</span>
        <span class="stat-label">28-Day Rate</span>
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

  // ── 2b. Adaptation trends ─────────────────────────────────────

  /**
   * renderAdaptationTrends()
   * Shows the most common note signals across recent sessions
   * so the user can see patterns in their own feedback.
   */
  function renderAdaptationTrends() {
    const container = document.getElementById('history-list');
    if (!container) return;

    const logs = Storage.getCompletedLogs().slice(0, 10);
    if (logs.length < 3) return; // not enough data to show trends

    // Tally signal types across all exercise logs
    const tally = {};
    const signalLabels = {
      pain:               { label: 'Pain reported',       icon: '🚨', color: 'var(--accent-light)' },
      joint_discomfort:   { label: 'Joint discomfort',    icon: '⚠️', color: '#ff9f7f' },
      excessive_fatigue:  { label: 'Fatigue / tired',     icon: '😴', color: 'var(--text-secondary)' },
      soreness:           { label: 'Soreness',            icon: '💪', color: 'var(--accent-yellow)' },
      easy_session:       { label: 'Felt easy',           icon: '✅', color: 'var(--accent-green)'  },
      grip_limitation:    { label: 'Grip issues',         icon: '✋', color: 'var(--accent-blue)'   },
      technique_breakdown:{ label: 'Technique concern',   icon: '🔍', color: 'var(--accent-yellow)' },
      poor_sleep:         { label: 'Poor sleep',          icon: '🌙', color: 'var(--text-secondary)' },
    };

    logs.forEach(log => {
      const allSignals = [
        ...(log.parsedSignals || []),
        ...(log.exerciseLogs || []).flatMap(e => e.parsedSignals || []),
      ];
      // Fallback: re-parse notes for Phase 1 logs
      if (allSignals.length === 0) {
        const text = [
          log.overallNotes || '',
          ...(log.exerciseLogs || []).map(e => e.notes || ''),
        ].join(' ');
        if (text.trim()) {
          NoteParser.parseNotes(text).forEach(s => allSignals.push(s));
        }
      }
      allSignals.forEach(s => {
        if (s && s.type) tally[s.type] = (tally[s.type] || 0) + 1;
      });
    });

    const sorted = Object.entries(tally)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    if (!sorted.length) return;

    // Inject above the history list container (use a dedicated div)
    const trendsContainer = document.getElementById('history-trends');
    if (!trendsContainer) return;

    const rows = sorted.map(([type, count]) => {
      const cfg = signalLabels[type] || { label: type, icon: '•', color: 'var(--text-secondary)' };
      return `
        <div class="trend-row">
          <span class="trend-icon">${cfg.icon}</span>
          <span class="trend-label">${cfg.label}</span>
          <span class="trend-count" style="color:${cfg.color}">${count}×</span>
        </div>
      `;
    }).join('');

    trendsContainer.innerHTML = `
      <div class="trends-section">
        <h3 style="font-size:13px;font-weight:700;color:var(--text-secondary);
          text-transform:uppercase;letter-spacing:0.06em;margin-bottom:10px;">
          📊 Recent Note Trends (last ${logs.length} sessions)
        </h3>
        ${rows}
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
    const completedExLogs = log.exerciseLogs.filter(e => e.completed);
    const exerciseNames = completedExLogs.map(e => e.name).slice(0, 3).join(', ');
    const trailingText  = completedExLogs.length > 3
      ? ` +${completedExLogs.length - 3} more`
      : '';

    // Duration
    let durationText = '';
    if (log.startedAt && log.finishedAt) {
      const mins = Math.round((log.finishedAt - log.startedAt) / 60000);
      durationText = `${mins} min`;
    }

    // Average RPE across exercises that have it
    const rpeValues = log.exerciseLogs.map(e => e.rpe).filter(Boolean);
    const avgRPE = rpeValues.length
      ? Math.round(rpeValues.reduce((a, b) => a + b, 0) / rpeValues.length)
      : null;

    // Top signal badges (max 2)
    const allSignals = [
      ...(log.parsedSignals || []),
      ...(log.exerciseLogs || []).flatMap(e => e.parsedSignals || []),
    ];
    const signalBadgeMap = {
      pain:                { label: '🚨 Pain',    cls: 'badge-danger'  },
      joint_discomfort:    { label: '⚠️ Joints',  cls: 'badge-warning' },
      easy_session:        { label: '✅ Easy',     cls: 'badge-green'   },
      grip_limitation:     { label: '✋ Grip',     cls: 'badge-secondary'},
      poor_sleep:          { label: '🌙 Tired',   cls: 'badge-secondary'},
      soreness:            { label: '💪 Sore',    cls: 'badge-yellow'  },
      excessive_fatigue:   { label: '😴 Fatigue', cls: 'badge-yellow'  },
      technique_breakdown: { label: '🔍 Form',    cls: 'badge-secondary'},
    };
    const signalBadgesHTML = [...new Set(allSignals.map(s => s && s.type).filter(Boolean))]
      .slice(0, 2)
      .map(t => {
        const cfg = signalBadgeMap[t];
        return cfg ? `<span class="badge ${cfg.cls}">${cfg.label}</span>` : '';
      }).join('');

    // Build detail rows (shown when expanded)
    const detailRows = log.exerciseLogs.map(ex => {
      const topSet = ex.setLogs.reduce((best, s) => {
        const v = s.repsCompleted || s.durationSeconds || 0;
        return v > best ? v : best;
      }, 0);
      const unit    = ex.plannedDurationSeconds ? 's' : ' reps';
      const rpeText = ex.rpe ? ` · Effort ${ex.rpe}/10` : '';
      const setsInfo = ex.setLogs.filter(s => s.completed).length;
      return `<div class="history-detail-row">${ex.completed ? '✓' : '✗'} <strong>${ex.name}</strong> — ${setsInfo} sets · best: ${topSet}${unit}${rpeText}</div>`;
    }).join('');

    const notesSection = log.overallNotes
      ? `<div class="history-detail-notes">"${log.overallNotes}"</div>`
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
          ${avgRPE ? `<span class="badge badge-secondary">Effort ${avgRPE}/10</span>` : ''}
          ${signalBadgesHTML}
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
