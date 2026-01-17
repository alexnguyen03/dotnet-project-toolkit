
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
    if (data.isDeploying) {
        const container = document.getElementById('deployBtnContainer');
        if (container) {
            container.innerHTML = `
    < button type = "button" class="btn-success" disabled title = "Deployment in progress..." >
        <div class="spinner"></div> Deploying...
                </button > `;
        }

        // Disable form
        const inputs = document.querySelectorAll('input, select, button');
        inputs.forEach(el => el.disabled = true);
    }
}

// Signal that webview is ready to receive data
vscode.postMessage({ command: 'ready' });

document.getElementById('profileForm').addEventListener('submit', (e) => {
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
        profileName: data.profileFileName, // Use original file name as ID
        environment: document.getElementById('environment').value,
        publishUrl: publishUrl,
        siteName: siteName,
        siteUrl: document.getElementById('siteUrl').value || undefined,
        username: username,
        password: document.getElementById('password').value || 'KEEP_EXISTING'
    };

    vscode.postMessage({ command: 'save', data: submitData });
});

function resetForm() {
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
    document.querySelector('.actions').before(errorBox);
}

function openFile() {
    vscode.postMessage({ command: 'openFile' });
}

function deploy() {
    vscode.postMessage({ command: 'deploy' });
}

function deleteProfile() {
    vscode.postMessage({ command: 'delete' });
}

// Run init
init();
