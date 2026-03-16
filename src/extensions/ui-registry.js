const sidebarItems = new Map();
const contextMenuItems = new Map();
const settingsPanels = new Map();
const playerWidgets = new Map();

// Replacement tracking: replacedId → { replacedBy, original }
const replacedSidebarItems = new Map();

// --- Sidebar ---

export function registerSidebarItem(extensionId, config) {
    const { id, label, icon, onClick, order, replaces } = config;
    if (!id || !label) throw new Error('Sidebar item requires id and label');

    // Handle replacement: hide the item being replaced
    if (replaces && sidebarItems.has(replaces)) {
        const original = sidebarItems.get(replaces);
        replacedSidebarItems.set(replaces, { replacedBy: id, original });
        sidebarItems.delete(replaces);
        // Remove the replaced item's view section
        const oldView = document.getElementById(`view-ext-${replaces}`);
        if (oldView) oldView.style.display = 'none';
    }

    sidebarItems.set(id, {
        extensionId, label, icon: icon || 'fas fa-puzzle-piece', onClick,
        order: order || 100, replaces: replaces || null,
    });
    renderExtSidebarItems();

    // Create a view section for this extension
    const viewId = `view-ext-${id}`;
    if (!document.getElementById(viewId)) {
        const viewDiv = document.createElement('div');
        viewDiv.id = viewId;
        viewDiv.className = 'view-section';
        viewDiv.style.padding = '40px';
        document.querySelector('.main-content').appendChild(viewDiv);
    }
    return id;
}

export function unregisterSidebarItem(id) {
    const item = sidebarItems.get(id);
    sidebarItems.delete(id);

    // Restore any item this one replaced
    if (item && item.replaces && replacedSidebarItems.has(item.replaces)) {
        const { original } = replacedSidebarItems.get(item.replaces);
        replacedSidebarItems.delete(item.replaces);
        sidebarItems.set(item.replaces, original);
        // Restore the original's view section
        const oldView = document.getElementById(`view-ext-${item.replaces}`);
        if (oldView) oldView.style.display = '';
    }

    renderExtSidebarItems();
    const viewDiv = document.getElementById(`view-ext-${id}`);
    if (viewDiv) viewDiv.remove();
}

function renderExtSidebarItems() {
    // Remove existing extension nav items
    document.querySelectorAll('.nav-item[data-ext]').forEach(el => el.remove());

    const panel = document.querySelector('.sidebar .side-panel');
    if (!panel) return;

    const sorted = [...sidebarItems.entries()].sort((a, b) => a[1].order - b[1].order);
    for (const [id, item] of sorted) {
        const div = document.createElement('div');
        div.className = 'nav-item';
        div.setAttribute('data-ext', id);
        div.innerHTML = `<i class="${item.icon}"></i> ${item.label}`;
        div.onclick = () => {
            // Switch to extension view
            document.querySelectorAll('.view-section').forEach(s => s.classList.remove('active'));
            document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
            div.classList.add('active');
            const viewDiv = document.getElementById(`view-ext-${id}`);
            if (viewDiv) {
                viewDiv.classList.add('active');
                if (item.onClick) item.onClick(viewDiv);
            }
        };
        panel.appendChild(div);
    }
}

// --- Context Menu ---

export function registerContextMenuItem(extensionId, config) {
    const { id, label, icon, onClick, shouldShow } = config;
    if (!id || !label) throw new Error('Context menu item requires id and label');

    contextMenuItems.set(id, { extensionId, label, icon: icon || 'fas fa-puzzle-piece', onClick, shouldShow });

    // Create the DOM element
    const ctxMenu = document.getElementById('ctx');
    const itemDiv = document.createElement('div');
    itemDiv.className = 'ctx-item';
    itemDiv.id = `cx-ext-${id}`;
    itemDiv.style.display = 'none';
    itemDiv.innerHTML = `<i class="${icon || 'fas fa-puzzle-piece'}"></i> ${label}`;
    itemDiv.onclick = () => {
        if (onClick) onClick();
    };
    ctxMenu.appendChild(itemDiv);
    return id;
}

export function unregisterContextMenuItem(id) {
    contextMenuItems.delete(id);
    const el = document.getElementById(`cx-ext-${id}`);
    if (el) el.remove();
}

export function showExtensionContextMenuItems(song) {
    for (const [id, item] of contextMenuItems) {
        const el = document.getElementById(`cx-ext-${id}`);
        if (!el) continue;
        const show = item.shouldShow ? item.shouldShow(song) : true;
        el.style.display = show ? 'flex' : 'none';
    }
}

export function hideExtensionContextMenuItems() {
    for (const [id] of contextMenuItems) {
        const el = document.getElementById(`cx-ext-${id}`);
        if (el) el.style.display = 'none';
    }
}

// --- Settings Panels ---

export function registerSettingsPanel(extensionId, config) {
    const { id, label, render } = config;
    if (!id || !label || !render) throw new Error('Settings panel requires id, label, and render');

    settingsPanels.set(id, { extensionId, label, render });
    renderExtSettingsPanels();
    return id;
}

export function unregisterSettingsPanel(id) {
    settingsPanels.delete(id);
    renderExtSettingsPanels();
}

function renderExtSettingsPanels() {
    const container = document.getElementById('ext-settings-panels');
    if (!container) return;
    container.innerHTML = '';
    for (const [id, panel] of settingsPanels) {
        const section = document.createElement('div');
        section.className = 'ext-settings-panel';
        section.innerHTML = `<label style="display:block; font-weight:700; color:var(--text-sub); font-size:12px; text-transform:uppercase; margin-bottom:10px">${panel.label}</label>`;
        const content = document.createElement('div');
        section.appendChild(content);
        container.appendChild(section);
        try { panel.render(content); } catch (e) { console.error(`Extension settings panel "${id}" render error:`, e); }
    }
}

// --- Player Widgets ---

export function registerPlayerWidget(extensionId, config) {
    const { id, render } = config;
    if (!id || !render) throw new Error('Player widget requires id and render');

    playerWidgets.set(id, { extensionId, render });

    const tools = document.querySelector('.p-tools');
    if (tools) {
        const container = document.createElement('div');
        container.className = 'ext-player-widget';
        container.id = `ext-pw-${id}`;
        tools.insertBefore(container, tools.firstChild);
        try { render(container); } catch (e) { console.error(`Extension player widget "${id}" render error:`, e); }
    }
    return id;
}

export function unregisterPlayerWidget(id) {
    playerWidgets.delete(id);
    const el = document.getElementById(`ext-pw-${id}`);
    if (el) el.remove();
}

// --- Bulk cleanup ---

export function removeAllForExtension(extensionId) {
    for (const [id, item] of sidebarItems) {
        if (item.extensionId === extensionId) unregisterSidebarItem(id);
    }
    for (const [id, item] of contextMenuItems) {
        if (item.extensionId === extensionId) unregisterContextMenuItem(id);
    }
    for (const [id, item] of settingsPanels) {
        if (item.extensionId === extensionId) unregisterSettingsPanel(id);
    }
    for (const [id, item] of playerWidgets) {
        if (item.extensionId === extensionId) unregisterPlayerWidget(id);
    }
}
