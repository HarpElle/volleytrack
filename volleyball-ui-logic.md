# Volleyball UI Logic & Standard Practices

This skill file defines the mandatory UI layouts and scaling logic for the VolleyTrack application. **ALL AGENTS MUST FOLLOW THESE GUIDELINES.**

## 1. Court Rotation Grid (Mandatory)

The player rotation view **MUST** always be rendered as a **3x2 Grid**. This mirrors the actual physical positions on a volleyball court.

### Grid Layout Layout
-   **Front Row (Top):** Positions 4 (Left), 3 (Center), 2 (Right)
-   **Back Row (Bottom):** Positions 5 (Left), 6 (Center), 1 (Right)

### Visual Representation
```
|  POS 4  |  POS 3  |  POS 2  |  <-- Net / Front Row
|---------|---------|---------|
|  POS 5  |  POS 6  |  POS 1  |  <-- Service Line / Back Row
```

**Do NOT** arrange players in a list or a single row for rotation views. Contextual spatial awareness is critical for the user (coach) to quickly identify who is where.

---

## 2. iPad & Tablet Scaling Strategy

When running on larger screens (iPad, Tablet), the UI strategy is **"Grow, Don't Reflow"**.

-   **constraint:** NEVER add more columns of data just because there is more width.
-   **Action:** Scale the **size** of the components and the **typography**.

### Rationale
Volleyball tracking happens at high speed. The user needs **larger touch targets** and **larger text** to hit the right button without looking down constantly.

### Implementation Checklist
-   [ ] **Container Height:** Increase row heights significantly on iPad.
-   [ ] **Font Sizes:** Scale headers and player numbers (e.g., from 16px to 24px+).
-   [ ] **Touch Targets:** Buttons must be significantly larger on iPad (e.g., min-height 60-80px).
-   [ ] **Whitespace:** Use comfortable padding to separate hit zones, preventing accidental mis-taps.
