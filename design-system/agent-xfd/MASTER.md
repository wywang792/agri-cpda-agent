# Design System Master File

> **LOGIC:** When building a specific page, first check `design-system/pages/[page-name].md`.
> If that file exists, its rules **override** this Master file.
> If not, strictly follow the rules below.

---

**Project:** Agent XFD (鲜达通)
**Generated:** 2026-05-27
**Category:** Agricultural Order Agent Mobile App
**Style:** Minimal Black & White

---

## Global Rules

### Color Palette

| Role | Hex | Usage |
|------|-----|-------|
| Primary / Text | `#1a1a1a` | Headings, primary text, CTA buttons, agent bubbles |
| Body Text | `#333333` | Standard body text |
| Secondary Text | `#666666` | Labels, secondary info |
| Muted Text | `#999999` | Placeholders, timestamps |
| Disabled / Hint | `#cccccc` | Disabled states, chevrons |
| Border | `#eeeeee` | Card borders, dividers |
| Surface | `#ffffff` | Cards, input backgrounds |
| Background | `#fafafa` | Page background |
| Alt Background | `#f5f5f5` | Input fields, disabled buttons |
| Agent Bubble | `#1a1a1a` bg + `#ffffff` text | Assistant messages |
| User Bubble | `#ffffff` bg + `#333333` text + `#eee` border | User messages |
| Status: Warning | `#b8860b` / `#fff8e1` bg | Pending status |
| Status: Success | `#558b2f` / `#e8f5e9` bg | Delivering/completed |
| Status: Info | `#666666` / `#f0f0f0` bg | Completed |
| Price Up | `#c62828` | Price increase |
| Price Down | `#2e7d32` | Price decrease |

### Typography

- **Font:** System default (no custom font import needed)
- **Heading:** 16-20px, weight 700
- **Body:** 14px, weight 400-500
- **Caption:** 11-12px, color `#999` or `#aaa`
- **Amount/Price:** weight 700

### Spacing

| Token | Value | Usage |
|-------|-------|-------|
| `xs` | 4px | Tight gaps |
| `sm` | 8px | Inline spacing, icon gaps |
| `md` | 12-14px | Card padding, list gaps |
| `lg` | 16-18px | Section padding |
| `xl` | 24px | Large section gaps |

### Border Radius

| Element | Radius |
|---------|--------|
| Cards | 12px |
| Buttons | 10px |
| Inputs | 8px |
| Chat bubbles | 14px (with 4px for tail corner) |
| Chips / Tags | 20px (pill) |
| Avatar | 50% |

### Shadows

Minimal — use borders instead of shadows.

```css
/* Only use subtle shadow for elevated cards if needed */
box-shadow: none; /* default */
border: 1px solid #eee; /* preferred */
```

---

## Component Specs

### Buttons

```css
/* Primary (CTA) */
.btn-primary {
  background: #1a1a1a;
  color: #ffffff;
  padding: 13px;
  border-radius: 10px;
  font-weight: 600;
  font-size: 15px;
  text-align: center;
  letter-spacing: 1px;
}

/* Secondary */
.btn-secondary {
  background: #f5f5f5;
  color: #666666;
  padding: 13px 18px;
  border-radius: 10px;
  font-weight: 500;
  font-size: 14px;
}
```

### Chat Bubbles

```css
/* User message */
.bubble-user {
  background: #ffffff;
  color: #333333;
  border: 1px solid #eeeeee;
  border-radius: 14px 14px 14px 4px;
  padding: 10px 14px;
  font-size: 14px;
}

/* Assistant message */
.bubble-assistant {
  background: #1a1a1a;
  color: #ffffff;
  border-radius: 14px 14px 4px 14px;
  padding: 10px 14px;
  font-size: 14px;
}
```

### Cards

```css
.card {
  background: #ffffff;
  border: 1px solid #eeeeee;
  border-radius: 12px;
  padding: 14px;
}
```

### Status Tags

```css
.tag {
  padding: 3px 10px;
  border-radius: 10px;
  font-size: 11px;
  font-weight: 600;
}

.tag-pending { background: #fff8e1; color: #b8860b; border: 1px solid #ffe082; }
.tag-active  { background: #e8f5e9; color: #558b2f; border: 1px solid #c8e6c9; }
.tag-done    { background: #f0f0f0; color: #666666; border: 1px solid #e0e0e0; }
```

---

## Anti-Patterns (Do NOT Use)

- Bright saturated colors (cyan, green, orange as primary)
- Gradient backgrounds
- Emoji as icon replacements (use text or SVG)
- Heavy box-shadows
- Colorful status badges — keep them muted
- Decorative illustrations

## Pre-Delivery Checklist

- [ ] All colors from the palette above
- [ ] No bright/saturated accent colors
- [ ] Borders (#eee) instead of shadows
- [ ] Consistent radius (10-14px)
- [ ] Text hierarchy via weight + gray shade, not color
- [ ] Status tags use muted tones
- [ ] Responsive: 375px mobile-first
