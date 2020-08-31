# @fluentkit/observable

A lightweight object proxy for reactivity with dependency tracking, watchers, effects and cached object getters.

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

### $watch

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

### $effect

Effect when called first evaluates the supplied callback, tracking any dependencies accessed.
Then when those dependencies change the callback is re-run, again tracking the dependencies.

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

### $track

@todo

### $nextTick

Allows you to run actions after any watchers and effects have been applied for the current observables modifications.

@todo

### $isSettled

Indicates if all watchers and effects have been run, and no new items have been passed to the queue.

### $isObservable

Indicates an object is already an observable.

## Computed values

@todo
