# Testing Guide - .NET Project Toolkit

## 🚀 How to Test the Extension

### Step 1: Launch Extension Development Host

**Method 1: Using F5**

1. Open this project in VS Code
2. Press `F5` to launch Extension Development Host
3. A new VS Code window will open with the extension activated

**Method 2: Using Run and Debug**

1. Click "Run and Debug" in the sidebar (Ctrl+Shift+D)
2. Select "Run Extension" from the dropdown
3. Click the green play button

---

### Step 2: Verify Multi-View Panel

Once the Extension Development Host opens:

1. **Find the .NET Toolkit icon** in the Activity Bar (left sidebar)
   - Look for the purple .NET icon
2. **Click the icon** to open the panel

3. **Verify all 4 tabs are visible:**
   - ✅ **Publish** - Should show hierarchical project structure
   - ✅ **Watch** - Should show "Coming in v1.1" message
   - ✅ **Debug** - Should show "Coming in v1.1" message
   - ✅ **History** - Should show "Coming in v1.2" message

---

### Step 3: Test Publish View

#### Test Hierarchical Structure

1. Click **"Publish"** tab
2. Expand **"Server"** folder
3. Expand **"BudgetControl.Server.Api"**
4. Expand **"Profiles"**
5. You should see:
   - `uat-api [UAT]` with 📄 icon
   - `prod-api [PROD]` with ⚠️ icon (red)

#### Test UAT Deployment

1. Click the 🚀 button next to `uat-api [UAT]`
2. **Expected behavior:**
   - Progress notification appears: "Deploying uat-api [UAT]..."
   - Progress steps:
     - Validating environment...
     - Building project...
     - Publishing to IIS...
     - Complete!
   - Success message: "✅ uat-api [UAT] deployed successfully!"
   - Output channel shows logs

#### Test PROD Deployment with Confirmation

1. Click the 🚀 button next to `prod-api [PROD]`
2. **Expected behavior:**
   - **Confirmation dialog appears:**
     - Title: "⚠️ Deploy to PRODUCTION: prod-api [PROD]?"
     - Options: "Deploy" | "Cancel"
3. Click **"Cancel"**

   - Deployment should be cancelled
   - Output channel shows: "[Cancelled] ..."

4. Click 🚀 again and select **"Deploy"**
   - Deployment should proceed
   - Same progress as UAT deployment

---

### Step 4: Test Output Channel

1. Deploy any profile
2. **Open Output panel:**
   - View → Output (Ctrl+Shift+U)
   - Select ".NET Toolkit" from dropdown
3. **Verify logs:**
   ```
   [Activated] .NET Project Toolkit extension activated successfully
   [Info] 4 views registered: Publish, Watch, Debug, History
   [Deploy] Starting deployment: uat-api [UAT]
   [Success] uat-api [UAT] deployed successfully!
   ```

---

### Step 5: Test Placeholder Views

#### Watch View

1. Click **"Watch"** tab
2. Expand **"⚡ Watch Feature"**
3. Should see:
   - "Coming in v1.1"
   - List of features with checkmarks
   - Each feature marked "(coming soon)"

#### Debug View

1. Click **"Debug"** tab
2. Expand **"🐛 Debug Feature"**
3. Should see:
   - "Coming in v1.1"
   - List of features

#### History View

1. Click **"History"** tab
2. Expand **"📜 History Feature"**
3. Should see:
   - "Coming in v1.2"
   - List of features

---

### Step 6: Test Refresh Command

1. Right-click anywhere in Publish view
2. Select **"Refresh Publish Profiles"**
3. Output channel should log: "[Refresh] Publish profiles refreshed"
4. Tree should reload

---

## ✅ Test Checklist

- [ ] Extension activates without errors
- [ ] .NET Toolkit icon appears in Activity Bar
- [ ] All 4 tabs are visible (Publish, Watch, Debug, History)
- [ ] Publish view shows hierarchical structure
- [ ] Server folder contains Api and Web projects
- [ ] Profiles folder shows UAT and PROD profiles
- [ ] UAT profiles have normal icon
- [ ] PROD profiles have warning icon (red)
- [ ] Clicking deploy button starts deployment
- [ ] Progress notification shows with stages
- [ ] PROD deployment shows confirmation dialog
- [ ] Cancelling PROD deployment works
- [ ] Proceeding with PROD deployment works
- [ ] Output channel logs all actions
- [ ] Watch view shows "Coming in v1.1"
- [ ] Debug view shows "Coming in v1.1"
- [ ] History view shows "Coming in v1.2"
- [ ] Refresh command works

---

## 🐛 Common Issues

### Extension doesn't activate

- Check for TypeScript errors: `npm run compile`
- Look at "Extension Development Host" debug console for errors

### Views don't appear

- Make sure you're clicking the .NET Toolkit icon (not another extension)
- Check package.json views configuration

### Deploy button doesn't work

- Check browser console for errors (Help → Toggle Developer Tools)
- Verify command is registered in extension.ts

---

## 📊 Expected UI Structure

```
.NET Toolkit (Activity Bar)
└── 4 Tabs:
    ├── 📦 Publish
    │   └── Projects with deploy buttons
    ├── ⚡ Watch
    │   └── "Coming in v1.1" message
    ├── 🐛 Debug
    │   └── "Coming in v1.1" message
    └── 📜 History
        └── "Coming in v1.2" message
```

---

## 🎥 Demo Flow

1. **Press F5** → Extension Development Host opens
2. **Click .NET Toolkit icon** → Panel opens with 4 tabs
3. **Click Publish tab** → See project hierarchy
4. **Expand folders** → Server → Api → Profiles
5. **Click 🚀 on uat-api** → Deployment starts, progress shows
6. **Click 🚀 on prod-api** → Confirmation dialog
7. **Select Cancel** → Deployment cancelled
8. **Click 🚀 again, Deploy** → Deployment proceeds
9. **Open Output** → See deployment logs
10. **Switch to Watch tab** → See coming soon
11. **Switch to Debug tab** → See coming soon
12. **Switch to History tab** → See coming soon

**Success!** All features working as expected! ✅
