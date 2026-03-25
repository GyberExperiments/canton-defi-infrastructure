#!/usr/bin/env python3
"""Intelligent project scanner for skill creation.

Analyzes project structure, tech stack, git hotspots, architecture patterns,
and existing skills. Outputs structured JSON for informed skill development.

Usage:
    scripts/analyze_project.py [path]            # Full JSON output
    scripts/analyze_project.py [path] --summary  # Summary string only
"""

import json
import os
import re
import subprocess
import sys
from collections import Counter
from pathlib import Path

SKIP_DIRS = {
    "node_modules", ".git", "venv", ".venv", "__pycache__", ".next",
    "dist", "build", ".cache", ".tox", "target", ".mypy_cache",
    ".pytest_cache", "coverage", ".turbo", ".vercel", ".output",
    "vendor", "bower_components", ".gradle", ".idea", ".vscode",
}

MANIFEST_MAP = {
    "package.json": "javascript/typescript",
    "Cargo.toml": "rust",
    "go.mod": "go",
    "requirements.txt": "python",
    "pyproject.toml": "python",
    "setup.py": "python",
    "Gemfile": "ruby",
    "pom.xml": "java",
    "build.gradle": "java/kotlin",
    "build.gradle.kts": "kotlin",
    "composer.json": "php",
    "mix.exs": "elixir",
    "Package.swift": "swift",
    "daml.yaml": "daml",
    "pubspec.yaml": "dart/flutter",
    "Makefile": "make",
    "CMakeLists.txt": "c/cpp",
}

CONFIG_MAP = {
    "tsconfig.json": "typescript",
    "tsconfig.*.json": "typescript",
    "next.config.*": "next.js",
    "vite.config.*": "vite",
    "webpack.config.*": "webpack",
    ".eslintrc*": "eslint",
    "eslint.config.*": "eslint",
    ".prettierrc*": "prettier",
    "tailwind.config.*": "tailwind",
    "postcss.config.*": "postcss",
    "docker-compose*": "docker",
    "Dockerfile*": "docker",
    ".dockerignore": "docker",
    "jest.config.*": "jest",
    "vitest.config.*": "vitest",
    "playwright.config.*": "playwright",
    ".github/workflows/*": "github-actions",
    "CLAUDE.md": "claude-code",
    ".cursorrules": "cursor",
    "daml.yaml": "daml",
    "kubernetes.yml": "kubernetes",
    "k8s/": "kubernetes",
}

ARCHITECTURE_PATTERNS = {
    "Next.js App Router": ["src/app/page", "src/app/layout", "app/page", "app/layout"],
    "Next.js Pages Router": ["pages/_app", "pages/index", "src/pages/_app"],
    "React SPA": ["src/App.tsx", "src/App.jsx", "src/index.tsx"],
    "Express/Node API": ["src/routes/", "src/controllers/", "src/middleware/"],
    "Django": ["manage.py", "settings.py", "urls.py"],
    "FastAPI": ["main.py", "routers/", "app/api/"],
    "Monorepo": ["packages/", "apps/", "lerna.json", "pnpm-workspace.yaml", "turbo.json"],
    "MVC": ["controllers/", "models/", "views/"],
    "DDD": ["domain/", "application/", "infrastructure/"],
    "Microservices": ["services/", "docker-compose"],
}


def run_cmd(cmd, cwd=None, timeout=15):
    """Run shell command and return stdout or empty string on failure."""
    try:
        result = subprocess.run(
            cmd, capture_output=True, text=True, cwd=cwd, timeout=timeout
        )
        return result.stdout.strip()
    except (subprocess.TimeoutExpired, FileNotFoundError, OSError):
        return ""


def detect_tech_stack(root):
    """Detect languages, frameworks, and dependencies from manifest files."""
    stack = {"languages": set(), "frameworks": [], "dependencies": {}, "manifests": []}

    for manifest, lang in MANIFEST_MAP.items():
        path = root / manifest
        if path.exists():
            stack["languages"].add(lang)
            stack["manifests"].append(manifest)

            if manifest == "package.json":
                _parse_package_json(path, stack)
            elif manifest == "Cargo.toml":
                _parse_cargo_toml(path, stack)
            elif manifest == "daml.yaml":
                _parse_daml_yaml(path, stack)

    stack["languages"] = sorted(stack["languages"])
    return stack


def _parse_package_json(path, stack):
    """Extract frameworks and key deps from package.json."""
    try:
        data = json.loads(path.read_text())
    except (json.JSONDecodeError, OSError):
        return

    all_deps = {}
    for key in ("dependencies", "devDependencies"):
        all_deps.update(data.get(key, {}))

    framework_indicators = {
        "next": "Next.js", "react": "React", "vue": "Vue.js",
        "svelte": "Svelte", "angular": "Angular", "express": "Express",
        "fastify": "Fastify", "nuxt": "Nuxt.js", "remix": "Remix",
        "astro": "Astro", "gatsby": "Gatsby",
    }
    for pkg, fw in framework_indicators.items():
        if pkg in all_deps:
            stack["frameworks"].append(fw)
            version = all_deps[pkg].lstrip("^~>=<")
            stack["dependencies"][fw] = version

    # Detect TypeScript
    if "typescript" in all_deps:
        stack["languages"].add("typescript")
        if "javascript/typescript" in stack["languages"]:
            stack["languages"].discard("javascript/typescript")

    # Notable deps
    notable = ["tailwindcss", "prisma", "drizzle-orm", "supabase",
               "@supabase/supabase-js", "trpc", "graphql", "socket.io"]
    for dep in notable:
        if dep in all_deps:
            stack["dependencies"][dep] = all_deps[dep].lstrip("^~>=<")


def _parse_cargo_toml(path, stack):
    """Extract key info from Cargo.toml."""
    try:
        content = path.read_text()
    except OSError:
        return
    for match in re.finditer(r'^(axum|tokio|actix-web|rocket|tonic|warp)\s*=', content, re.MULTILINE):
        fw = match.group(1)
        stack["frameworks"].append(fw)


def _parse_daml_yaml(path, stack):
    """Extract DAML SDK version."""
    try:
        content = path.read_text()
        match = re.search(r'sdk-version:\s*(.+)', content)
        if match:
            stack["dependencies"]["daml-sdk"] = match.group(1).strip()
    except OSError:
        pass


def scan_structure(root, max_depth=3):
    """Scan directory tree up to max_depth, skipping ignored dirs."""
    notable_dirs = []
    file_count = 0
    ext_counter = Counter()

    def _walk(path, depth):
        nonlocal file_count
        if depth > max_depth:
            return
        try:
            entries = sorted(path.iterdir())
        except PermissionError:
            return

        for entry in entries:
            if entry.name.startswith(".") and entry.name not in (".github",):
                if entry.is_dir():
                    continue
            if entry.is_dir():
                if entry.name in SKIP_DIRS:
                    continue
                rel = str(entry.relative_to(root))
                notable_dirs.append(rel)
                _walk(entry, depth + 1)
            else:
                file_count += 1
                ext = entry.suffix.lower()
                if ext:
                    ext_counter[ext] += 1

    _walk(root, 0)

    top_extensions = dict(ext_counter.most_common(10))
    return {
        "notable_dirs": notable_dirs[:50],
        "file_count": file_count,
        "top_extensions": top_extensions,
    }


def find_config_and_docs(root):
    """Find config files and documentation."""
    configs = []
    docs = []

    # Walk root level for configs
    for item in root.iterdir():
        name = item.name
        if item.is_file():
            for pattern, config_type in CONFIG_MAP.items():
                if pattern.endswith("*"):
                    if name.startswith(pattern.rstrip("*")):
                        configs.append({"name": name, "type": config_type})
                        break
                elif name == pattern:
                    configs.append({"name": name, "type": config_type})
                    break

    # Check for k8s/ dir
    if (root / "k8s").is_dir():
        configs.append({"name": "k8s/", "type": "kubernetes"})

    # Check .github/workflows
    workflows_dir = root / ".github" / "workflows"
    if workflows_dir.is_dir():
        configs.append({"name": ".github/workflows/", "type": "github-actions"})

    # Documentation
    doc_patterns = ["README.md", "README.rst", "CLAUDE.md", "CONTRIBUTING.md",
                    "ARCHITECTURE.md", "CHANGELOG.md", "docs/"]
    for pattern in doc_patterns:
        path = root / pattern
        if path.exists():
            if path.is_file():
                try:
                    size = path.stat().st_size
                    heading = _extract_heading(path)
                except OSError:
                    size = 0
                    heading = ""
                docs.append({"file": pattern, "heading": heading, "size": size})
            elif path.is_dir():
                doc_files = list(path.rglob("*.md"))[:10]
                docs.append({
                    "file": pattern,
                    "heading": f"{len(doc_files)} markdown files",
                    "size": sum(f.stat().st_size for f in doc_files),
                })

    return {"config_files": configs, "documentation": docs}


def _extract_heading(path):
    """Extract first heading from a markdown file."""
    try:
        with open(path, "r", errors="ignore") as f:
            for line in f:
                line = line.strip()
                if line.startswith("# "):
                    return line[2:].strip()
        return ""
    except OSError:
        return ""


def detect_architecture(root, structure):
    """Detect architectural patterns from directory structure."""
    patterns = []
    notable = set(structure.get("notable_dirs", []))

    for style, indicators in ARCHITECTURE_PATTERNS.items():
        matches = 0
        for indicator in indicators:
            check_path = root / indicator
            if check_path.exists() or indicator.rstrip("/") in notable:
                matches += 1
        if matches >= 1:
            patterns.append(style)

    # Detect API routes pattern
    api_dirs = [d for d in notable if "api" in d.lower() and ("route" in d.lower() or "app/api" in d)]
    if api_dirs:
        patterns.append("API routes")

    # Detect server components (Next.js 13+)
    if "Next.js App Router" in patterns:
        patterns.append("Server components")

    style = patterns[0] if patterns else "Unknown"
    return {"style": style, "patterns": list(set(patterns))}


def analyze_hotspots(root, top_n=20):
    """Find most frequently changed files using git log."""
    # Check if git repo
    if not (root / ".git").exists():
        return []

    # Get file change frequency from last 6 months
    output = run_cmd(
        ["git", "log", "--since=6 months ago", "--name-only",
         "--pretty=format:", "--diff-filter=AMRC"],
        cwd=root, timeout=30,
    )
    if not output:
        return []

    counter = Counter()
    for line in output.splitlines():
        line = line.strip()
        if line and not line.startswith("."):
            counter[line] += 1

    hotspots = []
    for filepath, changes in counter.most_common(top_n):
        full_path = root / filepath
        last_modified = ""
        if full_path.exists():
            log_out = run_cmd(
                ["git", "log", "-1", "--format=%ci", "--", filepath],
                cwd=root,
            )
            if log_out:
                last_modified = log_out[:10]

        hotspots.append({
            "file": filepath,
            "changes": changes,
            "last_modified": last_modified,
        })

    return hotspots


def find_existing_skills(root):
    """Find existing skills in .claude/skills/ and .agents/skills/."""
    skills = []
    skill_dirs = [
        root / ".claude" / "skills",
        root / ".agents" / "skills",
    ]

    for skill_base in skill_dirs:
        if not skill_base.is_dir():
            continue
        for entry in skill_base.iterdir():
            if not entry.is_dir():
                continue
            skill_md = entry / "SKILL.md"
            if skill_md.exists():
                info = {"name": entry.name, "path": str(entry.relative_to(root))}
                try:
                    content = skill_md.read_text()
                    desc_match = re.search(r'^description:\s*(.+?)$', content, re.MULTILINE)
                    if desc_match:
                        desc = desc_match.group(1).strip().strip('"').strip("'")
                        info["description"] = desc[:200]
                except OSError:
                    pass
                skills.append(info)

    return skills


def generate_summary(tech_stack, structure, architecture, hotspots, docs_info):
    """Generate 3-5 sentence project summary."""
    parts = []

    # Tech identity
    langs = tech_stack.get("languages", [])
    frameworks = tech_stack.get("frameworks", [])
    if frameworks:
        parts.append(f"{'/'.join(frameworks[:3])} project")
    elif langs:
        parts.append(f"{'/'.join(langs[:2])} project")
    else:
        parts.append("Software project")

    # Architecture
    arch_style = architecture.get("style", "")
    if arch_style and arch_style != "Unknown":
        parts[0] += f" ({arch_style})"

    # Scale
    fc = structure.get("file_count", 0)
    dirs = len(structure.get("notable_dirs", []))
    parts.append(f"{fc} files across {dirs} directories")

    # Documentation
    doc_list = docs_info.get("documentation", [])
    if doc_list:
        doc_names = [d["file"] for d in doc_list[:3]]
        parts.append(f"documented in {', '.join(doc_names)}")

    # Activity
    if hotspots:
        top = hotspots[0]
        parts.append(f"most active file: {top['file']} ({top['changes']} changes)")

    return ". ".join(parts) + "."


def analyze_project(root_path):
    """Run full project analysis and return structured dict."""
    root = Path(root_path).resolve()

    if not root.is_dir():
        return {"error": f"Not a directory: {root}"}

    tech_stack = detect_tech_stack(root)
    structure = scan_structure(root)
    docs_info = find_config_and_docs(root)
    architecture = detect_architecture(root, structure)
    hotspots = analyze_hotspots(root)
    existing_skills = find_existing_skills(root)

    summary = generate_summary(
        tech_stack, structure, architecture, hotspots, docs_info
    )

    return {
        "summary": summary,
        "tech_stack": {
            "languages": tech_stack["languages"],
            "frameworks": tech_stack["frameworks"],
            "dependencies": tech_stack["dependencies"],
            "manifests": tech_stack["manifests"],
        },
        "structure": structure,
        "config_files": docs_info["config_files"],
        "documentation": docs_info["documentation"],
        "architecture": architecture,
        "hotspots": hotspots,
        "existing_skills": existing_skills,
    }


def main():
    import argparse
    parser = argparse.ArgumentParser(description="Analyze project for skill creation")
    parser.add_argument("path", nargs="?", default=".", help="Project root path")
    parser.add_argument("--summary", action="store_true", help="Output summary only")
    args = parser.parse_args()

    result = analyze_project(args.path)

    if "error" in result:
        print(f"Error: {result['error']}", file=sys.stderr)
        sys.exit(1)

    if args.summary:
        print(result["summary"])
    else:
        print(json.dumps(result, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
