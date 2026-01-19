const vscode = acquireVsCodeApi();

// Listen for messages from extension
window.addEventListener('message', (event) => {
	const message = event.data;
	switch (message.command) {
		case 'updateData':
			init(message.data);
			break;
		case 'updateHistory':
			const historyContainer = document.getElementById('historyContainer');
			if (historyContainer && message.html) {
				historyContainer.innerHTML = message.html;
			}
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

	const openBrowserCheckbox = document.getElementById('openBrowserOnDeploy');
	if (openBrowserCheckbox) openBrowserCheckbox.checked = data.openBrowserOnDeploy !== false; // Default true if undefined

	const enableStdoutLogCheckbox = document.getElementById('enableStdoutLog');
	if (enableStdoutLogCheckbox) enableStdoutLogCheckbox.checked = data.enableStdoutLog === true; // Default false if undefined

	const logPathInput = document.getElementById('logPath');
	if (logPathInput) logPathInput.value = data.logPath || '';

	// Handle create mode vs edit mode
	// Styles handled by CSS now

	const modeHeader = document.getElementById('modeHeader');

	if (data.isCreateMode) {
		// Mode Title
		if (modeHeader) {
			modeHeader.textContent = 'Create Profile';
			// Optional: Keep color distinction via class or keep default
			modeHeader.style.color = 'var(--vscode-charts-green)';
		}

		// Disable profile name click in create mode
		const profileNameText = document.getElementById('displayProfileName');
		if (profileNameText) {
			profileNameText.classList.add('non-clickable');
			profileNameText.title = 'New profile (not saved yet)';
		}

		// Hide deploy button in create mode (Hide container to remove spacing)
		const deployContainer = document.getElementById('deployBtnContainer');
		// Actually skectch shows button always? No, typically hide deploy on create.
		// Let's hide the button itself to keep layout stable if other items exist, or hide container
		if (deployContainer) deployContainer.style.display = 'none';

		// Fake placeholders for create mode
		setPlaceholders({
			publishUrl: 'e.g. 192.168.10.5 or my-server.com',
			siteName: 'e.g. MyWebSite_Staging',
			siteUrl: 'e.g. https://staging.myapp.com',
			username: 'e.g. deploy_user',
			password: 'Enter server password',
		});

		// Update submit button text
		const submitBtn = document.querySelector('button[type="submit"]');
		if (submitBtn) submitBtn.innerHTML = 'Create Profile';

		// Hide delete button
		const deleteBtn = document.getElementById('btnDelete');
		if (deleteBtn) deleteBtn.style.display = 'none';

		// Hide separator context if needed, but 'Create Profile : [Name]' is fine
	} else {
		// Edit Mode Title
		if (modeHeader) {
			modeHeader.textContent = 'Edit Profile';
			modeHeader.style.color = ''; // Reset to default CSS color
		}

		// Restore placeholders for edit mode
		setPlaceholders({
			publishUrl: '192.168.10.3',
			siteName: 'MY_APP_API_STAGING',
			siteUrl: 'https://example.com',
			username: 'namnh',
			password: 'Leave empty to keep existing',
		});

		// Show deploy button
		const deployContainer = document.getElementById('deployBtnContainer');
		if (deployContainer) deployContainer.style.display = 'block';

		// Show delete button
		const deleteBtn = document.getElementById('btnDelete');
		if (deleteBtn) deleteBtn.style.display = 'block';

		// Enable profile name click in edit mode
		const profileNameText = document.getElementById('displayProfileName');
		if (profileNameText) {
			profileNameText.classList.remove('non-clickable');
			profileNameText.title = 'Click to open profile file';
		}
	}

	// Deploy Status
	const container = document.getElementById('deployBtnContainer');
	if (data.isDeploying) {
		if (container) {
			container.innerHTML = `
                <button type="button" class="btn-primary" disabled title="Deployment in progress...">
                    <div class="spinner"></div> Deploying...
                </button>`;
		}

		const inputs = document.querySelectorAll('input, select, button');
		inputs.forEach((el) => (el.disabled = true));
	} else {
		if (container) {
			// Restore button
			container.innerHTML = `
                <button type="button" class="btn-success" id="btnDeploy" title="Deploy to this environment">
                    Deploy
                </button>`;

			const deployBtn = document.getElementById('btnDeploy');
			if (deployBtn) {
				deployBtn.addEventListener('click', () => {
					vscode.postMessage({ command: 'deploy' });
				});
			}
		}

		const inputs = document.querySelectorAll('input, select, button');
		inputs.forEach((el) => (el.disabled = false));
	}
}

// Signal ready
vscode.postMessage({ command: 'ready' });

// Setup event listeners
document.addEventListener('DOMContentLoaded', () => {
	// Profile name click (open file)
	const profileNameText = document.getElementById('displayProfileName');
	if (profileNameText) {
		profileNameText.addEventListener('click', () => {
			if (window.currentData && !window.currentData.isCreateMode) {
				vscode.postMessage({ command: 'openFile' });
			}
		});
	}

	// Environment change
	const envSelect = document.getElementById('environment');
	if (envSelect) {
		envSelect.addEventListener('change', (e) => {
			const val = e.target.value;
			const badge = document.getElementById('envBadge');
			if (badge) {
				// Update class to match new CSS naming (e.g., 'badge uat')
				badge.className = `badge ${val}`;
				badge.textContent = val.toUpperCase();

				// Optional: Update border color if we want inline control,
				// but CSS classes .badge.uat handles it now.
			}
		});
	}

	// Deploy button
	const deployBtn = document.getElementById('btnDeploy');
	if (deployBtn) {
		deployBtn.addEventListener('click', () => {
			vscode.postMessage({ command: 'deploy' });
		});
	}

	// View Logs button
	const viewLogsBtn = document.getElementById('btnViewLogs');
	if (viewLogsBtn) {
		viewLogsBtn.addEventListener('click', () => {
			vscode.postMessage({ command: 'viewLogs' });
		});
	}

	// Cancel button
	const cancelBtn = document.getElementById('btnCancel');
	if (cancelBtn) {
		cancelBtn.addEventListener('click', () => {
			// In create mode, cancel means close the panel
			if (window.currentData && window.currentData.isCreateMode) {
				vscode.postMessage({ command: 'close' });
			} else {
				resetForm();
			}
		});
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
		const password = document.getElementById('password').value; // Don't trim password

		let errors = [];
		if (!publishUrl) errors.push('Publish URL is required');
		if (!siteName) errors.push('Site Name is required');
		if (!username) errors.push('Username is required');

		// Require password in create mode
		if (window.currentData && window.currentData.isCreateMode && !password) {
			errors.push('Password is required for new profiles');
		}

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
			password: document.getElementById('password').value || 'KEEP_EXISTING',
			openBrowserOnDeploy: document.getElementById('openBrowserOnDeploy').checked,
			enableStdoutLog: document.getElementById('enableStdoutLog').checked,
			logPath: document.getElementById('logPath').value.trim() || undefined,
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
	document.getElementById('openBrowserOnDeploy').checked = data.openBrowserOnDeploy !== false;
	document.getElementById('enableStdoutLog').checked = data.enableStdoutLog === true;
	document.getElementById('logPath').value = data.logPath || '';
	clearErrors();
};

function clearErrors() {
	const existing = document.querySelector('.error-box');
	if (existing) existing.remove();
}

function showErrors(errors) {
	const errorBox = document.createElement('div');
	errorBox.className = 'error-box';
	errorBox.innerHTML =
		'<strong>⚠️ Validation Errors:</strong><ul>' +
		errors.map((e) => '<li>' + e + '</li>').join('') +
		'</ul>';

	const actionsDiv = document.querySelector('.actions');
	if (actionsDiv) actionsDiv.before(errorBox);
}

function setPlaceholders(placeholders) {
	const ids = ['publishUrl', 'siteName', 'siteUrl', 'username', 'password'];
	ids.forEach((id) => {
		const el = document.getElementById(id);
		if (el && placeholders[id]) {
			el.placeholder = placeholders[id];
		}
	});
}
