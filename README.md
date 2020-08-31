# @fluentkit/observable

A lightweight 2KB (minified), zero dependency* object proxy for reactivity with dependency tracking, watchers, effects and cached object getters.

Watchers and effects are batched, de-duped and called asynchronously using promises for performance.

\* Requires the javascript [Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise) function, and the [Reflect](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Reflect) api.
Internet Explorer is NOT supported.

## Usage

To create a reactive object, import the observable function and provide your initial object as its only argument.

```javascript
import {observable} from '@fluentkit/observable';

const reactiveObj = observe({
    foo: 'bar',
    bazzer: {
        one: 'two',
        three: ['four', 'five', 'six']
    },
    get computedValue() {
        return this.bazzer.one + ',' + this.bazzer.three.join(',');
    }
});
```

### $watch: (PropertyKey | PropertyKey[] | Function, callback?: Function): void

To watch for data changes you can use the watch function:

```javascript
// when you provide just one argument the watcher is called on all changes:
reactiveObj.$watch((propertyName) => {
    // here propertyName equals the (possibly nested) object key that was changed.
});

// or indicate string property to watch:
reactiveObj.$watch('foo', () => {
    // reactiveObj.foo changed.
});

// and finally watch multiple properties with one callback:
reactiveObj.$watch(['foo', 'bazzer.one'], (propertyName) => {
    // propertyName changed.
});
```

### $effect: (callback: () => {}): void

Effect when called first evaluates the supplied callback, tracking any dependencies accessed.
Then when those dependencies change the callback is re-run, re-tracking the dependencies.

```javascript
reactiveObject.$effect(() => {
    console.log('effect called!', 'foo is:', reactiveObj.foo, 'bazzer is:', reactiveObj.bazzer);
});

// >> effect called .....

reactiveObject.bazzer.one = 'three'
// >> effect called .....

reactiveObj.newProperty = 'foobarbazzer'

// >> effect NOT called
```

### $track: (callback: () => {}): string[]

Mainly used internally the `$track` method returns the property keys accessed during the evaluation of its supplied callback.

```javascript
const dependencies = reactivObj.$track(() => {
    const foo = reactiveObj.foo;
    const bazzer = reactiveObj.bazzer;
});

// dependencies = ['foo', 'bazzer'];
```

### $nextTick: (callback?: () => {}): Promise<void>

Allows you to run actions after any watchers and effects have been applied for the current observables modifications.

`$nextTick` returns a promise, so you can provide a `then` callback, or `await $nextTick` in async functions.

```javascript
reactiveObj.foo = 'zab';
// modifications here runs before any watchers/effects on `foo`
await reactiveObj.$nextTick();
// modifications here run AFTER watchers and effects for `foo`
``` 

### $isSettled: boolean

Indicates if all watchers and effects have been run, and no new items have been passed to the queue.

### $isObservable: boolean

Indicates an object is already an observable.

## Computed values

Borrowed from Vue, "computed" values are just native object getters which can be defined upon creation:

```javascript
const obj = observable({
    foo: 'bar',
    get computed() {
        return this.foo.split('').reverse().join('');
    }
});
```

Or added later using `Object.defineProperty`:

```javascript
Object.defineProperty(obj, 'computed', {
    get () {
        return this.foo.split('').reverse().join('');
    }
});
```

Getters or "computed" properties are great for intensive operations.
What's more when accessed their values are cached and returned without re-invoking until one of their dependencies change:

```javascript
const obj = observable({
    foo: 'bar',
    bazzer: 'rezzab',
    get computed() {
        console.log('called');
        return this.foo.split('').reverse().join('');
    }
});

let computed = obj.computed; // === rab
// >> called
computed = obj.computed; // === rab
obj.bazzer = 'bazzer';
computed = obj.computed; // === rab
computed = obj.computed; // === rab
computed = obj.computed; // === rab
// >> NOT called
obj.foo = 'rab';
computed = obj.computed; // === bar
// >> called
computed = obj.computed; // === bar
computed = obj.computed; // === bar
computed = obj.computed; // === bar
// >> NOT called
```


## Nested Observables

Observables can be nested and watched, to watch the whole child object:

```javascript
obj.child = observable({ foo: 'bar' });

obj.$watch('child', () => {
    // child, was reassigned, deleted, or its internal values changed.
});

obj.$watch('child.foo', () => {
    // child.foo, was reassigned, deleted, or its value changed.
});
```
