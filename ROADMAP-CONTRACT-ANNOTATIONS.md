# Contract Annotations Roadmap

**Created:** 2025-11-04  
**Goal:** Add all missing contract annotations to achieve clean validator run  
**Current Status:** 10/16 validators passing, 6 contract validators failing

---

## 📊 Current Validation Status

### ✅ Passing Validators (10/16)

**Code Quality - All Clean:**
- ✅ Async without await (0 issues)
- ✅ Duplicate HTML IDs (0 issues)
- ✅ Inline styles (0 issues)
- ✅ Hardcoded colors (0 issues)
- ✅ Function calls validation (0 issues)
- ✅ Null/undefined access (0 issues)
- ✅ Data shape validation (0 issues)
- ✅ Security risks (0 issues)
- ✅ Memory leak risks (0 issues)
- ✅ Error contract annotations (0 issues)

**Analysis:** Code quality is EXCELLENT! No bugs, security issues, or anti-patterns detected.

---

### ❌ Failing Validators (6/16)

**Contract Documentation - All Missing:**

| Validator | Issues | Effort | Priority |
|-----------|--------|--------|----------|
| Return type annotations | 36 functions | Medium | HIGH |
| Nullability annotations | 20 parameters | Low | MEDIUM |
| Async boundary annotations | 5 functions | Low | HIGH |
| Side effects annotations | 14 functions | High | MEDIUM |
| State mutation annotations | 15 functions | High | MEDIUM |
| Dependency annotations | 47 functions | Very High | LOW |

**Total Work:** ~137 annotation points to add

---

## 🎯 Implementation Strategy

### Phase 1: Quick Wins (15-30 min)

**Goal:** Knock out the easiest validators first

**Tasks:**
1. ✅ Async boundary annotations (5 functions)
   - `initModelList()` - Line 1444
   - `initLocalModel()` - Line 2254
   - `streamFromLocalModel()` - Line 2277
   - `handleSendMessage()` - Line 2361
   - `streamFromOpenRouter()` - Line 2674

**Expected Result:** 11/16 validators passing

---

### Phase 2: Return Types (45-60 min)

**Goal:** Document what functions return

**Tasks:**
2. ✅ Return type annotations (36 functions)
   - Focus on functions with explicit return statements
   - Group by return type:
     - Simple getters (15 functions): `@returns {string|null}`, `@returns {object}`
     - Event handlers (10 functions): `@returns {void}`
     - Formatters (6 functions): `@returns {string}`
     - Complex functions (5 functions): Needs analysis

**Approach:**
- Start with simple getters (`getApiKey()`, `getCurrentChat()`, etc.)
- Then event handlers (mostly void returns)
- Finally complex functions

**Expected Result:** 12/16 validators passing

---

### Phase 3: Nullability (20-30 min)

**Goal:** Mark which parameters can be null/undefined

**Tasks:**
3. ✅ Nullability annotations (20 parameters)
   - Search for functions with conditional parameter checks
   - Look for patterns: `param || default`, `param ? ... : ...`, `if (!param)`
   - Add `@param {type?}` markers

**Common patterns in Fusion Studio:**
- `formatFileTimestamp(timestamp)` - timestamp can be null
- `formatModality(inputMods, outputMods)` - both can be undefined
- Functions with default values in body

**Expected Result:** 13/16 validators passing

---

### Phase 4: Side Effects (60-90 min)

**Goal:** Document functions with side effects

**Tasks:**
4. ✅ Side effects annotations (14 functions)
   - Scan for: DOM manipulation, localStorage, console.log, setTimeout, addEventListener
   - Add detailed `@side-effects` lists
   - Mark pure functions with `@pure true`

**Function Categories:**
- Init functions (3): Heavy side effects (DOM, storage, events)
- Display functions (5): DOM manipulation
- Event handlers (4): Mixed side effects
- Utility functions (2): Timer, console

**Bonus:** 44 functions appear pure - add `@pure true` to these for clarity

**Expected Result:** 14/16 validators passing

---

### Phase 5: State Mutations (60-90 min)

**Goal:** Document global state changes

**Tasks:**
5. ✅ State mutation annotations (15 functions)
   - Track mutations to: `chatHistory`, `activeChatSlot`, `currentFile`, `modelList`, etc.
   - Document DOM mutations
   - Document localStorage writes

**Global State in Fusion Studio:**
- `chatHistory[]` - Main chat data
- `activeChatSlot` - Current thread
- `currentFile` - Loaded JSON file
- `currentPrompt` - System prompt
- `modelList[]` - Available models
- `fileLibrary[]` - File attachments
- Plus DOM and localStorage

**Expected Result:** 15/16 validators passing

---

### Phase 6: Dependencies (90-120 min)

**Goal:** Document function and global dependencies

**Tasks:**
6. ✅ Dependency annotations (47 functions)
   - Map out function call graphs
   - Document global variable usage
   - Add `@requires-functions` and `@requires-globals`

**This is the biggest one:** 47 functions with complex dependency trees

**Approach:**
- Start with leaf functions (no dependencies)
- Work up to composite functions (`init()` calls 10+ functions)
- Use validator output to guide (it shows the dependencies)

**Expected Result:** 16/16 validators passing! 🎉

---

## 📋 Execution Plan

### Session 1: Quick Wins + Returns (Phases 1-2)
**Time:** 60-90 minutes  
**Goal:** Get 12/16 passing  
**Tasks:** Async boundaries + Return types

### Session 2: Nullability + Side Effects (Phases 3-4)
**Time:** 90-120 minutes  
**Goal:** Get 14/16 passing  
**Tasks:** Nullability markers + Side effects

### Session 3: State + Dependencies (Phases 5-6)
**Time:** 150-180 minutes  
**Goal:** Get 16/16 passing (CLEAN!)  
**Tasks:** State mutations + Dependencies

**Total Estimated Time:** 5-6 hours across 3 sessions

---

## 🛠️ Tools & Approach

### Manual Annotation Strategy

For each function:
1. Read validator output (tells you what's missing)
2. Read function code (understand behavior)
3. Add annotations above function
4. Re-run validator to verify

### Batch Processing

Group similar functions:
- All getters together
- All init functions together
- All event handlers together

### Validation Loop

After each phase:
```bash
node scripts/docs-check.js
```

Watch the "Passed" count go up! 10 → 11 → 12 → 13 → 14 → 15 → 16

---

## 🎯 Success Criteria

**Done when:**
```
Total: 16 validators
  ✅ Passed: 16
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✔️  All docs checks passed.
```

**Benefits:**
- ✅ AI assistants understand your code contracts
- ✅ Functions are self-documenting
- ✅ Easier to maintain and refactor
- ✅ Prevents breaking changes
- ✅ Clean validation = deploy with confidence

---

## 📝 Notes

- Code quality is already excellent (10/10 quality validators passed)
- This is DOCUMENTATION work, not bug fixing
- Each annotation makes the code more maintainable
- Can do incrementally - no rush to finish all at once
- Consider adding contracts during natural refactors

---

## 🚀 Next Steps

**When starting next session:**

1. Run validator to see current state:
   ```bash
   node scripts/docs-check.js
   ```

2. Pick a phase from the roadmap

3. Work through functions systematically

4. Re-validate frequently to track progress

5. Commit after each phase (logical checkpoints)

---

**Let's get that clean validator run bro! 🏄‍♂️**


