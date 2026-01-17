
const vscode = acquireVsCodeApi();

// Listen for messages from extension
window.addEventListener('message', event => {
    const message = event.data;
    switch (message.command) {
        case 'updateData':
            init(message.data);
            break;
    }
});

// Initialize UI with data received from extension
function init(data) {
    if (!data) return;

    // Store data globally for other functions if needed
    window.currentData = data;

    // Text displays
    const displayProjectName = document.getElementById('displayProjectName');
    if (displayProjectName) displayProjectName.textContent = data.projectName;

    const displayProfileName = document.getElementById('displayProfileName');
    if (displayProfileName) displayProfileName.textContent = data.profileFileName;

    const pwdKey = data.passwordKey;
    const displayPasswordKey = document.getElementById('displayPasswordKey');
    if (displayPasswordKey) displayPasswordKey.textContent = pwdKey;

    const displayPasswordKeyUsage = document.getElementById('displayPasswordKeyUsage');
    if (displayPasswordKeyUsage) displayPasswordKeyUsage.textContent = `/ p: Password = $env:${pwdKey} `;

    // Badge
    const badge = document.getElementById('envBadge');
    if (badge) {
        badge.className = `badge ${data.environment} `;
        badge.textContent = data.environment.toUpperCase();
    }

    // Form values
    const envSelect = document.getElementById('environment');
    if (envSelect) envSelect.value = data.environment;

    const pubUrlInput = document.getElementById('publishUrl');
    if (pubUrlInput) pubUrlInput.value = data.publishUrl || '';

    const siteNameInput = document.getElementById('siteName');
    if (siteNameInput) siteNameInput.value = data.siteName || '';

    const siteUrlInput = document.getElementById('siteUrl');
    if (siteUrlInput) siteUrlInput.value = data.siteUrl || '';

    const userInput = document.getElementById('username');
    if (userInput) userInput.value = data.username || '';

    // Deploy Status
    const container = document.getElementById('deployBtnContainer');
    if (data.isDeploying) {
        if (container) {
            container.innerHTML = `
                <button type="button" class="btn-success" disabled title="Deployment in progress...">
                    <div class="spinner"></div> Deploying...
                </button>`;
        }

        // Disable form
        const inputs = document.querySelectorAll('input, select, button');
        inputs.forEach(el => el.disabled = true);
    } else {
        // Restore normal state
        if (container) {
            container.innerHTML = `
                <button type="button" class="btn-success" id="btnDeploy" title="Deploy to this environment">
                    🚀 Deploy
                </button>`;

            // Re-attach event listener after recreating button
            const deployBtn = document.getElementById('btnDeploy');
            if (deployBtn) {
                deployBtn.addEventListener('click', () => {
                    vscode.postMessage({ command: 'deploy' });
                });
            }
        }

        // Enable form
        const inputs = document.querySelectorAll('input, select, button');
        inputs.forEach(el => el.disabled = false);
    }
}

// Signal that webview is ready to receive data
vscode.postMessage({ command: 'ready' });

// Setup event listeners
document.addEventListener('DOMContentLoaded', () => {
    // Profile name header click
    const profileHeader = document.getElementById('profileNameHeader');
    if (profileHeader) {
        profileHeader.addEventListener('click', () => {
            vscode.postMessage({ command: 'openFile' });
        });
    }

    // Deploy button
    const deployBtn = document.getElementById('btnDeploy');
    if (deployBtn) {
        deployBtn.addEventListener('click', () => {
            vscode.postMessage({ command: 'deploy' });
        });
    }

    // Cancel button
    const cancelBtn = document.getElementById('btnCancel');
    if (cancelBtn) {
        cancelBtn.addEventListener('click', resetForm);
    }

    // Delete button
    const deleteBtn = document.getElementById('btnDelete');
    if (deleteBtn) {
        deleteBtn.addEventListener('click', () => {
            vscode.postMessage({ command: 'delete' });
        });
    }
});

const form = document.getElementById('profileForm');
if (form) {
    form.addEventListener('submit', (e) => {
        e.preventDefault();

        // Validate required fields
        const publishUrl = document.getElementById('publishUrl').value.trim();
        const siteName = document.getElementById('siteName').value.trim();
        const username = document.getElementById('username').value.trim();

        let errors = [];
        if (!publishUrl) errors.push('Publish URL is required');
        if (!siteName) errors.push('Site Name is required');
        if (!username) errors.push('Username is required');

        // Show validation errors
        clearErrors();
        if (errors.length > 0) {
            showErrors(errors);
            return;
        }

        const submitData = {
            profileName: window.currentData.profileFileName, // Use original file name as ID
            environment: document.getElementById('environment').value,
            publishUrl: publishUrl,
            siteName: siteName,
            siteUrl: document.getElementById('siteUrl').value || undefined,
            username: username,
            password: document.getElementById('password').value || 'KEEP_EXISTING'
        };

        vscode.postMessage({ command: 'save', data: submitData });
    });
}

// Expose functions to global scope for HTML onclick access
window.resetForm = function () {
    if (!window.currentData) return;
    const data = window.currentData;

    document.getElementById('environment').value = data.environment;
    document.getElementById('publishUrl').value = data.publishUrl || '';
    document.getElementById('siteName').value = data.siteName || '';
    document.getElementById('siteUrl').value = data.siteUrl || '';
    document.getElementById('username').value = data.username || '';
    document.getElementById('password').value = '';
    clearErrors();
}

function clearErrors() {
    const existing = document.querySelector('.error-box');
    if (existing) existing.remove();
}

function showErrors(errors) {
    const errorBox = document.createElement('div');
    errorBox.className = 'error-box';
    errorBox.innerHTML = '<strong>⚠️ Validation Errors:</strong><ul>' +
        errors.map(e => '<li>' + e + '</li>').join('') + '</ul>';

    const actionsDiv = document.querySelector('.actions');
    if (actionsDiv) actionsDiv.before(errorBox);
}
