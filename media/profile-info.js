const vscode = acquireVsCodeApi();

const TRACKED_FIELDS = [
	'profileName',
	'environment',
	'publishUrl',
	'linkedBranch',
	'siteName',
	'siteUrl',
	'username',
	'logPath',
];
const TRACKED_CHECKBOXES = ['openBrowserOnDeploy', 'enableStdoutLog'];
const ENV_NAMES = { staging: 'Staging', production: 'Production', dev: 'Dev' };
const DEFAULT_DEPLOY_METHOD = 'iis';

let originalSnapshot = null;
let dirtyListenersAttached = false;
let activeDeployMethod = DEFAULT_DEPLOY_METHOD;

function byId(id) {
	return document.getElementById(id);
}

function setText(id, value) {
	const el = byId(id);
	if (el) {
		el.textContent = value;
	}
}

function setValue(id, value) {
	const el = byId(id);
	if (el) {
		el.value = value ?? '';
	}
}

function setChecked(id, value) {
	const el = byId(id);
	if (el) {
		el.checked = Boolean(value);
	}
}

function setDisplay(id, visible) {
	const el = byId(id);
	if (el) {
		el.style.display = visible ? '' : 'none';
	}
}

function captureSnapshot() {
	const snapshot = {};

	TRACKED_FIELDS.forEach((id) => {
		const el = byId(id);
		if (el) {
			snapshot[id] = el.value;
		}
	});

	TRACKED_CHECKBOXES.forEach((id) => {
		const el = byId(id);
		if (el) {
			snapshot[id] = el.checked;
		}
	});

	snapshot.password = '';
	return snapshot;
}

function isDirty() {
	if (!originalSnapshot) {
		return false;
	}

	for (const id of TRACKED_FIELDS) {
		const el = byId(id);
		if (el && el.value !== originalSnapshot[id]) {
			return true;
		}
	}

	for (const id of TRACKED_CHECKBOXES) {
		const el = byId(id);
		if (el && el.checked !== originalSnapshot[id]) {
			return true;
		}
	}

	const passwordInput = byId('password');
	if (passwordInput && passwordInput.value.length > 0) {
		return true;
	}

	return false;
}

function updateDirtyUI() {
	if (!isIisMethodActive()) {
		setDisplay('formDirtyActions', false);
		setDisplay('deployBtnContainer', false);
		return;
	}

	const dirty = isDirty() || (window.currentData && window.currentData.isCreateMode);
	setDisplay('formDirtyActions', Boolean(dirty));

	const isCreateMode = Boolean(window.currentData && window.currentData.isCreateMode);
	setDisplay('deployBtnContainer', !dirty && !isCreateMode);
}

function isIisMethodActive() {
	return activeDeployMethod === DEFAULT_DEPLOY_METHOD;
}

function setActiveDeployMethod(method) {
	activeDeployMethod = method || DEFAULT_DEPLOY_METHOD;

	document.querySelectorAll('.deploy-tab').forEach((tab) => {
		const isActive = tab.dataset.method === activeDeployMethod;
		tab.classList.toggle('is-active', isActive);
		tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
	});

	document.querySelectorAll('.deploy-panel').forEach((panel) => {
		const isActive = panel.dataset.methodPanel === activeDeployMethod;
		panel.classList.toggle('is-active', isActive);
	});

	updateModeUI(window.currentData || { isCreateMode: false });
	updateDirtyUI();
}

function attachDirtyListeners() {
	if (dirtyListenersAttached) {
		return;
	}

	dirtyListenersAttached = true;

	TRACKED_FIELDS.forEach((id) => {
		const el = byId(id);
		if (el) {
			el.addEventListener('input', updateDirtyUI);
			el.addEventListener('change', updateDirtyUI);
		}
	});

	TRACKED_CHECKBOXES.forEach((id) => {
		const el = byId(id);
		if (el) {
			el.addEventListener('change', updateDirtyUI);
		}
	});

	const passwordInput = byId('password');
	if (passwordInput) {
		passwordInput.addEventListener('input', updateDirtyUI);
	}
}

function applyMinimalSectionSeparators() {
	const sections = Array.from(document.querySelectorAll('.form-section, .history-section'));
	if (sections.length === 0) {
		return;
	}

	sections.forEach((section) => {
		section.style.border = 'none';
		section.style.borderRadius = '8px';
		section.style.padding = '16px';
		section.style.marginBottom = '10px';
		section.style.background =
			'var(--vscode-editorWidget-background, rgba(127, 127, 127, 0.08))';
	});
}

function setPlaceholders(placeholders) {
	['profileName', 'publishUrl', 'linkedBranch', 'siteName', 'siteUrl', 'username', 'password'].forEach((id) => {
		const el = byId(id);
		if (el && placeholders[id]) {
			el.placeholder = placeholders[id];
		}
	});
}

function updateDeployLabel(environment) {
	setText('deployEnvLabel', ENV_NAMES[environment] || environment);
}

function restoreDeployButton(environment) {
	const deployButton = byId('btnDeploy');
	if (!deployButton) {
		return;
	}

	deployButton.innerHTML =
		'<svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg> Deploy to <span id="deployEnvLabel">' +
		(ENV_NAMES[environment] || environment) +
		'</span>';
}

function updateModeUI(data) {
	const modeHeader = byId('modeHeader');
	const saveLabel = document.querySelector('#btnSave .btn-save-label');
	const isCreateMode = Boolean(data.isCreateMode);

	document.body.classList.toggle('is-create-mode', isCreateMode);
	document.body.classList.toggle('is-edit-mode', !isCreateMode);

	if (modeHeader) {
		modeHeader.textContent = isCreateMode ? 'Create Profile' : 'Profile Settings';
		modeHeader.style.color = isCreateMode ? 'var(--vscode-charts-green)' : '';
	}

	const isIis = isIisMethodActive();
	setDisplay('deployBtnContainer', !isCreateMode && isIis);
	setDisplay('btnDelete', !isCreateMode && isIis);
	setDisplay('cloneGroup', !isCreateMode && isIis);
	setDisplay('btnOpenProfileFile', !isCreateMode && isIis);

	if (saveLabel) {
		saveLabel.textContent = isCreateMode ? 'Create Profile' : 'Save Changes';
	}

	if (isCreateMode) {
		setPlaceholders({
			profileName: 'e.g. MyApi_UAT',
			publishUrl: 'e.g. 192.168.10.5 or my-server.com',
			linkedBranch: 'e.g. main, develop',
			siteName: 'e.g. MyWebSite_Staging',
			siteUrl: 'e.g. https://staging.myapp.com',
			username: 'e.g. deploy_user',
			password: 'Enter server password',
		});
		return;
	}

	setPlaceholders({
		profileName: 'e.g. UAT',
		publishUrl: '192.168.10.3',
		linkedBranch: 'e.g. main',
		siteName: 'MY_APP_API_STAGING',
		siteUrl: 'https://example.com',
		username: 'namnh',
		password: 'Leave empty to keep existing',
	});

	updateCloneMenuOptions();
}

function applyDeployingState(isDeploying, environment) {
	const deployButton = byId('btnDeploy');
	const controls = document.querySelectorAll('input, select, button');

	if (isDeploying) {
		if (deployButton) {
			deployButton.innerHTML = '<div class="spinner"></div> Deploying...';
			deployButton.disabled = true;
		}
		controls.forEach((el) => {
			el.disabled = true;
		});
		return;
	}

	if (deployButton) {
		restoreDeployButton(environment);
		deployButton.disabled = false;
	}

	controls.forEach((el) => {
		el.disabled = false;
	});
}

function init(data) {
	if (!data) {
		return;
	}

	window.currentData = data;
	setText('currentVersion', data.currentVersion || 'v0.0.0');

	setText('displayProjectName', data.projectName);
	setValue('profileName', data.profileFileName || '');

	updateDeployLabel(data.environment);

	setValue('environment', data.environment);
	setValue('publishUrl', data.publishUrl);
	setValue('linkedBranch', data.linkedBranch);
	setValue('siteName', data.siteName);
	setValue('siteUrl', data.siteUrl);
	setValue('username', data.username);
	setChecked('openBrowserOnDeploy', data.openBrowserOnDeploy !== false);
	setChecked('enableStdoutLog', data.enableStdoutLog === true);
	setValue('logPath', data.logPath);

	updateModeUI(data);
	applyDeployingState(Boolean(data.isDeploying), data.environment);

	originalSnapshot = captureSnapshot();
	attachDirtyListeners();
	updateDirtyUI();
	clearErrors();
}

function resetForm() {
	if (!window.currentData) {
		return;
	}

	const data = window.currentData;
	setValue('profileName', data.profileFileName);
	setValue('environment', data.environment);
	setValue('publishUrl', data.publishUrl);
	setValue('linkedBranch', data.linkedBranch);
	setValue('siteName', data.siteName);
	setValue('siteUrl', data.siteUrl);
	setValue('username', data.username);
	setValue('password', '');
	setChecked('openBrowserOnDeploy', data.openBrowserOnDeploy !== false);
	setChecked('enableStdoutLog', data.enableStdoutLog === true);
	setValue('logPath', data.logPath);
	updateDeployLabel(data.environment);
}

function clearErrors() {
	const errorBox = byId('formErrors');
	if (!errorBox) {
		return;
	}

	errorBox.style.display = 'none';
	errorBox.innerHTML = '';
}

function showErrors(errors) {
	const errorBox = byId('formErrors');
	if (!errorBox) {
		return;
	}

	errorBox.innerHTML = '<strong>Please fix the following:</strong><ul>' + errors.map((e) => `<li>${e}</li>`).join('') + '</ul>';
	errorBox.style.display = 'block';
}

function showNotification(message, type) {
	const errorBox = byId('formErrors');
	if (!errorBox) {
		return;
	}

	if (type === 'error') {
		showErrors([message]);
		return;
	}

	errorBox.innerHTML = `<strong>${message}</strong>`;
	errorBox.style.display = 'block';
	errorBox.style.borderColor = 'var(--vscode-inputValidation-infoBorder, var(--vscode-textLink-foreground))';
	errorBox.style.background = 'var(--vscode-inputValidation-infoBackground, var(--vscode-editorWidget-background))';

	window.setTimeout(() => {
		errorBox.style.display = 'none';
	}, 2400);
}

function handleWebviewMessage(event) {
	const message = event.data;
	switch (message.command) {
		case 'updateData':
			init(message.data);
			break;
		case 'updateHistory': {
			const historyContainer = byId('historyContainer');
			if (historyContainer && message.html) {
				historyContainer.innerHTML = message.html;
			}
			break;
		}
		case 'showNotification':
			showNotification(message.message, message.type);
			break;
		default:
			break;
	}
}

function bindFormEvents() {
	const form = byId('profileForm');
	if (!form) {
		return;
	}

	form.addEventListener('submit', (e) => {
		e.preventDefault();

		const profileName = byId('profileName').value.trim();
		const publishUrl = byId('publishUrl').value.trim();
		const siteName = byId('siteName').value.trim();
		const username = byId('username').value.trim();
		const password = byId('password').value;

		const errors = [];
		if (!profileName) {
			errors.push('Profile Name is required');
		}
		if (!publishUrl) {
			errors.push('Publish URL is required');
		}
		if (!siteName) {
			errors.push('IIS Site Name is required');
		}
		if (!username) {
			errors.push('Username is required');
		}
		if (window.currentData && window.currentData.isCreateMode && !password) {
			errors.push('Password is required for new profiles');
		}

		clearErrors();
		if (errors.length > 0) {
			showErrors(errors);
			return;
		}

		vscode.postMessage({
			command: 'save',
			data: {
				profileName,
				environment: byId('environment').value,
				publishUrl,
				linkedBranch: byId('linkedBranch').value.trim() || undefined,
				siteName,
				siteUrl: byId('siteUrl').value || undefined,
				username,
				password: password || 'KEEP_EXISTING',
				openBrowserOnDeploy: byId('openBrowserOnDeploy').checked,
				enableStdoutLog: byId('enableStdoutLog').checked,
				logPath: byId('logPath').value.trim() || undefined,
			},
		});
	});
}

function bindUIEvents() {
	const openProfileFileButton = byId('btnOpenProfileFile');
	if (openProfileFileButton) {
		openProfileFileButton.addEventListener('click', () => {
			if (window.currentData && !window.currentData.isCreateMode) {
				vscode.postMessage({ command: 'openFile' });
			}
		});
	}

	const environment = byId('environment');
	if (environment) {
		environment.addEventListener('change', (event) => {
			updateDeployLabel(event.target.value);
		});
	}

	const deployButton = byId('btnDeploy');
	if (deployButton) {
		deployButton.addEventListener('click', () => {
			vscode.postMessage({ command: 'deploy' });
		});
	}

	const viewLogsButton = byId('btnViewLogs');
	if (viewLogsButton) {
		viewLogsButton.addEventListener('click', () => {
			vscode.postMessage({ command: 'viewLogs' });
		});
	}

	const resetButton = byId('btnReset');
	if (resetButton) {
		resetButton.addEventListener('click', () => {
			resetForm();
			clearErrors();
			updateDirtyUI();
		});
	}

	const deleteButton = byId('btnDelete');
	if (deleteButton) {
		deleteButton.addEventListener('click', () => {
			vscode.postMessage({ command: 'delete' });
		});
	}

	const supportButton = byId('btnSupportMe');
	if (supportButton) {
		supportButton.addEventListener('click', () => {
			vscode.postMessage({ command: 'openSupport' });
		});
	}

	const starProjectButton = byId('btnStarProject');
	if (starProjectButton) {
		starProjectButton.addEventListener('click', () => {
			vscode.postMessage({ command: 'openStar' });
		});
	}

	const reportIssueButton = byId('btnReportIssue');
	if (reportIssueButton) {
		reportIssueButton.addEventListener('click', () => {
			vscode.postMessage({ command: 'openIssue' });
		});
	}

	bindCloneDropdownEvents();
	bindDeployMethodTabs();
}

function bindDeployMethodTabs() {
	const tabs = Array.from(document.querySelectorAll('.deploy-tab'));
	if (tabs.length === 0) {
		return;
	}

	tabs.forEach((tab) => {
		tab.addEventListener('click', () => {
			const method = tab.dataset.method || DEFAULT_DEPLOY_METHOD;
			setActiveDeployMethod(method);
		});
	});
}

function updateCloneMenuOptions() {
	const currentEnvironment = window.currentData?.environment;
	const cloneButton = byId('btnClone');
	const menuItems = Array.from(document.querySelectorAll('#cloneMenu .clone-menu-item'));

	let hasAvailableOption = false;
	menuItems.forEach((item) => {
		const environment = item.dataset.cloneEnv;
		const isCurrent = environment === currentEnvironment;
		item.hidden = isCurrent;
		if (!isCurrent) {
			hasAvailableOption = true;
		}
	});

	if (cloneButton) {
		cloneButton.disabled = !hasAvailableOption;
	}
}

function bindCloneDropdownEvents() {
	const cloneGroup = byId('cloneGroup');
	const cloneButton = byId('btnClone');
	const cloneMenu = byId('cloneMenu');

	if (!cloneGroup || !cloneButton || !cloneMenu) {
		return;
	}

	const closeMenu = () => {
		cloneGroup.classList.remove('open');
		cloneButton.setAttribute('aria-expanded', 'false');
	};

	cloneButton.addEventListener('click', (event) => {
		event.stopPropagation();
		updateCloneMenuOptions();
		const isOpen = cloneGroup.classList.contains('open');
		if (isOpen) {
			closeMenu();
			return;
		}

		cloneGroup.classList.add('open');
		cloneButton.setAttribute('aria-expanded', 'true');
	});

	cloneMenu.addEventListener('click', (event) => {
		const target = event.target.closest('.clone-menu-item');
		if (!target || target.hidden) {
			return;
		}

		const environment = target.dataset.cloneEnv;
		if (!environment) {
			return;
		}

		vscode.postMessage({ command: 'clone', data: { targetEnvironment: environment } });
		closeMenu();
	});

	document.addEventListener('click', (event) => {
		if (!cloneGroup.contains(event.target)) {
			closeMenu();
		}
	});

	document.addEventListener('keydown', (event) => {
		if (event.key === 'Escape') {
			closeMenu();
		}
	});
}

document.addEventListener('DOMContentLoaded', () => {
	bindUIEvents();
	bindFormEvents();
	setActiveDeployMethod(DEFAULT_DEPLOY_METHOD);
	applyMinimalSectionSeparators();
	window.resetForm = resetForm;
});

window.addEventListener('message', handleWebviewMessage);
vscode.postMessage({ command: 'ready' });
