/**
 * The English catalogue, and the source of truth for what keys exist.
 *
 * `pl.ts` declares its export as `Translations`, so a key added here and not
 * there is a compile error rather than a string that silently falls back to
 * English in a Polish interface.
 */
export const en = {
  app: {
    title: 'BMAPP',
  },
  language: {
    label: 'Language',
    // Each language is named in its own language: someone looking for Polish
    // is not helped by the word "Polish" written in a language they don't read.
    en: 'English',
    pl: 'Polski',
  },
  nav: {
    label: 'Sections',
    hub: 'Hub',
    teams: 'Teams',
    archive: 'Archive',
    notYetAvailable: 'Not yet available',
    brandSub: 'Board meetings',
  },
  hub: {
    loading: 'Loading the hub…',
    loadFailed: 'Could not load the hub.',
    eyebrow: 'Weekly team briefing · Kaizen board',
    heroTitle: 'The team board, online.',
    heroBody:
      'Record this meeting’s metric values, work the problems, agree the tasks. Every value belongs to the meeting it was recorded at, so the trend follows the sequence of meetings — not the calendar.',
    footerNote: 'on-premise · board meetings application',
    footerEnv: 'v0.1.0 · walking skeleton',
    provisional: 'The figures on this page are placeholder data, not anything recorded.',
  },
  declarations: {
    band: 'Company declarations',
    bandNote: 'Visible on every board',
    mission: 'Mission',
    vision: 'Vision',
    goals: 'Strategic goals',
    values: 'Values',
  },
  myTeams: {
    heading: 'My teams · next board meetings',
    // The count renders as a bare figure, as the mockup has it; this is
    // what names it for a screen reader.
    count: 'Teams: {{count}}',
    role_leader: 'Team leader',
    role_member: 'Member',
    ready: 'Board ready',
    // Colon form on purpose: Polish declines the noun after a numeral in
    // ways English does not, and the two catalogues must hold the same keys.
    metricsMissing: 'Metrics missing: {{count}}',
    days: 'days',
    hours: 'hrs',
    minutes: 'min',
    countdownLabel: 'Time until the next board meeting',
    nextMeeting: 'Next board meeting',
    weeklySlot: 'Meets',
  },
  tiles: {
    heading: 'What happens at the board',
    inSession: 'In session',
    metricsDue: 'metrics due',
    problemsReview: 'to review',
    openTasks: 'open tasks',
    configureTitle: 'Configure BM',
    configureBody: 'Metrics, acceptable min / max, custom targets.',
    prepareTitle: 'Prepare BM',
    prepareBody: 'Draft the agenda, enter metric values, flag what needs the team’s attention.',
    conductTitle: 'Conduct BM',
    conductBody:
      'Run the meeting at the board: read the trends, work the problems, agree the tasks — all recorded against this meeting.',
    conductStep1: 'Metrics',
    conductStep2: 'Problems',
    conductStep3: 'Tasks',
    browseTitle: 'Browse BM',
    browseBody: 'Past meetings, trends and the archive.',
    accessTitle: 'Manage access',
    accessBody:
      'Team membership, leaders and who may configure a board — identities keyed on employee email.',
    adminSection: 'Administration',
    adminNote: 'Set up once per team',
  },
  funnel: {
    heading: 'Problem & task funnel',
    scope: 'all my teams · last meetings ({{count}})',
    stage_open: 'Open',
    stage_in_progress: 'In progress',
    stage_archived: 'Archived',
    split: '{{problems}} problems · {{tasks}} tasks',
    footLeft: 'Raised at the board',
    footRight: 'Closed → archived, never deleted',
  },
  items: {
    heading: 'Assigned to me',
    assignedTo: 'Assigned to {{email}}',
    empty: 'Nothing is assigned to you right now.',
    kind_problem: 'Problem',
    kind_task: 'Task',
    progress: '{{percent}}% done',
    due: 'Due {{date}}',
    overdue: 'Overdue',
  },
  common: {
    unavailable: 'Not available',
  },
  theme: {
    // The control is captioned with the theme it switches *to*, as the mockup
    // has it; the full sentences are what assistive technology reads.
    dark: 'Dark',
    light: 'Light',
    switchToDark: 'Switch to the dark theme',
    switchToLight: 'Switch to the light theme',
    currentDark: 'Current theme: dark',
    currentLight: 'Current theme: light',
  },
  teams: {
    heading: 'Teams',
    nameLabel: 'Team name',
    register: 'Register team',
    registering: 'Registering…',
    loading: 'Loading teams…',
    loadFailed: 'Could not load teams.',
    empty: 'No teams registered yet.',
    boardSuffix: 'board: {{name}}',
    leaderEmailLabel: 'Team leader’s email',
    leaderSuffix: 'leader: {{email}}',
    // Colon form for the same reason as myTeams.metricsMissing.
    memberCount: 'Members: {{count}}',
    membersLink: 'Members',
    membersLinkLabel: 'Members of {{name}}',
  },
  members: {
    heading: 'Members of {{name}}',
    back: 'Back to the teams',
    loading: 'Loading the team…',
    loadFailed: 'Could not load the team.',
    notFound: 'Team not found.',
    listLabel: 'Team members',
    leader: 'Team leader',
    emailLabel: 'Employee email',
    add: 'Add member',
    adding: 'Adding…',
    remove: 'Remove from team',
    // The visible captions repeat on every row; these name the member too,
    // so a screen reader listing the buttons can tell them apart. They start
    // with the caption, so a voice user can still say what they see.
    removeLabel: 'Remove from team: {{email}}',
    makeLeader: 'Make leader',
    makeLeaderLabel: 'Make leader: {{email}}',
  },
  errors: {
    // Keyed by the code the API reports. `generic` covers a code this
    // catalogue does not know, so no untranslated text ever reaches a user.
    generic: 'Something went wrong. Please try again.',
    'team_name.blank': 'Enter a team name.',
    'team_name.too_long': 'A team name can be at most 200 characters.',
    'team_name.duplicate': 'A team with this name already exists.',
    'request.invalid_field': 'That value is not valid.',
    'employee_email.blank': 'Enter an email address.',
    'employee_email.too_long': 'An email address can be at most 254 characters.',
    'employee_email.invalid': 'Enter a valid email address, such as name@example.com.',
    'team.not_found': 'This team does not exist.',
    'team_member.duplicate': 'This employee is already a member of the team.',
    'team_member.not_found': 'This employee is not a member of the team.',
    'team_member.is_leader':
      'The team leader cannot be removed. Make another member the leader first.',
    'team_leader.not_member': 'Only a member of the team can become its leader.',
  },
} as const;

/** The shape every catalogue must have. */
export type Translations = {
  -readonly [Section in keyof typeof en]: {
    -readonly [Key in keyof (typeof en)[Section]]: string;
  };
};
