const fs = require('fs');
const {
    Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
    Header, Footer, AlignmentType, LevelFormat,
    HeadingLevel, BorderStyle, WidthType, ShadingType,
    PageNumber, PageBreak
} = require('docx');

// ─── Constants ──────────────────────────────────────────────────────────────

const PAGE_WIDTH = 12240;
const PAGE_HEIGHT = 15840;
const MARGIN = 1440;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2; // 9360

// Colors
const BRAND_BLUE = '53caff';
const BRAND_CORAL = 'ff6060';
const HEADER_BG = 'E8F7FF';
const SECTION_BG = 'F5F7FA';
const TABLE_HEADER_BG = '2B3A4D';
const TABLE_HEADER_TEXT = 'FFFFFF';
const TABLE_ALT_ROW = 'F9FAFB';
const BORDER_COLOR = 'D1D5DB';
const CODE_BG = 'F3F4F6';
const SUCCESS_GREEN = '22C55E';
const WARNING_AMBER = 'F59E0B';

// Borders
const thinBorder = { style: BorderStyle.SINGLE, size: 1, color: BORDER_COLOR };
const borders = { top: thinBorder, bottom: thinBorder, left: thinBorder, right: thinBorder };
const noBorder = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
const noBorders = { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder };

// Cell margins
const cellMargins = { top: 80, bottom: 80, left: 120, right: 120 };
const headerCellMargins = { top: 100, bottom: 100, left: 120, right: 120 };

// ─── Helpers ────────────────────────────────────────────────────────────────

function heading1(text) {
    return new Paragraph({
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 360, after: 200 },
        children: [new TextRun({ text, bold: true, font: 'Arial', size: 32, color: '111827' })]
    });
}

function heading2(text) {
    return new Paragraph({
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 300, after: 160 },
        children: [new TextRun({ text, bold: true, font: 'Arial', size: 26, color: '1F2937' })]
    });
}

function heading3(text) {
    return new Paragraph({
        spacing: { before: 240, after: 120 },
        children: [new TextRun({ text, bold: true, font: 'Arial', size: 22, color: '374151' })]
    });
}

function para(text, opts = {}) {
    return new Paragraph({
        spacing: { after: 160, line: 300 },
        ...opts.paragraphOpts,
        children: [new TextRun({ text, font: 'Arial', size: 21, color: '374151', ...opts })]
    });
}

function boldPara(label, text) {
    return new Paragraph({
        spacing: { after: 160, line: 300 },
        children: [
            new TextRun({ text: label, font: 'Arial', size: 21, color: '111827', bold: true }),
            new TextRun({ text, font: 'Arial', size: 21, color: '374151' })
        ]
    });
}

function codePara(text) {
    return new Paragraph({
        spacing: { after: 120 },
        shading: { fill: CODE_BG, type: ShadingType.CLEAR },
        children: [new TextRun({ text, font: 'Courier New', size: 18, color: '1F2937' })]
    });
}

function emptyPara() {
    return new Paragraph({ spacing: { after: 80 }, children: [] });
}

function bulletItem(text, ref = 'bullets', level = 0) {
    return new Paragraph({
        numbering: { reference: ref, level },
        spacing: { after: 80, line: 280 },
        children: [new TextRun({ text, font: 'Arial', size: 21, color: '374151' })]
    });
}

function bulletItemBold(label, text, ref = 'bullets', level = 0) {
    return new Paragraph({
        numbering: { reference: ref, level },
        spacing: { after: 80, line: 280 },
        children: [
            new TextRun({ text: label, font: 'Arial', size: 21, color: '111827', bold: true }),
            new TextRun({ text, font: 'Arial', size: 21, color: '374151' })
        ]
    });
}

function numberedItem(text, ref = 'numbers', level = 0) {
    return new Paragraph({
        numbering: { reference: ref, level },
        spacing: { after: 80, line: 280 },
        children: [new TextRun({ text, font: 'Arial', size: 21, color: '374151' })]
    });
}

function numberedItemBold(label, text, ref = 'numbers', level = 0) {
    return new Paragraph({
        numbering: { reference: ref, level },
        spacing: { after: 80, line: 280 },
        children: [
            new TextRun({ text: label, font: 'Arial', size: 21, color: '111827', bold: true }),
            new TextRun({ text, font: 'Arial', size: 21, color: '374151' })
        ]
    });
}

function headerCell(text, width) {
    return new TableCell({
        borders,
        width: { size: width, type: WidthType.DXA },
        shading: { fill: TABLE_HEADER_BG, type: ShadingType.CLEAR },
        margins: headerCellMargins,
        verticalAlign: 'center',
        children: [new Paragraph({
            children: [new TextRun({ text, font: 'Arial', size: 19, color: TABLE_HEADER_TEXT, bold: true })]
        })]
    });
}

function cell(text, width, opts = {}) {
    return new TableCell({
        borders,
        width: { size: width, type: WidthType.DXA },
        shading: opts.shading ? { fill: opts.shading, type: ShadingType.CLEAR } : undefined,
        margins: cellMargins,
        children: [new Paragraph({
            children: [new TextRun({
                text,
                font: opts.mono ? 'Courier New' : 'Arial',
                size: opts.mono ? 18 : 19,
                color: opts.color || '374151',
                bold: opts.bold || false
            })]
        })]
    });
}

function infoBox(title, bodyLines) {
    const children = [
        new Paragraph({
            spacing: { after: 80 },
            children: [new TextRun({ text: title, font: 'Arial', size: 21, bold: true, color: '1F2937' })]
        }),
        ...bodyLines.map(line => new Paragraph({
            spacing: { after: 60, line: 280 },
            indent: { left: 200 },
            children: [new TextRun({ text: line, font: 'Arial', size: 19, color: '374151' })]
        }))
    ];
    return new Table({
        width: { size: CONTENT_WIDTH, type: WidthType.DXA },
        columnWidths: [CONTENT_WIDTH],
        rows: [new TableRow({
            children: [new TableCell({
                borders: { top: { style: BorderStyle.SINGLE, size: 3, color: BRAND_BLUE }, bottom: thinBorder, left: thinBorder, right: thinBorder },
                width: { size: CONTENT_WIDTH, type: WidthType.DXA },
                shading: { fill: HEADER_BG, type: ShadingType.CLEAR },
                margins: { top: 160, bottom: 160, left: 200, right: 200 },
                children
            })]
        })]
    });
}

// ─── Document Structure ─────────────────────────────────────────────────────

const doc = new Document({
    styles: {
        default: { document: { run: { font: 'Arial', size: 21 } } },
        paragraphStyles: [
            {
                id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true,
                run: { size: 32, bold: true, font: 'Arial', color: '111827' },
                paragraph: { spacing: { before: 360, after: 200 }, outlineLevel: 0 }
            },
            {
                id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true,
                run: { size: 26, bold: true, font: 'Arial', color: '1F2937' },
                paragraph: { spacing: { before: 300, after: 160 }, outlineLevel: 1 }
            },
        ]
    },
    numbering: {
        config: [
            {
                reference: 'bullets',
                levels: [
                    { level: 0, format: LevelFormat.BULLET, text: '\u2022', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } },
                    { level: 1, format: LevelFormat.BULLET, text: '\u25E6', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 1440, hanging: 360 } } } },
                ]
            },
            {
                reference: 'numbers',
                levels: [
                    { level: 0, format: LevelFormat.DECIMAL, text: '%1.', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } },
                    { level: 1, format: LevelFormat.LOWER_LETTER, text: '%2.', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 1440, hanging: 360 } } } },
                ]
            },
            {
                reference: 'numbers2',
                levels: [
                    { level: 0, format: LevelFormat.DECIMAL, text: '%1.', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } },
                ]
            },
            {
                reference: 'numbers3',
                levels: [
                    { level: 0, format: LevelFormat.DECIMAL, text: '%1.', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } },
                ]
            },
            {
                reference: 'numbers4',
                levels: [
                    { level: 0, format: LevelFormat.DECIMAL, text: '%1.', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } },
                ]
            },
            {
                reference: 'numbers5',
                levels: [
                    { level: 0, format: LevelFormat.DECIMAL, text: '%1.', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } },
                ]
            },
            {
                reference: 'numbers6',
                levels: [
                    { level: 0, format: LevelFormat.DECIMAL, text: '%1.', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } },
                ]
            },
            {
                reference: 'bullets2',
                levels: [
                    { level: 0, format: LevelFormat.BULLET, text: '\u2022', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } },
                ]
            },
            {
                reference: 'bullets3',
                levels: [
                    { level: 0, format: LevelFormat.BULLET, text: '\u2022', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } },
                ]
            },
        ]
    },
    sections: [{
        properties: {
            page: {
                size: { width: PAGE_WIDTH, height: PAGE_HEIGHT },
                margin: { top: MARGIN, right: MARGIN, bottom: MARGIN, left: MARGIN }
            }
        },
        headers: {
            default: new Header({
                children: [new Paragraph({
                    alignment: AlignmentType.RIGHT,
                    children: [
                        new TextRun({ text: 'VolleyTrack', font: 'Arial', size: 16, color: BRAND_BLUE, bold: true }),
                        new TextRun({ text: '  |  Integration Development Plan', font: 'Arial', size: 16, color: '9CA3AF' })
                    ]
                })]
            })
        },
        footers: {
            default: new Footer({
                children: [new Paragraph({
                    alignment: AlignmentType.CENTER,
                    children: [
                        new TextRun({ text: 'Page ', font: 'Arial', size: 16, color: '9CA3AF' }),
                        new TextRun({ children: [PageNumber.CURRENT], font: 'Arial', size: 16, color: '9CA3AF' })
                    ]
                })]
            })
        },
        children: [

            // ═══════════════════════════════════════════════════════════════════
            // TITLE PAGE
            // ═══════════════════════════════════════════════════════════════════

            emptyPara(), emptyPara(), emptyPara(), emptyPara(),

            new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { after: 120 },
                children: [new TextRun({ text: 'VOLLEYTRACK', font: 'Arial', size: 48, bold: true, color: BRAND_BLUE })]
            }),
            new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { after: 400 },
                children: [new TextRun({ text: 'TeamSnap & SportsEngine Integration', font: 'Arial', size: 36, color: '374151' })]
            }),
            new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { after: 60 },
                children: [new TextRun({ text: 'UI/UX DEVELOPMENT PLAN', font: 'Arial', size: 28, bold: true, color: '1F2937', allCaps: true })]
            }),

            emptyPara(),

            new Table({
                width: { size: 5000, type: WidthType.DXA },
                columnWidths: [5000],
                rows: [new TableRow({
                    children: [new TableCell({
                        borders: { top: { style: BorderStyle.SINGLE, size: 2, color: BRAND_BLUE }, bottom: noBorder, left: noBorder, right: noBorder },
                        width: { size: 5000, type: WidthType.DXA },
                        margins: { top: 200, bottom: 0, left: 0, right: 0 },
                        children: [new Paragraph({ children: [] })]
                    })]
                })]
            }),

            emptyPara(),

            new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 60 }, children: [new TextRun({ text: 'Version 1.0  |  February 2026', font: 'Arial', size: 20, color: '6B7280' })] }),
            new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 60 }, children: [new TextRun({ text: 'Stack: React Native 0.81 + Expo SDK 54 + TypeScript + Zustand + Firebase', font: 'Arial', size: 18, color: '9CA3AF' })] }),
            new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200 }, children: [new TextRun({ text: 'Companion Document: TEAM_SCHEDULE_INTEGRATION.md.txt', font: 'Arial', size: 18, color: BRAND_BLUE, italics: true })] }),

            new Paragraph({ children: [new PageBreak()] }),


            // ═══════════════════════════════════════════════════════════════════
            // SECTION 1: HOW TO USE THIS DOCUMENT
            // ═══════════════════════════════════════════════════════════════════

            heading1('1. How to Use This Document'),

            para('This document is the UI/UX development plan for adding TeamSnap and SportsEngine roster and schedule import functionality to VolleyTrack. It is designed to be consumed by AI coding assistants (Claude Code, Gemini) as a single prompt or reference document that provides everything needed to implement the feature correctly on the first pass.'),

            infoBox('Companion Document', [
                'TEAM_SCHEDULE_INTEGRATION.md.txt contains all technical blueprints: OAuth flows, API details, service layer code, data model mappings, and the Zustand store design.',
                'This document focuses on the UI/UX layer: screen designs, component specs, user flows, design tokens, and implementation order.',
                'Both documents should be provided to the AI assistant at the start of development.'
            ]),

            emptyPara(),
            heading2('1.1 Recommended Prompt Strategy'),

            para('When starting a development session with Claude Code or Gemini, provide both documents and use a phased approach:'),

            numberedItemBold('Phase A (Foundation): ', '"Read TEAM_SCHEDULE_INTEGRATION.md.txt and this development plan. Install dependencies (expo-auth-session, expo-secure-store). Create the useIntegrationStore, authUtils, and feature flag. Do not create UI yet."', 'numbers'),
            numberedItemBold('Phase B (Services): ', '"Implement TeamSnapService.ts and ImportService.ts following the TEAM_SCHEDULE_INTEGRATION.md.txt blueprints exactly. Create the useIntegrationImport hook."', 'numbers'),
            numberedItemBold('Phase C (UI): ', '"Build all integration UI components and screens following this development plan. Start with the Settings integration section, then the Import Wizard, then the Season Detail refresh buttons."', 'numbers'),
            numberedItemBold('Phase D (Polish): ', '"Add error states, loading skeletons, haptic feedback, and empty states. Wire up Pro gating with PaywallModal. Test the full flow end-to-end."', 'numbers'),
            numberedItemBold('Phase E (SportsEngine): ', '"Extend to SportsEngine: implement SportsEngineService.ts, add the SportsEngine provider option to the Import Wizard, and test."', 'numbers'),

            new Paragraph({ children: [new PageBreak()] }),


            // ═══════════════════════════════════════════════════════════════════
            // SECTION 2: DESIGN SYSTEM REFERENCE
            // ═══════════════════════════════════════════════════════════════════

            heading1('2. Design System Reference'),

            para('Every screen in VolleyTrack uses the useAppTheme() hook from contexts/ThemeContext.tsx. Never hardcode colors, spacing, or font sizes. The following tokens are the complete design system.'),

            heading2('2.1 Brand Colors'),
            new Table({
                width: { size: CONTENT_WIDTH, type: WidthType.DXA },
                columnWidths: [2200, 2200, 4960],
                rows: [
                    new TableRow({ children: [headerCell('Token', 2200), headerCell('Value', 2200), headerCell('Usage', 4960)] }),
                    new TableRow({ children: [cell('brand.blue', 2200, { mono: true }), cell('#53caff', 2200, { mono: true }), cell('Primary actions, My Team color, links, active states', 4960)] }),
                    new TableRow({ children: [cell('brand.coral', 2200, { mono: true }), cell('#ff6060', 2200, { mono: true }), cell('Opponent color, accents, urgency/delete', 4960, { shading: TABLE_ALT_ROW })] }),
                ]
            }),

            emptyPara(),
            heading2('2.2 Semantic Colors'),
            new Table({
                width: { size: CONTENT_WIDTH, type: WidthType.DXA },
                columnWidths: [2200, 2200, 4960],
                rows: [
                    new TableRow({ children: [headerCell('Token', 2200), headerCell('Value', 2200), headerCell('Usage', 4960)] }),
                    new TableRow({ children: [cell('success', 2200, { mono: true }), cell('#22c55e', 2200, { mono: true }), cell('Connected status, import complete, sync success', 4960)] }),
                    new TableRow({ children: [cell('warning', 2200, { mono: true }), cell('#f59e0b', 2200, { mono: true }), cell('Merge conflicts, partial imports, sync issues', 4960, { shading: TABLE_ALT_ROW })] }),
                    new TableRow({ children: [cell('error', 2200, { mono: true }), cell('#ef4444', 2200, { mono: true }), cell('Auth failures, import errors, disconnect actions', 4960)] }),
                ]
            }),

            emptyPara(),
            heading2('2.3 Light/Dark Theme Keys (Most Used)'),
            new Table({
                width: { size: CONTENT_WIDTH, type: WidthType.DXA },
                columnWidths: [2400, 2000, 2000, 2960],
                rows: [
                    new TableRow({ children: [headerCell('Key', 2400), headerCell('Light', 2000), headerCell('Dark', 2000), headerCell('Use For', 2960)] }),
                    new TableRow({ children: [cell('colors.bg', 2400, { mono: true }), cell('#f5f7fa', 2000, { mono: true }), cell('#0d1117', 2000, { mono: true }), cell('Screen background', 2960)] }),
                    new TableRow({ children: [cell('colors.bgCard', 2400, { mono: true }), cell('#ffffff', 2000, { mono: true }), cell('#161b22', 2000, { mono: true }), cell('Card backgrounds', 2960, { shading: TABLE_ALT_ROW })] }),
                    new TableRow({ children: [cell('colors.text', 2400, { mono: true }), cell('#111827', 2000, { mono: true }), cell('#e6edf3', 2000, { mono: true }), cell('Primary text', 2960)] }),
                    new TableRow({ children: [cell('colors.textSecondary', 2400, { mono: true }), cell('#4b5563', 2000, { mono: true }), cell('#8b949e', 2000, { mono: true }), cell('Secondary/muted text', 2960, { shading: TABLE_ALT_ROW })] }),
                    new TableRow({ children: [cell('colors.border', 2400, { mono: true }), cell('#e5e7eb', 2000, { mono: true }), cell('#30363d', 2000, { mono: true }), cell('Card borders, dividers', 2960)] }),
                    new TableRow({ children: [cell('colors.primary', 2400, { mono: true }), cell('#53caff', 2000, { mono: true }), cell('#6dd5ff', 2000, { mono: true }), cell('Primary buttons, links', 2960, { shading: TABLE_ALT_ROW })] }),
                    new TableRow({ children: [cell('colors.primaryLight', 2400, { mono: true }), cell('#e8f7ff', 2000, { mono: true }), cell('#152238', 2000, { mono: true }), cell('Highlight backgrounds', 2960)] }),
                    new TableRow({ children: [cell('colors.buttonPrimary', 2400, { mono: true }), cell('#53caff', 2000, { mono: true }), cell('#53caff', 2000, { mono: true }), cell('CTA buttons', 2960, { shading: TABLE_ALT_ROW })] }),
                    new TableRow({ children: [cell('colors.inputBg', 2400, { mono: true }), cell('#ffffff', 2000, { mono: true }), cell('#0d1117', 2000, { mono: true }), cell('Input backgrounds', 2960)] }),
                ]
            }),

            emptyPara(),
            heading2('2.4 Spacing, Radius & Typography'),
            new Table({
                width: { size: CONTENT_WIDTH, type: WidthType.DXA },
                columnWidths: [3120, 3120, 3120],
                rows: [
                    new TableRow({ children: [headerCell('Spacing Tokens', 3120), headerCell('Radius Tokens', 3120), headerCell('Font Sizes', 3120)] }),
                    new TableRow({ children: [cell('xs: 4, sm: 8, md: 12', 3120, { mono: true }), cell('sm: 8, md: 12', 3120, { mono: true }), cell('xs: 11, sm: 13, base: 15', 3120, { mono: true })] }),
                    new TableRow({ children: [cell('base: 16, lg: 20, xl: 24', 3120, { mono: true }), cell('lg: 16, xl: 24', 3120, { mono: true }), cell('md: 16, lg: 18, xl: 22', 3120, { mono: true, shading: TABLE_ALT_ROW })] }),
                    new TableRow({ children: [cell('2xl: 32, 3xl: 48', 3120, { mono: true }), cell('full: 9999', 3120, { mono: true }), cell('2xl: 28, 3xl: 34', 3120, { mono: true })] }),
                ]
            }),

            infoBox('Critical Pattern', [
                'Every screen must destructure theme tokens: const { colors, spacing, fontSize, radius } = useAppTheme();',
                'StyleSheet.create() should reference these tokens, not literal values.',
                'All new integration screens MUST support both light and dark mode.'
            ]),

            new Paragraph({ children: [new PageBreak()] }),


            // ═══════════════════════════════════════════════════════════════════
            // SECTION 3: EXISTING UI PATTERNS
            // ═══════════════════════════════════════════════════════════════════

            heading1('3. Existing UI Patterns to Follow'),

            para('Every new screen and component must follow the established VolleyTrack patterns. Deviating from these patterns will create visual inconsistency.'),

            heading2('3.1 Screen Layout Pattern'),
            para('All screens in VolleyTrack follow this structure:'),
            codePara('SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}'),
            codePara('  KeyboardAvoidingView (if forms present)'),
            codePara('    ScrollView contentContainerStyle={{ padding: spacing.base }}'),
            codePara('      View style={cardStyle}   // bgCard, radius.lg, border, padding'),
            codePara('        ...content'),

            emptyPara(),
            heading3('Card Style Pattern'),
            codePara('const cardStyle = {'),
            codePara('  backgroundColor: colors.bgCard,'),
            codePara('  borderRadius: radius.lg,        // 16'),
            codePara('  borderWidth: 1,'),
            codePara('  borderColor: colors.border,'),
            codePara('  padding: spacing.base,           // 16'),
            codePara('  marginBottom: spacing.base,'),
            codePara('};'),

            emptyPara(),
            heading2('3.2 Settings Row Pattern'),
            para('The settings.tsx screen uses a consistent row pattern for each menu item. The integration section must match this exactly:'),
            codePara('TouchableOpacity style={{'),
            codePara('  flexDirection: "row", alignItems: "center",'),
            codePara('  paddingVertical: spacing.md,     // 12'),
            codePara('  paddingHorizontal: spacing.base,  // 16'),
            codePara('  borderBottomWidth: 1, borderBottomColor: colors.borderLight'),
            codePara('}}'),
            codePara('  <Icon size={20} color={colors.primary} />'),
            codePara('  <Text style={{ flex: 1, marginLeft: spacing.md }}>Label</Text>'),
            codePara('  <ChevronRight size={18} color={colors.textTertiary} />'),

            emptyPara(),
            heading2('3.3 Modal Pattern (PaywallModal Reference)'),
            para('All modals use the same pattern: a visible boolean prop, onClose callback, and full-screen overlay:'),
            codePara('Modal visible={visible} animationType="slide" transparent'),
            codePara('  View style={{ flex: 1, backgroundColor: colors.bgOverlay }}'),
            codePara('    View style={{'),
            codePara('      backgroundColor: colors.bgCard,'),
            codePara('      borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl,'),
            codePara('      maxHeight: "85%", padding: spacing.xl'),
            codePara('    }}'),

            emptyPara(),
            heading2('3.4 Button Patterns'),
            new Table({
                width: { size: CONTENT_WIDTH, type: WidthType.DXA },
                columnWidths: [2000, 3680, 3680],
                rows: [
                    new TableRow({ children: [headerCell('Type', 2000), headerCell('Style', 3680), headerCell('When to Use', 3680)] }),
                    new TableRow({ children: [cell('Primary CTA', 2000, { bold: true }), cell('bg: colors.buttonPrimary, text: colors.buttonPrimaryText, radius: radius.md, py: spacing.md', 3680, { mono: true }), cell('Main action: "Import", "Connect", "Save"', 3680)] }),
                    new TableRow({ children: [cell('Secondary', 2000, { bold: true }), cell('bg: colors.buttonSecondary, text: colors.buttonSecondaryText', 3680, { mono: true, shading: TABLE_ALT_ROW }), cell('Alternate action: "Skip", "Cancel"', 3680, { shading: TABLE_ALT_ROW })] }),
                    new TableRow({ children: [cell('Destructive', 2000, { bold: true }), cell('bg: transparent, text: colors.error, borderColor: colors.error', 3680, { mono: true }), cell('"Disconnect", "Remove"', 3680)] }),
                    new TableRow({ children: [cell('Disabled', 2000, { bold: true }), cell('bg: colors.buttonDisabled, text: colors.buttonDisabledText', 3680, { mono: true, shading: TABLE_ALT_ROW }), cell('When prerequisites not met', 3680, { shading: TABLE_ALT_ROW })] }),
                ]
            }),

            emptyPara(),
            heading2('3.5 Icon Library'),
            para('VolleyTrack uses lucide-react-native for all icons. Import specific icons by name. For the integration feature, recommended icons:'),
            new Table({
                width: { size: CONTENT_WIDTH, type: WidthType.DXA },
                columnWidths: [2340, 2340, 2340, 2340],
                rows: [
                    new TableRow({ children: [headerCell('Purpose', 2340), headerCell('Icon', 2340), headerCell('Purpose', 2340), headerCell('Icon', 2340)] }),
                    new TableRow({ children: [cell('Connect/Link', 2340), cell('Link, ExternalLink', 2340, { mono: true }), cell('Disconnect', 2340), cell('Unlink, XCircle', 2340, { mono: true })] }),
                    new TableRow({ children: [cell('Refresh/Sync', 2340), cell('RefreshCw, RotateCcw', 2340, { mono: true, shading: TABLE_ALT_ROW }), cell('Import', 2340, { shading: TABLE_ALT_ROW }), cell('Download, ArrowDown', 2340, { mono: true, shading: TABLE_ALT_ROW })] }),
                    new TableRow({ children: [cell('Success', 2340), cell('CheckCircle, Check', 2340, { mono: true }), cell('Warning', 2340), cell('AlertTriangle', 2340, { mono: true })] }),
                    new TableRow({ children: [cell('Team/Roster', 2340), cell('Users, UserPlus', 2340, { mono: true, shading: TABLE_ALT_ROW }), cell('Schedule', 2340, { shading: TABLE_ALT_ROW }), cell('Calendar, CalendarPlus', 2340, { mono: true, shading: TABLE_ALT_ROW })] }),
                    new TableRow({ children: [cell('Pro Badge', 2340), cell('Crown, Zap', 2340, { mono: true }), cell('Settings/Config', 2340), cell('Settings, Sliders', 2340, { mono: true })] }),
                ]
            }),

            new Paragraph({ children: [new PageBreak()] }),


            // ═══════════════════════════════════════════════════════════════════
            // SECTION 4: USER FLOW OVERVIEW
            // ═══════════════════════════════════════════════════════════════════

            heading1('4. User Flow Overview'),

            para('The integration feature has three main user flows. Each is initiated from a different entry point but shares the same underlying service layer.'),

            heading2('4.1 Flow A: First-Time Connection & Import'),
            numberedItem('User opens Settings and sees new "Integrations" section', 'numbers2'),
            numberedItem('Taps "Connect TeamSnap" (or SportsEngine)', 'numbers2'),
            numberedItem('OAuth browser opens, user logs in and authorizes VolleyTrack', 'numbers2'),
            numberedItem('App receives auth token, stores securely via expo-secure-store', 'numbers2'),
            numberedItem('Settings shows "Connected" status with green indicator', 'numbers2'),
            numberedItem('User navigates to Season Create and sees "Import from TeamSnap" option', 'numbers2'),
            numberedItem('Import Wizard opens: Select Team, Preview Roster, Preview Schedule, Confirm', 'numbers2'),
            numberedItem('Import completes, new Season with roster and events/matches is created', 'numbers2'),

            emptyPara(),
            heading2('4.2 Flow B: Re-Import / Refresh'),
            numberedItem('User opens an existing Season that was previously imported', 'numbers3'),
            numberedItem('Sees "Refresh Roster" and "Refresh Schedule" buttons in season detail', 'numbers3'),
            numberedItem('Taps refresh: app fetches latest data from external platform', 'numbers3'),
            numberedItem('New players are added to roster (existing players with stats are preserved)', 'numbers3'),
            numberedItem('New scheduled matches are added (played matches are never modified)', 'numbers3'),

            emptyPara(),
            heading2('4.3 Flow C: Disconnect'),
            numberedItem('User opens Settings > Integrations', 'numbers4'),
            numberedItem('Taps "Disconnect" on a connected service', 'numbers4'),
            numberedItem('Confirmation dialog appears', 'numbers4'),
            numberedItem('Auth tokens are revoked and deleted from secure storage', 'numbers4'),
            numberedItem('Previously imported data remains in the app (not deleted)', 'numbers4'),

            new Paragraph({ children: [new PageBreak()] }),


            // ═══════════════════════════════════════════════════════════════════
            // SECTION 5: SCREEN SPECIFICATIONS
            // ═══════════════════════════════════════════════════════════════════

            heading1('5. Screen-by-Screen Specifications'),

            // ── 5.1 Settings ──
            heading2('5.1 Settings Screen: Integrations Section'),

            boldPara('File: ', 'app/settings.tsx (modify existing file)'),
            boldPara('Position: ', 'Add new section between the existing "Appearance" and "Account" sections'),

            emptyPara(),
            heading3('Section Layout'),
            para('The Integrations section follows the same card-based section pattern used by the Appearance and Subscription sections in settings.tsx:'),

            codePara('// Section header'),
            codePara('"Integrations" label with Link icon (colors.primary)'),
            codePara(''),
            codePara('// Card with integration rows'),
            codePara('View style={cardStyle}'),
            codePara('  IntegrationRow provider="teamsnap"'),
            codePara('    Left: TeamSnap logo/icon + "TeamSnap"'),
            codePara('    Right: Status badge + ChevronRight'),
            codePara('  Divider'),
            codePara('  IntegrationRow provider="sportsengine"'),
            codePara('    Left: SportsEngine logo/icon + "SportsEngine"'),
            codePara('    Right: Status badge + ChevronRight'),

            emptyPara(),
            heading3('Integration Row States'),
            new Table({
                width: { size: CONTENT_WIDTH, type: WidthType.DXA },
                columnWidths: [2000, 3680, 3680],
                rows: [
                    new TableRow({ children: [headerCell('State', 2000), headerCell('Right Side Display', 3680), headerCell('On Tap Action', 3680)] }),
                    new TableRow({ children: [cell('Not Connected', 2000, { bold: true }), cell('Text "Connect" in colors.primary + ChevronRight', 3680), cell('Initiate OAuth flow', 3680)] }),
                    new TableRow({ children: [cell('Connecting', 2000, { bold: true }), cell('ActivityIndicator in colors.primary', 3680, { shading: TABLE_ALT_ROW }), cell('No action (disabled)', 3680, { shading: TABLE_ALT_ROW })] }),
                    new TableRow({ children: [cell('Connected', 2000, { bold: true }), cell('Green dot + "Connected" in colors.success + ChevronRight', 3680), cell('Open connection detail sheet', 3680)] }),
                    new TableRow({ children: [cell('Error', 2000, { bold: true }), cell('Red dot + "Reconnect" in colors.error + ChevronRight', 3680, { shading: TABLE_ALT_ROW }), cell('Re-initiate OAuth flow', 3680, { shading: TABLE_ALT_ROW })] }),
                ]
            }),

            emptyPara(),
            heading3('Connection Detail Sheet'),
            para('When a connected integration is tapped, show a bottom sheet (not full modal) with:'),
            bulletItemBold('Header: ', 'Provider name + large green "Connected" badge'),
            bulletItemBold('Info Row: ', 'Account name/email from the provider (stored in useIntegrationStore)'),
            bulletItemBold('Last Synced: ', 'Relative time ("2 hours ago") or "Never" if no import done yet'),
            bulletItemBold('Disconnect Button: ', 'Destructive style (red outline) at the bottom, triggers confirmation Alert.alert()'),

            emptyPara(),
            heading3('Pro Gating'),
            para('If the user is NOT Pro, the entire Integrations section should still be visible but tapping "Connect" opens the PaywallModal with trigger "integration_import" instead of starting OAuth. Show a small Crown icon and "Pro" badge next to the section header.'),

            new Paragraph({ children: [new PageBreak()] }),

            // ── 5.2 Import Wizard ──
            heading2('5.2 Import Wizard (Multi-Step Modal)'),

            boldPara('File: ', 'components/ImportWizard.tsx (new file)'),
            boldPara('Trigger: ', 'From season/create.tsx "Import from TeamSnap" button, or from a new "Import Season" FAB on the dashboard'),

            emptyPara(),
            heading3('Wizard Structure'),
            para('The Import Wizard is a full-screen modal with 4 steps. Use a horizontal step indicator at the top (similar to CapabilitiesTour.tsx dot indicators but with labels).'),

            new Table({
                width: { size: CONTENT_WIDTH, type: WidthType.DXA },
                columnWidths: [1200, 2720, 2720, 2720],
                rows: [
                    new TableRow({ children: [headerCell('Step', 1200), headerCell('Title', 2720), headerCell('Content', 2720), headerCell('CTA', 2720)] }),
                    new TableRow({ children: [cell('1', 1200, { bold: true }), cell('Select Team', 2720), cell('List of teams from external platform', 2720), cell('"Next" (enabled when team selected)', 2720)] }),
                    new TableRow({ children: [cell('2', 1200, { bold: true }), cell('Review Roster', 2720, { shading: TABLE_ALT_ROW }), cell('Preview of players to import with checkboxes', 2720, { shading: TABLE_ALT_ROW }), cell('"Next" (at least 1 player selected)', 2720, { shading: TABLE_ALT_ROW })] }),
                    new TableRow({ children: [cell('3', 1200, { bold: true }), cell('Review Schedule', 2720), cell('Preview of events/matches with checkboxes', 2720), cell('"Import" (confirm action)', 2720)] }),
                    new TableRow({ children: [cell('4', 1200, { bold: true }), cell('Complete', 2720, { shading: TABLE_ALT_ROW }), cell('Success animation + summary', 2720, { shading: TABLE_ALT_ROW }), cell('"View Season" or "Done"', 2720, { shading: TABLE_ALT_ROW })] }),
                ]
            }),

            emptyPara(),
            heading3('Step 1: Select Team'),
            para('When the wizard opens, immediately fetch teams from the connected provider. Show a loading skeleton while fetching. Display teams as selectable cards:'),

            codePara('// Each team card'),
            codePara('TouchableOpacity style={{'),
            codePara('  bg: isSelected ? colors.primaryLight : colors.bgCard,'),
            codePara('  borderColor: isSelected ? colors.primary : colors.border,'),
            codePara('  borderWidth: isSelected ? 2 : 1,'),
            codePara('  borderRadius: radius.md, padding: spacing.base,'),
            codePara('  flexDirection: "row", alignItems: "center"'),
            codePara('}}'),
            codePara('  Users icon + team name + player count badge'),

            emptyPara(),
            heading3('Step 2: Review Roster'),
            para('Show all players from the selected team with checkboxes. All are checked by default. Each row displays:'),
            bulletItem('Checkbox (TouchableOpacity with CheckCircle/Circle icon)'),
            bulletItem('Player name (bold, colors.text)'),
            bulletItem('Jersey number (in a small rounded badge, colors.primaryLight background)'),
            bulletItem('Positions (colors.textSecondary, comma-separated)'),

            para('Include a "Select All / Deselect All" toggle at the top. If some players already exist in a Season roster (re-import), show them grayed out with a "Already imported" label.'),

            emptyPara(),
            heading3('Step 3: Review Schedule'),
            para('Show events and matches grouped by date. Each item shows:'),
            bulletItem('Checkbox for inclusion'),
            bulletItem('Date and time (formatted: "Mar 15, 2026 at 3:00 PM")'),
            bulletItem('Event/tournament name or opponent name'),
            bulletItem('Location (colors.textSecondary)'),
            bulletItem('Type badge: "Tournament" (blue) or "Match" (coral)'),

            para('Already-imported matches (by externalId match) are shown grayed out with "Already imported" label.'),

            emptyPara(),
            heading3('Step 4: Import Complete'),
            para('Show a success animation (checkmark with a brief scale animation). Display a summary:'),
            bulletItem('"12 players imported to roster"'),
            bulletItem('"3 events and 8 matches added to schedule"'),
            bulletItem('Two buttons: "View Season" (primary) and "Done" (secondary)'),

            emptyPara(),
            heading3('Step Indicator Component'),
            codePara('// Horizontal step indicator at top of wizard'),
            codePara('View style={{ flexDirection: "row", justifyContent: "space-between", paddingHorizontal: spacing.xl }}'),
            codePara('  {steps.map((step, i) => ('),
            codePara('    <View key={i} style={{ alignItems: "center", flex: 1 }}>'),
            codePara('      <View style={{'),
            codePara('        width: 28, height: 28, borderRadius: 14,'),
            codePara('        bg: i <= currentStep ? colors.primary : colors.buttonSecondary,'),
            codePara('        alignItems: "center", justifyContent: "center"'),
            codePara('      }}>'),
            codePara('        {i < currentStep ? <Check /> : <Text>{i + 1}</Text>}'),
            codePara('      </View>'),
            codePara('      <Text style={{ fontSize: fontSize.xs }}>{step.label}</Text>'),
            codePara('    </View>'),
            codePara('  ))}'),

            new Paragraph({ children: [new PageBreak()] }),

            // ── 5.3 Season Create ──
            heading2('5.3 Season Create Screen Modifications'),

            boldPara('File: ', 'app/season/create.tsx (modify existing file)'),

            emptyPara(),
            heading3('Changes Required'),
            para('Add an "Import from External Platform" option at the top of the season creation form. This appears before the manual entry fields:'),

            codePara('// New section at top of ScrollView, before the manual form'),
            codePara('{hasConnectedIntegration && ('),
            codePara('  <View style={cardStyle}>'),
            codePara('    <Text style={sectionLabel}>Quick Import</Text>'),
            codePara('    <TouchableOpacity onPress={openImportWizard} style={importButtonStyle}>'),
            codePara('      <Download icon />'),
            codePara('      <View>'),
            codePara('        <Text>Import from {connectedProvider}</Text>'),
            codePara('        <Text style={subtextStyle}>Pull roster and schedule automatically</Text>'),
            codePara('      </View>'),
            codePara('      <ChevronRight />'),
            codePara('    </TouchableOpacity>'),
            codePara('  </View>'),
            codePara(')}'),

            para('If NO integration is connected, show a subtle prompt card instead:'),
            codePara('{!hasConnectedIntegration && ('),
            codePara('  <TouchableOpacity onPress={goToSettings} style={promptCardStyle}>'),
            codePara('    <Link icon color={colors.primary} />'),
            codePara('    <Text>Connect TeamSnap or SportsEngine to import automatically</Text>'),
            codePara('  </TouchableOpacity>'),
            codePara(')}'),

            emptyPara(),

            // ── 5.4 Season Detail ──
            heading2('5.4 Season Detail Screen Modifications'),

            boldPara('File: ', 'app/season/[id].tsx (modify existing file)'),

            emptyPara(),
            heading3('Changes Required'),
            para('For seasons that were imported (identified by a sourceProvider field on the Season type), add refresh buttons in the season header area:'),

            codePara('// Below season name/info, inside the header card'),
            codePara('{season.sourceProvider && ('),
            codePara('  <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm }}>'),
            codePara('    <TouchableOpacity onPress={refreshRoster} style={refreshButtonStyle}>'),
            codePara('      <RefreshCw size={14} />'),
            codePara('      <Text>Refresh Roster</Text>'),
            codePara('    </TouchableOpacity>'),
            codePara('    <TouchableOpacity onPress={refreshSchedule} style={refreshButtonStyle}>'),
            codePara('      <RefreshCw size={14} />'),
            codePara('      <Text>Refresh Schedule</Text>'),
            codePara('    </TouchableOpacity>'),
            codePara('  </View>'),
            codePara(')}'),

            emptyPara(),
            heading3('Refresh Button Style'),
            codePara('const refreshButtonStyle = {'),
            codePara('  flexDirection: "row", alignItems: "center", gap: spacing.xs,'),
            codePara('  backgroundColor: colors.primaryLight,'),
            codePara('  paddingVertical: spacing.xs, paddingHorizontal: spacing.md,'),
            codePara('  borderRadius: radius.full, // pill shape'),
            codePara('};'),

            emptyPara(),
            heading3('Source Badge'),
            para('Add a small badge next to the season name showing the source platform:'),
            codePara('// Inline badge'),
            codePara('<View style={{'),
            codePara('  bg: colors.primaryLight, borderRadius: radius.sm,'),
            codePara('  paddingHorizontal: spacing.sm, paddingVertical: 2'),
            codePara('}}>'),
            codePara('  <Text style={{ fontSize: fontSize.xs, color: colors.primary }}>'),
            codePara('    via TeamSnap'),
            codePara('  </Text>'),
            codePara('</View>'),

            new Paragraph({ children: [new PageBreak()] }),


            // ═══════════════════════════════════════════════════════════════════
            // SECTION 6: COMPONENT SPECIFICATIONS
            // ═══════════════════════════════════════════════════════════════════

            heading1('6. Component Specifications'),

            heading2('6.1 New Components to Create'),
            new Table({
                width: { size: CONTENT_WIDTH, type: WidthType.DXA },
                columnWidths: [3120, 3120, 3120],
                rows: [
                    new TableRow({ children: [headerCell('Component', 3120), headerCell('File Path', 3120), headerCell('Props', 3120)] }),
                    new TableRow({ children: [cell('ImportWizard', 3120, { bold: true }), cell('components/ImportWizard.tsx', 3120, { mono: true }), cell('visible, onClose, provider, onComplete', 3120)] }),
                    new TableRow({ children: [cell('TeamSelector', 3120, { bold: true }), cell('components/integration/TeamSelector.tsx', 3120, { mono: true, shading: TABLE_ALT_ROW }), cell('teams[], selectedId, onSelect, loading', 3120, { shading: TABLE_ALT_ROW })] }),
                    new TableRow({ children: [cell('RosterPreview', 3120, { bold: true }), cell('components/integration/RosterPreview.tsx', 3120, { mono: true }), cell('players[], selected[], onToggle, existingIds[]', 3120)] }),
                    new TableRow({ children: [cell('SchedulePreview', 3120, { bold: true }), cell('components/integration/SchedulePreview.tsx', 3120, { mono: true, shading: TABLE_ALT_ROW }), cell('events[], matches[], selected{}, onToggle, existingIds[]', 3120, { shading: TABLE_ALT_ROW })] }),
                    new TableRow({ children: [cell('ImportComplete', 3120, { bold: true }), cell('components/integration/ImportComplete.tsx', 3120, { mono: true }), cell('summary: { players, events, matches }, onViewSeason, onDone', 3120)] }),
                    new TableRow({ children: [cell('StepIndicator', 3120, { bold: true }), cell('components/integration/StepIndicator.tsx', 3120, { mono: true, shading: TABLE_ALT_ROW }), cell('steps[], currentStep, completedSteps[]', 3120, { shading: TABLE_ALT_ROW })] }),
                    new TableRow({ children: [cell('IntegrationRow', 3120, { bold: true }), cell('components/integration/IntegrationRow.tsx', 3120, { mono: true }), cell('provider, status, onPress', 3120)] }),
                    new TableRow({ children: [cell('ConnectionSheet', 3120, { bold: true }), cell('components/integration/ConnectionSheet.tsx', 3120, { mono: true, shading: TABLE_ALT_ROW }), cell('provider, accountInfo, lastSync, onDisconnect, onClose', 3120, { shading: TABLE_ALT_ROW })] }),
                    new TableRow({ children: [cell('ImportProgressOverlay', 3120, { bold: true }), cell('components/integration/ImportProgressOverlay.tsx', 3120, { mono: true }), cell('visible, step, total, message', 3120)] }),
                ]
            }),

            emptyPara(),
            heading2('6.2 ImportWizard Component Detail'),

            boldPara('State Management: ', 'Internal useState for wizard step, selected team, selected players/events. The hook useIntegrationImport handles all API calls and data mapping.'),

            emptyPara(),
            codePara('interface ImportWizardProps {'),
            codePara('  visible: boolean;'),
            codePara('  onClose: () => void;'),
            codePara('  provider: "teamsnap" | "sportsengine";'),
            codePara('  onComplete: (seasonId: string) => void;'),
            codePara('  existingSeasonId?: string; // for re-import into existing season'),
            codePara('}'),

            emptyPara(),
            heading3('Internal State'),
            codePara('const [step, setStep] = useState(0);'),
            codePara('const [selectedTeam, setSelectedTeam] = useState<ExternalTeam | null>(null);'),
            codePara('const [selectedPlayerIds, setSelectedPlayerIds] = useState<Set<string>>(new Set());'),
            codePara('const [selectedEventIds, setSelectedEventIds] = useState<Set<string>>(new Set());'),
            codePara('const [selectedMatchIds, setSelectedMatchIds] = useState<Set<string>>(new Set());'),
            codePara('const [importResult, setImportResult] = useState<ImportSummary | null>(null);'),

            emptyPara(),
            heading3('Key Behaviors'),
            bulletItem('Back button on step > 0 goes to previous step, on step 0 closes the wizard'),
            bulletItem('Each step transition fetches data for the next step (team selection triggers roster + schedule fetch)'),
            bulletItem('Show loading skeletons during API calls, not blank screens'),
            bulletItem('If API call fails, show inline error with retry button (do not close wizard)'),
            bulletItem('The "Import" action on Step 3 is destructive (creates data) so should use expo-haptics impact feedback'),

            new Paragraph({ children: [new PageBreak()] }),


            // ═══════════════════════════════════════════════════════════════════
            // SECTION 7: DATA MODEL EXTENSIONS
            // ═══════════════════════════════════════════════════════════════════

            heading1('7. Data Model Extensions'),

            para('The following fields need to be added to existing types. These are minimal, non-breaking additions.'),

            heading2('7.1 Season Type Extension'),
            codePara('// Add to types/index.ts Season interface'),
            codePara('sourceProvider?: "teamsnap" | "sportsengine";'),
            codePara('externalTeamId?: string;'),
            codePara('lastRosterSync?: number;  // timestamp'),
            codePara('lastScheduleSync?: number; // timestamp'),

            emptyPara(),
            heading2('7.2 Player Type Extension'),
            codePara('// Add to types/index.ts Player interface'),
            codePara('externalId?: string; // TeamSnap member_id or SportsEngine person_id'),

            emptyPara(),
            heading2('7.3 Event & MatchRecord Extension'),
            codePara('// Add to types/index.ts Event interface'),
            codePara('externalId?: string;'),
            codePara(''),
            codePara('// Add to types/index.ts MatchRecord interface'),
            codePara('externalId?: string;'),

            emptyPara(),
            heading2('7.4 PaywallTrigger Extension'),
            codePara('// Update in components/PaywallModal.tsx'),
            codePara("type PaywallTrigger = 'season' | 'ai_narrative' | 'export' | 'settings' | 'voice_input' | 'integration_import';"),

            emptyPara(),

            infoBox('Important: Backward Compatibility', [
                'All new fields are optional (?) so existing data loads without migration.',
                'The Zustand persisted store will hydrate existing seasons/events/matches without these fields and they will simply be undefined.',
                'Firebase sync will ignore undefined fields during push and read them as undefined on pull.'
            ]),

            new Paragraph({ children: [new PageBreak()] }),


            // ═══════════════════════════════════════════════════════════════════
            // SECTION 8: FEATURE FLAG & PRO GATING
            // ═══════════════════════════════════════════════════════════════════

            heading1('8. Feature Flag & Pro Gating'),

            heading2('8.1 Feature Flag'),
            codePara('// constants/featureFlags.ts'),
            codePara('export const INTEGRATIONS_ENABLED = true;'),

            para('Wrap all integration UI entry points with this flag. This allows instant disable without code removal during beta testing.'),

            emptyPara(),
            heading2('8.2 Pro Gating Strategy'),
            para('Integration import is a Pro-only feature. The gating logic follows the existing pattern used by voice input and AI narratives:'),

            numberedItem('Check isPro from useSubscriptionStore before starting any integration flow', 'numbers5'),
            numberedItem('If not Pro, show PaywallModal with trigger "integration_import" instead of proceeding', 'numbers5'),
            numberedItem('The PaywallModal content for this trigger should emphasize: "Import your roster and schedule from TeamSnap or SportsEngine with one tap"', 'numbers5'),
            numberedItem('Free users can SEE the integration section in Settings (creates desire) but cannot Connect', 'numbers5'),

            emptyPara(),
            heading2('8.3 PaywallModal Content for Integration'),
            new Table({
                width: { size: CONTENT_WIDTH, type: WidthType.DXA },
                columnWidths: [3120, 6240],
                rows: [
                    new TableRow({ children: [headerCell('Field', 3120), headerCell('Value', 6240)] }),
                    new TableRow({ children: [cell('Title', 3120, { bold: true }), cell('"Unlock Integrations"', 6240)] }),
                    new TableRow({ children: [cell('Description', 3120, { bold: true }), cell('"Import your entire roster and schedule from TeamSnap or SportsEngine in seconds. No more manual entry."', 6240, { shading: TABLE_ALT_ROW })] }),
                    new TableRow({ children: [cell('Features List', 3120, { bold: true }), cell('"One-tap roster import", "Automatic schedule sync", "Re-import to stay updated"', 6240)] }),
                ]
            }),

            new Paragraph({ children: [new PageBreak()] }),


            // ═══════════════════════════════════════════════════════════════════
            // SECTION 9: STATE MANAGEMENT
            // ═══════════════════════════════════════════════════════════════════

            heading1('9. State Management Architecture'),

            heading2('9.1 useIntegrationStore (New Zustand Store)'),
            boldPara('File: ', 'store/useIntegrationStore.ts'),
            para('This store manages OAuth connection state for external platforms. Tokens themselves are stored in expo-secure-store (not in Zustand) for security. The store only tracks connection status and metadata.'),

            emptyPara(),
            codePara('interface IntegrationState {'),
            codePara('  connections: {'),
            codePara('    teamsnap: ConnectionInfo | null;'),
            codePara('    sportsengine: ConnectionInfo | null;'),
            codePara('  };'),
            codePara('  connect: (provider, info: ConnectionInfo) => void;'),
            codePara('  disconnect: (provider) => void;'),
            codePara('  isConnected: (provider) => boolean;'),
            codePara('}'),
            codePara(''),
            codePara('interface ConnectionInfo {'),
            codePara('  accountName: string;   // display name from OAuth'),
            codePara('  accountEmail?: string;'),
            codePara('  connectedAt: number;   // timestamp'),
            codePara('}'),

            emptyPara(),
            heading2('9.2 Token Storage (expo-secure-store)'),
            para('OAuth access and refresh tokens are stored in expo-secure-store, not in the Zustand store. This is critical for security:'),
            codePara('// services/integrations/authUtils.ts'),
            codePara('import * as SecureStore from "expo-secure-store";'),
            codePara(''),
            codePara('const KEYS = {'),
            codePara('  teamsnap_access: "integration_teamsnap_access_token",'),
            codePara('  teamsnap_refresh: "integration_teamsnap_refresh_token",'),
            codePara('  sportsengine_access: "integration_sportsengine_access_token",'),
            codePara('  sportsengine_refresh: "integration_sportsengine_refresh_token",'),
            codePara('};'),

            emptyPara(),
            heading2('9.3 useIntegrationImport Hook'),
            boldPara('File: ', 'hooks/useIntegrationImport.ts'),
            para('This hook orchestrates the entire import flow. It is consumed by the ImportWizard component:'),

            codePara('function useIntegrationImport(provider) {'),
            codePara('  return {'),
            codePara('    fetchTeams: () => Promise<ExternalTeam[]>,'),
            codePara('    fetchRoster: (teamId) => Promise<ExternalPlayer[]>,'),
            codePara('    fetchSchedule: (teamId) => Promise<{ events, matches }>,'),
            codePara('    commitImport: (seasonName, roster, events, matches) => string, // returns seasonId'),
            codePara('    refreshRoster: (seasonId) => Promise<RefreshResult>,'),
            codePara('    refreshSchedule: (seasonId) => Promise<RefreshResult>,'),
            codePara('    loading: boolean,'),
            codePara('    error: string | null,'),
            codePara('  };'),
            codePara('}'),

            new Paragraph({ children: [new PageBreak()] }),


            // ═══════════════════════════════════════════════════════════════════
            // SECTION 10: IMPLEMENTATION ORDER
            // ═══════════════════════════════════════════════════════════════════

            heading1('10. Implementation Order (Dependency Graph)'),

            para('This section defines the exact order of implementation to minimize blocked work. Each phase can be completed in a single development session.'),

            emptyPara(),

            // Phase table
            heading2('10.1 Phase A: Foundation (No UI)'),
            new Table({
                width: { size: CONTENT_WIDTH, type: WidthType.DXA },
                columnWidths: [600, 3760, 5000],
                rows: [
                    new TableRow({ children: [headerCell('#', 600), headerCell('Task', 3760), headerCell('Details', 5000)] }),
                    new TableRow({ children: [cell('A1', 600, { bold: true }), cell('Install dependencies', 3760), cell('expo install expo-auth-session expo-secure-store', 5000, { mono: true })] }),
                    new TableRow({ children: [cell('A2', 600, { bold: true }), cell('Add type extensions', 3760, { shading: TABLE_ALT_ROW }), cell('Add sourceProvider, externalTeamId, externalId, lastRosterSync, lastScheduleSync to types/index.ts', 5000, { shading: TABLE_ALT_ROW })] }),
                    new TableRow({ children: [cell('A3', 600, { bold: true }), cell('Create feature flag', 3760), cell('constants/featureFlags.ts with INTEGRATIONS_ENABLED = true', 5000)] }),
                    new TableRow({ children: [cell('A4', 600, { bold: true }), cell('Create useIntegrationStore', 3760, { shading: TABLE_ALT_ROW }), cell('store/useIntegrationStore.ts (Zustand + persist). Connection status only, no tokens.', 5000, { shading: TABLE_ALT_ROW })] }),
                    new TableRow({ children: [cell('A5', 600, { bold: true }), cell('Create authUtils', 3760), cell('services/integrations/authUtils.ts. Token CRUD via expo-secure-store. OAuth config for both providers.', 5000)] }),
                    new TableRow({ children: [cell('A6', 600, { bold: true }), cell('Update PaywallTrigger type', 3760, { shading: TABLE_ALT_ROW }), cell('Add "integration_import" to PaywallTrigger union in PaywallModal.tsx. Add content for this trigger.', 5000, { shading: TABLE_ALT_ROW })] }),
                ]
            }),

            emptyPara(),
            heading2('10.2 Phase B: Service Layer'),
            new Table({
                width: { size: CONTENT_WIDTH, type: WidthType.DXA },
                columnWidths: [600, 3760, 5000],
                rows: [
                    new TableRow({ children: [headerCell('#', 600), headerCell('Task', 3760), headerCell('Details', 5000)] }),
                    new TableRow({ children: [cell('B1', 600, { bold: true }), cell('TeamSnapService.ts', 3760), cell('services/integrations/TeamSnapService.ts. Fetch teams, members, events. Collection+JSON parser. See TEAM_SCHEDULE_INTEGRATION.md Section 6.', 5000)] }),
                    new TableRow({ children: [cell('B2', 600, { bold: true }), cell('ImportService.ts', 3760, { shading: TABLE_ALT_ROW }), cell('services/integrations/ImportService.ts. Data mappers: TeamSnap Member to Player, Event to Event/MatchRecord. commitImport function. See Section 8.', 5000, { shading: TABLE_ALT_ROW })] }),
                    new TableRow({ children: [cell('B3', 600, { bold: true }), cell('useIntegrationImport hook', 3760), cell('hooks/useIntegrationImport.ts. Orchestration hook wrapping TeamSnapService + ImportService + store actions.', 5000)] }),
                ]
            }),

            emptyPara(),
            heading2('10.3 Phase C: UI Components'),
            new Table({
                width: { size: CONTENT_WIDTH, type: WidthType.DXA },
                columnWidths: [600, 3760, 5000],
                rows: [
                    new TableRow({ children: [headerCell('#', 600), headerCell('Task', 3760), headerCell('Details', 5000)] }),
                    new TableRow({ children: [cell('C1', 600, { bold: true }), cell('IntegrationRow + ConnectionSheet', 3760), cell('Two components for Settings screen integration section', 5000)] }),
                    new TableRow({ children: [cell('C2', 600, { bold: true }), cell('Settings screen modification', 3760, { shading: TABLE_ALT_ROW }), cell('Add Integrations section to app/settings.tsx between Appearance and Account', 5000, { shading: TABLE_ALT_ROW })] }),
                    new TableRow({ children: [cell('C3', 600, { bold: true }), cell('StepIndicator component', 3760), cell('Reusable horizontal step indicator with labels', 5000)] }),
                    new TableRow({ children: [cell('C4', 600, { bold: true }), cell('TeamSelector component', 3760, { shading: TABLE_ALT_ROW }), cell('Team list with selectable cards, loading skeleton', 5000, { shading: TABLE_ALT_ROW })] }),
                    new TableRow({ children: [cell('C5', 600, { bold: true }), cell('RosterPreview component', 3760), cell('Player list with checkboxes, select all, already-imported detection', 5000)] }),
                    new TableRow({ children: [cell('C6', 600, { bold: true }), cell('SchedulePreview component', 3760, { shading: TABLE_ALT_ROW }), cell('Date-grouped event/match list with checkboxes, type badges', 5000, { shading: TABLE_ALT_ROW })] }),
                    new TableRow({ children: [cell('C7', 600, { bold: true }), cell('ImportComplete component', 3760), cell('Success view with summary counts and navigation buttons', 5000)] }),
                    new TableRow({ children: [cell('C8', 600, { bold: true }), cell('ImportWizard (assembles C3-C7)', 3760, { shading: TABLE_ALT_ROW }), cell('Full-screen modal combining all wizard sub-components', 5000, { shading: TABLE_ALT_ROW })] }),
                    new TableRow({ children: [cell('C9', 600, { bold: true }), cell('Season create modification', 3760), cell('Add "Import from TeamSnap" button to app/season/create.tsx', 5000)] }),
                    new TableRow({ children: [cell('C10', 600, { bold: true }), cell('Season detail modification', 3760, { shading: TABLE_ALT_ROW }), cell('Add refresh buttons and source badge to app/season/[id].tsx', 5000, { shading: TABLE_ALT_ROW })] }),
                ]
            }),

            emptyPara(),
            heading2('10.4 Phase D: Polish & Error Handling'),
            new Table({
                width: { size: CONTENT_WIDTH, type: WidthType.DXA },
                columnWidths: [600, 3760, 5000],
                rows: [
                    new TableRow({ children: [headerCell('#', 600), headerCell('Task', 3760), headerCell('Details', 5000)] }),
                    new TableRow({ children: [cell('D1', 600, { bold: true }), cell('Loading skeletons', 3760), cell('Add shimmer loading states to TeamSelector, RosterPreview, SchedulePreview', 5000)] }),
                    new TableRow({ children: [cell('D2', 600, { bold: true }), cell('Error states', 3760, { shading: TABLE_ALT_ROW }), cell('Inline retry buttons for API failures. Network offline detection. Token expiry handling.', 5000, { shading: TABLE_ALT_ROW })] }),
                    new TableRow({ children: [cell('D3', 600, { bold: true }), cell('Empty states', 3760), cell('No teams found, no players on team, no upcoming events', 5000)] }),
                    new TableRow({ children: [cell('D4', 600, { bold: true }), cell('Haptic feedback', 3760, { shading: TABLE_ALT_ROW }), cell('expo-haptics on import confirm, disconnect confirm, error events', 5000, { shading: TABLE_ALT_ROW })] }),
                    new TableRow({ children: [cell('D5', 600, { bold: true }), cell('Pro gating wiring', 3760), cell('Wire up PaywallModal for non-Pro users at all entry points', 5000)] }),
                    new TableRow({ children: [cell('D6', 600, { bold: true }), cell('ImportProgressOverlay', 3760, { shading: TABLE_ALT_ROW }), cell('Shows step-by-step progress during import commit (fetching, mapping, saving)', 5000, { shading: TABLE_ALT_ROW })] }),
                ]
            }),

            emptyPara(),
            heading2('10.5 Phase E: SportsEngine Extension'),
            new Table({
                width: { size: CONTENT_WIDTH, type: WidthType.DXA },
                columnWidths: [600, 3760, 5000],
                rows: [
                    new TableRow({ children: [headerCell('#', 600), headerCell('Task', 3760), headerCell('Details', 5000)] }),
                    new TableRow({ children: [cell('E1', 600, { bold: true }), cell('SportsEngineService.ts', 3760), cell('services/integrations/SportsEngineService.ts. GraphQL API calls. See TEAM_SCHEDULE_INTEGRATION.md Section 7.', 5000)] }),
                    new TableRow({ children: [cell('E2', 600, { bold: true }), cell('Extend ImportService mappers', 3760, { shading: TABLE_ALT_ROW }), cell('Add SportsEngine-to-VolleyTrack mapping functions alongside TeamSnap ones', 5000, { shading: TABLE_ALT_ROW })] }),
                    new TableRow({ children: [cell('E3', 600, { bold: true }), cell('Extend useIntegrationImport', 3760), cell('Add SportsEngine provider support to the hook', 5000)] }),
                    new TableRow({ children: [cell('E4', 600, { bold: true }), cell('UI: Add SportsEngine to wizard', 3760, { shading: TABLE_ALT_ROW }), cell('ImportWizard accepts both providers, minor UI differences for GraphQL data shape', 5000, { shading: TABLE_ALT_ROW })] }),
                ]
            }),

            new Paragraph({ children: [new PageBreak()] }),


            // ═══════════════════════════════════════════════════════════════════
            // SECTION 11: ERROR HANDLING & EDGE CASES
            // ═══════════════════════════════════════════════════════════════════

            heading1('11. Error Handling & Edge Cases'),

            heading2('11.1 OAuth Failures'),
            new Table({
                width: { size: CONTENT_WIDTH, type: WidthType.DXA },
                columnWidths: [2800, 3280, 3280],
                rows: [
                    new TableRow({ children: [headerCell('Scenario', 2800), headerCell('User Sees', 3280), headerCell('Implementation', 3280)] }),
                    new TableRow({ children: [cell('User cancels OAuth', 2800), cell('Nothing (silently return to Settings)', 3280), cell('Check AuthSession result.type === "cancel"', 3280)] }),
                    new TableRow({ children: [cell('OAuth error', 2800), cell('Alert: "Connection failed. Please try again."', 3280, { shading: TABLE_ALT_ROW }), cell('Show Alert.alert() with retry option', 3280, { shading: TABLE_ALT_ROW })] }),
                    new TableRow({ children: [cell('Token expired during import', 2800), cell('Alert: "Session expired. Please reconnect."', 3280), cell('Attempt silent refresh first, then prompt reconnect', 3280)] }),
                    new TableRow({ children: [cell('Network offline', 2800), cell('Toast/banner: "No internet connection"', 3280, { shading: TABLE_ALT_ROW }), cell('Check NetInfo before starting, show retry button', 3280, { shading: TABLE_ALT_ROW })] }),
                ]
            }),

            emptyPara(),
            heading2('11.2 Import Edge Cases'),
            new Table({
                width: { size: CONTENT_WIDTH, type: WidthType.DXA },
                columnWidths: [2800, 3280, 3280],
                rows: [
                    new TableRow({ children: [headerCell('Scenario', 2800), headerCell('Behavior', 3280), headerCell('Implementation', 3280)] }),
                    new TableRow({ children: [cell('Team has 0 players', 2800), cell('Show empty state: "No players found on this team"', 3280), cell('Allow skip to schedule step', 3280)] }),
                    new TableRow({ children: [cell('No upcoming events', 2800), cell('Show: "No upcoming events found"', 3280, { shading: TABLE_ALT_ROW }), cell('Allow import with roster only', 3280, { shading: TABLE_ALT_ROW })] }),
                    new TableRow({ children: [cell('Player missing jersey #', 2800), cell('Show "No #" in the jersey badge', 3280), cell('Map to empty string, allow manual edit later', 3280)] }),
                    new TableRow({ children: [cell('Duplicate player on re-import', 2800), cell('Show as grayed "Already imported"', 3280, { shading: TABLE_ALT_ROW }), cell('Match by externalId, skip duplicate insert', 3280, { shading: TABLE_ALT_ROW })] }),
                    new TableRow({ children: [cell('Played match on re-import', 2800), cell('Show as grayed "Already played"', 3280), cell('Never modify matches with result !== "Scheduled"', 3280)] }),
                    new TableRow({ children: [cell('Very large team (50+ players)', 2800), cell('FlatList with virtualization', 3280, { shading: TABLE_ALT_ROW }), cell('Use FlatList in RosterPreview, not ScrollView + .map()', 3280, { shading: TABLE_ALT_ROW })] }),
                ]
            }),

            new Paragraph({ children: [new PageBreak()] }),


            // ═══════════════════════════════════════════════════════════════════
            // SECTION 12: FILE MANIFEST
            // ═══════════════════════════════════════════════════════════════════

            heading1('12. Complete File Manifest'),

            heading2('12.1 New Files'),
            new Table({
                width: { size: CONTENT_WIDTH, type: WidthType.DXA },
                columnWidths: [5200, 4160],
                rows: [
                    new TableRow({ children: [headerCell('File Path', 5200), headerCell('Purpose', 4160)] }),
                    new TableRow({ children: [cell('constants/featureFlags.ts', 5200, { mono: true }), cell('INTEGRATIONS_ENABLED flag', 4160)] }),
                    new TableRow({ children: [cell('store/useIntegrationStore.ts', 5200, { mono: true, shading: TABLE_ALT_ROW }), cell('Connection state (Zustand + persist)', 4160, { shading: TABLE_ALT_ROW })] }),
                    new TableRow({ children: [cell('services/integrations/authUtils.ts', 5200, { mono: true }), cell('OAuth + SecureStore token CRUD', 4160)] }),
                    new TableRow({ children: [cell('services/integrations/TeamSnapService.ts', 5200, { mono: true, shading: TABLE_ALT_ROW }), cell('TeamSnap REST API client', 4160, { shading: TABLE_ALT_ROW })] }),
                    new TableRow({ children: [cell('services/integrations/SportsEngineService.ts', 5200, { mono: true }), cell('SportsEngine GraphQL client', 4160)] }),
                    new TableRow({ children: [cell('services/integrations/ImportService.ts', 5200, { mono: true, shading: TABLE_ALT_ROW }), cell('Data mappers + commitImport', 4160, { shading: TABLE_ALT_ROW })] }),
                    new TableRow({ children: [cell('hooks/useIntegrationImport.ts', 5200, { mono: true }), cell('Orchestration hook', 4160)] }),
                    new TableRow({ children: [cell('components/ImportWizard.tsx', 5200, { mono: true, shading: TABLE_ALT_ROW }), cell('Multi-step import modal', 4160, { shading: TABLE_ALT_ROW })] }),
                    new TableRow({ children: [cell('components/integration/TeamSelector.tsx', 5200, { mono: true }), cell('Team selection step', 4160)] }),
                    new TableRow({ children: [cell('components/integration/RosterPreview.tsx', 5200, { mono: true, shading: TABLE_ALT_ROW }), cell('Roster review with checkboxes', 4160, { shading: TABLE_ALT_ROW })] }),
                    new TableRow({ children: [cell('components/integration/SchedulePreview.tsx', 5200, { mono: true }), cell('Schedule review with checkboxes', 4160)] }),
                    new TableRow({ children: [cell('components/integration/ImportComplete.tsx', 5200, { mono: true, shading: TABLE_ALT_ROW }), cell('Success summary view', 4160, { shading: TABLE_ALT_ROW })] }),
                    new TableRow({ children: [cell('components/integration/StepIndicator.tsx', 5200, { mono: true }), cell('Horizontal step progress', 4160)] }),
                    new TableRow({ children: [cell('components/integration/IntegrationRow.tsx', 5200, { mono: true, shading: TABLE_ALT_ROW }), cell('Settings row for each provider', 4160, { shading: TABLE_ALT_ROW })] }),
                    new TableRow({ children: [cell('components/integration/ConnectionSheet.tsx', 5200, { mono: true }), cell('Connected provider detail sheet', 4160)] }),
                    new TableRow({ children: [cell('components/integration/ImportProgressOverlay.tsx', 5200, { mono: true, shading: TABLE_ALT_ROW }), cell('Progress overlay during commit', 4160, { shading: TABLE_ALT_ROW })] }),
                ]
            }),

            emptyPara(),
            heading2('12.2 Modified Files'),
            new Table({
                width: { size: CONTENT_WIDTH, type: WidthType.DXA },
                columnWidths: [5200, 4160],
                rows: [
                    new TableRow({ children: [headerCell('File Path', 5200), headerCell('Change', 4160)] }),
                    new TableRow({ children: [cell('types/index.ts', 5200, { mono: true }), cell('Add optional external fields to Season, Player, Event, MatchRecord', 4160)] }),
                    new TableRow({ children: [cell('components/PaywallModal.tsx', 5200, { mono: true, shading: TABLE_ALT_ROW }), cell('Add "integration_import" to PaywallTrigger + content', 4160, { shading: TABLE_ALT_ROW })] }),
                    new TableRow({ children: [cell('app/settings.tsx', 5200, { mono: true }), cell('Add Integrations section', 4160)] }),
                    new TableRow({ children: [cell('app/season/create.tsx', 5200, { mono: true, shading: TABLE_ALT_ROW }), cell('Add "Import from" quick action', 4160, { shading: TABLE_ALT_ROW })] }),
                    new TableRow({ children: [cell('app/season/[id].tsx', 5200, { mono: true }), cell('Add refresh buttons and source badge', 4160)] }),
                    new TableRow({ children: [cell('app.json', 5200, { mono: true, shading: TABLE_ALT_ROW }), cell('No changes needed (scheme: "volleytrack" already set for OAuth redirects)', 4160, { shading: TABLE_ALT_ROW })] }),
                ]
            }),

            new Paragraph({ children: [new PageBreak()] }),


            // ═══════════════════════════════════════════════════════════════════
            // SECTION 13: TESTING CHECKLIST
            // ═══════════════════════════════════════════════════════════════════

            heading1('13. Testing Checklist'),

            para('Use this checklist to verify the implementation is complete and correct.'),

            heading2('13.1 OAuth Flow'),
            bulletItem('TeamSnap OAuth: connect, receive token, see "Connected" status in Settings', 'bullets2'),
            bulletItem('SportsEngine OAuth: connect, receive token, see "Connected" status in Settings', 'bullets2'),
            bulletItem('Cancel OAuth mid-flow: app returns to Settings with no error shown', 'bullets2'),
            bulletItem('Disconnect: tokens cleared from SecureStore, status reverts to "Not Connected"', 'bullets2'),
            bulletItem('Token refresh: expired token triggers silent refresh before showing error', 'bullets2'),

            emptyPara(),
            heading2('13.2 Import Wizard'),
            bulletItem('Teams load after selecting provider', 'bullets3'),
            bulletItem('Selecting a team loads roster and schedule', 'bullets3'),
            bulletItem('All players checked by default, can uncheck individual players', 'bullets3'),
            bulletItem('Select All / Deselect All works correctly', 'bullets3'),
            bulletItem('Schedule items grouped by date, type badges correct', 'bullets3'),
            bulletItem('Import creates Season with correct roster, events, and scheduled matches', 'bullets3'),
            bulletItem('Imported Season has sourceProvider, externalTeamId, and sync timestamps set', 'bullets3'),
            bulletItem('All imported players have externalId set', 'bullets3'),
            bulletItem('All imported events and matches have externalId set', 'bullets3'),
            bulletItem('Matches created with result: "Scheduled" and correct opponent names', 'bullets3'),

            emptyPara(),
            heading2('13.3 Re-Import / Refresh'),
            bulletItem('Refresh Roster: new players added, existing players preserved', 'bullets3'),
            bulletItem('Refresh Roster: removed players on TeamSnap are NOT removed locally', 'bullets3'),
            bulletItem('Refresh Schedule: new matches added, played matches untouched', 'bullets3'),
            bulletItem('Refresh Schedule: already-imported scheduled matches updated (e.g., time change)', 'bullets3'),
            bulletItem('lastRosterSync and lastScheduleSync timestamps update after refresh', 'bullets3'),

            emptyPara(),
            heading2('13.4 UI/UX'),
            bulletItem('All screens render correctly in both light and dark mode', 'bullets3'),
            bulletItem('Loading skeletons display during API calls', 'bullets3'),
            bulletItem('Error states show retry buttons', 'bullets3'),
            bulletItem('Empty states show helpful messages', 'bullets3'),
            bulletItem('Haptic feedback fires on import confirm and errors', 'bullets3'),
            bulletItem('Pro gating: free users see PaywallModal instead of OAuth flow', 'bullets3'),
            bulletItem('Firebase sync: imported data syncs to cloud after import', 'bullets3'),

            new Paragraph({ children: [new PageBreak()] }),


            // ═══════════════════════════════════════════════════════════════════
            // SECTION 14: CRITICAL REMINDERS
            // ═══════════════════════════════════════════════════════════════════

            heading1('14. Critical Reminders for AI Assistants'),

            infoBox('Before Writing Any Code, Read These', [
                '1. Read TEAM_SCHEDULE_INTEGRATION.md.txt first for all API details, data mappings, and service code.',
                '2. All colors, spacing, and fonts come from useAppTheme() hook. Never hardcode.',
                '3. TeamSnap uses Collection+JSON format. You MUST use the parseCollectionItems() helper.',
                '4. SportsEngine uses GraphQL. Endpoint: https://api.sportsengine.com/graphql',
                '5. Tokens go in expo-secure-store, NOT in Zustand. Only connection metadata in Zustand.',
                '6. OAuth redirect scheme is "volleytrack" (already in app.json).',
                '7. Use FlatList for lists > 20 items (especially roster preview).',
                '8. Every new component must support light and dark mode.',
                '9. Free tier users can SEE integrations but CANNOT connect (Pro gating).',
                '10. Re-import NEVER deletes local data. Merge-only strategy.',
                '11. Matches with result !== "Scheduled" are NEVER modified on re-import.',
                '12. IDs: Date.now().toString() for seasons, Date.now().toString() + Math.random() for players/events/matches.',
                '13. All import data flows through useDataStore actions (addSeason, addEvent, saveMatchRecord).',
                '14. After import, call pushItemToCloud() to sync to Firebase.',
                '15. lucide-react-native for icons. Not @expo/vector-icons.'
            ]),

            emptyPara(),
            para('End of document. Use this plan alongside TEAM_SCHEDULE_INTEGRATION.md.txt to implement the feature.'),
        ]
    }]
});

// ─── Generate ───────────────────────────────────────────────────────────────

Packer.toBuffer(doc).then(buffer => {
    const outPath = '/sessions/sweet-admiring-darwin/mnt/VolleyTrack/Integration_UI_Development_Plan.docx';
    fs.writeFileSync(outPath, buffer);
    console.log(`Document written to ${outPath} (${buffer.length} bytes)`);
}).catch(err => {
    console.error('Error generating document:', err);
    process.exit(1);
});
