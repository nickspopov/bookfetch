// In-memory stand-in for react-native-mmkv: importing the real module loads Nitro, which needs native code.
export const memory = new Map<string, string>();

export const mmkvMock = {
  createMMKV: () => ({
    getString: (key: string) => memory.get(key),
    set: (key: string, value: string) => void memory.set(key, value),
    remove: (key: string) => memory.delete(key),
  }),
};
