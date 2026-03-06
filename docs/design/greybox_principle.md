# The Greybox Principle: Engineering for AI-Human Synergy

**Core Philosophy:** Design modules to be **"Accessible but Irrelevant."**
Implementation details must be accessible to the AI when requested, but irrelevant to the rest of the system during standard operation.

## 1. The Three-Question Checklist

Before committing or refactoring, evaluate every module:

1. **Is it Deep?** Does a simple interface hide significant internal complexity? (e.g., one `sendEmail()` function hiding template rendering and provider retry logic).
2. **Is it Opaque?** Can you swap internal libraries or data structures without touching any file that *uses* the module?
3. **Is it Outcome-Focused?** Do tests assert that the "result was correct" rather than mocking the "internal steps"?

## 2. Locating the "Seams" (Practical Heuristics)

Use these two signals to identify where your module boundaries are failing:

- **Change Gravity:** If changing a single internal decision (like a database schema or a UI state shape) requires updating 3 or more files, **the seam is too thin.** Move that logic "down" into a deeper module.
- **Temporal Coupling:** Check `git log --name-only`. If a specific set of files always change together in the same commit, they are "coupled." They likely belong inside the same Deep Module boundary.

## 3. Implementation Patterns (Convex-Specific)

- **Deep Builders:** Use `functions.ts` custom builders (like `userQuery`) to hide repetitive logic like auth injection or validation.
- **Service Folders:** Group provider-specific logic (OpenAI, Resend, R2) into dedicated folders with a single, stable public API.
- **Opaque Logic:** The rest of the app should never know *how* an AI response is generated or *where* an image is stored -- only that it was successful.

## 4. AI Interaction Strategy

When working with an agent, use it as an **Architectural Auditor**:

- **Audit for Leakage:** *"Are any internal schema decisions leaking into my domain logic? Recommend a Seam."*
- **Audit for Depth:** *"Is this new module 'shallow'? Suggest how to pull the complexity into the implementation to keep the interface simple."*

## Why This Matters

A "Clean" codebase for AI is not one with the most files; it is the one with the most **stable interfaces.** High-gravity, shallow codebases cause AI "hallucinations" because the agent cannot keep the interconnected complexity in its context window. **Deep Modules solve this.**

## References

- John Ousterhout, *A Philosophy of Software Design* (Deep Modules, Information Leakage)
- Codebase examples: `convex/email/`, `convex/storage/`, `convex/ai/`, `convex/functions.ts`
