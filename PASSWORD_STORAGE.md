# Password Storage Configuration

## 🔐 Overview

The extension supports **two password storage strategies** for deployment credentials:

1. **SecretStorage** (Default, Recommended) - Encrypted, secure
2. **Environment Variables** - Plain text, less secure but easier to debug

---

## ✅ SecretStorage (Default)

### What is it?

Uses VS Code's built-in **SecretStorage API** which stores passwords encrypted in your OS keychain.

### Where are passwords stored?

- **Windows**: Windows Credential Manager (encrypted)
- **macOS**: Keychain (encrypted)
- **Linux**: Secret Service API / libsecret (encrypted)

### Advantages

✅ **Encrypted** - Passwords are encrypted by OS keychain  
✅ **Secure** - Cannot be read by other processes  
✅ **Cross-platform** - Works on Windows, macOS, Linux  
✅ **Syncs** - Can sync with VS Code Settings Sync  
✅ **No restart required** - Changes apply immediately

### How to use

This is the **default** setting. No configuration needed!

Passwords are automatically stored when you:

1. Create a new publish profile
2. Edit profile credentials via Profile Info panel

### How to view (Windows)

1. Open **Credential Manager** (`control /name Microsoft.CredentialManager`)
2. Go to **Windows Credentials**
3. Look for entries starting with `vscodecredentials`

**Note**: You cannot view the actual password (it's encrypted), but you can delete credentials here.

---

## ⚠️ Environment Variables (Alternative)

### What is it?

Stores passwords as **Windows environment variables** (plain text).

### Where are passwords stored?

- **Registry**: `HKEY_CURRENT_USER\Environment`
- **Format**: `DEPLOY_PWD_{PROJECT}_{PROFILE}`

Example: `DEPLOY_PWD_MYAPI_SERVER_UAT_API`

### Advantages

✅ **Easy to debug** - Can view passwords directly  
✅ **Persistent** - Survives VS Code restarts  
✅ **Manual control** - Can set/view via PowerShell

### Disadvantages

⚠️ **Plain text** - Passwords stored unencrypted  
⚠️ **Less secure** - Can be read by other processes  
⚠️ **Requires restart** - Terminal must be restarted to apply changes

### How to enable

Add to `.vscode/settings.json`:

```json
{
  "dotnetToolkit.passwordStorage": "envvar"
}
```

Or use VS Code Settings UI:

1. Open Settings (`Ctrl+,`)
2. Search for "dotnet toolkit password"
3. Change **Password Storage** to `envvar`

### How to view passwords (PowerShell)

```powershell
# List all deployment passwords
Get-ChildItem Env: | Where-Object { $_.Name -like "DEPLOY_PWD_*" }

# View specific password
echo $env:DEPLOY_PWD_MYAPI_SERVER_UAT_API
```

### How to manually set (PowerShell)

```powershell
setx DEPLOY_PWD_MYAPI_SERVER_UAT_API "your-password-here"
```

**Note**: Restart terminal after setting.

---

## 🔄 Migration Guide

### From EnvVar to SecretStorage (Recommended)

If you previously used environment variables and want to switch to secure storage:

1. **Change setting** in `.vscode/settings.json`:

   ```json
   {
     "dotnetToolkit.passwordStorage": "secret"
   }
   ```

2. **Reload VS Code** or restart the extension

3. **Re-configure credentials** for each profile:
   - Click on profile in TreeView
   - Click "Edit" in Profile Info panel
   - Re-enter password
   - Click "Save"

4. **Clean up old env vars** (optional):

   ```powershell
   # List old passwords
   Get-ChildItem Env: | Where-Object { $_.Name -like "DEPLOY_PWD_*" }

   # Delete from Registry Editor
   # Navigate to: HKEY_CURRENT_USER\Environment
   # Delete keys starting with DEPLOY_PWD_
   ```

### From SecretStorage to EnvVar

If you need to switch to environment variables (e.g., for debugging):

1. **Change setting** in `.vscode/settings.json`:

   ```json
   {
     "dotnetToolkit.passwordStorage": "envvar"
   }
   ```

2. **Reload VS Code**

3. **Re-configure credentials** for each profile

4. **Restart terminal** to load new environment variables

---

## 🔍 Troubleshooting

### "Password not found" error when deploying

**Cause**: Password not configured or storage method changed.

**Solution**:

1. Click on the profile in TreeView
2. Click "Edit" in Profile Info panel
3. Re-enter the password
4. Click "Save"

### Cannot view passwords in Credential Manager

**Cause**: Passwords are encrypted by VS Code.

**Solution**: This is normal and expected. Passwords are encrypted for security. You cannot view them directly.

### Environment variables not working after setting

**Cause**: Terminal not restarted.

**Solution**:

1. Close all terminals
2. Restart VS Code
3. Try deployment again

### Want to use different storage per workspace

**Solution**: Use workspace settings instead of user settings:

`.vscode/settings.json` (workspace-specific):

```json
{
  "dotnetToolkit.passwordStorage": "secret"
}
```

---

## 📊 Comparison Table

| Feature              | SecretStorage (Default) | Environment Variables |
| -------------------- | ----------------------- | --------------------- |
| **Security**         | ✅ Encrypted            | ⚠️ Plain text         |
| **Cross-platform**   | ✅ Yes                  | ✅ Yes                |
| **Requires restart** | ❌ No                   | ⚠️ Yes (terminal)     |
| **Sync support**     | ✅ Yes                  | ❌ No                 |
| **Debug-ability**    | ⚠️ Hard                 | ✅ Easy               |
| **OS Integration**   | ✅ Keychain             | ⚠️ Registry           |
| **Recommended for**  | Production              | Development/Testing   |

---

## 🎯 Recommendations

### For Production Deployments

```json
{
  "dotnetToolkit.passwordStorage": "secret"
}
```

✅ Use **SecretStorage** for maximum security.

### For Development/Testing

```json
{
  "dotnetToolkit.passwordStorage": "envvar"
}
```

⚠️ Use **EnvVar** only if you need to debug password issues.

### For Teams

- Commit `.vscode/settings.json` with `"passwordStorage": "secret"`
- Each team member configures their own credentials
- Credentials are NOT committed to git (stored locally)

---

## 🔐 Security Best Practices

1. ✅ **Always use SecretStorage** for production credentials
2. ✅ **Never commit passwords** to git
3. ✅ **Use different passwords** for DEV/UAT/PROD
4. ✅ **Rotate passwords** regularly
5. ✅ **Use service accounts** instead of personal accounts
6. ⚠️ **Avoid EnvVar** for sensitive production passwords

---

## 📝 Configuration Reference

### Setting Location

**User Settings** (global):

- File: `%APPDATA%\Code\User\settings.json`
- Applies to: All workspaces

**Workspace Settings** (per-project):

- File: `.vscode/settings.json`
- Applies to: Current workspace only

### Setting Schema

```json
{
  "dotnetToolkit.passwordStorage": "secret" | "envvar"
}
```

**Values**:

- `"secret"` - Use VS Code SecretStorage (encrypted, default)
- `"envvar"` - Use environment variables (plain text)

**Default**: `"secret"`

---

## ❓ FAQ

**Q: Can I see my passwords after saving?**  
A: With SecretStorage, no (encrypted). With EnvVar, yes (via PowerShell).

**Q: Are passwords synced across devices?**  
A: With SecretStorage + Settings Sync enabled, yes. With EnvVar, no.

**Q: What happens if I change storage method?**  
A: You need to re-configure all credentials. Old passwords are not migrated automatically.

**Q: Can I use both methods simultaneously?**  
A: No, only one method is active at a time (per workspace).

**Q: Where are passwords stored in the extension code?**  
A: Nowhere. Passwords are only stored in OS keychain or environment variables, never in extension files.

---

**Last Updated**: 2026-01-19  
**Default Storage**: SecretStorage (encrypted)  
**Recommended**: SecretStorage for all scenarios
