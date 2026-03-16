import { state } from './state.js';

const DB_NAME = 'OpenifyDB';

export function initDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 1);
        request.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta');
            if (!db.objectStoreNames.contains('system')) db.createObjectStore('system');
        };
        request.onsuccess = (e) => {
            state.db = e.target.result;
            resolve(state.db);
        };
        request.onerror = () => reject(request.error);
    });
}

export function saveToDB(storeName, key, value) {
    const tx = state.db.transaction(storeName, 'readwrite');
    tx.objectStore(storeName).put(value, key);
}

export function getFromDB(storeName, key) {
    return new Promise((resolve) => {
        const tx = state.db.transaction(storeName, 'readonly');
        const req = tx.objectStore(storeName).get(key);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(null);
    });
}
