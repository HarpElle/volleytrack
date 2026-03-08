# Workflow
- Do not use worktrees. Make changes directly in the working directory.
- Do not commit or push unless explicitly asked.
- After making changes, run `npx tsc --noEmit` to verify TypeScript compiles cleanly. Ignore pre-existing errors in `functions/src/`.
- When the user confirms that changes look good (e.g., "looks good", "everything's fine", "LGTM", "approved", or similar), ask whether they'd like everything committed and pushed to Git.
- If they confirm, handle the full Git workflow on their behalf:
  1. Run `npx tsc --noEmit` to verify the build is clean.
  2. Check if `PROJECT_OVERVIEW.md` needs updates for any added, renamed, or deleted files.
  3. Stage and commit all relevant changes with a descriptive commit message.
  4. Push to the remote branch.
  5. Create a PR to `main` (if one doesn't already exist for the branch).

# Code Conventions
- Use theme tokens from `useAppTheme()` (from `contexts/ThemeContext.tsx`). Never hardcode colors, border radii, or spacing values.
  - Colors: `colors.primary`, `colors.text`, `colors.error`, `colors.bgCard`, `colors.border`, etc.
  - Radii: `radius.sm` (8), `radius.md` (12), `radius.lg` (16), `radius.xl` (24)
- Icons come from `lucide-react-native`.
- Navigation uses Expo Router (`expo-router`).
- Keep `PROJECT_OVERVIEW.md` in sync when adding, renaming, or deleting files.
