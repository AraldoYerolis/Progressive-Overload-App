/**
 * exerciseLibrary.js
 * ─────────────────────────────────────────────────────────────
 * Seeded exercise database for Adaptive Progression Coach.
 *
 * Organised into four categories:
 *   1. PULL_UP_MUSCLE_UP — the flagship progression path
 *   2. SQUAT_THRUST_PUSHUP — explosive push/thrust work
 *   3. CALVES — calf raise progressions
 *   4. TIBIALIS — anterior shin/ankle work
 *
 * Each exercise object contains:
 *   id, name, category, stage (for pull-up path), progressions[],
 *   regressions[], cue, defaultSets, defaultReps, defaultDuration,
 *   restSeconds, prerequisites[], equipment[], notes
 * ─────────────────────────────────────────────────────────────
 */

const ExerciseLibrary = {

  // ═══════════════════════════════════════════════════════════
  // CATEGORY 1 — PULL-UP / MUSCLE-UP PROGRESSION
  // Stages map to PULL_UP_STAGES keys in dataModels.js
  // ═══════════════════════════════════════════════════════════

  // ── Stage 0: Dead Hang Base ────────────────────────────────

  dead_hang: {
    id: 'dead_hang',
    name: 'Dead Hang',
    category: 'pull_up_muscle_up',
    stage: 'dead_hang_base',
    progressions: ['active_hang', 'scapular_pull'],
    regressions: [],
    cue: 'Grip shoulder-width, arms fully extended. Engage lats by pulling shoulders away from ears.',
    defaultSets: 3,
    defaultReps: null,
    defaultDuration: 20,    // seconds
    restSeconds: 90,
    prerequisites: [],
    equipment: ['pull_up_bar'],
    notes: 'Build to 60s hold before advancing. This is the foundation.',
  },

  scapular_pull: {
    id: 'scapular_pull',
    name: 'Scapular Pull',
    category: 'pull_up_muscle_up',
    stage: 'dead_hang_base',
    progressions: ['band_assisted_pullup_heavy', 'dead_hang'],
    regressions: ['dead_hang'],
    cue: 'From dead hang, depress and retract shoulder blades without bending elbows. Hold 1 second.',
    defaultSets: 3,
    defaultReps: 8,
    defaultDuration: null,
    restSeconds: 90,
    prerequisites: ['dead_hang'],
    equipment: ['pull_up_bar'],
    notes: 'Key movement pattern for pull-up. Own this before adding elbow bend.',
  },

  active_hang: {
    id: 'active_hang',
    name: 'Active Hang (Shoulders Packed)',
    category: 'pull_up_muscle_up',
    stage: 'dead_hang_base',
    progressions: ['scapular_pull'],
    regressions: ['dead_hang'],
    cue: 'Hang with lats engaged — shoulders pulled down and back, body hollow. Do not shrug.',
    defaultSets: 3,
    defaultReps: null,
    defaultDuration: 15,
    restSeconds: 90,
    prerequisites: [],
    equipment: ['pull_up_bar'],
    notes: 'Active hang is a position, not just a hold. Think "proud chest."',
  },

  // ── Stage 1: Assisted Volume ───────────────────────────────

  band_assisted_pullup_heavy: {
    id: 'band_assisted_pullup_heavy',
    name: 'Band-Assisted Pull-Up (Heavy Band)',
    category: 'pull_up_muscle_up',
    stage: 'assisted_volume',
    progressions: ['band_assisted_pullup_medium'],
    regressions: ['scapular_pull'],
    cue: 'Full range: dead hang to chin over bar. Control the descent — 2–3 seconds down.',
    defaultSets: 4,
    defaultReps: 6,
    defaultDuration: null,
    restSeconds: 90,
    prerequisites: ['scapular_pull'],
    equipment: ['pull_up_bar', 'resistance_bands'],
    notes: 'Heavy band = significant assistance. Work toward lighter band over time.',
  },

  band_assisted_pullup_medium: {
    id: 'band_assisted_pullup_medium',
    name: 'Band-Assisted Pull-Up (Medium Band)',
    category: 'pull_up_muscle_up',
    stage: 'assisted_volume',
    progressions: ['band_assisted_pullup_light'],
    regressions: ['band_assisted_pullup_heavy'],
    cue: 'Same technique as heavy band — full ROM, controlled negative. Chase quality reps.',
    defaultSets: 4,
    defaultReps: 6,
    defaultDuration: null,
    restSeconds: 90,
    prerequisites: ['band_assisted_pullup_heavy'],
    equipment: ['pull_up_bar', 'resistance_bands'],
    notes: 'When you hit 3×8 cleanly, move to light band.',
  },

  band_assisted_pullup_light: {
    id: 'band_assisted_pullup_light',
    name: 'Band-Assisted Pull-Up (Light Band)',
    category: 'pull_up_muscle_up',
    stage: 'assisted_volume',
    progressions: ['strict_pullup'],
    regressions: ['band_assisted_pullup_medium'],
    cue: 'Minimal assistance — treat it like a strict pull-up. 3-second negatives.',
    defaultSets: 3,
    defaultReps: 5,
    defaultDuration: null,
    restSeconds: 90,
    prerequisites: ['band_assisted_pullup_medium'],
    equipment: ['pull_up_bar', 'resistance_bands'],
    notes: 'This is the bridge to unassisted. When you hit 3×5, attempt strict pull-ups.',
  },

  jumping_pullup_negative: {
    id: 'jumping_pullup_negative',
    name: 'Jumping Pull-Up + Slow Negative',
    category: 'pull_up_muscle_up',
    stage: 'assisted_volume',
    progressions: ['strict_pullup'],
    regressions: ['scapular_pull'],
    cue: 'Jump to top position (chin over bar), then lower yourself in 5–8 seconds. Control everything.',
    defaultSets: 3,
    defaultReps: 5,
    defaultDuration: null,
    restSeconds: 90,
    prerequisites: ['scapular_pull'],
    equipment: ['pull_up_bar', 'box_or_bench'],
    notes: 'Negatives build strength faster than assisted concentric reps.',
  },

  // ── Stage 2: Strict Pull-Up Strength ──────────────────────

  strict_pullup: {
    id: 'strict_pullup',
    name: 'Strict Pull-Up',
    category: 'pull_up_muscle_up',
    stage: 'strict_strength',
    progressions: ['weighted_pullup', 'chest_to_bar_pullup'],
    regressions: ['band_assisted_pullup_light', 'jumping_pullup_negative'],
    cue: 'Dead hang start. Drive elbows down. Chin clears bar. Full extension on every rep.',
    defaultSets: 4,
    defaultReps: 4,
    defaultDuration: null,
    restSeconds: 120,
    prerequisites: [],
    equipment: ['pull_up_bar'],
    notes: 'Quality > quantity. Stop before form breaks. Rest well between sets.',
  },

  pullup_top_hold: {
    id: 'pullup_top_hold',
    name: 'Pull-Up Top Hold (Isometric)',
    category: 'pull_up_muscle_up',
    stage: 'strict_strength',
    progressions: ['chest_to_bar_pullup'],
    regressions: ['scapular_pull'],
    cue: 'Hold chin above bar, chest pressed toward bar. Squeeze lats and biceps. Stay tight.',
    defaultSets: 3,
    defaultReps: null,
    defaultDuration: 8,
    restSeconds: 90,
    prerequisites: ['strict_pullup'],
    equipment: ['pull_up_bar'],
    notes: 'Builds the strength needed for the top of the muscle-up transition.',
  },

  weighted_pullup: {
    id: 'weighted_pullup',
    name: 'Weighted Pull-Up',
    category: 'pull_up_muscle_up',
    stage: 'strict_strength',
    progressions: ['chest_to_bar_pullup'],
    regressions: ['strict_pullup'],
    cue: 'Add load only after hitting 10 clean unweighted reps. Keep technique perfect.',
    defaultSets: 4,
    defaultReps: 4,
    defaultDuration: null,
    restSeconds: 150,
    prerequisites: ['strict_pullup'],
    equipment: ['pull_up_bar', 'weight_vest'],
    notes: 'Small load increase (2.5kg). Consistent technique is the rule.',
  },

  // ── Stage 3: Chest-to-Bar ──────────────────────────────────

  chest_to_bar_pullup: {
    id: 'chest_to_bar_pullup',
    name: 'Chest-to-Bar Pull-Up',
    category: 'pull_up_muscle_up',
    stage: 'chest_to_bar',
    progressions: ['hip_pop_pullup', 'explosive_pullup'],
    regressions: ['strict_pullup', 'pullup_top_hold'],
    cue: 'Drive elbows back and down — aim to touch chest to bar. Lean back slightly as you pull.',
    defaultSets: 4,
    defaultReps: 3,
    defaultDuration: null,
    restSeconds: 120,
    prerequisites: ['strict_pullup'],
    equipment: ['pull_up_bar'],
    notes: 'The lean and the elbow drive are essential for the muscle-up catch.',
  },

  // ── Stage 4: Explosive Pull Power ─────────────────────────

  hip_pop_pullup: {
    id: 'hip_pop_pullup',
    name: 'Hip-Pop / Kipping Pull-Up (Controlled)',
    category: 'pull_up_muscle_up',
    stage: 'explosive_pull',
    progressions: ['explosive_pullup'],
    regressions: ['chest_to_bar_pullup'],
    cue: 'Small hip drive, not a wild swing. Use momentum to get higher than a strict pull. Stay hollow.',
    defaultSets: 3,
    defaultReps: 4,
    defaultDuration: null,
    restSeconds: 90,
    prerequisites: ['chest_to_bar_pullup'],
    equipment: ['pull_up_bar'],
    notes: 'This is about learning to use momentum efficiently, not junk kipping.',
  },

  explosive_pullup: {
    id: 'explosive_pullup',
    name: 'Explosive Pull-Up (Above Bar)',
    category: 'pull_up_muscle_up',
    stage: 'explosive_pull',
    progressions: ['muscle_up_negative', 'straight_bar_transition_drill'],
    regressions: ['hip_pop_pullup', 'chest_to_bar_pullup'],
    cue: 'Pull as hard as you can — chest should rise above the bar. Think "jump with your arms."',
    defaultSets: 3,
    defaultReps: 3,
    defaultDuration: null,
    restSeconds: 150,
    prerequisites: ['chest_to_bar_pullup'],
    equipment: ['pull_up_bar'],
    notes: 'Getting hips above bar level on each rep is the target. Rest fully.',
  },

  // ── Stage 5: Transition Readiness ─────────────────────────

  straight_bar_transition_drill: {
    id: 'straight_bar_transition_drill',
    name: 'Straight Bar Transition Drill (Box Assisted)',
    category: 'pull_up_muscle_up',
    stage: 'transition_readiness',
    progressions: ['muscle_up_negative'],
    regressions: ['explosive_pullup'],
    cue: 'Use a box to get hips level with bar. Practice rolling wrists over and pressing out from that position.',
    defaultSets: 4,
    defaultReps: 4,
    defaultDuration: null,
    restSeconds: 120,
    prerequisites: ['explosive_pullup'],
    equipment: ['pull_up_bar', 'box_or_bench'],
    notes: 'This teaches the wrist rotation and pressing pattern before you go unassisted.',
  },

  muscle_up_negative: {
    id: 'muscle_up_negative',
    name: 'Muscle-Up Negative (Assisted Start)',
    category: 'pull_up_muscle_up',
    stage: 'transition_readiness',
    progressions: ['ring_muscle_up_attempt', 'straight_bar_muscle_up_attempt'],
    regressions: ['straight_bar_transition_drill'],
    cue: 'Start above bar in dip position. Lower yourself through the transition slowly — 5+ seconds.',
    defaultSets: 3,
    defaultReps: 3,
    defaultDuration: null,
    restSeconds: 150,
    prerequisites: ['straight_bar_transition_drill', 'ring_dip'],
    equipment: ['pull_up_bar', 'box_or_bench'],
    notes: 'The negative teaches the exact movement path. Own each rep.',
  },

  // ── Stage 6: Dip Support / Straight Bar Dip Prep ──────────

  ring_dip: {
    id: 'ring_dip',
    name: 'Ring Dip',
    category: 'pull_up_muscle_up',
    stage: 'dip_support_prep',
    progressions: ['straight_bar_dip', 'muscle_up_negative'],
    regressions: ['parallel_bar_dip'],
    cue: 'Elbows track back, not out. Lower to 90° or below. Keep rings turned out at lockout.',
    defaultSets: 3,
    defaultReps: 5,
    defaultDuration: null,
    restSeconds: 120,
    prerequisites: ['parallel_bar_dip'],
    equipment: ['gymnastic_rings'],
    notes: 'Rings are harder than bars. Work parallel bar dips first.',
  },

  parallel_bar_dip: {
    id: 'parallel_bar_dip',
    name: 'Parallel Bar Dip',
    category: 'pull_up_muscle_up',
    stage: 'dip_support_prep',
    progressions: ['ring_dip', 'straight_bar_dip'],
    regressions: ['bench_dip', 'dip_support_hold'],
    cue: 'Upright torso, elbows back. Lower to 90°. Press to full lockout.',
    defaultSets: 3,
    defaultReps: 5,
    defaultDuration: null,
    restSeconds: 90,
    prerequisites: [],
    equipment: ['dip_bars'],
    notes: 'Foundation for all muscle-up pressing. Build to 10 clean reps before ring dips.',
  },

  dip_support_hold: {
    id: 'dip_support_hold',
    name: 'Dip Support Hold (Top Position)',
    category: 'pull_up_muscle_up',
    stage: 'dip_support_prep',
    progressions: ['parallel_bar_dip'],
    regressions: [],
    cue: 'Arms fully extended, body vertical. Shoulders depressed. Hold still.',
    defaultSets: 3,
    defaultReps: null,
    defaultDuration: 20,
    restSeconds: 90,
    prerequisites: [],
    equipment: ['dip_bars'],
    notes: 'Build to 30s hold. Required strength before attempting dips.',
  },

  bench_dip: {
    id: 'bench_dip',
    name: 'Bench Dip',
    category: 'pull_up_muscle_up',
    stage: 'dip_support_prep',
    progressions: ['parallel_bar_dip'],
    regressions: [],
    cue: 'Hands on bench, feet on floor. Lower until arms reach 90°. Keep hips close to bench.',
    defaultSets: 3,
    defaultReps: 8,
    defaultDuration: null,
    restSeconds: 60,
    prerequisites: [],
    equipment: ['box_or_bench'],
    notes: 'Entry-level dip. Move to parallel bars as soon as possible.',
  },

  straight_bar_dip: {
    id: 'straight_bar_dip',
    name: 'Straight Bar Dip',
    category: 'pull_up_muscle_up',
    stage: 'dip_support_prep',
    progressions: ['muscle_up_negative'],
    regressions: ['parallel_bar_dip'],
    cue: 'More forward lean than parallel dips. Elbows go back. Essential muscle-up finish pattern.',
    defaultSets: 3,
    defaultReps: 5,
    defaultDuration: null,
    restSeconds: 120,
    prerequisites: ['parallel_bar_dip'],
    equipment: ['pull_up_bar'],
    notes: 'This mirrors the pressing-out phase of the muscle-up exactly.',
  },

  // ── Stage 7: Muscle-Up Readiness ──────────────────────────

  ring_muscle_up_attempt: {
    id: 'ring_muscle_up_attempt',
    name: 'Ring Muscle-Up (False Grip Attempt)',
    category: 'pull_up_muscle_up',
    stage: 'muscle_up_readiness',
    progressions: [],
    regressions: ['muscle_up_negative', 'explosive_pullup'],
    cue: 'False grip, lean back at bottom. Pull, hips forward, then press. It\'s a pull + lean + press.',
    defaultSets: 3,
    defaultReps: 2,
    defaultDuration: null,
    restSeconds: 180,
    prerequisites: ['muscle_up_negative', 'ring_dip', 'explosive_pullup'],
    equipment: ['gymnastic_rings'],
    notes: 'Full rest between sets. Aim for smooth, not just getting over.',
  },

  straight_bar_muscle_up_attempt: {
    id: 'straight_bar_muscle_up_attempt',
    name: 'Straight Bar Muscle-Up (Attempt)',
    category: 'pull_up_muscle_up',
    stage: 'muscle_up_readiness',
    progressions: [],
    regressions: ['muscle_up_negative', 'straight_bar_dip'],
    cue: 'Strong hip drive, explosive pull — get waist to bar. Lean over and press out smoothly.',
    defaultSets: 3,
    defaultReps: 2,
    defaultDuration: null,
    restSeconds: 180,
    prerequisites: ['muscle_up_negative', 'straight_bar_dip', 'explosive_pullup'],
    equipment: ['pull_up_bar'],
    notes: 'The final movement. Rest 3 full minutes between attempts.',
  },

  // ── Warm-up / mobility exercises ──────────────────────────

  arm_circles_warmup: {
    id: 'arm_circles_warmup',
    name: 'Arm Circles + Shoulder Rolls',
    category: 'warmup',
    stage: null,
    progressions: [],
    regressions: [],
    cue: 'Large controlled circles — 10 forward, 10 backward. Mobilise the shoulder joint.',
    defaultSets: 1,
    defaultReps: 20,
    defaultDuration: null,
    restSeconds: 0,
    prerequisites: [],
    equipment: [],
    notes: 'Warm-up staple for all upper-body sessions.',
  },

  band_pull_apart_warmup: {
    id: 'band_pull_apart_warmup',
    name: 'Band Pull-Apart',
    category: 'warmup',
    stage: null,
    progressions: [],
    regressions: [],
    cue: 'Arms straight, pull band apart to chest height. Squeeze shoulder blades together.',
    defaultSets: 2,
    defaultReps: 15,
    defaultDuration: null,
    restSeconds: 0,
    prerequisites: [],
    equipment: ['resistance_bands'],
    notes: 'Activates rear delts and scapular retractors. Great pre-pull warm-up.',
  },

  bodyweight_row_warmup: {
    id: 'bodyweight_row_warmup',
    name: 'Bodyweight / Bar Row (Warm-Up)',
    category: 'warmup',
    stage: null,
    progressions: [],
    regressions: [],
    cue: 'Horizontal row from low bar or table. Light effort — just activate the pulling muscles.',
    defaultSets: 1,
    defaultReps: 10,
    defaultDuration: null,
    restSeconds: 0,
    prerequisites: [],
    equipment: ['pull_up_bar'],
    notes: 'Use a low bar or table edge if available.',
  },

  jumping_jacks_warmup: {
    id: 'jumping_jacks_warmup',
    name: 'Jumping Jacks',
    category: 'warmup',
    stage: null,
    progressions: [],
    regressions: [],
    cue: 'Light and rhythmic — purpose is to raise heart rate and warm tissues.',
    defaultSets: 1,
    defaultReps: 30,
    defaultDuration: null,
    restSeconds: 0,
    prerequisites: [],
    equipment: [],
    notes: 'Can be replaced with light jogging in place.',
  },

  wrist_circles_warmup: {
    id: 'wrist_circles_warmup',
    name: 'Wrist Circles + Flexion/Extension',
    category: 'warmup',
    stage: null,
    progressions: [],
    regressions: [],
    cue: 'Slow, full-range circles. Then flex and extend. Essential before bar work.',
    defaultSets: 1,
    defaultReps: 15,
    defaultDuration: null,
    restSeconds: 0,
    prerequisites: [],
    equipment: [],
    notes: 'Never skip wrist warm-up before pull-up or muscle-up work.',
  },

  // ═══════════════════════════════════════════════════════════
  // CATEGORY 2 — SQUAT THRUST + PUSH-UP PROGRESSION
  // ═══════════════════════════════════════════════════════════

  incline_pushup: {
    id: 'incline_pushup',
    name: 'Incline Push-Up',
    category: 'squat_thrust_pushup',
    stage: null,
    progressions: ['full_pushup'],
    regressions: ['wall_pushup'],
    cue: 'Hands on elevated surface. Straight line from heels to head. Lower chest to surface.',
    defaultSets: 3,
    defaultReps: 10,
    defaultDuration: null,
    restSeconds: 60,
    prerequisites: [],
    equipment: ['box_or_bench'],
    notes: 'The lower the surface, the harder. Progress the surface height down over time.',
  },

  full_pushup: {
    id: 'full_pushup',
    name: 'Push-Up',
    category: 'squat_thrust_pushup',
    stage: null,
    progressions: ['decline_pushup', 'diamond_pushup'],
    regressions: ['incline_pushup'],
    cue: 'Hands just outside shoulder-width. Elbows ~45° out. Touch chest to floor. Full lockout.',
    defaultSets: 3,
    defaultReps: 10,
    defaultDuration: null,
    restSeconds: 60,
    prerequisites: [],
    equipment: [],
    notes: 'Build to 20 clean reps before advancing. Quality over junk volume.',
  },

  wall_pushup: {
    id: 'wall_pushup',
    name: 'Wall Push-Up',
    category: 'squat_thrust_pushup',
    stage: null,
    progressions: ['incline_pushup'],
    regressions: [],
    cue: 'Hands on wall, slight angle. Bend elbows to bring chest close to wall. Push out.',
    defaultSets: 3,
    defaultReps: 12,
    defaultDuration: null,
    restSeconds: 45,
    prerequisites: [],
    equipment: [],
    notes: 'Entry point for push-up work. Move to incline as soon as 15+ reps feel easy.',
  },

  decline_pushup: {
    id: 'decline_pushup',
    name: 'Decline Push-Up',
    category: 'squat_thrust_pushup',
    stage: null,
    progressions: ['archer_pushup'],
    regressions: ['full_pushup'],
    cue: 'Feet elevated on bench/box. More upper chest and shoulder involvement.',
    defaultSets: 3,
    defaultReps: 10,
    defaultDuration: null,
    restSeconds: 60,
    prerequisites: ['full_pushup'],
    equipment: ['box_or_bench'],
    notes: 'Great for upper chest development and building pressing strength.',
  },

  diamond_pushup: {
    id: 'diamond_pushup',
    name: 'Diamond Push-Up',
    category: 'squat_thrust_pushup',
    stage: null,
    progressions: ['archer_pushup'],
    regressions: ['full_pushup'],
    cue: 'Hands form a diamond shape. Elbows track back along your sides. Tricep-dominant.',
    defaultSets: 3,
    defaultReps: 8,
    defaultDuration: null,
    restSeconds: 60,
    prerequisites: ['full_pushup'],
    equipment: [],
    notes: 'Builds tricep strength needed for straight bar dip and muscle-up press-out.',
  },

  archer_pushup: {
    id: 'archer_pushup',
    name: 'Archer Push-Up',
    category: 'squat_thrust_pushup',
    stage: null,
    progressions: ['one_arm_pushup_progression'],
    regressions: ['decline_pushup', 'diamond_pushup'],
    cue: 'One arm bends, other arm extends straight out. Alternate. Moving toward one-arm strength.',
    defaultSets: 3,
    defaultReps: 6,
    defaultDuration: null,
    restSeconds: 90,
    prerequisites: ['full_pushup'],
    equipment: [],
    notes: 'Builds the asymmetrical strength for one-arm progressions.',
  },

  squat_thrust: {
    id: 'squat_thrust',
    name: 'Squat Thrust (Without Push-Up)',
    category: 'squat_thrust_pushup',
    stage: null,
    progressions: ['squat_thrust_pushup_combo'],
    regressions: [],
    cue: 'Stand → squat → kick feet back → feet forward → stand. Smooth rhythm, not rushed.',
    defaultSets: 3,
    defaultReps: 8,
    defaultDuration: null,
    restSeconds: 60,
    prerequisites: [],
    equipment: [],
    notes: 'Learn the pattern before adding the push-up.',
  },

  squat_thrust_pushup_combo: {
    id: 'squat_thrust_pushup_combo',
    name: 'Squat Thrust + Push-Up',
    category: 'squat_thrust_pushup',
    stage: null,
    progressions: ['burpee_with_jump'],
    regressions: ['squat_thrust'],
    cue: 'Stand → squat → kick back → push-up → kick forward → stand. Smooth transitions.',
    defaultSets: 3,
    defaultReps: 6,
    defaultDuration: null,
    restSeconds: 75,
    prerequisites: ['full_pushup', 'squat_thrust'],
    equipment: [],
    notes: 'This is the core movement. Build up to 3×10 before adding jump.',
  },

  burpee_with_jump: {
    id: 'burpee_with_jump',
    name: 'Burpee (Squat Thrust + Push-Up + Jump)',
    category: 'squat_thrust_pushup',
    stage: null,
    progressions: [],
    regressions: ['squat_thrust_pushup_combo'],
    cue: 'Full burpee — add explosive jump at the top. Land soft. Keep breathing.',
    defaultSets: 3,
    defaultReps: 8,
    defaultDuration: null,
    restSeconds: 90,
    prerequisites: ['squat_thrust_pushup_combo'],
    equipment: [],
    notes: 'Excellent conditioning. Keep rest honest — 90s maximum.',
  },

  // ═══════════════════════════════════════════════════════════
  // CATEGORY 3 — CALVES
  // ═══════════════════════════════════════════════════════════

  double_leg_calf_raise: {
    id: 'double_leg_calf_raise',
    name: 'Double-Leg Calf Raise',
    category: 'calves',
    stage: null,
    progressions: ['single_leg_calf_raise_assisted'],
    regressions: [],
    cue: 'Full range — heel below edge on step. Slow up (2s) and slow down (3s). Pause at top.',
    defaultSets: 3,
    defaultReps: 20,
    defaultDuration: null,
    restSeconds: 60,
    prerequisites: [],
    equipment: [],
    notes: 'If 20 easy reps feel simple, add load or progress to single-leg.',
  },

  single_leg_calf_raise_assisted: {
    id: 'single_leg_calf_raise_assisted',
    name: 'Single-Leg Calf Raise (Wall Support)',
    category: 'calves',
    stage: null,
    progressions: ['single_leg_calf_raise'],
    regressions: ['double_leg_calf_raise'],
    cue: 'One hand lightly on wall for balance only — don\'t push off it. Full ROM, slow eccentric.',
    defaultSets: 3,
    defaultReps: 10,
    defaultDuration: null,
    restSeconds: 60,
    prerequisites: ['double_leg_calf_raise'],
    equipment: [],
    notes: 'Build to 15 reps per side before removing wall support.',
  },

  single_leg_calf_raise: {
    id: 'single_leg_calf_raise',
    name: 'Single-Leg Calf Raise (Free Standing)',
    category: 'calves',
    stage: null,
    progressions: ['single_leg_calf_raise_loaded'],
    regressions: ['single_leg_calf_raise_assisted'],
    cue: 'Slight bend at knee. Full ROM. Tempo: 2 up, pause, 3 down. Do not rush.',
    defaultSets: 3,
    defaultReps: 12,
    defaultDuration: null,
    restSeconds: 60,
    prerequisites: ['single_leg_calf_raise_assisted'],
    equipment: [],
    notes: 'Build to 20 controlled reps per leg before adding load.',
  },

  single_leg_calf_raise_loaded: {
    id: 'single_leg_calf_raise_loaded',
    name: 'Loaded Single-Leg Calf Raise',
    category: 'calves',
    stage: null,
    progressions: [],
    regressions: ['single_leg_calf_raise'],
    cue: 'Hold light weight in one hand. Same tempo — never rush eccentrics.',
    defaultSets: 3,
    defaultReps: 12,
    defaultDuration: null,
    restSeconds: 60,
    prerequisites: ['single_leg_calf_raise'],
    equipment: [],
    notes: 'Progression by load and reps. Small increments.',
  },

  // ═══════════════════════════════════════════════════════════
  // CATEGORY 4 — TIBIALIS / SHIN WORK
  // ═══════════════════════════════════════════════════════════

  tibialis_raise_seated: {
    id: 'tibialis_raise_seated',
    name: 'Tibialis Raise (Seated)',
    category: 'tibialis',
    stage: null,
    progressions: ['tibialis_raise_standing'],
    regressions: [],
    cue: 'Sit with feet slightly off floor. Dorsiflect feet — pull toes toward shins. Slow and controlled.',
    defaultSets: 2,
    defaultReps: 20,
    defaultDuration: null,
    restSeconds: 45,
    prerequisites: [],
    equipment: [],
    notes: 'Start point for tibialis work. Very little equipment needed.',
  },

  tibialis_raise_standing: {
    id: 'tibialis_raise_standing',
    name: 'Tibialis Raise (Standing / Wall)',
    category: 'tibialis',
    stage: null,
    progressions: ['tibialis_raise_loaded'],
    regressions: ['tibialis_raise_seated'],
    cue: 'Back against wall, feet 6" out. Lift toes and forefoot off floor. Full ROM, slow.',
    defaultSets: 3,
    defaultReps: 25,
    defaultDuration: null,
    restSeconds: 45,
    prerequisites: ['tibialis_raise_seated'],
    equipment: [],
    notes: 'Wall tibialis raises are the standard. Build to 3×30 before adding load.',
  },

  tibialis_raise_loaded: {
    id: 'tibialis_raise_loaded',
    name: 'Loaded Tibialis Raise',
    category: 'tibialis',
    stage: null,
    progressions: [],
    regressions: ['tibialis_raise_standing'],
    cue: 'Use a light weight plate or band over feet. Same controlled ROM.',
    defaultSets: 3,
    defaultReps: 20,
    defaultDuration: null,
    restSeconds: 45,
    prerequisites: ['tibialis_raise_standing'],
    equipment: ['resistance_bands'],
    notes: 'Add load gradually. Shin splint prevention work.',
  },

  // ═══════════════════════════════════════════════════════════
  // CATEGORY 5 — CORE / STABILITY
  // ═══════════════════════════════════════════════════════════

  hollow_body_hold: {
    id: 'hollow_body_hold',
    name: 'Hollow Body Hold',
    category: 'core',
    stage: null,
    progressions: ['l_sit_tuck'],
    regressions: ['dead_bug'],
    cue: 'Lower back pressed to floor. Legs and arms extended. Breathe while maintaining the shape.',
    defaultSets: 3,
    defaultReps: null,
    defaultDuration: 20,
    restSeconds: 60,
    prerequisites: [],
    equipment: [],
    notes: 'Foundation for bar work. Build to 30s hold before progressing.',
  },

  dead_bug: {
    id: 'dead_bug',
    name: 'Dead Bug',
    category: 'core',
    stage: null,
    progressions: ['hollow_body_hold'],
    regressions: [],
    cue: 'Arms up, legs at 90°. Lower opposite arm/leg slowly. Never let lower back arch off floor.',
    defaultSets: 2,
    defaultReps: 8,
    defaultDuration: null,
    restSeconds: 45,
    prerequisites: [],
    equipment: [],
    notes: 'Entry core exercise. Safer than crunches for spinal health.',
  },

  l_sit_tuck: {
    id: 'l_sit_tuck',
    name: 'L-Sit Tuck (Bar or Floor)',
    category: 'core',
    stage: null,
    progressions: ['l_sit_one_leg', 'hanging_knee_raise'],
    regressions: ['hollow_body_hold'],
    cue: 'Support on hands, knees pulled to chest. Depress shoulders. Hold tight.',
    defaultSets: 3,
    defaultReps: null,
    defaultDuration: 10,
    restSeconds: 60,
    prerequisites: ['hollow_body_hold'],
    equipment: [],
    notes: 'Build to 20s hold before attempting full L-sit.',
  },

  hanging_knee_raise: {
    id: 'hanging_knee_raise',
    name: 'Hanging Knee Raise',
    category: 'core',
    stage: null,
    progressions: ['hanging_leg_raise'],
    regressions: ['l_sit_tuck'],
    cue: 'Hang from bar. Raise knees to 90° (or higher). Control the descent. No swinging.',
    defaultSets: 3,
    defaultReps: 8,
    defaultDuration: null,
    restSeconds: 60,
    prerequisites: [],
    equipment: ['pull_up_bar'],
    notes: 'Also builds grip and scapular stability. Win-win for pull-up training.',
  },

  hanging_leg_raise: {
    id: 'hanging_leg_raise',
    name: 'Hanging Leg Raise (Straight)',
    category: 'core',
    stage: null,
    progressions: [],
    regressions: ['hanging_knee_raise'],
    cue: 'Raise straight legs to parallel or above. No swinging. Slow eccentric.',
    defaultSets: 3,
    defaultReps: 6,
    defaultDuration: null,
    restSeconds: 90,
    prerequisites: ['hanging_knee_raise'],
    equipment: ['pull_up_bar'],
    notes: 'Advanced core work. Don\'t kip.',
  },

  plank: {
    id: 'plank',
    name: 'Plank',
    category: 'core',
    stage: null,
    progressions: ['hollow_body_hold'],
    regressions: ['dead_bug'],
    cue: 'Straight line heel to head. Squeeze glutes and abs. Breathe. Elbows under shoulders.',
    defaultSets: 3,
    defaultReps: null,
    defaultDuration: 20,
    restSeconds: 45,
    prerequisites: [],
    equipment: [],
    notes: 'Stop when form breaks — don\'t hold a bad plank.',
  },

};

// ── Helper Functions ───────────────────────────────────────────

/**
 * Get all exercises for a given category.
 * Returns an array of exercise objects.
 */
function getExercisesByCategory(category) {
  return Object.values(ExerciseLibrary).filter(ex => ex.category === category);
}

/**
 * Get all exercises for a given pull-up stage.
 */
function getExercisesByStage(stageId) {
  return Object.values(ExerciseLibrary).filter(ex => ex.stage === stageId);
}

/**
 * Get a single exercise by its id.
 * Returns null if not found.
 */
function getExerciseById(id) {
  return ExerciseLibrary[id] || null;
}

/**
 * Check whether the user has the equipment required for an exercise.
 * Returns true if requirements are met or if no equipment is needed.
 */
function exerciseMatchesEquipment(exercise, userEquipment) {
  if (!exercise.equipment || exercise.equipment.length === 0) return true;
  return exercise.equipment.every(eq => userEquipment.includes(eq));
}

/**
 * Get a formatted prescription string for an exercise.
 * e.g. "3×8" or "3×20s" or "3×30s hold"
 */
function formatPrescription(exercise, sets, reps, duration) {
  const s = sets || exercise.defaultSets;
  if (duration || exercise.defaultDuration) {
    const d = duration || exercise.defaultDuration;
    return `${s}×${d}s`;
  }
  const r = reps || exercise.defaultReps;
  return `${s}×${r}`;
}

/**
 * Returns the warm-up exercises appropriate for the current session context.
 * Always includes the base warm-up; adds band pull-apart if bands available.
 */
function getWarmupExercises(userEquipment) {
  const warmup = [
    ExerciseLibrary.jumping_jacks_warmup,
    ExerciseLibrary.arm_circles_warmup,
    ExerciseLibrary.wrist_circles_warmup,
  ];
  if (userEquipment.includes(EQUIPMENT.RESISTANCE_BANDS)) {
    warmup.push(ExerciseLibrary.band_pull_apart_warmup);
  } else {
    warmup.push(ExerciseLibrary.bodyweight_row_warmup);
  }
  return warmup;
}
