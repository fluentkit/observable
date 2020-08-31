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
});
