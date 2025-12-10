export class Storage {
  static getItem<T>(key: string, defaultValue: T): T {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : defaultValue;
    } catch (e) {
      return defaultValue;
    }
  }

  static setItem(key: string, value: any) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {}
  }

  static removeItem(key: string) {
    try {
      localStorage.removeItem(key);
    } catch (e) {}
  }

  static getRaw(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch (e) {
      return null;
    }
  }

  static setRaw(key: string, value: string) {
    try {
      localStorage.setItem(key, value);
    } catch (e) {}
  }
}
