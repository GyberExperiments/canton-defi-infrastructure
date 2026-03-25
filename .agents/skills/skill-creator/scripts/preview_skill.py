#!/usr/bin/env python3
"""
Skill Preview - Show how Claude sees a skill with token estimates

Usage:
    python preview_skill.py <skill_directory>
"""

import sys
import re
from pathlib import Path


def estimate_tokens(text):
    """Rough token estimate: ~4 chars per token for English, ~2-3 for code/mixed."""
    if not text:
        return 0
    # Heuristic: split by whitespace and punctuation
    words = len(text.split())
    chars = len(text)
    # Approximate: avg 1.3 tokens per word for mixed content
    return max(words, chars // 4)


def format_size(chars):
    """Format character count as human-readable size."""
    if chars < 1024:
        return f"{chars} chars"
    return f"{chars / 1024:.1f}K chars"


def preview_skill(skill_path):
    skill_path = Path(skill_path).resolve()

    skill_md = skill_path / 'SKILL.md'
    if not skill_md.exists():
        print(f"  ❌ SKILL.md not found in {skill_path}")
        return

    content = skill_md.read_text()

    # Parse frontmatter
    match = re.match(r'^---\n(.*?)\n---', content, re.DOTALL)
    if not match:
        print("  ❌ No valid frontmatter found")
        return

    frontmatter_text = match.group(1)
    body_match = re.match(r'^---\n.*?\n---\n?(.*)', content, re.DOTALL)
    body = body_match.group(1).strip() if body_match else ""

    # Extract name and description from frontmatter
    name_match = re.search(r'^name:\s*(.+)$', frontmatter_text, re.MULTILINE)
    desc_match = re.search(r'^description:\s*(.+)$', frontmatter_text, re.MULTILINE | re.DOTALL)
    name = name_match.group(1).strip() if name_match else "?"
    # Handle multiline description
    desc_lines = []
    in_desc = False
    for line in frontmatter_text.split('\n'):
        if line.startswith('description:'):
            desc_lines.append(line.split('description:', 1)[1].strip().strip('"').strip("'"))
            in_desc = True
        elif in_desc and (line.startswith('  ') or line.startswith('\t')):
            desc_lines.append(line.strip())
        else:
            in_desc = False
    description = ' '.join(desc_lines).strip()

    metadata_text = f"name: {name}\ndescription: {description}"

    # Collect resources
    scripts = []
    references = []
    assets = []

    scripts_dir = skill_path / 'scripts'
    refs_dir = skill_path / 'references'
    assets_dir = skill_path / 'assets'

    if scripts_dir.exists():
        for f in sorted(scripts_dir.rglob('*')):
            if f.is_file():
                scripts.append((f.relative_to(skill_path), f.stat().st_size))

    if refs_dir.exists():
        for f in sorted(refs_dir.rglob('*')):
            if f.is_file():
                references.append((f.relative_to(skill_path), f.stat().st_size))

    if assets_dir.exists():
        for f in sorted(assets_dir.rglob('*')):
            if f.is_file():
                assets.append((f.relative_to(skill_path), f.stat().st_size))

    # Calculate tokens
    metadata_tokens = estimate_tokens(metadata_text)
    body_tokens = estimate_tokens(body)
    body_lines = len(body.split('\n')) if body else 0

    ref_tokens_total = 0
    for ref_path, size in references:
        try:
            ref_content = (skill_path / ref_path).read_text()
            ref_tokens_total += estimate_tokens(ref_content)
        except Exception:
            pass

    # --- Output ---
    print(f"\n{'=' * 55}")
    print(f"  SKILL PREVIEW: {name}")
    print(f"{'=' * 55}")

    # Level 1: Metadata (always loaded)
    print(f"\n  📋 Level 1: METADATA (always in context)")
    print(f"  {'─' * 45}")
    print(f"  Name:        {name}")
    if len(description) > 120:
        print(f"  Description: {description[:120]}...")
    else:
        print(f"  Description: {description}")
    print(f"  Tokens:      ~{metadata_tokens}")

    # Level 2: Body (loaded on trigger)
    print(f"\n  📖 Level 2: BODY (loaded when skill triggers)")
    print(f"  {'─' * 45}")
    print(f"  Lines:       {body_lines} / {500} max")
    print(f"  Size:        {format_size(len(body))}")
    print(f"  Tokens:      ~{body_tokens}")
    if body:
        # Show section headers
        headers = re.findall(r'^(#{1,3}\s+.+)$', body, re.MULTILINE)
        if headers:
            print(f"  Sections:")
            for h in headers[:15]:
                print(f"    {h}")
            if len(headers) > 15:
                print(f"    ... and {len(headers) - 15} more")

    # Level 3: Resources (loaded on demand)
    print(f"\n  📦 Level 3: RESOURCES (loaded on demand)")
    print(f"  {'─' * 45}")

    if scripts:
        print(f"\n  Scripts ({len(scripts)}):")
        for path, size in scripts:
            print(f"    {path} ({format_size(size)})")

    if references:
        print(f"\n  References ({len(references)}):")
        for path, size in references:
            tokens = estimate_tokens((skill_path / path).read_text()) if size > 0 else 0
            print(f"    {path} ({format_size(size)}, ~{tokens} tokens)")

    if assets:
        print(f"\n  Assets ({len(assets)}):")
        for path, size in assets:
            print(f"    {path} ({format_size(size)})")

    if not scripts and not references and not assets:
        print(f"  (none)")

    # Summary
    total_potential = metadata_tokens + body_tokens + ref_tokens_total
    print(f"\n  {'─' * 45}")
    print(f"  TOTAL CONTEXT COST:")
    print(f"    Always loaded:     ~{metadata_tokens} tokens (metadata)")
    print(f"    On trigger:        ~{metadata_tokens + body_tokens} tokens (+ body)")
    print(f"    Max potential:     ~{total_potential} tokens (+ all refs)")
    print(f"    Context budget:    ~200K tokens")
    print(f"    Skill footprint:   {total_potential / 2000:.1f}% of context")
    print()


def main():
    if len(sys.argv) < 2:
        print("Usage: python preview_skill.py <skill_directory>")
        sys.exit(1)

    preview_skill(sys.argv[1])


if __name__ == "__main__":
    main()
