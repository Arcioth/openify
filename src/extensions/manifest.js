const REQUIRED_FIELDS = ['id', 'name', 'version', 'main'];

const VALID_PERMISSIONS = new Set([
    'playback:read',
    'playback:control',
    'events:subscribe',
    'events:emit',
    'ui:sidebar',
    'ui:contextMenu',
    'ui:settingsPanel',
    'ui:playerWidget',
    'library:read',
    'storage',
    'themes:register',
    'network',
]);

export function validateManifest(manifest) {
    const errors = [];

    for (const field of REQUIRED_FIELDS) {
        if (!manifest[field]) errors.push(`Missing required field: "${field}"`);
    }

    if (manifest.id && !/^[\w.-]+$/.test(manifest.id)) {
        errors.push(`Invalid extension id: "${manifest.id}" (use alphanumeric, dots, hyphens, underscores)`);
    }

    if (manifest.permissions) {
        if (!Array.isArray(manifest.permissions)) {
            errors.push('"permissions" must be an array');
        } else {
            for (const perm of manifest.permissions) {
                if (!VALID_PERMISSIONS.has(perm)) errors.push(`Unknown permission: "${perm}"`);
            }
        }
    }

    if (manifest.requires) {
        if (!Array.isArray(manifest.requires)) {
            errors.push('"requires" must be an array of extension IDs');
        } else {
            for (const dep of manifest.requires) {
                if (typeof dep !== 'string' || !/^[\w.-]+$/.test(dep)) {
                    errors.push(`Invalid dependency id: "${dep}"`);
                }
                if (dep === manifest.id) {
                    errors.push('An extension cannot require itself');
                }
            }
        }
    }

    return { valid: errors.length === 0, errors };
}

export { VALID_PERMISSIONS };
