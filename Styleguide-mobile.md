# Fusion Studio Mobile Optimization Guide

**Purpose:** Documentation of mobile-specific fixes for keyboard jank, viewport resizing, safe area handling, and address bar behavior.

**Problem Summary:** Mobile browsers (especially iOS Safari) cause layout jank when the keyboard appears, the address bar hides/shows, and when dealing with notches and safe areas. Text inputs also trigger unwanted auto-zoom. This guide documents the solutions implemented in Fusion Studio.

---

## 1. Keyboard & Window Resize Jank Prevention

### Problem
When the mobile keyboard appears or disappears, the viewport height changes dynamically, causing the entire layout to shift, resize awkwardly, or create double-scroll situations.

### Solution: Dynamic Viewport Height Units + Fixed Positioning

**Implementation:** `css/layout.css` lines 81-117

```css
/* Portrait phones/tablets: lock chat window to viewport */
@media (max-width: 1024px) and (orientation: portrait) {
  #chat-window {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    width: 100vw;
    height: 100vh;   /* fallback */
    height: 100svh;  /* small viewport height */
    height: 100dvh;  /* dynamic viewport height */
    margin: 0;
    border-radius: 0;
    overflow: hidden;
    -webkit-overflow-scrolling: touch;
    overscroll-behavior-y: contain;
  }
}
```

**Key Techniques:**

1. **Fixed Positioning:** Locks the chat window to the viewport, preventing layout shifts when keyboard appears
2. **Triple Height Declaration:**
   - `100vh` - Fallback for older browsers
   - `100svh` - Small viewport height (ignores browser UI, treats it as always visible)
   - `100dvh` - Dynamic viewport height (adapts to keyboard/address bar changes)
3. **Overflow Control:**
   - `overflow: hidden` on parent prevents double-scroll
   - `-webkit-overflow-scrolling: touch` enables smooth scrolling on iOS
   - `overscroll-behavior-y: contain` prevents parent scroll when reaching list limits

---

## 2. Input Field Positioning (Stays in Right Zone)

### Problem
When the keyboard opens, the input field needs to stay visible and positioned correctly above the keyboard without causing the entire app to shrink or shift awkwardly.

### Solution: Scrollable Message List + Fixed Input Container

**Implementation:** `css/layout.css` lines 108-117

```css
/* When keyboard opens, allow the message list to scroll while input stays fixed */
.messages-list {
  height: calc(100vh - 120px);  /* fallback */
  height: calc(100svh - 120px); /* small viewport */
  height: calc(100dvh - 120px); /* dynamic viewport */
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  overscroll-behavior: contain;
}
```

**Input Container:** `css/chat.css` lines 80-101

```css
#input-container {
  position: absolute;
  box-sizing: border-box;
  width: 95%;
  left: 2.5%;
  bottom: 55px;  /* Fixed distance from bottom */
  min-height: 45px;
  height: auto;
  z-index: 15;
  /* ... styling ... */
}
```

**Key Techniques:**

1. **Absolute Positioning:** Input stays at a fixed distance from the bottom of the viewport
2. **Message List Scroll:** Only the message list scrolls when keyboard appears, not the entire layout
3. **Calculated Heights:** Uses viewport units minus header/footer space to prevent content from being hidden behind keyboard

---

## 3. Preventing iOS Auto-Zoom on Input Focus

### Problem
iOS Safari automatically zooms in when an input field has font-size smaller than 16px. This creates a jarring experience where the entire page zooms in when tapping the input.

### Solution: Force 16px Font Size on All Inputs

**Implementation:** `css/layout.css` lines 103-106

```css
/* Ensure inputs / textareas don't trigger automatic zoom on focus */
input, textarea, .edit-textarea, select {
  font-size: 16px !important;
}
```

**Key Technique:**

- Set `font-size: 16px` (or larger) on ALL inputs, textareas, and selects
- iOS Safari only auto-zooms if font-size is below 16px
- Using `!important` ensures this rule overrides any other font-size declarations

**Note:** This applies specifically within the portrait mobile media query to avoid affecting desktop styles.

---

## 4. Safe Area Notch Handling (iPhone X+ and Modern Android)

### Problem
Devices with notches, dynamic islands, or rounded corners have "safe areas" that content can bleed into. The system provides inset values to avoid placing content behind these hardware features.

### Solution: env(safe-area-inset-*) CSS Environment Variables

**Implementation for Header:** `css/chat.css` lines 32-37

```css
/* Installed app (standalone), iPhone portrait only: nudge header below notch */
@media (display-mode: standalone) and (orientation: portrait) and (max-width: 600px) {
  #chat-header {
    top: env(safe-area-inset-top);
  }
}
```

**Implementation for Chat Window Padding:** `css/layout.css` lines 119-124

```css
/* Installed app (standalone), portrait: pad content below header + notch */
@media (display-mode: standalone) and (orientation: portrait) and (max-width: 600px) {
  #chat-window {
    padding-top: calc(env(safe-area-inset-top) + 56px);
  }
}
```

**Implementation for Output (Message List):** `css/chat.css` lines 271-276

```css
/* Installed app (standalone), portrait: push output below header + notch */
@media (display-mode: standalone) and (orientation: portrait) and (max-width: 600px) {
  #output {
    top: calc(env(safe-area-inset-top) + 56px);
  }
}
```

**Implementation for Bottom Safe Area:** `css/layout.css` lines 95-97

```css
#chat-window {
  /* keep content above iOS home indicator / safe areas */
  padding-bottom: env(safe-area-inset-bottom);
  padding-bottom: constant(safe-area-inset-bottom);  /* older iOS fallback */
}
```

**Key Techniques:**

1. **Safe Area Insets:**
   - `env(safe-area-inset-top)` - Space needed at top (notch, dynamic island)
   - `env(safe-area-inset-bottom)` - Space needed at bottom (home indicator)
   - `constant(safe-area-inset-bottom)` - Fallback for older iOS versions

2. **Display Mode Detection:**
   - `@media (display-mode: standalone)` - Only applies when installed as PWA
   - Avoids adding extra padding when running in regular browser (which already handles safe areas)

3. **Calculated Spacing:**
   - `calc(env(safe-area-inset-top) + 56px)` - Combines safe area + header height
   - Ensures content starts below both the notch and the header

---

## 5. Hiding the Web Address Bar

### Problem
On mobile browsers, the address bar takes up valuable screen space. We want it to auto-hide when scrolling and minimize its presence for a more app-like experience.

### Solution: Viewport Meta Tags + Standalone Display Mode

**Implementation:** `index.html` lines 25-30

```html
<!-- Viewport Configuration -->
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<meta name="theme-color" content="#000000" />

<!-- iOS PWA Settings -->
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
```

**Key Techniques:**

1. **viewport-fit=cover:**
   - Tells browser to extend content edge-to-edge, including into safe areas
   - Must be paired with safe-area-inset padding (see section 4)

2. **apple-mobile-web-app-capable:**
   - When installed as PWA on iOS, removes the browser chrome entirely
   - App runs in standalone mode without address bar or browser UI

3. **black-translucent Status Bar:**
   - Status bar (time, battery, signal) appears with black translucent background
   - Content renders underneath the status bar (managed by safe-area-inset)

4. **Theme Color:**
   - Sets the browser chrome color to match app background (#000000 = black)
   - Creates seamless appearance even before address bar auto-hides

**Additional Technique (Auto-Hide on Scroll):**

By using `position: fixed` on `#chat-window` and allowing only the message list to scroll (see section 2), the browser's address bar auto-hides when the user scrolls the message list, giving more vertical space.

---

## 6. Preventing Layout "Scrunch" in Background

### Problem
When the keyboard appears, some mobile browsers try to resize the entire viewport, causing content to compress or shift awkwardly. We want content to remain stable while allowing scrolling.

### Solution: Contain Overflow Behavior + Separate Scroll Contexts

**Implementation:** `css/layout.css` lines 98-101

```css
#chat-window {
  overflow: hidden; /* avoid double-scroll when keyboard appears */
  -webkit-overflow-scrolling: touch;
  overscroll-behavior-y: contain;
}
```

**Key Techniques:**

1. **overflow: hidden on Parent:**
   - Prevents the chat window itself from scrolling
   - Only child elements (message list) handle scroll

2. **overscroll-behavior-y: contain:**
   - Prevents scroll chaining (when reaching end of message list, doesn't scroll parent)
   - Stops "bounce" effect from propagating to parent elements

3. **Separate Scroll Context for Messages:**
   - `.messages-list` has its own `overflow-y: auto`
   - Creates independent scroll area that doesn't affect layout

**Result:** When keyboard appears, the layout remains stable. Only the message list adjusts its scroll area. No awkward compression or shifting of UI elements.

---

## 7. Input Expansion Behavior (Responsive to Content)

### Problem
As users type long messages, the input field needs to expand vertically without causing layout jank or covering content.

### Solution: Smooth Height Transitions + Max Height Constraints

**Implementation:** `css/responsive.css` lines 82-96

```css
#message-input {
  height: 44px;
  min-height: 44px;
  transition: height 0.3s ease, min-height 0.3s ease;
  overflow-y: auto; /* Allow scrolling when expanded */
}

/* Optional: Make container adapt smoothly */
#input-container {
  transition: min-height 0.3s ease;
}
```

**Implementation in chat.css:** `css/chat.css` lines 103-137

```css
#message-input {
  max-height: 300px;
  overflow-y: auto;
  resize: none;
  transition: height 0.2s;
  white-space: normal;
  overflow-wrap: break-word;
  word-wrap: break-word;
}

/* Expanded state - applied via JS when text approaches icons */
#message-input.message-input-expanded {
  height: calc(44px + 50px);
  min-height: calc(44px + 50px);
  max-height: 300px;
  padding-bottom: 40px;
  overflow-y: auto;
}
```

**Key Techniques:**

1. **Max Height Limit:** Prevents input from growing infinitely and covering entire screen
2. **Smooth Transitions:** 0.3s ease on height changes creates natural expansion/contraction
3. **Overflow Auto:** Once max height is reached, input becomes scrollable
4. **Word Wrapping:** Ensures text wraps naturally within the input field

**JavaScript Trigger:** Add class `message-input-expanded` dynamically when text length/height increases.

---

## Summary: The Mobile Optimization Stack

| Issue | Solution | Key Files |
|-------|----------|-----------|
| Keyboard jank | Fixed positioning + dynamic viewport units (svh/dvh) | `layout.css` lines 81-117 |
| Input positioning | Absolute positioning with calculated heights | `chat.css` lines 80-101, `layout.css` lines 108-117 |
| Auto-zoom on focus | Force 16px font-size on all inputs | `layout.css` lines 103-106 |
| Safe area notch | env(safe-area-inset-*) padding | `chat.css` lines 32-37, `layout.css` lines 95-97, 119-124 |
| Address bar hiding | viewport-fit=cover + PWA meta tags | `RavenOS.html` lines 25-30 |
| Layout scrunch | overflow: hidden + overscroll-behavior | `layout.css` lines 98-101 |
| Input expansion | Smooth height transitions + max-height | `responsive.css` lines 82-96, `chat.css` lines 103-137 |

---

## Testing Checklist

When making changes to mobile layout, test the following:

- [ ] **Keyboard Appearance:** Does the input stay visible when keyboard opens?
- [ ] **Keyboard Dismissal:** Does the layout smoothly restore when keyboard closes?
- [ ] **Input Focus:** Does tapping the input zoom the page? (Should NOT zoom)
- [ ] **Portrait Rotation:** Does the layout adapt correctly when rotating device?
- [ ] **Notch Devices:** Is content visible below the notch/dynamic island?
- [ ] **Home Indicator:** Is content above the iOS home indicator area?
- [ ] **Address Bar:** Does the address bar auto-hide when scrolling?
- [ ] **PWA Mode:** When installed as PWA, is browser chrome completely hidden?
- [ ] **Message List Scroll:** Can you scroll messages while keyboard is open?
- [ ] **Input Expansion:** Does the input grow smoothly as you type long text?
- [ ] **Layout Stability:** Does content shift or compress awkwardly at any point?

---

## Browser-Specific Notes

### iOS Safari (iPhone/iPad)

- Uses `-webkit-overflow-scrolling: touch` for momentum scrolling
- Requires `font-size: 16px` to prevent auto-zoom
- Safe area insets critical for notched devices (iPhone X+)
- `constant(safe-area-inset-*)` fallback needed for older iOS versions
- Status bar style controlled by `apple-mobile-web-app-status-bar-style`

### Android Chrome/Samsung Internet

- Better support for dynamic viewport units (dvh/svh) than iOS
- Safe area insets work on newer Android devices with notches/punch holes
- Address bar auto-hide more reliable than iOS Safari
- Less aggressive with input auto-zoom, but 16px still recommended

### Desktop/Tablet Landscape

These mobile-specific fixes are wrapped in media queries:
- `@media (max-width: 1024px) and (orientation: portrait)`
- `@media (display-mode: standalone) and (orientation: portrait) and (max-width: 600px)`

Desktop and landscape tablet modes maintain the original layout without these constraints.

---

## Future Enhancements

Potential improvements for mobile experience:

1. **Virtual Keyboard API:** Detect keyboard height and adjust layout dynamically (experimental)
2. **Resize Observer:** Monitor viewport changes and adjust scroll positions
3. **Visual Viewport API:** More precise control over layout during keyboard transitions
4. **Input Toolbar:** Sticky toolbar that follows keyboard on iOS (requires more complex setup)

---

**Last Updated:** October 22, 2025  
**Implementation Status:** ✅ Complete and deployed  
**Related Files:** `css/layout.css`, `css/chat.css`, `css/responsive.css`, `index.html`

