/**
 * @file Generates the "HiveMind — High-Level Design & User Flow" Word document
 * (.docx) using the {@link https://docx.js.org|docx} library. The module defines
 * a set of small styling helpers (headings, paragraphs, tables, code blocks, info
 * boxes) and then assembles them into a multi-section, paginated document that is
 * written to disk via {@link https://docx.js.org/api/classes/Packer.html|Packer}.
 *
 * @module hivemind/doc
 * @requires docx
 * @requires fs
 */

const {
    Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
    HeadingLevel, AlignmentType, BorderStyle, WidthType, ShadingType,
    LevelFormat, PageNumber, Header, Footer, PageBreak, UnderlineType
  } = require('docx');
  const fs = require('fs');
  
  /**
   * Document color palette. Values are 6-digit hex strings (no leading `#`) as
   * expected by the `docx` library.
   *
   * @constant {string} BRAND_BLUE   Primary brand color, used for H1 headings & table headers.
   * @constant {string} ACCENT_BLUE  Accent color for H2 headings, rules and borders.
   * @constant {string} LIGHT_BLUE   Light fill for alternating table rows / info boxes.
   * @constant {string} LIGHT_GRAY   Neutral light fill for alternating table rows.
   * @constant {string} MID_GRAY     Default table border color.
   * @constant {string} DARK_GRAY    Default body text color.
   * @constant {string} WHITE        White fill / text color.
   * @constant {string} AMBER        Warning/highlight info-box fill.
   * @constant {string} GREEN_LIGHT  Success info-box fill.
   * @constant {string} PURPLE_LIGHT Formula/notice info-box fill.
   */
  const BRAND_BLUE = "1E3A5F";
  const ACCENT_BLUE = "2563EB";
  const LIGHT_BLUE = "DBEAFE";
  const LIGHT_GRAY = "F1F5F9";
  const MID_GRAY = "CBD5E1";
  const DARK_GRAY = "334155";
  const WHITE = "FFFFFF";
  const AMBER = "FEF3C7";
  const GREEN_LIGHT = "D1FAE5";
  const PURPLE_LIGHT = "EDE9FE";
  
  /**
   * Build a single-line border definition for a table cell or paragraph.
   *
   * @param {string} [color=MID_GRAY] Hex color (no `#`) for the border line.
   * @returns {{style: string, size: number, color: string}} A `docx` border spec.
   */
  function border(color = MID_GRAY) {
    return { style: BorderStyle.SINGLE, size: 1, color };
  }
  /**
   * Build a uniform border spec (top/bottom/left/right) using {@link border}.
   *
   * @param {string} [color=MID_GRAY] Hex color (no `#`) applied to all four sides.
   * @returns {{top: object, bottom: object, left: object, right: object}} Border spec for all sides.
   */
  const allBorders = (color = MID_GRAY) => ({
    top: border(color), bottom: border(color), left: border(color), right: border(color)
  });
  
  /**
   * Create a level-1 heading paragraph (large, bold, brand-blue, with an accent
   * underline rule).
   *
   * @param {string} text The heading text.
   * @returns {Paragraph} A configured `docx` {@link Paragraph}.
   */
  function h1(text) {
    return new Paragraph({
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 400, after: 200 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: ACCENT_BLUE, space: 6 } },
      children: [new TextRun({ text, font: "Arial", size: 36, bold: true, color: BRAND_BLUE })]
    });
  }
  
  /**
   * Create a level-2 heading paragraph (bold, accent-blue).
   *
   * @param {string} text The heading text.
   * @returns {Paragraph} A configured `docx` {@link Paragraph}.
   */
  function h2(text) {
    return new Paragraph({
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 300, after: 160 },
      children: [new TextRun({ text, font: "Arial", size: 28, bold: true, color: ACCENT_BLUE })]
    });
  }
  
  /**
   * Create a level-3 heading paragraph (bold, dark-gray).
   *
   * @param {string} text The heading text.
   * @returns {Paragraph} A configured `docx` {@link Paragraph}.
   */
  function h3(text) {
    return new Paragraph({
      heading: HeadingLevel.HEADING_3,
      spacing: { before: 200, after: 120 },
      children: [new TextRun({ text, font: "Arial", size: 24, bold: true, color: DARK_GRAY })]
    });
  }
  
  /**
   * Create a body paragraph in the default Arial body style.
   *
   * @param {string} text The paragraph text.
   * @param {object} [opts={}] Extra {@link TextRun} options merged onto the run
   *   (e.g. `{ bold: true }`, `{ italics: true }`).
   * @returns {Paragraph} A configured `docx` {@link Paragraph}.
   */
  function para(text, opts = {}) {
    return new Paragraph({
      spacing: { after: 140 },
      children: [new TextRun({ text, font: "Arial", size: 22, color: DARK_GRAY, ...opts })]
    });
  }
  
  /**
   * Create a bulleted list item bound to the document's "bullets" numbering config.
   *
   * @param {string} text The list-item text.
   * @param {boolean} [bold=false] Whether to render the text in bold.
   * @returns {Paragraph} A configured `docx` {@link Paragraph}.
   */
  function bullet(text, bold = false) {
    return new Paragraph({
      numbering: { reference: "bullets", level: 0 },
      spacing: { after: 100 },
      children: [new TextRun({ text, font: "Arial", size: 22, color: DARK_GRAY, bold })]
    });
  }
  
  /**
   * Create an empty paragraph used purely for vertical spacing.
   *
   * @param {number} [lines=1] Number of "lines" of space; each line adds 120 twips of trailing space.
   * @returns {Paragraph} An empty spacing {@link Paragraph}.
   */
  function spacer(lines = 1) {
    return new Paragraph({ spacing: { after: lines * 120 }, children: [new TextRun("")] });
  }
  
  /**
   * Create a styled table header cell (bold, centered, colored fill).
   *
   * @param {string} text The header label.
   * @param {string} [fill=BRAND_BLUE] Cell background hex color.
   * @param {string} [textColor=WHITE] Text hex color.
   * @param {number} [width=2340] Cell width in DXA (twips).
   * @returns {TableCell} A configured `docx` {@link TableCell}.
   */
  function headerCell(text, fill = BRAND_BLUE, textColor = WHITE, width = 2340) {
    return new TableCell({
      borders: allBorders(BRAND_BLUE),
      shading: { fill, type: ShadingType.CLEAR },
      margins: { top: 100, bottom: 100, left: 140, right: 140 },
      width: { size: width, type: WidthType.DXA },
      children: [new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text, font: "Arial", size: 20, bold: true, color: textColor })]
      })]
    });
  }
  
  /**
   * Create a styled table data (body) cell.
   *
   * @param {string} text The cell text.
   * @param {string} [fill=WHITE] Cell background hex color (used for zebra striping).
   * @param {number} [width=2340] Cell width in DXA (twips).
   * @param {boolean} [bold=false] Whether to render the text in bold.
   * @returns {TableCell} A configured `docx` {@link TableCell}.
   */
  function dataCell(text, fill = WHITE, width = 2340, bold = false) {
    return new TableCell({
      borders: allBorders(MID_GRAY),
      shading: { fill, type: ShadingType.CLEAR },
      margins: { top: 80, bottom: 80, left: 140, right: 140 },
      width: { size: width, type: WidthType.DXA },
      children: [new Paragraph({
        children: [new TextRun({ text, font: "Arial", size: 20, color: DARK_GRAY, bold })]
      })]
    });
  }
  
  /**
   * Render an array of source lines as a monospaced, dark-themed code block with
   * an accent left border.
   *
   * @param {string[]} lines The lines of code/text to render (one per visual line).
   * @returns {Paragraph} A configured `docx` {@link Paragraph} containing the code.
   */
  function codeBlock(lines) {
    return new Paragraph({
      spacing: { after: 160 },
      shading: { fill: "1E293B", type: ShadingType.CLEAR },
      border: { left: { style: BorderStyle.SINGLE, size: 12, color: ACCENT_BLUE, space: 6 } },
      children: lines.map((line, i) =>
        new TextRun({ text: line + (i < lines.length - 1 ? "\n" : ""), font: "Courier New", size: 18, color: "94A3B8", break: i > 0 ? 0 : undefined })
      )
    });
  }
  
  /**
   * Render a callout / "info box": a shaded paragraph with a thick colored left
   * border, used for highlights, notices and formulas.
   *
   * @param {string} text The callout text.
   * @param {string} [fill=LIGHT_BLUE] Background hex color.
   * @param {string} [borderColor=ACCENT_BLUE] Left-border hex color.
   * @returns {Paragraph} A configured `docx` {@link Paragraph}.
   */
  function infoBox(text, fill = LIGHT_BLUE, borderColor = ACCENT_BLUE) {
    return new Paragraph({
      spacing: { before: 100, after: 200 },
      shading: { fill, type: ShadingType.CLEAR },
      border: { left: { style: BorderStyle.SINGLE, size: 16, color: borderColor, space: 8 } },
      children: [new TextRun({ text, font: "Arial", size: 20, color: DARK_GRAY })]
    });
  }
  
  // ── TITLE PAGE ──────────────────────────────────────────────────────────────
  const titlePage = [
    spacer(4),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 160 },
      children: [new TextRun({ text: "🐝  HiveMind", font: "Arial", size: 72, bold: true, color: BRAND_BLUE })]
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
      children: [new TextRun({ text: "Internal Organizational Problem Marketplace & Contribution Economy", font: "Arial", size: 28, color: DARK_GRAY, italics: true })]
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: ACCENT_BLUE, space: 4 } },
      spacing: { after: 300 },
      children: [new TextRun({ text: " ", font: "Arial", size: 24 })]
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 120 },
      children: [new TextRun({ text: "High-Level Design & User Flow", font: "Arial", size: 32, bold: true, color: ACCENT_BLUE })]
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 120 },
      children: [new TextRun({ text: "Version 1.0  |  Internal Document", font: "Arial", size: 22, color: "6B7280" })]
    }),
    spacer(5),
    new Paragraph({ children: [new PageBreak()] })
  ];
  
  // ── SECTION 1: OVERVIEW ─────────────────────────────────────────────────────
  const section1 = [
    h1("1. Overview"),
    para("HiveMind turns the quiet, distributed expertise inside an organization into a measurable internal economy. Anyone can post a \"request\" (a problem or ask) with a credit bounty; colleagues claim it, do the work, attach proof, and get the bounty once a reviewer approves. Contribution is tracked via credits, reputation, and tiered badges."),
    spacer(),
    h2("1.1  Core Value Proposition"),
    infoBox("Employees post problems (intros, hiring, research, vendor discovery, market intel, mentorship), peers claim and solve them, submit proof-of-work, and earn credits redeemable for rewards — with reputation, badges, leaderboards, a kanban board, dashboards, multi-tenant orgs, RBAC, audit logs, and notifications.", AMBER, "D97706"),
    spacer(),
    h2("1.2  Personas & Roles"),
    new Table({
      width: { size: 9360, type: WidthType.DXA },
      columnWidths: [1980, 7380],
      rows: [
        new TableRow({ children: [headerCell("Persona", BRAND_BLUE, WHITE, 1980), headerCell("Responsibilities", BRAND_BLUE, WHITE, 7380)] }),
        new TableRow({ children: [dataCell("Admin", LIGHT_BLUE, 1980, true), dataCell("Owns the org. Manages users, roles, categories, departments, credit valuation, rewards; views audit logs.", WHITE, 7380)] }),
        new TableRow({ children: [dataCell("Manager", LIGHT_GRAY, 1980, true), dataCell("Monitors team activity, sees audit logs, can edit/transition any request.", LIGHT_GRAY, 7380)] }),
        new TableRow({ children: [dataCell("Reviewer", LIGHT_BLUE, 1980, true), dataCell("Approves / rejects / requests changes on submitted solutions.", WHITE, 7380)] }),
        new TableRow({ children: [dataCell("Employee", LIGHT_GRAY, 1980, true), dataCell("Creates and claims requests, submits solutions, earns credits, redeems rewards.", LIGHT_GRAY, 7380)] }),
      ]
    }),
    spacer(),
    infoBox("All data is scoped to a single tenant (org_id), so multiple organizations are fully isolated within one deployment.", GREEN_LIGHT, "059669"),
    spacer(),
    new Paragraph({ children: [new PageBreak()] })
  ];
  
  // ── SECTION 2: TECH STACK ───────────────────────────────────────────────────
  const section2 = [
    h1("2. Tech Stack"),
    new Table({
      width: { size: 9360, type: WidthType.DXA },
      columnWidths: [2340, 7020],
      rows: [
        new TableRow({ children: [headerCell("Layer", BRAND_BLUE, WHITE, 2340), headerCell("Technology", BRAND_BLUE, WHITE, 7020)] }),
        new TableRow({ children: [dataCell("Backend", LIGHT_BLUE, 2340, true), dataCell("FastAPI (single-file MVP in backend/server.py), APIRouter mounted at /api", WHITE, 7020)] }),
        new TableRow({ children: [dataCell("Database", LIGHT_GRAY, 2340, true), dataCell("MongoDB via Motor (AsyncIOMotorClient)", LIGHT_GRAY, 7020)] }),
        new TableRow({ children: [dataCell("Auth", LIGHT_BLUE, 2340, true), dataCell("JWT (HS256) in httpOnly cookies — access_token 1 day, refresh_token 7 days — with samesite=none; secure", WHITE, 7020)] }),
        new TableRow({ children: [dataCell("Object Storage", LIGHT_GRAY, 2340, true), dataCell("Emergent Object Storage (init via EMERGENT_LLM_KEY) for proof-of-work file uploads", LIGHT_GRAY, 7020)] }),
        new TableRow({ children: [dataCell("Frontend", LIGHT_BLUE, 2340, true), dataCell("React 19, react-router-dom 7, Tailwind + shadcn/ui (Radix), Recharts, axios, sonner toasts", WHITE, 7020)] }),
        new TableRow({ children: [dataCell("Build", LIGHT_GRAY, 2340, true), dataCell("CRACO (Create React App + config override), Yarn", LIGHT_GRAY, 7020)] }),
      ]
    }),
    spacer(),
    para("Key backend dependencies: motor, pydantic, pyjwt, bcrypt, python-multipart, requests (see backend/requirements.txt)."),
    spacer(),
    new Paragraph({ children: [new PageBreak()] })
  ];
  
  // ── SECTION 3: ARCHITECTURE ─────────────────────────────────────────────────
  const section3 = [
    h1("3. High-Level Architecture"),
    para("The system consists of three layers: a React 19 single-page application in the browser, a FastAPI backend server, and persistent data stores (MongoDB + object storage)."),
    spacer(),
    h2("3.1  Component Overview"),
    new Table({
      width: { size: 9360, type: WidthType.DXA },
      columnWidths: [2340, 3510, 3510],
      rows: [
        new TableRow({ children: [headerCell("Layer", BRAND_BLUE, WHITE, 2340), headerCell("Components", BRAND_BLUE, WHITE, 3510), headerCell("Responsibilities", BRAND_BLUE, WHITE, 3510)] }),
        new TableRow({ children: [dataCell("Browser (SPA)", LIGHT_BLUE, 2340, true), dataCell("React 19, AuthContext, axios client", WHITE, 3510), dataCell("UI rendering, session management, API communication via withCredentials", WHITE, 3510)] }),
        new TableRow({ children: [dataCell("Server (API)", LIGHT_GRAY, 2340, true), dataCell("CORS middleware, APIRouter, RBAC dep, storage layer", LIGHT_GRAY, 3510), dataCell("Business logic, authentication, authorization, file I/O", LIGHT_GRAY, 3510)] }),
        new TableRow({ children: [dataCell("Data", LIGHT_BLUE, 2340, true), dataCell("MongoDB, Emergent Object Storage", WHITE, 3510), dataCell("Persistent org-scoped data & binary file objects", WHITE, 3510)] }),
      ]
    }),
    spacer(),
    h2("3.2  Key Architectural Decisions"),
    bullet("The SPA communicates exclusively through /api/*. The axios instance sets withCredentials: true so the JWT cookie travels on every request."),
    bullet("Every protected endpoint resolves the caller via get_current_user (decodes the cookie/Bearer JWT, loads the user). Admin/manager-only endpoints add require_role(...)."),
    bullet("Multi-tenancy: every query filters on org_id taken from the authenticated user, so tenants never see each other's data."),
    bullet("File downloads require a valid token (cookie or ?auth= query param for <img> tags), re-checked against org_id and is_deleted."),
    spacer(),
    new Paragraph({ children: [new PageBreak()] })
  ];
  
  // ── SECTION 4: DATA MODEL ────────────────────────────────────────────────────
  const section4 = [
    h1("4. Data Model"),
    para("MongoDB collections created and seeded in backend/server.py. IDs are UUID strings (new_id()); timestamps are ISO-8601 UTC (now_iso())."),
    spacer(),
    h2("4.1  Collections"),
    new Table({
      width: { size: 9360, type: WidthType.DXA },
      columnWidths: [2000, 3680, 3680],
      rows: [
        new TableRow({ children: [headerCell("Collection", BRAND_BLUE, WHITE, 2000), headerCell("Key Fields", BRAND_BLUE, WHITE, 3680), headerCell("Notes", BRAND_BLUE, WHITE, 3680)] }),
        new TableRow({ children: [dataCell("organizations", LIGHT_BLUE, 2000, true), dataCell("id, name, domain (unique), credit_value_inr, categories[], departments[]", WHITE, 3680), dataCell("One per tenant", WHITE, 3680)] }),
        new TableRow({ children: [dataCell("users", LIGHT_GRAY, 2000, true), dataCell("id, org_id, email (unique), password_hash, role, department, skills[], reputation_score, credits_earned, credits_redeemed, badges[]", LIGHT_GRAY, 3680), dataCell("credits_balance = earned - redeemed (computed in public_user)", LIGHT_GRAY, 3680)] }),
        new TableRow({ children: [dataCell("requests_col", LIGHT_BLUE, 2000, true), dataCell("id, org_id, creator_id, title, description, category, tags[], difficulty, bounty_credits, status, claimed_by, claimed_at, completed_at, view_count", WHITE, 3680), dataCell("The core \"problem\" entity", WHITE, 3680)] }),
        new TableRow({ children: [dataCell("solutions", LIGHT_GRAY, 2000, true), dataCell("id, request_id, org_id, contributor_id, submission_text, links[], file_ids[], status, feedback, reviewed_by", LIGHT_GRAY, 3680), dataCell("status: pending / approved / rejected / changes_requested", LIGHT_GRAY, 3680)] }),
        new TableRow({ children: [dataCell("transactions", LIGHT_BLUE, 2000, true), dataCell("id, org_id, source_user, destination_user, credits, transaction_type, reason, request_id, timestamp", WHITE, 3680), dataCell("Immutable credit ledger; types: earn / redeem", WHITE, 3680)] }),
        new TableRow({ children: [dataCell("rewards", LIGHT_GRAY, 2000, true), dataCell("id, org_id, name, credits, image, stock, active", LIGHT_GRAY, 3680), dataCell("8 defaults seeded per org", LIGHT_GRAY, 3680)] }),
        new TableRow({ children: [dataCell("redemptions", LIGHT_BLUE, 2000, true), dataCell("id, org_id, user_id, reward_id, reward_name, credits, status", WHITE, 3680), dataCell("Redemption history", WHITE, 3680)] }),
        new TableRow({ children: [dataCell("notifications", LIGHT_GRAY, 2000, true), dataCell("id, org_id, user_id, message, link, read, timestamp", LIGHT_GRAY, 3680), dataCell("In-app bell feed", LIGHT_GRAY, 3680)] }),
        new TableRow({ children: [dataCell("audit_logs", LIGHT_BLUE, 2000, true), dataCell("id, org_id, actor_id, action, target, meta, timestamp", WHITE, 3680), dataCell("Admin/manager visibility only", WHITE, 3680)] }),
        new TableRow({ children: [dataCell("files", LIGHT_GRAY, 2000, true), dataCell("id, org_id, uploader_id, storage_path, original_filename, content_type, size, is_deleted", LIGHT_GRAY, 3680), dataCell("Metadata only; bytes live in object storage", LIGHT_GRAY, 3680)] }),
      ]
    }),
    spacer(),
    h2("4.2  Indexes"),
    para("The following indexes are created on startup for query performance:"),
    bullet("users.email — unique"),
    bullet("users.org_id"),
    bullet("organizations.domain — unique"),
    bullet("requests_col (org_id, status) and (org_id, created_at desc)"),
    bullet("solutions.request_id"),
    bullet("transactions (org_id, destination_user)"),
    bullet("notifications (user_id, timestamp desc)"),
    bullet("files.id — unique"),
    spacer(),
    new Paragraph({ children: [new PageBreak()] })
  ];
  
  // ── SECTION 5: API SURFACE ───────────────────────────────────────────────────
  const section5 = [
    h1("5. Backend API Surface"),
    para("All routes are under /api. Auth is required unless noted. RBAC is enforced via require_role(...)."),
    spacer(),
    h2("5.1  Auth Endpoints"),
    new Table({
      width: { size: 9360, type: WidthType.DXA },
      columnWidths: [3600, 5760],
      rows: [
        new TableRow({ children: [headerCell("Method & Path", BRAND_BLUE, WHITE, 3600), headerCell("Purpose", BRAND_BLUE, WHITE, 5760)] }),
        new TableRow({ children: [dataCell("POST /auth/register-org", LIGHT_BLUE, 3600, true), dataCell("Create a new org + admin user; seeds categories/departments/rewards; sets cookies. (public)", WHITE, 5760)] }),
        new TableRow({ children: [dataCell("POST /auth/register", LIGHT_GRAY, 3600, true), dataCell("Join an existing org by domain as an employee; sets cookies. (public)", LIGHT_GRAY, 5760)] }),
        new TableRow({ children: [dataCell("POST /auth/login", LIGHT_BLUE, 3600, true), dataCell("Email/password login; sets cookies. (public)", WHITE, 5760)] }),
        new TableRow({ children: [dataCell("POST /auth/logout", LIGHT_GRAY, 3600, true), dataCell("Clear auth cookies.", LIGHT_GRAY, 5760)] }),
        new TableRow({ children: [dataCell("GET /auth/me", LIGHT_BLUE, 3600, true), dataCell("Current user + org (used to rehydrate session).", WHITE, 5760)] }),
        new TableRow({ children: [dataCell("POST /auth/refresh", LIGHT_GRAY, 3600, true), dataCell("Mint a new access token from the refresh cookie.", LIGHT_GRAY, 5760)] }),
      ]
    }),
    spacer(),
    h2("5.2  Org & Users"),
    new Table({
      width: { size: 9360, type: WidthType.DXA },
      columnWidths: [3600, 5760],
      rows: [
        new TableRow({ children: [headerCell("Method & Path", BRAND_BLUE, WHITE, 3600), headerCell("Purpose", BRAND_BLUE, WHITE, 5760)] }),
        new TableRow({ children: [dataCell("GET/PATCH /org", LIGHT_BLUE, 3600, true), dataCell("Read / update org settings (PATCH = admin only).", WHITE, 5760)] }),
        new TableRow({ children: [dataCell("GET/POST /org/categories", LIGHT_GRAY, 3600, true), dataCell("Manage category taxonomy (POST = admin only).", LIGHT_GRAY, 5760)] }),
        new TableRow({ children: [dataCell("GET /org/departments", LIGHT_BLUE, 3600, true), dataCell("List departments.", WHITE, 5760)] }),
        new TableRow({ children: [dataCell("GET /users, /users/{id}, /users/me", LIGHT_GRAY, 3600, true), dataCell("Directory & profiles (search by name/email/skills).", LIGHT_GRAY, 5760)] }),
        new TableRow({ children: [dataCell("PATCH /users/me", LIGHT_BLUE, 3600, true), dataCell("Update own profile (skills, designation, avatar...).", WHITE, 5760)] }),
        new TableRow({ children: [dataCell("PATCH /users/{id}/role", LIGHT_GRAY, 3600, true), dataCell("Change a user's role (admin only).", LIGHT_GRAY, 5760)] }),
      ]
    }),
    spacer(),
    h2("5.3  Requests & Solutions"),
    new Table({
      width: { size: 9360, type: WidthType.DXA },
      columnWidths: [3600, 5760],
      rows: [
        new TableRow({ children: [headerCell("Method & Path", BRAND_BLUE, WHITE, 3600), headerCell("Purpose", BRAND_BLUE, WHITE, 5760)] }),
        new TableRow({ children: [dataCell("GET /requests", LIGHT_BLUE, 3600, true), dataCell("List with filters: status, category, department, q, creator_id, claimed_by; decorated with creator/claimer.", WHITE, 5760)] }),
        new TableRow({ children: [dataCell("POST /requests", LIGHT_GRAY, 3600, true), dataCell("Create a request (status: open).", LIGHT_GRAY, 5760)] }),
        new TableRow({ children: [dataCell("GET /requests/{id}", LIGHT_BLUE, 3600, true), dataCell("Detail incl. solutions + contributors; increments view_count.", WHITE, 5760)] }),
        new TableRow({ children: [dataCell("PATCH /requests/{id}", LIGHT_GRAY, 3600, true), dataCell("Edit (creator or admin/manager).", LIGHT_GRAY, 5760)] }),
        new TableRow({ children: [dataCell("POST /requests/{id}/claim", LIGHT_BLUE, 3600, true), dataCell("Claim a request (can't claim own).", WHITE, 5760)] }),
        new TableRow({ children: [dataCell("POST /requests/{id}/unclaim", LIGHT_GRAY, 3600, true), dataCell("Release a claimed request.", LIGHT_GRAY, 5760)] }),
        new TableRow({ children: [dataCell("POST /requests/{id}/status", LIGHT_BLUE, 3600, true), dataCell("Manual status transition (creator/claimer/admin/manager).", WHITE, 5760)] }),
        new TableRow({ children: [dataCell("POST /requests/{id}/solutions", LIGHT_GRAY, 3600, true), dataCell("Submit a solution — request becomes submitted.", LIGHT_GRAY, 5760)] }),
        new TableRow({ children: [dataCell("POST /solutions/{id}/review", LIGHT_BLUE, 3600, true), dataCell("Approve / reject / request_changes (creator or reviewer/admin/manager).", WHITE, 5760)] }),
      ]
    }),
    spacer(),
    h2("5.4  Files, Rewards, Ledger & Insights"),
    new Table({
      width: { size: 9360, type: WidthType.DXA },
      columnWidths: [3600, 5760],
      rows: [
        new TableRow({ children: [headerCell("Method & Path", BRAND_BLUE, WHITE, 3600), headerCell("Purpose", BRAND_BLUE, WHITE, 5760)] }),
        new TableRow({ children: [dataCell("POST /files/upload", LIGHT_BLUE, 3600, true), dataCell("Upload proof-of-work files (max 15 MB).", WHITE, 5760)] }),
        new TableRow({ children: [dataCell("GET /files/{id}/download", LIGHT_GRAY, 3600, true), dataCell("Stream download; supports ?auth= token for <img> tags.", LIGHT_GRAY, 5760)] }),
        new TableRow({ children: [dataCell("GET/POST /rewards", LIGHT_BLUE, 3600, true), dataCell("Rewards marketplace listing; POST to create (admin only).", WHITE, 5760)] }),
        new TableRow({ children: [dataCell("POST /rewards/redeem", LIGHT_GRAY, 3600, true), dataCell("Redeem a reward (balance + stock checked).", LIGHT_GRAY, 5760)] }),
        new TableRow({ children: [dataCell("GET /redemptions", LIGHT_BLUE, 3600, true), dataCell("Redemption history.", WHITE, 5760)] }),
        new TableRow({ children: [dataCell("GET /transactions/me", LIGHT_GRAY, 3600, true), dataCell("Personal credit ledger.", LIGHT_GRAY, 5760)] }),
        new TableRow({ children: [dataCell("GET /leaderboard", LIGHT_BLUE, 3600, true), dataCell("Rankings by scope (global/department) and period (all/monthly/quarterly).", WHITE, 5760)] }),
        new TableRow({ children: [dataCell("GET /dashboard/stats", LIGHT_GRAY, 3600, true), dataCell("KPI cards, 14-day activity, category breakdown, personal stats.", LIGHT_GRAY, 5760)] }),
        new TableRow({ children: [dataCell("GET /notifications", LIGHT_BLUE, 3600, true), dataCell("In-app notification feed.", WHITE, 5760)] }),
        new TableRow({ children: [dataCell("POST /notifications/{id}/read", LIGHT_GRAY, 3600, true), dataCell("Mark individual notification as read.", LIGHT_GRAY, 5760)] }),
        new TableRow({ children: [dataCell("POST /notifications/read-all", LIGHT_BLUE, 3600, true), dataCell("Mark all notifications as read.", WHITE, 5760)] }),
        new TableRow({ children: [dataCell("GET /audit-logs", LIGHT_GRAY, 3600, true), dataCell("Full audit trail (admin/manager only).", LIGHT_GRAY, 5760)] }),
        new TableRow({ children: [dataCell("GET /health", LIGHT_BLUE, 3600, true), dataCell("Liveness probe.", WHITE, 5760)] }),
      ]
    }),
    spacer(),
    new Paragraph({ children: [new PageBreak()] })
  ];
  
  // ── SECTION 6: DOMAIN LOGIC ─────────────────────────────────────────────────
  const section6 = [
    h1("6. Domain Logic"),
    h2("6.1  Request Lifecycle & Status Machine"),
    para("Requests flow through a well-defined set of states. The following transitions are enforced by the backend:"),
    spacer(),
    new Table({
      width: { size: 9360, type: WidthType.DXA },
      columnWidths: [2340, 2340, 2340, 2340],
      rows: [
        new TableRow({ children: [headerCell("From State", BRAND_BLUE, WHITE, 2340), headerCell("To State", BRAND_BLUE, WHITE, 2340), headerCell("Trigger", BRAND_BLUE, WHITE, 2340), headerCell("Who", BRAND_BLUE, WHITE, 2340)] }),
        new TableRow({ children: [dataCell("(new)", LIGHT_BLUE, 2340), dataCell("open", WHITE, 2340), dataCell("create_request", WHITE, 2340), dataCell("Any employee", WHITE, 2340)] }),
        new TableRow({ children: [dataCell("open", LIGHT_GRAY, 2340), dataCell("claimed", LIGHT_GRAY, 2340), dataCell("claim", LIGHT_GRAY, 2340), dataCell("Any employee (not creator)", LIGHT_GRAY, 2340)] }),
        new TableRow({ children: [dataCell("claimed", LIGHT_BLUE, 2340), dataCell("open", WHITE, 2340), dataCell("unclaim", WHITE, 2340), dataCell("Claimer / admin / manager", WHITE, 2340)] }),
        new TableRow({ children: [dataCell("claimed", LIGHT_GRAY, 2340), dataCell("in_progress", LIGHT_GRAY, 2340), dataCell("status update", LIGHT_GRAY, 2340), dataCell("Claimer", LIGHT_GRAY, 2340)] }),
        new TableRow({ children: [dataCell("in_progress / claimed", LIGHT_BLUE, 2340), dataCell("submitted", WHITE, 2340), dataCell("submit_solution", WHITE, 2340), dataCell("Claimer", WHITE, 2340)] }),
        new TableRow({ children: [dataCell("submitted", LIGHT_GRAY, 2340), dataCell("completed", LIGHT_GRAY, 2340), dataCell("review = approve", LIGHT_GRAY, 2340), dataCell("Creator / reviewer / admin / manager", LIGHT_GRAY, 2340)] }),
        new TableRow({ children: [dataCell("submitted", LIGHT_BLUE, 2340), dataCell("open (claim cleared)", WHITE, 2340), dataCell("review = reject", WHITE, 2340), dataCell("Creator / reviewer / admin / manager", WHITE, 2340)] }),
        new TableRow({ children: [dataCell("submitted", LIGHT_GRAY, 2340), dataCell("under_review", LIGHT_GRAY, 2340), dataCell("review = request_changes", LIGHT_GRAY, 2340), dataCell("Creator / reviewer / admin / manager", LIGHT_GRAY, 2340)] }),
        new TableRow({ children: [dataCell("under_review", LIGHT_BLUE, 2340), dataCell("submitted", WHITE, 2340), dataCell("resubmit solution", WHITE, 2340), dataCell("Claimer", WHITE, 2340)] }),
      ]
    }),
    spacer(),
    h2("6.2  Review Action Outcomes"),
    bullet("Approve → request becomes completed; bounty paid to contributor via award_credits; reputation and badges recomputed; contributor notified."),
    bullet("Reject → request returns to open with claim cleared so others can pick it up; contributor notified."),
    bullet("Request Changes → request moves to under_review; contributor is notified to revise and may resubmit."),
    spacer(),
    h2("6.3  Credits & Reputation"),
    para("Credits flow through an immutable ledger (transactions collection). The reputation score is computed as:"),
    infoBox("reputation = credits_earned × 0.5 + solved × 25 + success_rate × 2 + avg_rating × 10", PURPLE_LIGHT, "7C3AED"),
    spacer(),
    h2("6.4  Badges (Auto-Awarded)"),
    para("Badges are auto-awarded in recompute_user_stats across tiers: Bronze → Silver → Gold → Platinum → Diamond."),
    new Table({
      width: { size: 9360, type: WidthType.DXA },
      columnWidths: [3120, 6240],
      rows: [
        new TableRow({ children: [headerCell("Badge", BRAND_BLUE, WHITE, 3120), headerCell("Awarded By", BRAND_BLUE, WHITE, 6240)] }),
        new TableRow({ children: [dataCell("problem_solver", LIGHT_BLUE, 3120, true), dataCell("Number of requests solved", WHITE, 6240)] }),
        new TableRow({ children: [dataCell("connector", LIGHT_GRAY, 3120, true), dataCell("Proxy of solved count (collaborative contribution)", LIGHT_GRAY, 6240)] }),
        new TableRow({ children: [dataCell("top_contributor", LIGHT_BLUE, 3120, true), dataCell("Total credits earned", WHITE, 6240)] }),
      ]
    }),
    spacer(),
    new Paragraph({ children: [new PageBreak()] })
  ];
  
  // ── SECTION 7: FRONTEND ─────────────────────────────────────────────────────
  const section7 = [
    h1("7. Frontend Structure"),
    h2("7.1  Routes & Pages"),
    new Table({
      width: { size: 9360, type: WidthType.DXA },
      columnWidths: [2800, 2560, 4000],
      rows: [
        new TableRow({ children: [headerCell("Route", BRAND_BLUE, WHITE, 2800), headerCell("Page", BRAND_BLUE, WHITE, 2560), headerCell("Access", BRAND_BLUE, WHITE, 4000)] }),
        new TableRow({ children: [dataCell("/", LIGHT_BLUE, 2800), dataCell("Landing", WHITE, 2560), dataCell("Public", WHITE, 4000)] }),
        new TableRow({ children: [dataCell("/login", LIGHT_GRAY, 2800), dataCell("Login", LIGHT_GRAY, 2560), dataCell("Public (redirects to /app if authenticated)", LIGHT_GRAY, 4000)] }),
        new TableRow({ children: [dataCell("/app", LIGHT_BLUE, 2800), dataCell("Dashboard", WHITE, 2560), dataCell("Protected", WHITE, 4000)] }),
        new TableRow({ children: [dataCell("/app/board", LIGHT_GRAY, 2800), dataCell("Board (kanban)", LIGHT_GRAY, 2560), dataCell("Protected", LIGHT_GRAY, 4000)] }),
        new TableRow({ children: [dataCell("/app/requests/new", LIGHT_BLUE, 2800), dataCell("NewRequest", WHITE, 2560), dataCell("Protected", WHITE, 4000)] }),
        new TableRow({ children: [dataCell("/app/requests/:id", LIGHT_GRAY, 2800), dataCell("RequestDetail", LIGHT_GRAY, 2560), dataCell("Protected", LIGHT_GRAY, 4000)] }),
        new TableRow({ children: [dataCell("/app/leaderboard", LIGHT_BLUE, 2800), dataCell("Leaderboard", WHITE, 2560), dataCell("Protected", WHITE, 4000)] }),
        new TableRow({ children: [dataCell("/app/rewards", LIGHT_GRAY, 2800), dataCell("Rewards", LIGHT_GRAY, 2560), dataCell("Protected", LIGHT_GRAY, 4000)] }),
        new TableRow({ children: [dataCell("/app/profile/:id", LIGHT_BLUE, 2800), dataCell("Profile", WHITE, 2560), dataCell("Protected", WHITE, 4000)] }),
        new TableRow({ children: [dataCell("/app/admin", LIGHT_GRAY, 2800), dataCell("Admin", LIGHT_GRAY, 2560), dataCell("Admin only (nav hidden for other roles)", LIGHT_GRAY, 4000)] }),
      ]
    }),
    spacer(),
    h2("7.2  Key Frontend Components"),
    bullet("AuthContext (frontend/src/contexts/AuthContext.js) — calls GET /auth/me on mount to rehydrate user/org from the cookie; exposes login, register, registerOrg, logout, and refresh actions."),
    bullet("ProtectedRoute (frontend/src/components/ProtectedRoute.js) — shows a loader while auth resolves, then redirects unauthenticated users to /login."),
    bullet("AppShell (frontend/src/components/AppShell.js) — renders the glass nav (Dashboard / Board / Leaderboard / Rewards, plus Admin for admins), global search (Enter navigates to /app/board?q=), a notifications bell polling every 30s, and the user/account menu."),
    bullet("Board (frontend/src/pages/Board.js) — groups requests into kanban columns by status (excluding rejected), with search + category filters."),
    bullet("RequestDetail (frontend/src/pages/RequestDetail.js) — drives claim/unclaim, solution submission (text + comma-separated links + file uploads), and the review dialog."),
    spacer(),
    new Paragraph({ children: [new PageBreak()] })
  ];
  
  // ── SECTION 8: USER FLOWS ────────────────────────────────────────────────────
  const section8 = [
    h1("8. User Flows"),
    h2("8.1  Onboarding & Authentication"),
    para("The /login page provides three tabs: New Org (register-org), Join Org (register by domain), and Sign In (login). On submit, the API sets httpOnly JWT cookies and returns the user + org object. On page reload, AuthContext calls GET /auth/me to rehydrate the session from the cookie."),
    spacer(),
    h2("8.2  Create a Request"),
    bullet("User clicks New Request in the header or board navigation."),
    bullet("NewRequest form is presented; user fills in title, description, category, tags, difficulty, and bounty_credits."),
    bullet("POST /requests creates the record with status open, org_id, and creator_id."),
    bullet("The request immediately appears in the Open column of the Board."),
    spacer(),
    h2("8.3  Core Economy Loop: Claim → Solve → Review"),
    infoBox("This is the primary value-creation loop in HiveMind. Each successful completion pays credits to the contributor and increases their reputation score.", GREEN_LIGHT, "059669"),
    spacer(),
    new Table({
      width: { size: 9360, type: WidthType.DXA },
      columnWidths: [480, 2400, 6480],
      rows: [
        new TableRow({ children: [headerCell("#", BRAND_BLUE, WHITE, 480), headerCell("Actor", BRAND_BLUE, WHITE, 2400), headerCell("Action", BRAND_BLUE, WHITE, 6480)] }),
        new TableRow({ children: [dataCell("1", LIGHT_BLUE, 480), dataCell("Solver", WHITE, 2400), dataCell("POST /requests/{id}/claim — status becomes claimed; creator is notified.", WHITE, 6480)] }),
        new TableRow({ children: [dataCell("2", LIGHT_GRAY, 480), dataCell("Solver", LIGHT_GRAY, 2400), dataCell("POST /files/upload — uploads proof-of-work files; receives file_id(s).", LIGHT_GRAY, 6480)] }),
        new TableRow({ children: [dataCell("3", LIGHT_BLUE, 480), dataCell("Solver", WHITE, 2400), dataCell("POST /requests/{id}/solutions — submits solution text, links, file_ids; request status becomes submitted; creator notified.", WHITE, 6480)] }),
        new TableRow({ children: [dataCell("4a", LIGHT_GRAY, 480), dataCell("Creator / Reviewer", LIGHT_GRAY, 2400), dataCell("POST /solutions/{sid}/review {approve} — request becomes completed; bounty credited; reputation/badges recomputed; solver notified.", LIGHT_GRAY, 6480)] }),
        new TableRow({ children: [dataCell("4b", LIGHT_BLUE, 480), dataCell("Creator / Reviewer", WHITE, 2400), dataCell("POST /solutions/{sid}/review {reject} — request returns to open; claim cleared; solver notified.", WHITE, 6480)] }),
        new TableRow({ children: [dataCell("4c", LIGHT_GRAY, 480), dataCell("Creator / Reviewer", LIGHT_GRAY, 2400), dataCell("POST /solutions/{sid}/review {request_changes} — request moves to under_review; solver notified to revise.", LIGHT_GRAY, 6480)] }),
      ]
    }),
    spacer(),
    h2("8.4  Earn Credits & Redeem Rewards"),
    bullet("Approved solutions credit the solver (credits_earned increases)."),
    bullet("In the Rewards page, the user selects a reward and submits POST /rewards/redeem."),
    bullet("Backend checks balance (credits_earned - credits_redeemed) and reward stock, increments credits_redeemed, decrements stock, records a redemption, and writes a redeem ledger entry."),
    bullet("Redemption history is available via GET /redemptions."),
    spacer(),
    h2("8.5  Insights & Notifications"),
    bullet("Dashboard (GET /dashboard/stats) — org KPIs (total/open/in-progress/completed, credits awarded, active contributors, participation rate), personal stats, a 14-day created-vs-solved activity chart (Recharts), and top categories."),
    bullet("Leaderboard (GET /leaderboard) — global or department scope; all-time (by reputation then credits) or monthly/quarterly (by credits earned in the window via transaction aggregation)."),
    bullet("Notifications — AppShell polls GET /notifications every 30s; bell badge shows unread count; clicking an item navigates to its link; 'Mark all read' calls POST /notifications/read-all."),
    spacer(),
    new Paragraph({ children: [new PageBreak()] })
  ];
  
  // ── SECTION 9: SECURITY ─────────────────────────────────────────────────────
  const section9 = [
    h1("9. Security & Multi-Tenancy"),
    h2("9.1  Security Controls"),
    bullet("JWT in httpOnly cookies (access_token, refresh_token) — not readable by JavaScript, mitigating XSS token theft; secure + samesite=none for cross-site preview hosting. get_current_user also accepts a Bearer header fallback."),
    bullet("RBAC via require_role(...) for admin/manager/reviewer-gated endpoints; finer checks inline (e.g., only creator/claimer/admin/manager can transition a request)."),
    bullet("Password security via bcrypt hashing (hash_password / verify_password)."),
    bullet("File access: downloads require a valid token (cookie or ?auth= query token for <img src>), re-checked against org_id and is_deleted."),
    spacer(),
    h2("9.2  Multi-Tenancy"),
    infoBox("Tenant isolation: every DB query is filtered by the caller's org_id; cross-org access is structurally prevented at the data layer.", LIGHT_BLUE, ACCENT_BLUE),
    spacer(),
    h2("9.3  Known Limitations"),
    new Table({
      width: { size: 9360, type: WidthType.DXA },
      columnWidths: [3120, 6240],
      rows: [
        new TableRow({ children: [headerCell("Issue", BRAND_BLUE, WHITE, 3120), headerCell("Mitigation / Recommendation", BRAND_BLUE, WHITE, 6240)] }),
        new TableRow({ children: [dataCell("Sync requests library in async routes", LIGHT_BLUE, 3120, true), dataCell("Object storage uses synchronous requests inside async routes — fine for low traffic but should migrate to httpx for high concurrency.", WHITE, 6240)] }),
        new TableRow({ children: [dataCell("CORS wildcard", LIGHT_GRAY, 3120, true), dataCell("allow_origin_regex=\".*\" with credentials is set for preview convenience. Tighten to explicit origins before production deployment.", LIGHT_GRAY, 6240)] }),
        new TableRow({ children: [dataCell("Recharts warning", LIGHT_BLUE, 3120, true), dataCell("ResponsiveContainer emits a cosmetic width/height(-1) warning on first paint. Cosmetic only — no functional impact.", WHITE, 6240)] }),
      ]
    }),
    spacer(),
    new Paragraph({ children: [new PageBreak()] })
  ];
  
  // ── APPENDIX: SEED DATA ──────────────────────────────────────────────────────
  const appendix = [
    h1("Appendix — Seed / Demo Data"),
    para("On startup the backend seeds a demo tenant Acme Corp (acme.com) with 5 users, 8 sample requests (a mix of open/claimed/completed states), default categories, departments, and 8 rewards."),
    spacer(),
    new Table({
      width: { size: 9360, type: WidthType.DXA },
      columnWidths: [3600, 2880, 2880],
      rows: [
        new TableRow({ children: [headerCell("Email", BRAND_BLUE, WHITE, 3600), headerCell("Password", BRAND_BLUE, WHITE, 2880), headerCell("Role", BRAND_BLUE, WHITE, 2880)] }),
        new TableRow({ children: [dataCell("admin@acme.com", LIGHT_BLUE, 3600), dataCell("Admin@123", WHITE, 2880), dataCell("admin", WHITE, 2880)] }),
        new TableRow({ children: [dataCell("manager@acme.com", LIGHT_GRAY, 3600), dataCell("Manager@123", LIGHT_GRAY, 2880), dataCell("manager", LIGHT_GRAY, 2880)] }),
        new TableRow({ children: [dataCell("reviewer@acme.com", LIGHT_BLUE, 3600), dataCell("Reviewer@123", WHITE, 2880), dataCell("reviewer", WHITE, 2880)] }),
        new TableRow({ children: [dataCell("priya@acme.com", LIGHT_GRAY, 3600), dataCell("Priya@123", LIGHT_GRAY, 2880), dataCell("employee", LIGHT_GRAY, 2880)] }),
        new TableRow({ children: [dataCell("arjun@acme.com", LIGHT_BLUE, 3600), dataCell("Arjun@123", WHITE, 2880), dataCell("employee", WHITE, 2880)] }),
      ]
    }),
    spacer(),
    infoBox("These credentials are for demo and development purposes only. All passwords must be changed before any production deployment.", AMBER, "D97706"),
  ];
  
  // ── ASSEMBLE DOCUMENT ────────────────────────────────────────────────────────
  const doc = new Document({
    numbering: {
      config: [
        {
          reference: "bullets",
          levels: [{
            level: 0, format: LevelFormat.BULLET, text: "\u2022", alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 720, hanging: 360 } } }
          }]
        }
      ]
    },
    styles: {
      default: { document: { run: { font: "Arial", size: 22, color: DARK_GRAY } } },
      paragraphStyles: [
        { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
          run: { size: 36, bold: true, font: "Arial", color: BRAND_BLUE },
          paragraph: { spacing: { before: 400, after: 200 }, outlineLevel: 0 } },
        { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
          run: { size: 28, bold: true, font: "Arial", color: ACCENT_BLUE },
          paragraph: { spacing: { before: 300, after: 160 }, outlineLevel: 1 } },
        { id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal", quickFormat: true,
          run: { size: 24, bold: true, font: "Arial", color: DARK_GRAY },
          paragraph: { spacing: { before: 200, after: 120 }, outlineLevel: 2 } },
      ]
    },
    sections: [{
      properties: {
        page: {
          size: { width: 12240, height: 15840 },
          margin: { top: 1440, right: 1296, bottom: 1296, left: 1296 }
        }
      },
      headers: {
        default: new Header({
          children: [
            new Paragraph({
              border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: ACCENT_BLUE, space: 4 } },
              spacing: { after: 0 },
              children: [
                new TextRun({ text: "HiveMind — High-Level Design", font: "Arial", size: 18, color: "6B7280" }),
                new TextRun({ text: "\t", font: "Arial", size: 18 }),
                new TextRun({ text: "INTERNAL DOCUMENT", font: "Arial", size: 18, color: "9CA3AF", italics: true })
              ],
              tabStops: [{ type: "right", position: 8640 }]
            })
          ]
        })
      },
      footers: {
        default: new Footer({
          children: [
            new Paragraph({
              border: { top: { style: BorderStyle.SINGLE, size: 4, color: MID_GRAY, space: 4 } },
              spacing: { before: 80 },
              children: [
                new TextRun({ text: "Confidential", font: "Arial", size: 16, color: "9CA3AF" }),
                new TextRun({ text: "\t", font: "Arial", size: 16 }),
                new TextRun({ text: "Page ", font: "Arial", size: 16, color: "9CA3AF" }),
                new PageNumber({ type: "current", font: "Arial", size: 16, color: "9CA3AF" })
              ],
              tabStops: [{ type: "right", position: 8640 }]
            })
          ]
        })
      },
      children: [
        ...titlePage,
        ...section1,
        ...section2,
        ...section3,
        ...section4,
        ...section5,
        ...section6,
        ...section7,
        ...section8,
        ...section9,
        ...appendix
      ]
    }]
  });
  
  Packer.toBuffer(doc).then(buf => {
    fs.writeFileSync("/mnt/user-data/outputs/HiveMind_Design_Doc.docx", buf);
    console.log("Done");
  });