export type ObservableKey = string | number | symbol;

export type Observable = {
  [key in ObservableKey]: any;
} & {
  $isObservable: boolean;
  $isSettled: boolean;
  $nextTick: (callback?: () => void) => Promise<void>;
  $notify: (propertyKey: PropertyKey) => void;
  $watch: (
    propertyKey: PropertyKey | PropertyKey[] | Function,
    callback?: Function
  ) => void;
  $track: Function;
  $effect: Function;
};

export const tick: Promise<void> = Promise.resolve();

export const nextTick = (callback?: () => void): Promise<void> => {
  return callback ? tick.then(callback) : tick;
};

export const observable = (object: any): Observable => {
  const $watchers: Record<string, Function[]> = {};
  const $tracking: PropertyKey[][] = [];
  const $cached: Record<PropertyKey, unknown> = {};

  const $notificationQueue: {
    isQueued: boolean;
    _queue: string[];
    queue: (propertyKey: PropertyKey) => void;
    flush: () => void;
  } = {
    isQueued: false,
    _queue: [],
    queue(propertyKey: PropertyKey): void {
      if (!this.isQueued) {
        nextTick(() => this.flush());
        this.isQueued = true;
      }
      this._queue.push(propertyKey.toString());
    },
    flush(): void {
      const queue = [...new Set(this._queue)];
      this._queue = [];
      this.isQueued = false;
      while (queue.length) {
        const propertyKey = queue.shift();
        if (!propertyKey) return;

        $watchers[propertyKey] = ($watchers[propertyKey] || []).filter(
          watcher => {
            return watcher(propertyKey === '*' ? null : propertyKey) !== false;
          }
        );

        if (propertyKey !== '*') {
          $watchers['*'] = ($watchers['*'] || []).filter(watcher => {
            return watcher(propertyKey) !== false;
          });
        }
      }
    },
  };

  const _isObservable = (value: unknown): boolean => {
    return (
      value !== null &&
      typeof value === 'object' &&
      (value as Observable).$isObservable
    );
  };

  const handler: Observable & ProxyHandler<Observable> = {
    $isObservable: true,
    get $isSettled() {
      return $notificationQueue._queue.length === 0;
    },
    $nextTick: nextTick,
    $notify(propertyKey: PropertyKey): void {
      $notificationQueue.queue(propertyKey);
    },
    $watch(
      propertyKey: PropertyKey | PropertyKey[] | Function,
      callback?: Function
    ) {
      if (typeof propertyKey === 'function') {
        callback = propertyKey;
        propertyKey = '*';
      }
      if (Array.isArray(propertyKey)) {
        $watchers['*'] = $watchers['*'] || [];
        $watchers['*'].push((property: PropertyKey) => {
          if ((propertyKey as PropertyKey[]).includes(property)) {
            return (callback as Function)(property);
          }
        });
      } else {
        propertyKey = propertyKey.toString();
        $watchers[propertyKey] = $watchers[propertyKey] || [];
        $watchers[propertyKey].push(callback as Function);
      }
    },
    $track(callback: Function): PropertyKey[] {
      $tracking.push([]);
      callback();
      return [...new Set($tracking.pop())];
    },
    $effect(callback: Function): void {
      let deps = this.$track(() => callback());
      this.$watch((propertyKey: PropertyKey) => {
        if (deps.includes(propertyKey)) {
          this.$nextTick(() => {
            deps = this.$track(() => callback());
          });
        }
      });
    },
    $cache(propertyKey: PropertyKey, callback: Function): unknown {
      const key = propertyKey.toString();
      if ($cached[key]) return $cached[key];
      const deps = this.$track(() => {
        $cached[key] = callback();
      });
      this.$watch(deps, () => {
        delete $cached[key];
        this.$notify(propertyKey);
        return false;
      });
      return $cached[key];
    },
    get(target: object, propertyKey: PropertyKey, receiver: object) {
      if (
        [
          '$isObservable',
          '$isSettled',
          '$nextTick',
          '$notify',
          '$watch',
          '$track',
          '$effect',
        ].includes(propertyKey.toString())
      )
        return this[propertyKey.toString()];

      if ($tracking.length > 0)
        $tracking[$tracking.length - 1].push(propertyKey);

      const descriptor = Reflect.getOwnPropertyDescriptor(target, propertyKey);

      if (descriptor && descriptor.get) {
        return this.$cache(propertyKey, () =>
          Reflect.get(target, propertyKey, receiver)
        );
      }

      let value = Reflect.get(target, propertyKey, receiver);

      if (
        value !== null &&
        typeof value === 'object' &&
        (!descriptor || (descriptor && descriptor.writable)) &&
        !value.$isObservable
      ) {
        value = observable(value);
        value.$watch((property: string | null) => {
          this.$notify(propertyKey);
          if (property) this.$notify(propertyKey.toString() + '.' + property);
        });
        Reflect.set(target, propertyKey, value);
      }

      return value;
    },
    set(target: any, propertyKey: PropertyKey, value: unknown) {
      const result = Reflect.set(target, propertyKey, value);
      if (_isObservable(value)) {
        (value as Observable).$watch((property: string | null) => {
          this.$notify(propertyKey);
          if (property) this.$notify(propertyKey.toString() + '.' + property);
        });
      }
      this.$notify(propertyKey);
      return result;
    },
    defineProperty(
      target: object,
      propertyKey: PropertyKey,
      descriptor: PropertyDescriptor
    ) {
      if (descriptor.value && _isObservable(descriptor.value)) {
        (descriptor.value as Observable).$watch((property: string | null) => {
          this.$notify(propertyKey);
          if (property) this.$notify(propertyKey.toString() + '.' + property);
        });
      }
      this.$notify(propertyKey);
      return Reflect.defineProperty(target, propertyKey, descriptor);
    },
    deleteProperty(target: object, propertyKey: PropertyKey) {
      this.$notify(propertyKey);
      return Reflect.deleteProperty(target, propertyKey);
    },
  };
  return new Proxy<Observable>(object, handler);
};
