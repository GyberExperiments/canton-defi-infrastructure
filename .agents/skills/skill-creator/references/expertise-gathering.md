# Expertise Gathering Guide

How to research intelligently when creating skills. Core principle: **structure > volume**.

## A) Decision Framework — Research or Skip?

**SKIP research when:**
- Technology is well-known (React, PostgreSQL, Docker, etc.) — Claude already knows
- Information is company/project-specific — only the user knows
- General workflow/methodology — Claude has strong priors

**RESEARCH when:**
- Specific API version or recent changes (e.g., Next.js 15 Server Actions syntax)
- Niche/unfamiliar tool the skill targets
- Exact CLI flags, config schemas, or migration paths
- Something released after training cutoff

## B) Source Hierarchy

Prefer sources in this order:
1. Official docs (`docs.*.com`, GitHub README)
2. Official examples and tutorials
3. Engineering blogs from major companies
4. StackOverflow accepted answers
5. Blog posts (verify against official docs)

Avoid: outdated tutorials, AI-generated content farms, opinion pieces.

## C) Research Patterns

### Pattern 1: API/Library
```
WebSearch "[library] docs [version]"
→ WebFetch official docs page
→ Condense to:
  - Purpose (1 line)
  - Key methods/functions (bullet list)
  - Common patterns (2-3 code snippets)
  - Gotchas and breaking changes
```

### Pattern 2: Framework Best Practices
```
WebSearch "[framework] best practices [year]"
→ Official guides only
→ Extract actionable rules (not philosophy)
→ Version-specific patterns
```

### Pattern 3: CLI/Tool Reference
```
WebSearch "[tool] CLI reference"
→ Commands + flags + config format
→ Common workflows (install → configure → use)
```

## D) Compression Protocol

Research is only valuable when compressed to high-density knowledge.

**Limits:**
- Max 5 web searches per skill
- Max 300 words extracted per source
- Apply 1/8 rule: compress to 1/8 of raw text while preserving meaning

**Format preferences:**
- Bullets > prose
- Rules > explanations
- Examples > descriptions
- Code snippets > paragraphs about code
- Tables > lists when comparing options

**Template for condensed research:**
```
### [Topic]
- **What**: [1 sentence]
- **Key API**: `method()`, `config.option`
- **Pattern**: [code snippet]
- **Gotcha**: [non-obvious issue]
```

## E) Validation Checklist

Before including research in a skill, every piece must pass ALL four checks:

1. **Current?** — Version matches what the project actually uses
2. **Actionable?** — Claude can directly apply it (not just "interesting")
3. **Non-obvious?** — Claude wouldn't know this from training data alone
4. **Token-worthy?** — Information density justifies the context cost

If any check fails, discard the research.

## F) When to Stop Researching

Stop when:
- You have enough for the skill's core workflow (80/20 rule)
- Results are repeating (diminishing returns)
- You've done 3-4 searches on a topic — that's the limit
- Remaining gaps can only be filled by the user (business logic, preferences, conventions)
- You catch yourself researching "nice to know" vs "need to know"

**After stopping:** List remaining knowledge gaps explicitly for the user interview phase. Frame gaps as specific questions, not open-ended topics.
