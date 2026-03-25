#!/usr/bin/env python3
"""
Skill Initializer - Creates a new skill from template

Usage:
    init_skill.py <skill-name> --path <path> [--minimal] [--type workflow|task|reference|capabilities]

Examples:
    init_skill.py my-new-skill --path skills/public
    init_skill.py my-api-helper --path skills/private --minimal
    init_skill.py deploy-tool --path skills/public --type workflow
    init_skill.py code-standards --path skills/public --type reference --minimal
"""

import sys
from pathlib import Path


# ─── Minimal template (clean skeleton, no examples) ─────────────────

SKILL_MINIMAL = """---
name: {skill_name}
version: 0.1.0
description: TODO — describe what the skill does and WHEN to trigger it
---

# {skill_title}

"""

# ─── Type-specific templates ─────────────────────────────────────────

SKILL_WORKFLOW = """---
name: {skill_name}
version: 0.1.0
description: TODO — describe what the skill does and WHEN to trigger it
---

# {skill_title}

## Workflow

1. Determine the task type:
   - **Option A** → Follow "Workflow A" below
   - **Option B** → Follow "Workflow B" below

## Workflow A

1. Step one
2. Step two
3. Step three

## Workflow B

1. Step one
2. Step two
3. Step three

## Resources

- Scripts: See `scripts/` for executable automation
- References: See `references/` for detailed documentation
"""

SKILL_TASK = """---
name: {skill_name}
version: 0.1.0
description: TODO — describe what the skill does and WHEN to trigger it
---

# {skill_title}

## Quick Start

Minimal example to get started:

```
# example command or code
```

## Tasks

### Task 1: [Name]

Steps and instructions.

### Task 2: [Name]

Steps and instructions.

## Resources

- Scripts: See `scripts/` for executable automation
- References: See `references/` for detailed documentation
"""

SKILL_REFERENCE = """---
name: {skill_name}
version: 0.1.0
description: TODO — describe what the skill does and WHEN to trigger it
---

# {skill_title}

## Guidelines

Core rules and standards to follow.

## Specifications

Detailed specifications and requirements.

## Examples

Concrete examples demonstrating correct usage.
"""

SKILL_CAPABILITIES = """---
name: {skill_name}
version: 0.1.0
description: TODO — describe what the skill does and WHEN to trigger it
---

# {skill_title}

## Overview

Brief overview of what this skill provides.

## Core Capabilities

### 1. [Capability Name]

Description and usage instructions.

### 2. [Capability Name]

Description and usage instructions.

### 3. [Capability Name]

Description and usage instructions.
"""

# ─── Full template with guidance (original behavior) ─────────────────

SKILL_FULL = """---
name: {skill_name}
version: 0.1.0
description: TODO — describe what the skill does and WHEN to trigger it. Include specific scenarios, file types, or tasks that trigger it.
---

# {skill_title}

## Overview

Brief explanation of what this skill enables.

## Structuring This Skill

Choose the structure that best fits this skill's purpose:

**1. Workflow-Based** (best for sequential processes)
- Structure: ## Overview → ## Workflow Decision Tree → ## Step 1 → ## Step 2...

**2. Task-Based** (best for tool collections)
- Structure: ## Overview → ## Quick Start → ## Task Category 1 → ## Task Category 2...

**3. Reference/Guidelines** (best for standards or specifications)
- Structure: ## Overview → ## Guidelines → ## Specifications → ## Usage...

**4. Capabilities-Based** (best for integrated systems)
- Structure: ## Overview → ## Core Capabilities → ### 1. Feature → ### 2. Feature...

Delete this section when done — it's just guidance. Or re-run with --type <type> for a pre-built structure.

## Resources

### scripts/
Executable code. See `scripts/example.py` for the placeholder.

### references/
Documentation loaded on demand. See `references/api_reference.md` for the placeholder.

### assets/
Files used in output (templates, images, etc.). See `assets/example_asset.txt` for the placeholder.

Delete any unneeded directories.
"""

TEMPLATES = {
    'workflow': SKILL_WORKFLOW,
    'task': SKILL_TASK,
    'reference': SKILL_REFERENCE,
    'capabilities': SKILL_CAPABILITIES,
}

EXAMPLE_SCRIPT = '''#!/usr/bin/env python3
"""
Example helper script for {skill_name}

Replace with actual implementation or delete if not needed.
"""

def main():
    print("Example script for {skill_name}")

if __name__ == "__main__":
    main()
'''

EXAMPLE_REFERENCE = """# Reference Documentation for {skill_title}

Replace with actual reference content or delete if not needed.

## Structure Suggestions

- API Reference: Overview → Endpoints → Error codes
- Workflow Guide: Prerequisites → Steps → Troubleshooting
"""

EXAMPLE_ASSET = """# Example Asset File

Replace with actual asset files (templates, images, fonts, etc.) or delete if not needed.
"""


def title_case_skill_name(skill_name):
    """Convert hyphenated skill name to Title Case for display."""
    return ' '.join(word.capitalize() for word in skill_name.split('-'))


def init_skill(skill_name, path, minimal=False, skill_type=None):
    """
    Initialize a new skill directory.

    Args:
        skill_name: Name of the skill (kebab-case)
        path: Parent directory where skill folder will be created
        minimal: If True, create only SKILL.md with clean skeleton
        skill_type: One of 'workflow', 'task', 'reference', 'capabilities'

    Returns:
        Path to created skill directory, or None if error
    """
    skill_dir = Path(path).resolve() / skill_name

    if skill_dir.exists():
        print(f"  ❌ Directory already exists: {skill_dir}")
        return None

    try:
        skill_dir.mkdir(parents=True, exist_ok=False)
    except Exception as e:
        print(f"  ❌ Error creating directory: {e}")
        return None

    skill_title = title_case_skill_name(skill_name)
    fmt = {'skill_name': skill_name, 'skill_title': skill_title}

    # Select template
    if minimal:
        template = SKILL_MINIMAL
    elif skill_type and skill_type in TEMPLATES:
        template = TEMPLATES[skill_type]
    else:
        template = SKILL_FULL

    # Write SKILL.md
    skill_md_path = skill_dir / 'SKILL.md'
    try:
        skill_md_path.write_text(template.format(**fmt))
        print(f"  ✅ SKILL.md")
    except Exception as e:
        print(f"  ❌ Error creating SKILL.md: {e}")
        return None

    # Create resource dirs (skip for --minimal)
    if not minimal:
        try:
            scripts_dir = skill_dir / 'scripts'
            scripts_dir.mkdir()
            example_script = scripts_dir / 'example.py'
            example_script.write_text(EXAMPLE_SCRIPT.format(**fmt))
            example_script.chmod(0o755)
            print(f"  ✅ scripts/example.py")

            refs_dir = skill_dir / 'references'
            refs_dir.mkdir()
            example_ref = refs_dir / 'api_reference.md'
            example_ref.write_text(EXAMPLE_REFERENCE.format(**fmt))
            print(f"  ✅ references/api_reference.md")

            assets_dir = skill_dir / 'assets'
            assets_dir.mkdir()
            example_asset = assets_dir / 'example_asset.txt'
            example_asset.write_text(EXAMPLE_ASSET)
            print(f"  ✅ assets/example_asset.txt")
        except Exception as e:
            print(f"  ❌ Error creating resources: {e}")
            return None

    print(f"\n  ✅ Skill '{skill_name}' initialized at {skill_dir}")

    if minimal:
        print("\n  Next steps:")
        print("  1. Write the description in SKILL.md frontmatter")
        print("  2. Add instructions in the body")
        print("  3. Create scripts/, references/, assets/ as needed")
    else:
        print("\n  Next steps:")
        print("  1. Complete the TODO items in SKILL.md")
        print("  2. Replace or delete example files in scripts/, references/, assets/")
        print("  3. Run: python quick_validate.py " + str(skill_dir))

    return skill_dir


def print_usage():
    print("Usage: init_skill.py <skill-name> --path <path> [options]")
    print()
    print("Options:")
    print("  --minimal              Clean skeleton (just SKILL.md, no example files)")
    print("  --type <type>          Pre-built structure:")
    print("    workflow              Sequential/branching processes")
    print("    task                  Collection of operations")
    print("    reference             Standards, guidelines, specs")
    print("    capabilities          Feature-based system")
    print()
    print("Examples:")
    print("  init_skill.py my-skill --path .claude/skills")
    print("  init_skill.py my-skill --path .claude/skills --minimal")
    print("  init_skill.py deploy --path .claude/skills --type workflow")


def main():
    args = sys.argv[1:]

    if not args or '--help' in args or '-h' in args:
        print_usage()
        sys.exit(0 if '--help' in args or '-h' in args else 1)

    # Parse arguments
    skill_name = None
    path = None
    minimal = '--minimal' in args
    skill_type = None

    i = 0
    positional_args = []
    while i < len(args):
        if args[i] == '--path' and i + 1 < len(args):
            path = args[i + 1]
            i += 2
        elif args[i] == '--type' and i + 1 < len(args):
            skill_type = args[i + 1]
            i += 2
        elif args[i] == '--minimal':
            i += 1
        elif not args[i].startswith('--'):
            positional_args.append(args[i])
            i += 1
        else:
            i += 1

    if positional_args:
        skill_name = positional_args[0]

    if not skill_name or not path:
        print("  ❌ Missing required arguments\n")
        print_usage()
        sys.exit(1)

    if skill_type and skill_type not in TEMPLATES:
        print(f"  ❌ Unknown type '{skill_type}'. Valid: {', '.join(TEMPLATES.keys())}")
        sys.exit(1)

    mode = "minimal" if minimal else (f"type={skill_type}" if skill_type else "full")
    print(f"\n  Initializing skill: {skill_name} ({mode})")
    print(f"  Location: {path}\n")

    result = init_skill(skill_name, path, minimal, skill_type)
    sys.exit(0 if result else 1)


if __name__ == "__main__":
    main()
