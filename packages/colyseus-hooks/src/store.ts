export function store<T>(value: T) {
  let state = value;

  const subscribers = new Set<() => void>();

  const get = () => state;
  const set = (value: T) => {
    state = value;
    subscribers.forEach((callback) => callback());
  };
  const subscribe = (callback: () => void) => {
    subscribers.add(callback);
    return () => subscribers.delete(callback);
  };

  return { get, set, subscribe };
}
