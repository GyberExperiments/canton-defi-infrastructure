#!/usr/bin/env python3
"""
Skill Tester - Run functional tests on a skill

Usage:
    python test_skill.py <skill_directory>
    python test_skill.py <skill_directory> --run-scripts
"""

import sys
import os
import re
import subprocess
import yaml
from pathlib import Path


def parse_skill(skill_path):
    """Parse SKILL.md and return (frontmatter, body) or (None, error)."""
    skill_md = Path(skill_path) / 'SKILL.md'
    if not skill_md.exists():
        return None, None, "SKILL.md not found"

    content = skill_md.read_text()
    match = re.match(r'^---\n(.*?)\n---\n?(.*)', content, re.DOTALL)
    if not match:
        return None, None, "Invalid frontmatter"

    try:
        fm = yaml.safe_load(match.group(1))
    except yaml.YAMLError as e:
        return None, None, f"YAML error: {e}"

    return fm, match.group(2).strip(), None


def test_skill(skill_path, run_scripts=False):
    """
    Run tests on a skill. Returns list of test results:
    [{'name': str, 'passed': bool, 'message': str}]
    """
    results = []
    skill_path = Path(skill_path).resolve()

    def ok(name, msg=""):
        results.append({'name': name, 'passed': True, 'message': msg})

    def fail(name, msg):
        results.append({'name': name, 'passed': False, 'message': msg})

    # --- Test 1: Parse skill ---
    fm, body, err = parse_skill(skill_path)
    if err:
        fail("parse", err)
        return results
    ok("parse", "SKILL.md parsed successfully")

    # --- Test 2: Trigger keywords in description ---
    description = fm.get('description', '')
    name = fm.get('name', '')

    trigger_indicators = ['use when', 'use this', 'trigger', 'for:', 'when claude',
                          'when the user', 'should be used']
    has_trigger = any(t in description.lower() for t in trigger_indicators)
    if has_trigger:
        ok("trigger-keywords", "Description contains trigger context")
    else:
        fail("trigger-keywords",
             "Description lacks trigger keywords (e.g. 'Use when...', 'for:'). "
             "Claude may not know when to activate this skill")

    # --- Test 3: Description specificity ---
    desc_words = len(description.split())
    if desc_words >= 10:
        ok("description-quality", f"Description has {desc_words} words")
    else:
        fail("description-quality", f"Description only {desc_words} words — too vague for reliable triggering")

    # --- Test 4: Body has actionable content ---
    if not body:
        fail("body-content", "Body is empty")
    else:
        # Check for code blocks, lists, or structured content
        has_code = '```' in body
        has_list = re.search(r'^\s*[-*\d+\.]\s', body, re.MULTILINE) is not None
        has_headers = '## ' in body

        if has_headers:
            ok("body-structure", "Body has section headers")
        else:
            fail("body-structure", "Body lacks section headers (## )")

        if has_code or has_list:
            ok("body-actionable", "Body contains code blocks or lists")
        else:
            fail("body-actionable", "Body lacks code blocks and lists — may be too abstract")

    # --- Test 5: Scripts syntax and execution ---
    scripts_dir = skill_path / 'scripts'
    if scripts_dir.exists():
        py_scripts = list(scripts_dir.glob('*.py'))
        sh_scripts = list(scripts_dir.glob('*.sh'))
        all_scripts = py_scripts + sh_scripts

        if not all_scripts:
            ok("scripts", "No scripts to test")
        else:
            for script in py_scripts:
                # Syntax check
                try:
                    compile(script.read_text(), str(script), 'exec')
                    ok(f"syntax:{script.name}", "Python syntax OK")
                except SyntaxError as e:
                    fail(f"syntax:{script.name}", f"Line {e.lineno}: {e.msg}")

                # Execution check (only with --run-scripts)
                if run_scripts:
                    try:
                        result = subprocess.run(
                            [sys.executable, str(script), '--help'],
                            capture_output=True, text=True, timeout=10,
                            cwd=str(scripts_dir)
                        )
                        # Accept both 0 and non-zero (--help may not be supported)
                        ok(f"run:{script.name}", f"Executed (exit code {result.returncode})")
                    except subprocess.TimeoutExpired:
                        fail(f"run:{script.name}", "Timed out after 10s")
                    except Exception as e:
                        fail(f"run:{script.name}", str(e))

            for script in sh_scripts:
                # Check bash syntax
                try:
                    result = subprocess.run(
                        ['bash', '-n', str(script)],
                        capture_output=True, text=True, timeout=5
                    )
                    if result.returncode == 0:
                        ok(f"syntax:{script.name}", "Bash syntax OK")
                    else:
                        fail(f"syntax:{script.name}", result.stderr.strip())
                except Exception as e:
                    fail(f"syntax:{script.name}", str(e))
    else:
        ok("scripts", "No scripts directory")

    # --- Test 6: References readability ---
    refs_dir = skill_path / 'references'
    if refs_dir.exists():
        for ref_file in refs_dir.rglob('*'):
            if ref_file.is_file():
                try:
                    content = ref_file.read_text()
                    rel = ref_file.relative_to(skill_path)
                    if len(content.strip()) == 0:
                        fail(f"ref:{rel}", "File is empty")
                    elif len(content) > 50000:
                        fail(f"ref:{rel}", f"Very large ({len(content)} chars). "
                             "Consider splitting or adding grep patterns in SKILL.md")
                    else:
                        ok(f"ref:{rel}", f"{len(content)} chars")
                except UnicodeDecodeError:
                    fail(f"ref:{ref_file.name}", "Not readable as text")
                except Exception as e:
                    fail(f"ref:{ref_file.name}", str(e))

    # --- Test 7: Assets exist and are non-empty ---
    assets_dir = skill_path / 'assets'
    if assets_dir.exists():
        for asset in assets_dir.rglob('*'):
            if asset.is_file():
                rel = asset.relative_to(skill_path)
                size = asset.stat().st_size
                if size == 0:
                    fail(f"asset:{rel}", "Empty file")
                else:
                    ok(f"asset:{rel}", f"{size} bytes")

    # --- Test 8: Cross-reference integrity ---
    if body:
        # Strip fenced code blocks to avoid matching example paths
        clean_body = re.sub(r'```.*?```', '', body, flags=re.DOTALL)
        # Only check markdown links [text](path) — inline backtick mentions
        # are often used as examples in documentation
        refs_in_body = set()
        for m in re.finditer(r'\[.*?\]\(([^)]+)\)', clean_body):
            path = m.group(1)
            if not path.startswith(('http://', 'https://', '#', 'mailto:')):
                refs_in_body.add(path)

        for ref in refs_in_body:
            ref_path = skill_path / ref
            if ref_path.exists():
                ok(f"xref:{ref}", "File exists")
            else:
                fail(f"xref:{ref}", "Referenced but file not found")

    return results


def main():
    if len(sys.argv) < 2:
        print("Usage: python test_skill.py <skill_directory> [--run-scripts]")
        sys.exit(1)

    skill_path = sys.argv[1]
    run_scripts = '--run-scripts' in sys.argv

    print(f"\n{'=' * 55}")
    print(f"  TESTING: {Path(skill_path).name}")
    print(f"{'=' * 55}\n")

    results = test_skill(skill_path, run_scripts)

    passed = [r for r in results if r['passed']]
    failed = [r for r in results if not r['passed']]

    for r in results:
        icon = "✅" if r['passed'] else "❌"
        msg = f" — {r['message']}" if r['message'] else ""
        print(f"  {icon} {r['name']}{msg}")

    print(f"\n  {'─' * 45}")
    print(f"  Results: {len(passed)} passed, {len(failed)} failed, {len(results)} total")

    if failed:
        print(f"\n  ❌ {len(failed)} test(s) failed\n")
        sys.exit(1)
    else:
        print(f"\n  ✅ All tests passed!\n")
        sys.exit(0)


if __name__ == "__main__":
    main()
