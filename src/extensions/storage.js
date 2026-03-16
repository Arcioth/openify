const DB_NAME = 'OpenifyExtensionsDB';
const STORE_NAME = 'ext_data';
let extDb = null;

export function initExtensionDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 1);
        request.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME);
            }
        };
        request.onsuccess = (e) => {
            extDb = e.target.result;
            resolve(extDb);
        };
        request.onerror = () => reject(request.error);
    });
}

function nsKey(extensionId, key) {
    return `${extensionId}:${key}`;
}

export function extStorageGet(extensionId, key) {
    return new Promise((resolve) => {
        const tx = extDb.transaction(STORE_NAME, 'readonly');
        const req = tx.objectStore(STORE_NAME).get(nsKey(extensionId, key));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(null);
    });
}

export function extStorageSet(extensionId, key, value) {
    return new Promise((resolve, reject) => {
        const tx = extDb.transaction(STORE_NAME, 'readwrite');
        const req = tx.objectStore(STORE_NAME).put(value, nsKey(extensionId, key));
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
    });
}

export function extStorageRemove(extensionId, key) {
    return new Promise((resolve, reject) => {
        const tx = extDb.transaction(STORE_NAME, 'readwrite');
        const req = tx.objectStore(STORE_NAME).delete(nsKey(extensionId, key));
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
    });
}

export function extStorageGetAll(extensionId) {
    return new Promise((resolve) => {
        const tx = extDb.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.openCursor();
        const result = {};
        const prefix = `${extensionId}:`;
        req.onsuccess = (e) => {
            const cursor = e.target.result;
            if (cursor) {
                if (typeof cursor.key === 'string' && cursor.key.startsWith(prefix)) {
                    result[cursor.key.slice(prefix.length)] = cursor.value;
                }
                cursor.continue();
            } else {
                resolve(result);
            }
        };
        req.onerror = () => resolve({});
    });
}
