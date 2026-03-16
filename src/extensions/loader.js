export async function loadModuleFromSource(source, extensionId) {
    // Wrap source so the extension's init/enable/disable/destroy are accessible
    // Extensions export: { init(api), enable(api), disable(), destroy() }
    const wrappedSource = `
        const __ext = (function() {
            const module = { exports: {} };
            const exports = module.exports;
            ${source}
            return module.exports;
        })();
        export default __ext;
    `;

    const blob = new Blob([wrappedSource], { type: 'application/javascript' });
    const url = URL.createObjectURL(blob);
    try {
        const mod = await import(/* @vite-ignore */ url);
        return mod.default || mod;
    } finally {
        URL.revokeObjectURL(url);
    }
}

export async function loadModuleFromFunction(source) {
    // Fallback: use Function constructor if blob imports fail
    const fn = new Function('module', 'exports', source);
    const module = { exports: {} };
    fn(module, module.exports);
    return module.exports;
}
