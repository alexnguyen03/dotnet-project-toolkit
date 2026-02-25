const vscode = acquireVsCodeApi();

// ═══════════════════════════════════════
// Dirty State Tracking
// ═══════════════════════════════════════

const TRACKED_FIELDS = ['environment', 'publishUrl', 'siteName', 'siteUrl', 'username', 'logPath'];
const TRACKED_CHECKBOXES = ['openBrowserOnDeploy', 'enableStdoutLog'];

/** Snapshot of original values (set when data arrives from extension) */
let originalSnapshot = null;
let dirtyListenersAttached = false;

function captureSnapshot() {
	const s = {};
	TRACKED_FIELDS.forEach((id) => {
		const el = document.getElementById(id);
		if (el) s[id] = el.value;
	});
	TRACKED_CHECKBOXES.forEach((id) => {
		const el = document.getElementById(id);
		if (el) s[id] = el.checked;
	});
	// Password is always considered "clean" unless the user types something
	s.password = '';
	return s;
}

function isDirty() {
	if (!originalSnapshot) return false;
	for (const id of TRACKED_FIELDS) {
		const el = document.getElementById(id);
		if (el && el.value !== originalSnapshot[id]) return true;
	}
	for (const id of TRACKED_CHECKBOXES) {
		const el = document.getElementById(id);
		if (el && el.checked !== originalSnapshot[id]) return true;
	}
	// Any password input counts as dirty
	const pwdEl = document.getElementById('password');
	if (pwdEl && pwdEl.value.length > 0) return true;
	return false;
}

function updateDirtyUI() {
	const dirty = isDirty() || (window.currentData && window.currentData.isCreateMode);
	const dirtyActions = document.getElementById('formDirtyActions');
	if (dirtyActions) dirtyActions.style.display = dirty ? 'flex' : 'none';
}

function attachDirtyListeners() {
	if (dirtyListenersAttached) return;
	dirtyListenersAttached = true;

	TRACKED_FIELDS.forEach((id) => {
		const el = document.getElementById(id);
		if (el) el.addEventListener('input', updateDirtyUI);
		if (el) el.addEventListener('change', updateDirtyUI);
	});
	TRACKED_CHECKBOXES.forEach((id) => {
		const el = document.getElementById(id);
		if (el) el.addEventListener('change', updateDirtyUI);
	});
	const pwdEl = document.getElementById('password');
	if (pwdEl) pwdEl.addEventListener('input', updateDirtyUI);
}

// ═══════════════════════════════════════
// Message handler from extension
// ═══════════════════════════════════════

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

// ═══════════════════════════════════════
// Init — populate form from data
// ═══════════════════════════════════════

function init(data) {
	if (!data) return;
	window.currentData = data;

	// Header text
	const displayProjectName = document.getElementById('displayProjectName');
	if (displayProjectName) displayProjectName.textContent = data.projectName + '.';

	const displayProfileNameText = document.querySelector('#displayProfileName .profile-name-text');
	if (displayProfileNameText) displayProfileNameText.textContent = data.profileFileName;

	// Deploy button env label
	updateDeployLabel(data.environment);

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
	if (openBrowserCheckbox) openBrowserCheckbox.checked = data.openBrowserOnDeploy !== false;

	const enableStdoutLogCheckbox = document.getElementById('enableStdoutLog');
	if (enableStdoutLogCheckbox) enableStdoutLogCheckbox.checked = data.enableStdoutLog === true;

	const logPathInput = document.getElementById('logPath');
	if (logPathInput) logPathInput.value = data.logPath || '';

	// Snapshot AFTER values are set
	originalSnapshot = captureSnapshot();
	attachDirtyListeners();

	// Update mode-specific UI
	const modeHeader = document.getElementById('modeHeader');

	if (data.isCreateMode) {
		if (modeHeader) {
			modeHeader.textContent = 'Create Profile';
			modeHeader.style.color = 'var(--vscode-charts-green)';
		}

		const profileNameText = document.getElementById('displayProfileName');
		if (profileNameText) {
			profileNameText.classList.add('non-clickable');
			profileNameText.title = 'New profile (not saved yet)';
		}

		const deployContainer = document.getElementById('deployBtnContainer');
		if (deployContainer) deployContainer.style.display = 'none';

		setPlaceholders({
			publishUrl: 'e.g. 192.168.10.5 or my-server.com',
			siteName: 'e.g. MyWebSite_Staging',
			siteUrl: 'e.g. https://staging.myapp.com',
			username: 'e.g. deploy_user',
			password: 'Enter server password',
		});

		// Update label
		const label = document.querySelector('#btnSave .btn-save-label');
		if (label) label.textContent = 'Create Profile';

		// Hide delete / clone
		const deleteBtn = document.getElementById('btnDelete');
		if (deleteBtn) deleteBtn.style.display = 'none';
		const cloneBtn = document.getElementById('btnClone');
		if (cloneBtn) cloneBtn.style.display = 'none';
	} else {
		if (modeHeader) {
			modeHeader.textContent = 'Profile Settings';
			modeHeader.style.color = '';
		}

		setPlaceholders({
			publishUrl: '192.168.10.3',
			siteName: 'MY_APP_API_STAGING',
			siteUrl: 'https://example.com',
			username: 'namnh',
			password: 'Leave empty to keep existing',
		});

		const deployContainer = document.getElementById('deployBtnContainer');
		if (deployContainer) deployContainer.style.display = '';

		const deleteBtn = document.getElementById('btnDelete');
		if (deleteBtn) deleteBtn.style.display = '';
		const cloneBtn = document.getElementById('btnClone');
		if (cloneBtn) cloneBtn.style.display = '';

		const profileNameText = document.getElementById('displayProfileName');
		if (profileNameText) {
			profileNameText.classList.remove('non-clickable');
			profileNameText.title = 'Click to open profile file';
		}
	}

	// Deploy status
	const deployBtn = document.getElementById('btnDeploy');
	if (data.isDeploying) {
		if (deployBtn) {
			deployBtn.innerHTML = `<div class="spinner"></div> Deploying...`;
			deployBtn.disabled = true;
		}
		document.querySelectorAll('input, select, button').forEach((el) => (el.disabled = true));
	} else {
		if (deployBtn) {
			restoreDeployButton(data.environment);
			deployBtn.disabled = false;
		}
		document.querySelectorAll('input, select, button').forEach((el) => (el.disabled = false));
	}

	// Update dirty UI (will hide save/reset in edit mode since snapshot == current)
	updateDirtyUI();
	clearErrors();
}

// ═══════════════════════════════════════
// Deploy button helpers
// ═══════════════════════════════════════

const ENV_NAMES = { staging: 'Staging', production: 'Production', dev: 'Dev' };

function updateDeployLabel(env) {
	const deployEnvLabel = document.getElementById('deployEnvLabel');
	if (deployEnvLabel) deployEnvLabel.textContent = ENV_NAMES[env] || env;
}

function restoreDeployButton(env) {
	const deployBtn = document.getElementById('btnDeploy');
	if (!deployBtn) return;
	deployBtn.innerHTML = `<svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg> Deploy to <span id="deployEnvLabel">${ENV_NAMES[env] || env}</span>`;
}

// ═══════════════════════════════════════
// Signal ready
// ═══════════════════════════════════════

vscode.postMessage({ command: 'ready' });

// ═══════════════════════════════════════
// Event listeners
// ═══════════════════════════════════════

document.addEventListener('DOMContentLoaded', () => {
	// Profile name click
	const profileNameText = document.getElementById('displayProfileName');
	if (profileNameText) {
		profileNameText.addEventListener('click', () => {
			if (window.currentData && !window.currentData.isCreateMode) {
				vscode.postMessage({ command: 'openFile' });
			}
		});
	}

	// Environment change → update deploy label
	const envSelect = document.getElementById('environment');
	if (envSelect) {
		envSelect.addEventListener('change', (e) => {
			updateDeployLabel(e.target.value);
		});
	}

	// Deploy button
	const deployBtn = document.getElementById('btnDeploy');
	if (deployBtn) {
		deployBtn.addEventListener('click', () => {
			vscode.postMessage({ command: 'deploy' });
		});
	}

	// View Logs
	const viewLogsBtn = document.getElementById('btnViewLogs');
	if (viewLogsBtn) {
		viewLogsBtn.addEventListener('click', () => {
			vscode.postMessage({ command: 'viewLogs' });
		});
	}

	// Reset button
	const resetBtn = document.getElementById('btnReset');
	if (resetBtn) {
		resetBtn.addEventListener('click', () => {
			resetForm();
			clearErrors();
			updateDirtyUI();
		});
	}

	// Delete button
	const deleteBtn = document.getElementById('btnDelete');
	if (deleteBtn) {
		deleteBtn.addEventListener('click', () => {
			vscode.postMessage({ command: 'delete' });
		});
	}

	// Clone button + modal
	const cloneBtn = document.getElementById('btnClone');
	const cloneModal = document.getElementById('cloneModal');
	const btnCloseModal = document.getElementById('btnCloseModal');
	const btnCancelClone = document.getElementById('btnCancelClone');
	const btnConfirmClone = document.getElementById('btnConfirmClone');
	const envRadios = document.querySelectorAll('input[name="targetEnv"]');

	if (cloneBtn) {
		cloneBtn.addEventListener('click', () => {
			if (window.currentData) {
				const currentEnv = window.currentData.environment;
				envRadios.forEach((radio) => {
					const option = radio.closest('.env-option');
					if (radio.value === currentEnv) {
						option.style.display = 'none';
						radio.checked = false;
					} else {
						option.style.display = 'flex';
					}
				});
			}
			envRadios.forEach((radio) => (radio.checked = false));
			btnConfirmClone.disabled = true;
			cloneModal.classList.add('show');
		});
	}

	const closeModal = () => cloneModal.classList.remove('show');
	if (btnCloseModal) btnCloseModal.addEventListener('click', closeModal);
	if (btnCancelClone) btnCancelClone.addEventListener('click', closeModal);
	if (cloneModal) {
		cloneModal.addEventListener('click', (e) => {
			if (e.target === cloneModal) closeModal();
		});
	}

	envRadios.forEach((radio) => {
		radio.addEventListener('change', () => {
			btnConfirmClone.disabled = !Array.from(envRadios).some((r) => r.checked);
		});
	});

	if (btnConfirmClone) {
		btnConfirmClone.addEventListener('click', () => {
			const selectedEnv = Array.from(envRadios).find((r) => r.checked)?.value;
			if (selectedEnv) {
				vscode.postMessage({ command: 'clone', data: { targetEnvironment: selectedEnv } });
				closeModal();
			}
		});
	}
});

// ═══════════════════════════════════════
// Form submit with validation
// ═══════════════════════════════════════

const form = document.getElementById('profileForm');
if (form) {
	form.addEventListener('submit', (e) => {
		e.preventDefault();

		const publishUrl = document.getElementById('publishUrl').value.trim();
		const siteName = document.getElementById('siteName').value.trim();
		const username = document.getElementById('username').value.trim();
		const password = document.getElementById('password').value;

		const errors = [];
		if (!publishUrl) errors.push('Publish URL is required');
		if (!siteName) errors.push('IIS Site Name is required');
		if (!username) errors.push('Username is required');
		if (window.currentData && window.currentData.isCreateMode && !password) {
			errors.push('Password is required for new profiles');
		}

		clearErrors();
		if (errors.length > 0) {
			showErrors(errors);
			return;
		}

		const submitData = {
			profileName: window.currentData.profileFileName,
			environment: document.getElementById('environment').value,
			publishUrl,
			siteName,
			siteUrl: document.getElementById('siteUrl').value || undefined,
			username,
			password: password || 'KEEP_EXISTING',
			openBrowserOnDeploy: document.getElementById('openBrowserOnDeploy').checked,
			enableStdoutLog: document.getElementById('enableStdoutLog').checked,
			logPath: document.getElementById('logPath').value.trim() || undefined,
		};

		vscode.postMessage({ command: 'save', data: submitData });
	});
}

// ═══════════════════════════════════════
// Helpers
// ═══════════════════════════════════════

function getFormData() {
	if (!window.currentData) return {};
	return {
		profileName: window.currentData.profileFileName,
		environment: document.getElementById('environment').value,
		publishUrl: document.getElementById('publishUrl').value.trim(),
		siteName: document.getElementById('siteName').value.trim(),
		siteUrl: document.getElementById('siteUrl').value || undefined,
		username: document.getElementById('username').value.trim(),
		password: document.getElementById('password').value || 'KEEP_EXISTING',
		openBrowserOnDeploy: document.getElementById('openBrowserOnDeploy').checked,
		enableStdoutLog: document.getElementById('enableStdoutLog').checked,
		logPath: document.getElementById('logPath').value.trim() || undefined,
	};
}

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
	updateDeployLabel(data.environment);
};

function resetForm() {
	window.resetForm();
}

function clearErrors() {
	const errorBox = document.getElementById('formErrors');
	if (errorBox) {
		errorBox.style.display = 'none';
		errorBox.innerHTML = '';
	}
}

function showErrors(errors) {
	const errorBox = document.getElementById('formErrors');
	if (errorBox) {
		errorBox.innerHTML =
			'<strong>⚠️ Please fix the following:</strong><ul>' +
			errors.map((e) => '<li>' + e + '</li>').join('') +
			'</ul>';
		errorBox.style.display = 'block';
	}
}

function setPlaceholders(placeholders) {
	const ids = ['publishUrl', 'siteName', 'siteUrl', 'username', 'password'];
	ids.forEach((id) => {
		const el = document.getElementById(id);
		if (el && placeholders[id]) el.placeholder = placeholders[id];
	});
}
