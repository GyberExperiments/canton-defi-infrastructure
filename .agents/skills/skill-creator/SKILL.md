---
name: skill-creator
version: 1.1.0
description: Guide for creating effective skills. This skill should be used when users want to create a new skill (or update an existing skill) that extends Claude's capabilities with specialized knowledge, workflows, or tool integrations.
license: Complete terms in LICENSE.txt
---

# Skill Creator

This skill provides guidance for creating effective skills.

## About Skills

Skills are modular, self-contained packages that extend Claude's capabilities by providing
specialized knowledge, workflows, and tools. Think of them as "onboarding guides" for specific
domains or tasks—they transform Claude from a general-purpose agent into a specialized agent
equipped with procedural knowledge that no model can fully possess.

### What Skills Provide

1. Specialized workflows - Multi-step procedures for specific domains
2. Tool integrations - Instructions for working with specific file formats or APIs
3. Domain expertise - Company-specific knowledge, schemas, business logic
4. Bundled resources - Scripts, references, and assets for complex and repetitive tasks

## Core Principles

### Concise is Key

The context window is a public good. Skills share the context window with everything else Claude needs: system prompt, conversation history, other Skills' metadata, and the actual user request.

**Default assumption: Claude is already very smart.** Only add context Claude doesn't already have. Challenge each piece of information: "Does Claude really need this explanation?" and "Does this paragraph justify its token cost?"

Prefer concise examples over verbose explanations.

### Set Appropriate Degrees of Freedom

Match the level of specificity to the task's fragility and variability:

**High freedom (text-based instructions)**: Use when multiple approaches are valid, decisions depend on context, or heuristics guide the approach.

**Medium freedom (pseudocode or scripts with parameters)**: Use when a preferred pattern exists, some variation is acceptable, or configuration affects behavior.

**Low freedom (specific scripts, few parameters)**: Use when operations are fragile and error-prone, consistency is critical, or a specific sequence must be followed.

Think of Claude as exploring a path: a narrow bridge with cliffs needs specific guardrails (low freedom), while an open field allows many routes (high freedom).

### Anatomy of a Skill

Every skill consists of a required SKILL.md file and optional bundled resources:

```
skill-name/
├── SKILL.md (required)
│   ├── YAML frontmatter metadata (required)
│   │   ├── name: (required)
│   │   ├── description: (required)
│   │   └── compatibility: (optional, rarely needed)
│   └── Markdown instructions (required)
└── Bundled Resources (optional)
    ├── scripts/          - Executable code (Python/Bash/etc.)
    ├── references/       - Documentation intended to be loaded into context as needed
    └── assets/           - Files used in output (templates, icons, fonts, etc.)
```

#### SKILL.md (required)

Every SKILL.md consists of:

- **Frontmatter** (YAML): Contains `name` and `description` fields (required), plus optional fields like `version`, `license`, `metadata`, and `compatibility`. Only `name` and `description` are read by Claude to determine when the skill triggers, so be clear and comprehensive about what the skill is and when it should be used. The `version` field (semver: X.Y.Z) tracks skill iterations. The `compatibility` field is for noting environment requirements (target product, system packages, etc.) but most skills don't need it.
- **Body** (Markdown): Instructions and guidance for using the skill. Only loaded AFTER the skill triggers (if at all).

#### Bundled Resources (optional)

##### Scripts (`scripts/`)

Executable code (Python/Bash/etc.) for tasks that require deterministic reliability or are repeatedly rewritten.

- **When to include**: When the same code is being rewritten repeatedly or deterministic reliability is needed
- **Example**: `scripts/rotate_pdf.py` for PDF rotation tasks
- **Benefits**: Token efficient, deterministic, may be executed without loading into context
- **Note**: Scripts may still need to be read by Claude for patching or environment-specific adjustments

##### References (`references/`)

Documentation and reference material intended to be loaded as needed into context to inform Claude's process and thinking.

- **When to include**: For documentation that Claude should reference while working
- **Examples**: `references/finance.md` for financial schemas, `references/mnda.md` for company NDA template, `references/policies.md` for company policies, `references/api_docs.md` for API specifications
- **Use cases**: Database schemas, API documentation, domain knowledge, company policies, detailed workflow guides
- **Benefits**: Keeps SKILL.md lean, loaded only when Claude determines it's needed
- **Best practice**: If files are large (>10k words), include grep search patterns in SKILL.md
- **Avoid duplication**: Information should live in either SKILL.md or references files, not both. Prefer references files for detailed information unless it's truly core to the skill—this keeps SKILL.md lean while making information discoverable without hogging the context window. Keep only essential procedural instructions and workflow guidance in SKILL.md; move detailed reference material, schemas, and examples to references files.

##### Assets (`assets/`)

Files not intended to be loaded into context, but rather used within the output Claude produces.

- **When to include**: When the skill needs files that will be used in the final output
- **Examples**: `assets/logo.png` for brand assets, `assets/slides.pptx` for PowerPoint templates, `assets/frontend-template/` for HTML/React boilerplate, `assets/font.ttf` for typography
- **Use cases**: Templates, images, icons, boilerplate code, fonts, sample documents that get copied or modified
- **Benefits**: Separates output resources from documentation, enables Claude to use files without loading them into context

#### What to Not Include in a Skill

A skill should only contain essential files that directly support its functionality. Do NOT create extraneous documentation or auxiliary files, including:

- README.md
- INSTALLATION_GUIDE.md
- QUICK_REFERENCE.md
- CHANGELOG.md
- etc.

The skill should only contain the information needed for an AI agent to do the job at hand. It should not contain auxilary context about the process that went into creating it, setup and testing procedures, user-facing documentation, etc. Creating additional documentation files just adds clutter and confusion.

### Progressive Disclosure Design Principle

Skills use a three-level loading system to manage context efficiently:

1. **Metadata (name + description)** - Always in context (~100 words)
2. **SKILL.md body** - When skill triggers (<5k words)
3. **Bundled resources** - As needed by Claude (Unlimited because scripts can be executed without reading into context window)

#### Progressive Disclosure Patterns

Keep SKILL.md body to the essentials and under 500 lines to minimize context bloat. Split content into separate files when approaching this limit. When splitting out content into other files, it is very important to reference them from SKILL.md and describe clearly when to read them, to ensure the reader of the skill knows they exist and when to use them.

**Key principle:** When a skill supports multiple variations, frameworks, or options, keep only the core workflow and selection guidance in SKILL.md. Move variant-specific details (patterns, examples, configuration) into separate reference files.

**Pattern 1: High-level guide with references**

```markdown
# PDF Processing

## Quick start

Extract text with pdfplumber:
[code example]

## Advanced features

- **Form filling**: See [FORMS.md](FORMS.md) for complete guide
- **API reference**: See [REFERENCE.md](REFERENCE.md) for all methods
- **Examples**: See [EXAMPLES.md](EXAMPLES.md) for common patterns
```

Claude loads FORMS.md, REFERENCE.md, or EXAMPLES.md only when needed.

**Pattern 2: Domain-specific organization**

For Skills with multiple domains, organize content by domain to avoid loading irrelevant context:

```
bigquery-skill/
├── SKILL.md (overview and navigation)
└── reference/
    ├── finance.md (revenue, billing metrics)
    ├── sales.md (opportunities, pipeline)
    ├── product.md (API usage, features)
    └── marketing.md (campaigns, attribution)
```

When a user asks about sales metrics, Claude only reads sales.md.

Similarly, for skills supporting multiple frameworks or variants, organize by variant:

```
cloud-deploy/
├── SKILL.md (workflow + provider selection)
└── references/
    ├── aws.md (AWS deployment patterns)
    ├── gcp.md (GCP deployment patterns)
    └── azure.md (Azure deployment patterns)
```

When the user chooses AWS, Claude only reads aws.md.

**Pattern 3: Conditional details**

Show basic content, link to advanced content:

```markdown
# DOCX Processing

## Creating documents

Use docx-js for new documents. See [DOCX-JS.md](DOCX-JS.md).

## Editing documents

For simple edits, modify the XML directly.

**For tracked changes**: See [REDLINING.md](REDLINING.md)
**For OOXML details**: See [OOXML.md](OOXML.md)
```

Claude reads REDLINING.md or OOXML.md only when the user needs those features.

**Important guidelines:**

- **Avoid deeply nested references** - Keep references one level deep from SKILL.md. All reference files should link directly from SKILL.md.
- **Structure longer reference files** - For files longer than 100 lines, include a table of contents at the top so Claude can see the full scope when previewing.

## Skill Creation Process

Skill creation involves these steps:

1. Gather expertise (5-phase adaptive process)
2. Initialize the skill (run init_skill.py)
3. Edit the skill (implement resources and write SKILL.md)
4. Validate, test, and package the skill
5. Iterate based on real usage

Follow these steps in order, skipping only if there is a clear reason why they are not applicable.

### Step 1: Gather Expertise (5-Phase Adaptive Process)

This step replaces simple Q&A with intelligent, structured knowledge gathering. Run all applicable phases in order.

#### Phase A: Project Scan (automatic)

Run the project scanner to understand context:

```bash
scripts/analyze_project.py [project-path]
```

Study the output: tech stack, hotspots, architecture, existing skills, documentation. Skip only for fully abstract skills with no project context (rare).

#### Phase B: Knowledge Gap Analysis

Categorize what you know into three buckets:

- **Known**: Claude's training + scan results → skip (don't research what you already know)
- **Research needed**: specific APIs, niche tools, exact configs, version-specific behavior → Phase C
- **User input needed**: business logic, preferences, conventions, team-specific workflows → Phase D

If no research is needed, skip directly to Phase D.

#### Phase C: Targeted Web Research

Follow the guide in `references/expertise-gathering.md`. Key rules:

- Max 5 web searches per skill
- Condense each source to ≤300 words (1/8 compression rule)
- Validate: version matches project? Actionable? Non-obvious?
- Stop when you have enough for the skill's core workflow

#### Phase D: Structured User Interview

Ask ONLY about what couldn't be learned from Phases A-C. Use scenario-based elicitation:

- **Reference findings**: "I see the project uses Next.js 15 + Supabase + DAML. The skill should [assumption] — correct?"
- **Concrete scenarios**: "Describe 2-3 specific tasks this skill should handle"
- **Gap-filling**: Ask about specific unknowns from Phase B, not generic "tell me about your architecture"
- Max 3-5 questions per round, follow-up only if critical

#### Phase E: Knowledge Synthesis

Produce a structured brief (blueprint for skill assembly):

- **Purpose**: 1 sentence describing what the skill does
- **Triggers**: What user requests activate this skill
- **Workflows**: Numbered list of tasks the skill handles
- **Tech context**: Frameworks, APIs, patterns, versions relevant to the skill
- **Resources**: What to include in `scripts/`, `references/`, `assets/`
- **Constraints**: Token budget, compatibility requirements, integration points

This brief becomes the foundation for Steps 2-3.

### Step 2: Initializing the Skill

At this point, it is time to actually create the skill.

Skip this step only if the skill being developed already exists, and iteration or packaging is needed. In this case, continue to the next step.

When creating a new skill from scratch, always run the `init_skill.py` script.

Usage:

```bash
scripts/init_skill.py <skill-name> --path <output-directory> [options]
```

Options:
- `--minimal` — Clean skeleton: only SKILL.md, no example files or resource directories
- `--type <type>` — Pre-built structure for common patterns:
  - `workflow` — Sequential/branching processes
  - `task` — Collection of operations
  - `reference` — Standards, guidelines, specs
  - `capabilities` — Feature-based system

Examples:

```bash
scripts/init_skill.py my-skill --path .claude/skills                    # Full template with guidance
scripts/init_skill.py my-skill --path .claude/skills --minimal          # Clean skeleton
scripts/init_skill.py deploy --path .claude/skills --type workflow      # Workflow structure
```

After initialization, customize or remove the generated SKILL.md and example files as needed.

### Step 3: Edit the Skill

When editing the (newly-generated or existing) skill, remember that the skill is being created for another instance of Claude to use. Include information that would be beneficial and non-obvious to Claude. Consider what procedural knowledge, domain-specific details, or reusable assets would help another Claude instance execute these tasks more effectively.

#### Learn Proven Design Patterns

Consult these helpful guides based on your skill's needs:

- **Multi-step processes**: See references/workflows.md for sequential workflows and conditional logic
- **Specific output formats or quality standards**: See references/output-patterns.md for template and example patterns

These files contain established best practices for effective skill design.

#### Start with Reusable Skill Contents

To begin implementation, start with the reusable resources identified above: `scripts/`, `references/`, and `assets/` files. Note that this step may require user input. For example, when implementing a `brand-guidelines` skill, the user may need to provide brand assets or templates to store in `assets/`, or documentation to store in `references/`.

Added scripts must be tested by actually running them to ensure there are no bugs and that the output matches what is expected. If there are many similar scripts, only a representative sample needs to be tested to ensure confidence that they all work while balancing time to completion.

Any example files and directories not needed for the skill should be deleted. The initialization script creates example files in `scripts/`, `references/`, and `assets/` to demonstrate structure, but most skills won't need all of them.

#### Update SKILL.md

**Writing Guidelines:** Always use imperative/infinitive form.

##### Frontmatter

Write the YAML frontmatter with `name`, `description`, and optionally `version`:

- `name`: The skill name (kebab-case)
- `version`: Semver string (e.g., `1.0.0`). Increment on each iteration to track changes
- `description`: This is the primary triggering mechanism for your skill, and helps Claude understand when to use the skill.
  - Include both what the Skill does and specific triggers/contexts for when to use it.
  - Include all "when to use" information here - Not in the body. The body is only loaded after triggering, so "When to Use This Skill" sections in the body are not helpful to Claude.
  - Run `scripts/suggest_description.py` after writing the body to auto-generate a description based on content analysis.
  - Example description for a `docx` skill: "Comprehensive document creation, editing, and analysis with support for tracked changes, comments, formatting preservation, and text extraction. Use when Claude needs to work with professional documents (.docx files) for: (1) Creating new documents, (2) Modifying or editing content, (3) Working with tracked changes, (4) Adding comments, or any other document tasks"

##### Body

Write instructions for using the skill and its bundled resources.

### Step 4: Validate, Test, Preview, and Package

Before packaging, use the enhanced toolchain to ensure quality:

#### Validate (comprehensive checks)

```bash
scripts/quick_validate.py <path/to/skill-folder>           # Standard validation
scripts/quick_validate.py <path/to/skill-folder> --strict   # Extra checks (trigger keywords, structure)
```

Checks: frontmatter, TODO stubs, broken file references, empty body, 500-line limit, junk files, Python syntax, executable permissions, reference readability.

#### Test (functional verification)

```bash
scripts/test_skill.py <path/to/skill-folder>                # Structural tests
scripts/test_skill.py <path/to/skill-folder> --run-scripts   # Also execute scripts
```

Tests: trigger keywords in description, description quality, body structure, script syntax/execution, reference readability, asset existence, cross-reference integrity.

#### Preview (context cost analysis)

```bash
scripts/preview_skill.py <path/to/skill-folder>
```

Shows: metadata tokens (always loaded), body tokens (on trigger), resource tokens (on demand), total context footprint as % of 200K window.

#### Suggest Description (auto-generate)

```bash
scripts/suggest_description.py <path/to/skill-folder>
```

Analyzes body content (headings, actions, file types) and proposes a description for the frontmatter.

#### Package

```bash
scripts/package_skill.py <path/to/skill-folder> [output-directory]
```

Runs validation automatically, then creates a `.skill` file (zip archive) for distribution.

### Step 5: Iterate

After testing the skill, users may request improvements. Often this happens right after using the skill, with fresh context of how the skill performed.

**Iteration workflow:**

1. Use the skill on real tasks
2. Notice struggles or inefficiencies
3. Identify how SKILL.md or bundled resources should be updated
4. Implement changes and test again
