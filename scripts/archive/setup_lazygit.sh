#!/bin/bash

# Setup script for LazyGit
# This script configures LazyGit to work in your terminal

echo "Setting up LazyGit..."

# Add ~/bin to PATH if not already there
if [[ ":$PATH:" != *":$HOME/bin:"* ]]; then
    export PATH="$HOME/bin:$PATH"
    echo "✓ Added ~/bin to PATH"
else
    echo "✓ ~/bin already in PATH"
fi

# Create aliases
alias lazygit="$HOME/bin/lazygit"
alias lg="$HOME/bin/lazygit"

echo "✓ Aliases created:"
echo "  - lazygit"
echo "  - lg (shortcut)"

# Check if LazyGit is accessible
if [ -f "$HOME/bin/lazygit" ]; then
    echo "✓ LazyGit found at ~/bin/lazygit"

    # Get version
    VERSION=$($HOME/bin/lazygit --version 2>/dev/null | grep -o 'version=[^,]*' | cut -d= -f2)
    echo "✓ LazyGit version: $VERSION"
else
    echo "✗ LazyGit not found at ~/bin/lazygit"
    echo "  Please ensure LazyGit is installed correctly"
    exit 1
fi

echo ""
echo "=========================================="
echo "LazyGit is ready to use!"
echo "=========================================="
echo ""
echo "Usage:"
echo "  lazygit    - Launch LazyGit"
echo "  lg         - Launch LazyGit (shortcut)"
echo ""
echo "To make these changes permanent, run:"
echo "  source ~/.zshrc"
echo ""
echo "Or restart your terminal."
