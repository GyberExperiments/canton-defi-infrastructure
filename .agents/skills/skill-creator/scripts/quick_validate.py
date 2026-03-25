#!/usr/bin/env python3
"""
Skill Validator - Comprehensive validation for skills

Usage:
    python quick_validate.py <skill_directory>
    python quick_validate.py <skill_directory> --strict
"""

import sys
import os
import re
import yaml
from pathlib import Path


JUNK_FILES = {
    'README.md', 'INSTALLATION_GUIDE.md', 'QUICK_REFERENCE.md',
    'CHANGELOG.md', 'CONTRIBUTING.md', '.DS_Store', 'Thumbs.db',
    '.gitignore', '.npmignore', 'package.json', 'node_modules',
    '__pycache__', '.pytest_cache',
}

MAX_BODY_LINES = 500
ALLOWED_PROPERTIES = {'name', 'description', 'version', 'license', 'allowed-tools', 'metadata', 'compatibility'}


def parse_frontmatter(content):
    """Extract and parse YAML frontmatter from SKILL.md content."""
    if not content.startswith('---'):
        return None, "No YAML frontmatter found"

    match = re.match(r'^---\n(.*?)\n---', content, re.DOTALL)
    if not match:
        return None, "Invalid frontmatter format"

    try:
        frontmatter = yaml.safe_load(match.group(1))
        if not isinstance(frontmatter, dict):
            return None, "Frontmatter must be a YAML dictionary"
        return frontmatter, None
    except yaml.YAMLError as e:
        return None, f"Invalid YAML in frontmatter: {e}"


def get_body(content):
    """Extract body text after frontmatter."""
    match = re.match(r'^---\n.*?\n---\n?(.*)', content, re.DOTALL)
    return match.group(1).strip() if match else ""


def strip_code_blocks(text):
    """Remove fenced code blocks (``` ... ```) from text to avoid false positives."""
    return re.sub(r'```.*?```', '', text, flags=re.DOTALL)


def extract_file_references(body):
    """Find file paths in markdown links (outside code blocks).
    Only checks [text](path) links — not inline backtick mentions,
    which are often used as examples in documentation."""
    clean = strip_code_blocks(body)
    refs = set()
    # Markdown links: [text](path) — these are actionable references
    for m in re.finditer(r'\[.*?\]\(([^)]+)\)', clean):
        path = m.group(1)
        if not path.startswith(('http://', 'https://', '#', 'mailto:')):
            refs.add(path)
    return refs


def validate_skill(skill_path, strict=False):
    """
    Validate a skill directory. Returns (valid, message) for backward compat.
    For detailed results, use validate_skill_detailed().
    """
    results = validate_skill_detailed(skill_path, strict)
    errors = [r for r in results if r['level'] == 'error']
    if errors:
        return False, "; ".join(r['message'] for r in errors)
    return True, "Skill is valid!"


def validate_skill_detailed(skill_path, strict=False):
    """
    Comprehensive skill validation. Returns list of issues:
    [{'level': 'error'|'warning', 'check': str, 'message': str}]
    """
    issues = []
    skill_path = Path(skill_path)

    def error(check, msg):
        issues.append({'level': 'error', 'check': check, 'message': msg})

    def warn(check, msg):
        issues.append({'level': 'warning', 'check': check, 'message': msg})

    # --- Check SKILL.md exists ---
    skill_md = skill_path / 'SKILL.md'
    if not skill_md.exists():
        error('structure', "SKILL.md not found")
        return issues

    content = skill_md.read_text()

    # --- Frontmatter validation ---
    frontmatter, fm_err = parse_frontmatter(content)
    if fm_err:
        error('frontmatter', fm_err)
        return issues

    unexpected_keys = set(frontmatter.keys()) - ALLOWED_PROPERTIES
    if unexpected_keys:
        error('frontmatter', f"Unexpected key(s): {', '.join(sorted(unexpected_keys))}. "
              f"Allowed: {', '.join(sorted(ALLOWED_PROPERTIES))}")

    # Required fields
    if 'name' not in frontmatter:
        error('frontmatter', "Missing 'name'")
    if 'description' not in frontmatter:
        error('frontmatter', "Missing 'description'")

    # Name validation
    name = frontmatter.get('name', '')
    if not isinstance(name, str):
        error('name', f"Name must be a string, got {type(name).__name__}")
    else:
        name = name.strip()
        if name:
            if not re.match(r'^[a-z0-9-]+$', name):
                error('name', f"'{name}' should be kebab-case (lowercase, digits, hyphens)")
            if name.startswith('-') or name.endswith('-') or '--' in name:
                error('name', f"'{name}' cannot start/end with hyphen or contain consecutive hyphens")
            if len(name) > 64:
                error('name', f"Name too long ({len(name)} chars, max 64)")
            # Check name matches directory name
            if name != skill_path.name:
                warn('name', f"Name '{name}' doesn't match directory name '{skill_path.name}'")

    # Description validation
    description = frontmatter.get('description', '')
    if not isinstance(description, str):
        error('description', f"Description must be a string, got {type(description).__name__}")
    else:
        description = description.strip()
        if not description:
            error('description', "Description is empty")
        else:
            if '<' in description or '>' in description:
                error('description', "Description cannot contain angle brackets")
            if len(description) > 1024:
                error('description', f"Description too long ({len(description)} chars, max 1024)")
            if len(description) < 30:
                warn('description', f"Description very short ({len(description)} chars). Add more detail for better triggering")
            if '[TODO' in description or 'TODO' in description:
                error('description', "Description contains TODO placeholder — must be completed")

    # Version validation (optional)
    version = frontmatter.get('version')
    if version is not None:
        v = str(version).strip()
        if not re.match(r'^\d+\.\d+(\.\d+)?$', v):
            warn('version', f"Version '{v}' doesn't follow semver (expected X.Y or X.Y.Z)")

    # Compatibility validation
    compatibility = frontmatter.get('compatibility', '')
    if compatibility:
        if not isinstance(compatibility, str):
            error('compatibility', f"Compatibility must be a string, got {type(compatibility).__name__}")
        elif len(compatibility) > 500:
            error('compatibility', f"Compatibility too long ({len(compatibility)} chars, max 500)")

    # --- Body validation ---
    body = get_body(content)

    if not body:
        error('body', "SKILL.md body is empty — no instructions for Claude")

    if body:
        body_lines = body.split('\n')

        # Check line count
        if len(body_lines) > MAX_BODY_LINES:
            warn('body', f"Body has {len(body_lines)} lines (recommended max {MAX_BODY_LINES}). "
                 "Consider splitting into reference files")

        # Check for forgotten TODO stubs
        todo_matches = re.findall(r'\[TODO:.*?\]', body)
        if todo_matches:
            error('body', f"Found {len(todo_matches)} unresolved [TODO:] placeholder(s): {todo_matches[0]}")

        # Check for broken file references
        file_refs = extract_file_references(body)
        for ref in file_refs:
            ref_path = skill_path / ref
            if not ref_path.exists():
                error('references', f"Referenced file not found: {ref}")

    # --- Junk files check ---
    for item in skill_path.rglob('*'):
        rel = item.relative_to(skill_path)
        if item.name in JUNK_FILES or str(rel.parts[0]) in JUNK_FILES:
            warn('junk', f"Unnecessary file: {rel} — skills should only contain essential files")

    # --- Scripts validation ---
    scripts_dir = skill_path / 'scripts'
    if scripts_dir.exists():
        py_scripts = list(scripts_dir.glob('*.py'))
        sh_scripts = list(scripts_dir.glob('*.sh'))
        for script in py_scripts + sh_scripts:
            # Check syntax for Python scripts
            if script.suffix == '.py':
                try:
                    compile(script.read_text(), str(script), 'exec')
                except SyntaxError as e:
                    error('scripts', f"Syntax error in {script.name}: line {e.lineno}: {e.msg}")
            # Check executable permission
            if not os.access(script, os.X_OK):
                warn('scripts', f"{script.name} is not executable (chmod +x)")

    # --- References validation ---
    refs_dir = skill_path / 'references'
    if refs_dir.exists():
        for ref_file in refs_dir.rglob('*'):
            if ref_file.is_file():
                try:
                    ref_file.read_text()
                except Exception as e:
                    error('references', f"Cannot read {ref_file.relative_to(skill_path)}: {e}")

    # --- Strict mode: extra checks ---
    if strict:
        if not description or 'when' not in description.lower():
            warn('description', "Description should explain WHEN to trigger (include use-case scenarios)")
        if body and '## ' not in body:
            warn('body', "Body has no markdown sections (## headers) — consider structuring with headings")

    return issues


def main():
    if len(sys.argv) < 2:
        print("Usage: python quick_validate.py <skill_directory> [--strict]")
        sys.exit(1)

    skill_path = sys.argv[1]
    strict = '--strict' in sys.argv

    print(f"{'=' * 50}")
    print(f"  Validating: {Path(skill_path).name}")
    print(f"{'=' * 50}\n")

    results = validate_skill_detailed(skill_path, strict)

    errors = [r for r in results if r['level'] == 'error']
    warnings = [r for r in results if r['level'] == 'warning']

    if not errors and not warnings:
        print("  ✅ Skill is valid!\n")
        sys.exit(0)

    if warnings:
        print(f"  ⚠️  {len(warnings)} warning(s):\n")
        for w in warnings:
            print(f"    [{w['check']}] {w['message']}")
        print()

    if errors:
        print(f"  ❌ {len(errors)} error(s):\n")
        for e in errors:
            print(f"    [{e['check']}] {e['message']}")
        print()
        sys.exit(1)
    else:
        print("  ✅ Skill is valid (with warnings)\n")
        sys.exit(0)


if __name__ == "__main__":
    main()
