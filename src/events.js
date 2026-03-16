class EventBus {
    constructor() {
        this.listeners = {};
    }
    on(event, fn) {
        (this.listeners[event] ||= []).push(fn);
    }
    off(event, fn) {
        this.listeners[event] = (this.listeners[event] || []).filter(f => f !== fn);
    }
    emit(event, ...args) {
        (this.listeners[event] || []).forEach(fn => fn(...args));
    }
}

export const events = new EventBus();
