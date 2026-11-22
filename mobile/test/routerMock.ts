type RemoveListener = (event: { data: { action: { type: string } }; preventDefault: () => void }) => void;

const removeListeners = new Set<RemoveListener>();

export function emitBack(event: { data: { action: { type: string } }; preventDefault: () => void }) {
  removeListeners.forEach((listener) => listener(event));
}

export const navigation = {
  addListener: (_name: string, listener: RemoveListener) => {
    removeListeners.add(listener);
    return () => {
      removeListeners.delete(listener);
    };
  },
};

export const router = {
  push: jest.fn(),
  back: jest.fn(),
  replace: jest.fn(),
};

export const params: { id?: string } = { id: 'sunset-social' };
