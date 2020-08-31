import { observable } from '../src';

describe('reactivity/computed', () => {
  it('should return updated value', () => {
    const obj = observable({
      get computed(): number {
        return this.foo;
      },
    });
    expect(obj.computed).toBe(undefined);
    obj.foo = 1;
    expect(obj.computed).toBe(1);
  });

  it('should compute lazily', () => {
    const obj = observable({});
    const getter = jest.fn(() => obj.foo);
    Object.defineProperty(obj, 'computed', {
      get(): number {
        return getter();
      },
    });

    // lazy
    expect(getter).not.toHaveBeenCalled();

    expect(obj.computed).toBe(undefined);
    expect(getter).toHaveBeenCalledTimes(1);

    // should not compute again
    obj.computed;
    expect(getter).toHaveBeenCalledTimes(1);

    // should not compute until needed
    obj.foo = 1;
    expect(getter).toHaveBeenCalledTimes(1);

    // now it should compute
    expect(obj.computed).toBe(1);
    expect(getter).toHaveBeenCalledTimes(2);

    // should not compute again
    obj.computed;
    expect(getter).toHaveBeenCalledTimes(2);
  });

  it('should trigger effect', async () => {
    const obj = observable({
      get computed(): number {
        return this.foo;
      },
    });
    let dummy;
    obj.$effect(() => {
      dummy = obj.computed;
    });
    expect(dummy).toBe(undefined);
    obj.foo = 1;
    await obj.$nextTick();
    await obj.$nextTick();
    expect(dummy).toBe(1);
  });

  it('should work when chained', () => {
    const obj = observable({
      foo: 0,
      get c1() {
        return this.foo;
      },
      get c2() {
        return this.c1 + 1;
      },
    });
    expect(obj.c2).toBe(1);
    expect(obj.c1).toBe(0);
    obj.foo++;
    expect(obj.c2).toBe(2);
    expect(obj.c1).toBe(1);
  });
});
