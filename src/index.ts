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
  $watchSync: (
    propertyKey: PropertyKey | PropertyKey[] | Function,
    callback?: Function
  ) => void;
  $track: Function;
  $effect: Function;
};

type QueueCommon = {
  stack: Record<string, Function[]>;
  push: (propertyKey: string, callback: Function) => void;
  callStack: (propertyKey: string) => void;
};

export const tick: Promise<void> = Promise.resolve();

export const nextTick = (callback?: () => void): Promise<void> => {
  return callback ? tick.then(callback) : tick;
};

const _isObservable = (value: unknown): boolean => {
  return (
    value !== null &&
    typeof value === 'object' &&
    (value as Observable).$isObservable
  );
};

const queueCommon = (): QueueCommon => ({
  stack: {},
  push(propertyKey: string, callback: Function): void {
    if (!this.stack[propertyKey]) this.stack[propertyKey] = [];
    this.stack[propertyKey].push(callback);
  },
  callStack(propertyKey: string): void {
    if (this.stack[propertyKey]) {
      this.stack[propertyKey] = this.stack[propertyKey].filter(
        watcher => watcher(propertyKey === '*' ? null : propertyKey) !== false
      );
    }

    if (propertyKey !== '*' && this.stack['*']) {
      this.stack['*'] = this.stack['*'].filter(
        watcher => watcher(propertyKey) !== false
      );
    }
  },
});

export const observable = (object: any): Observable => {
  const $tracking: Set<PropertyKey>[] = [];
  const $cached: Record<PropertyKey, unknown> = {};

  const $watcherQueue: QueueCommon & {
    isQueued: boolean;
    _queue: Set<string>;
    queue: (propertyKey: PropertyKey) => void;
    flush: () => void;
  } = {
    ...queueCommon(),
    isQueued: false,
    _queue: new Set(),
    queue(propertyKey: PropertyKey): void {
      if (!this.isQueued) {
        nextTick(() => this.flush());
        this.isQueued = true;
      }
      this._queue.add(propertyKey.toString());
    },
    flush(): void {
      const queue = [...this._queue.values()];
      this._queue.clear();
      this.isQueued = false;
      while (queue.length) {
        const propertyKey = queue.shift();
        if (!propertyKey) return;
        this.callStack(propertyKey);
      }
    },
  };

  const $watcherSyncQueue: QueueCommon & {
    flush: (propertyKey: PropertyKey) => void;
  } = {
    ...queueCommon(),
    flush(propertyKey: PropertyKey): void {
      this.callStack(propertyKey.toString());
    },
  };

  const handler: Observable & ProxyHandler<Observable> = {
    $isObservable: true,
    get $isSettled() {
      return $watcherQueue._queue.size === 0;
    },
    $nextTick: nextTick,
    $notify(propertyKey: PropertyKey): void {
      $watcherQueue.queue(propertyKey);
      $watcherSyncQueue.flush(propertyKey);
    },
    $watch(
      propertyKey: PropertyKey | PropertyKey[] | Function,
      callback?: Function
    ) {
      if (typeof propertyKey === 'function') {
        callback = propertyKey;
        propertyKey = '*';
      }

      if (Array.isArray(propertyKey) && propertyKey.length === 1)
        propertyKey = propertyKey[0];

      if (Array.isArray(propertyKey)) {
        $watcherQueue.push('*', (property: PropertyKey) => {
          if ((propertyKey as PropertyKey[]).includes(property))
            return (callback as Function)(property);
        });
      } else {
        $watcherQueue.push(propertyKey.toString(), callback as Function);
      }
    },
    $watchSync(
      propertyKey: PropertyKey | PropertyKey[] | Function,
      callback?: Function
    ) {
      if (typeof propertyKey === 'function') {
        callback = propertyKey;
        propertyKey = '*';
      }

      if (Array.isArray(propertyKey) && propertyKey.length === 1)
        propertyKey = propertyKey[0];

      if (Array.isArray(propertyKey)) {
        $watcherSyncQueue.push('*', (property: PropertyKey) => {
          if ((propertyKey as PropertyKey[]).includes(property))
            return (callback as Function)(property);
        });
      } else {
        $watcherSyncQueue.push(propertyKey.toString(), callback as Function);
      }
    },
    $track(callback: Function): PropertyKey[] {
      $tracking.push(new Set<PropertyKey>());
      callback();
      return Array.from($tracking.pop() as Set<PropertyKey>);
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
      if ($cached.hasOwnProperty(key)) return $cached[key];
      const deps = this.$track(() => {
        $cached[key] = callback();
      });
      this.$watchSync(deps, () => {
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
        $tracking[$tracking.length - 1].add(propertyKey);

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
