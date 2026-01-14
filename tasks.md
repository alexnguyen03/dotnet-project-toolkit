```json
{
  "version": "2.0.0",
  "tasks": [
    {
      "label": "build",
      "command": "dotnet",
      "type": "process",
      "args": [
        "build",
        "${workspaceFolder}/BudgetControl.sln",
        "/property:GenerateFullPaths=true",
        "/consoleloggerparameters:NoSummary;ForceNoAlign"
      ],
      "problemMatcher": "$msCompile"
    },
    {
      "label": "publish",
      "command": "dotnet",
      "type": "process",
      "args": [
        "publish",
        "${workspaceFolder}/BudgetControl.sln",
        "/property:GenerateFullPaths=true",
        "/consoleloggerparameters:NoSummary;ForceNoAlign"
      ],
      "problemMatcher": "$msCompile"
    },
    {
      "label": "watch",
      "command": "dotnet",
      "type": "process",
      "args": [
        "watch",
        "run",
        "--project",
        "${workspaceFolder}/BudgetControl.sln"
      ],
      "problemMatcher": "$msCompile"
    },
    // ======================== UAT TASKS ========================
    {
      "label": "🧪 DEPLOY API TO UAT 🧪",
      "dependsOrder": "sequence",
      "dependsOn": ["Core: Deploy API UAT", "Notify: API UAT Success"],
      "group": "build"
    },
    {
      "label": "🧪 DEPLOY CLIENT TO UAT 🧪",
      "dependsOrder": "sequence",
      "dependsOn": ["Core: Deploy CLIENT UAT", "Notify: CLIENT UAT Success"],
      "group": "build"
    },
    // ======================== PRODUCTION TASKS ========================
    {
      "label": "✅‼️ DEPLOY API TO PRODUCTION ✅‼️",
      "dependsOrder": "sequence",
      "dependsOn": ["Core: Deploy API PROD", "Notify: API PROD Success"],
      "group": "build"
    },
    {
      "label": "✅‼️ DEPLOY CLIENT TO PRODUCTION ✅‼️",
      "dependsOrder": "sequence",
      "dependsOn": ["Core: Deploy CLIENT PROD", "Notify: CLIENT PROD Success"],
      "group": "build"
    },
    // ======================== CORE DEPLOY COMMANDS (HIDDEN) ========================
    {
      "label": "Core: Deploy API UAT",
      "hide": true,
      "type": "shell",
      "command": "dotnet",
      "args": [
        "publish",
        "BudgetControl.Server.Api.csproj",
        "-f",
        "net8.0",
        "/p:PublishProfile=Properties/PublishProfiles/uat-api.pubxml",
        "/p:Password=${env:DEPLOY_PWD}",
        "/p:AllowUntrustedCertificate=True",
        "/p:StdoutLogEnabled=true",
        "/p:StdoutLogFile=.\\logs\\stdout",
        "/p:Configuration=Release"
      ],
      "options": {
        "cwd": "${workspaceFolder}/src/Server/BudgetControl.Server.Api"
      },
      "problemMatcher": "$msCompile"
    },
    {
      "label": "Core: Deploy CLIENT UAT",
      "hide": true,
      "type": "shell",
      "command": "dotnet",
      "args": [
        "publish",
        "BudgetControl.Server.Web.csproj",
        "-f",
        "net8.0",
        "/p:PublishProfile=Properties/PublishProfiles/uat-web.pubxml",
        "/p:Password=${env:DEPLOY_PWD}",
        "/p:AllowUntrustedCertificate=True",
        "/p:StdoutLogEnabled=true",
        "/p:StdoutLogFile=.\\logs\\stdout",
        "/p:Configuration=Release"
      ],
      "options": {
        "cwd": "${workspaceFolder}/src/Server/BudgetControl.Server.Web"
      },
      "problemMatcher": "$msCompile"
    },
    {
      "label": "Core: Deploy API PROD",
      "hide": true,
      "type": "shell",
      "command": "dotnet",
      "args": [
        "publish",
        "BudgetControl.Server.Api.csproj",
        "-f",
        "net8.0",
        "/p:PublishProfile=Properties/PublishProfiles/prod-api.pubxml",
        "/p:Password=${env:DEPLOY_PWD_PROD}",
        "/p:AllowUntrustedCertificate=True",
        "/p:StdoutLogEnabled=true",
        "/p:StdoutLogFile=.\\logs\\stdout",
        "/p:Configuration=Release"
      ],
      "options": {
        "cwd": "${workspaceFolder}/src/Server/BudgetControl.Server.Api"
      },
      "problemMatcher": "$msCompile"
    },
    {
      "label": "Core: Deploy CLIENT PROD",
      "hide": true,
      "type": "shell",
      "command": "dotnet",
      "args": [
        "publish",
        "BudgetControl.Server.Web.csproj",
        "-f",
        "net8.0",
        "/p:PublishProfile=Properties/PublishProfiles/prod-web.pubxml",
        "/p:Password=${env:DEPLOY_PWD_PROD}",
        "/p:AllowUntrustedCertificate=True",
        "/p:StdoutLogEnabled=true",
        "/p:StdoutLogFile=.\\logs\\stdout",
        "/p:Configuration=Release"
      ],
      "options": {
        "cwd": "${workspaceFolder}/src/Server/BudgetControl.Server.Web"
      },
      "problemMatcher": "$msCompile"
    },
    // ======================== NOTIFICATION COMMANDS ========================
    {
      "label": "Notify: API UAT Success",
      "hide": true,
      "type": "shell",
      "command": "powershell",
      "args": [
        "-File",
        "${workspaceFolder}\\.vscode\\scripts\\notify-api-uat-success.ps1"
      ]
    },
    {
      "label": "Notify: CLIENT UAT Success",
      "hide": true,
      "type": "shell",
      "command": "powershell",
      "args": [
        "-File",
        "${workspaceFolder}\\.vscode\\scripts\\notify-web-uat-success.ps1"
      ]
    },
    {
      "label": "Notify: API PROD Success",
      "hide": true,
      "type": "shell",
      "command": "powershell",
      "args": [
        "-File",
        "${workspaceFolder}\\.vscode\\scripts\\notify-api-prod-success.ps1"
      ]
    },
    {
      "label": "Notify: CLIENT PROD Success",
      "hide": true,
      "type": "shell",
      "command": "powershell",
      "args": [
        "-File",
        "${workspaceFolder}\\.vscode\\scripts\\notify-web-prod-success.ps1"
      ]
    }
  ]
}
```
