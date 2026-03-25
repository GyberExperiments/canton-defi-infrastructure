# LazyGit Setup Instructions

## ✅ LazyGit is installed!

LazyGit has been successfully installed to `~/bin/lazygit`

## 🚀 To activate LazyGit in your current terminal:

Copy and paste these commands into your terminal:

```bash
# Add ~/bin to PATH
export PATH="$HOME/bin:$PATH"

# Create aliases
alias lazygit="$HOME/bin/lazygit"
alias lg="$HOME/bin/lazygit"

# Test that it works
lazygit --version
```

## 📌 To make it permanent (works after terminal restart):

The aliases have already been added to your `~/.zshrc` file. 
Just restart your terminal or run:

```bash
source ~/.zshrc
```

## 🎯 How to use LazyGit:

After activation, you can use either command:

```bash
lazygit   # Full command
lg        # Short alias
```

## ⌨️ Essential LazyGit shortcuts:

### Navigation
- `↑↓` - Move up/down in lists
- `←→` or `Tab` - Switch between panels
- `q` - Quit LazyGit

### Files Panel
- `Space` - Stage/unstage file
- `c` - Commit staged changes
- `a` - Stage all files
- `d` - Discard changes
- `e` - Edit file

### Branches Panel
- `Space` - Checkout branch
- `n` - Create new branch
- `d` - Delete branch
- `m` - Merge branch

### Commits Panel
- `r` - Reword commit message
- `s` - Squash commits
- `c` - Cherry-pick commit

### General
- `P` - Push to remote
- `p` - Pull from remote
- `?` - Show help menu
- `/` - Search in current panel

## 🔧 Configuration

LazyGit configuration is located at: `~/.config/lazygit/config.yml`

The configuration includes:
- Visual theme with cyan highlighting
- Auto-refresh enabled
- VS Code as default editor (`code` command)
- Standard keybindings optimized for productivity

## 📝 Quick Test

To verify everything is working, run this in your project directory:

```bash
# Using full command
~/bin/lazygit

# Or after activation
lazygit

# Or using alias
lg
```

## ⚠️ Troubleshooting

If `lazygit` command is not found after running `source ~/.zshrc`:

1. Check if the file exists:
   ```bash
   ls -la ~/bin/lazygit
   ```

2. Check if PATH is set correctly:
   ```bash
   echo $PATH | grep "$HOME/bin"
   ```

3. Try using the full path directly:
   ```bash
   ~/bin/lazygit
   ```

4. If you're using a different shell (bash, fish, etc.), add the aliases to the appropriate config file:
   - Bash: `~/.bashrc` or `~/.bash_profile`
   - Fish: `~/.config/fish/config.fish`
   - Zsh: `~/.zshrc` (already configured)

## 📚 Resources

- [LazyGit Documentation](https://github.com/jesseduffield/lazygit)
- [LazyGit Keybindings](https://github.com/jesseduffield/lazygit/blob/master/docs/keybindings/Keybindings_en.md)
- [Configuration Options](https://github.com/jesseduffield/lazygit/blob/master/docs/Config.md)

---

**Version installed:** 0.58.1  
**Location:** `~/bin/lazygit`  
**Config:** `~/.config/lazygit/config.yml`
