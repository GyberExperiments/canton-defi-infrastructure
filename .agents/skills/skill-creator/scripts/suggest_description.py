#!/usr/bin/env python3
"""
Description Auto-Suggest - Analyze SKILL.md body and propose a description

Usage:
    python suggest_description.py <skill_directory>
"""

import sys
import re
import yaml
from pathlib import Path


def extract_keywords(text):
    """Extract meaningful keywords from text (headings, bold terms)."""
    # Strip fenced code blocks to avoid noise
    clean = re.sub(r'```.*?```', '', text, flags=re.DOTALL)
    keywords = set()

    skip_headings = {'overview', 'resources', 'quick start', 'examples', 'references',
                     'about', 'introduction', 'getting started', 'structuring this skill',
                     'what to not include in a skill', 'core principles', 'important guidelines'}

    # Section headings (skip generic ones)
    for m in re.finditer(r'^#{1,3}\s+(.+)$', clean, re.MULTILINE):
        heading = m.group(1).strip()
        if heading.lower() not in skip_headings and len(heading) > 3 and len(heading) < 60:
            keywords.add(heading)

    # Bold text (only meaningful terms, not punctuation)
    for m in re.finditer(r'\*\*([^*]+)\*\*', clean):
        term = m.group(1).strip()
        if len(term) > 3 and len(term) < 50 and re.search(r'[a-zA-Z]', term):
            keywords.add(term)

    return keywords


def extract_actions(text):
    """Extract action verbs from the body."""
    clean = re.sub(r'```.*?```', '', text, flags=re.DOTALL)
    actions = set()

    action_verbs = {'create', 'build', 'generate', 'analyze', 'process', 'convert',
                    'extract', 'fill', 'edit', 'modify', 'update', 'delete', 'remove',
                    'deploy', 'test', 'validate', 'check', 'run', 'install', 'configure',
                    'format', 'transform', 'parse', 'merge', 'split', 'rotate', 'resize',
                    'compress', 'optimize', 'search', 'find', 'replace', 'review',
                    'document', 'annotate', 'translate', 'summarize', 'scaffold',
                    'initialize', 'package', 'publish', 'monitor', 'debug'}

    # Imperative verbs at start of list items
    for m in re.finditer(r'^\s*[-*\d+\.]\s+(\w+)', clean, re.MULTILINE):
        word = m.group(1).lower()
        if word in action_verbs:
            actions.add(word)

    return actions


def extract_file_types(text):
    """Find file extensions and formats mentioned."""
    types = set()
    for m in re.finditer(r'\.([a-z]{2,6})\b', text):
        ext = m.group(1).lower()
        if ext in {'pdf', 'docx', 'xlsx', 'pptx', 'csv', 'json', 'yaml', 'yml',
                    'md', 'html', 'css', 'js', 'ts', 'tsx', 'jsx', 'py', 'sh',
                    'sql', 'xml', 'svg', 'png', 'jpg', 'gif', 'mp4', 'mp3',
                    'zip', 'tar', 'gz', 'toml', 'ini', 'env', 'txt', 'log'}:
            types.add(f'.{ext}')
    return types


def suggest_description(skill_path):
    """Analyze SKILL.md and suggest a description."""
    skill_path = Path(skill_path).resolve()
    skill_md = skill_path / 'SKILL.md'

    if not skill_md.exists():
        print("  ❌ SKILL.md not found")
        return None

    content = skill_md.read_text()

    # Parse current state
    match = re.match(r'^---\n(.*?)\n---\n?(.*)', content, re.DOTALL)
    if not match:
        print("  ❌ No valid frontmatter")
        return None

    try:
        fm = yaml.safe_load(match.group(1))
    except yaml.YAMLError:
        print("  ❌ Invalid YAML frontmatter")
        return None

    name = fm.get('name', skill_path.name)
    current_desc = fm.get('description', '')
    body = match.group(2).strip()

    if not body:
        print("  ❌ Body is empty — write instructions first, then run this tool")
        return None

    # Analyze body
    keywords = extract_keywords(body)
    actions = extract_actions(body)
    file_types = extract_file_types(body)

    # Check resources
    has_scripts = (skill_path / 'scripts').exists() and any((skill_path / 'scripts').iterdir())
    has_refs = (skill_path / 'references').exists() and any((skill_path / 'references').iterdir())
    has_assets = (skill_path / 'assets').exists() and any((skill_path / 'assets').iterdir())

    # Build suggestion
    title = ' '.join(w.capitalize() for w in name.split('-'))

    # Core description from keywords
    keyword_list = sorted(keywords, key=len)[:8]
    action_list = sorted(actions)[:5]
    type_list = sorted(file_types)[:5]

    parts = []

    # What it does
    if keyword_list:
        parts.append(f"{title} — provides capabilities for: {', '.join(keyword_list[:4])}")
    else:
        parts.append(f"{title} — specialized skill for {name.replace('-', ' ')} tasks")

    # When to trigger
    triggers = []
    if action_list:
        triggers.append(f"({', '.join(action_list[:3])}) operations")
    if file_types:
        triggers.append(f"working with {', '.join(type_list)} files")

    if triggers:
        parts.append(f"Use when Claude needs to handle {' or '.join(triggers)}")

    # Resources hint
    resource_parts = []
    if has_scripts:
        resource_parts.append("automation scripts")
    if has_refs:
        resource_parts.append("reference documentation")
    if has_assets:
        resource_parts.append("templates/assets")
    if resource_parts:
        parts.append(f"Includes {', '.join(resource_parts)}")

    suggestion = '. '.join(parts) + '.'

    # Ensure under 1024 chars
    if len(suggestion) > 1024:
        suggestion = suggestion[:1020] + '...'

    # Output
    print(f"\n{'=' * 55}")
    print(f"  DESCRIPTION SUGGESTION: {name}")
    print(f"{'=' * 55}")

    if current_desc and 'TODO' not in current_desc:
        print(f"\n  Current description:")
        print(f"  {current_desc[:200]}")

    print(f"\n  Suggested description:")
    print(f"  {suggestion}")

    print(f"\n  Analysis:")
    if keyword_list:
        print(f"    Keywords:   {', '.join(keyword_list)}")
    if action_list:
        print(f"    Actions:    {', '.join(action_list)}")
    if type_list:
        print(f"    File types: {', '.join(type_list)}")
    print(f"    Length:     {len(suggestion)} / 1024 chars")

    print(f"\n  To apply, update the description field in SKILL.md frontmatter.\n")

    return suggestion


def main():
    if len(sys.argv) < 2:
        print("Usage: python suggest_description.py <skill_directory>")
        sys.exit(1)

    result = suggest_description(sys.argv[1])
    sys.exit(0 if result else 1)


if __name__ == "__main__":
    main()
