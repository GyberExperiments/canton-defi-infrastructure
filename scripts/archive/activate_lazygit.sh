#!/bin/bash

# LazyGit Activation Script
# This script activates LazyGit in your current terminal session
# Usage: source activate_lazygit.sh

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "                    LazyGit Activation                      "
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Add ~/bin to PATH if not already there
if [[ ":$PATH:" != *":$HOME/bin:"* ]]; then
    export PATH="$HOME/bin:$PATH"
    echo "✅ Added ~/bin to PATH"
else
    echo "✅ ~/bin already in PATH"
fi

# Create aliases for LazyGit
alias lazygit="$HOME/bin/lazygit"
alias lg="$HOME/bin/lazygit"
echo "✅ Aliases created: lazygit, lg"

# Verify LazyGit is installed and working
if [ -f "$HOME/bin/lazygit" ]; then
    VERSION=$($HOME/bin/lazygit --version 2>/dev/null | grep -o 'version=[^,]*' | cut -d= -f2)
    if [ ! -z "$VERSION" ]; then
        echo "✅ LazyGit v$VERSION is ready to use!"
    else
        echo "✅ LazyGit is installed at ~/bin/lazygit"
    fi
else
    echo "❌ Error: LazyGit not found at ~/bin/lazygit"
    echo "   Please ensure LazyGit is properly installed."
    exit 1
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "                    🎉 Ready to use!                        "
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "You can now use LazyGit with any of these commands:"
echo ""
echo "  lazygit    - Launch LazyGit (full command)"
echo "  lg         - Launch LazyGit (short alias)"
echo ""
echo "Quick commands:"
echo "  • Stage files:     Space"
echo "  • Commit:          c"
echo "  • Push:            P"
echo "  • Pull:            p"
echo "  • Switch branch:   Space (in branches panel)"
echo "  • Help:            ?"
echo "  • Quit:            q"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Check if we're in a git repository
if [ -d .git ] || git rev-parse --git-dir > /dev/null 2>&1; then
    echo ""
    echo "📁 Current directory is a Git repository"
    echo "   Type 'lg' or 'lazygit' to start!"
else
    echo ""
    echo "📝 Note: Current directory is not a Git repository"
    echo "   Navigate to a Git project and then use 'lg' or 'lazygit'"
fi

echo ""
