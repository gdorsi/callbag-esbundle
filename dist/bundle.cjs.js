'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

/**
 * callbag-for-each
 * ----------------
 *
 * Callbag sink that consume both pullable and listenable sources. When called
 * on a pullable source, it will iterate through its data. When called on a
 * listenable source, it will observe its data.
 *
 * `npm install callbag-for-each`
 *
 * Examples
 * --------
 *
 * Consume a pullable source:
 *
 *     const fromIter = require('callbag-from-iter');
 *     const forEach = require('callbag-for-each');
 *
 *     const source = fromIter([10,20,30,40])
 *
 *     forEach(x => console.log(x))(source); // 10
 *                                           // 20
 *                                           // 30
 *                                           // 40
 *
 * Consume a listenable source:
 *
 *     const interval = require('callbag-interval');
 *     const forEach = require('callbag-for-each');
 *
 *     const source = interval(1000);
 *
 *     forEach(x => console.log(x))(source); // 0
 *                                           // 1
 *                                           // 2
 *                                           // 3
 *                                           // ...
 */
const forEach = operation => source => {
  let talkback;
  source(0, (t, d) => {
    if (t === 0) talkback = d;
    if (t === 1) operation(d);
    if (t === 1 || t === 0) talkback(1);
  });
};

function symbolObservablePonyfill(root) {
  var result;
  var Symbol = root.Symbol;

  if (typeof Symbol === 'function') {
    if (Symbol.observable) {
      result = Symbol.observable;
    } else {
      result = Symbol('observable');
      Symbol.observable = result;
    }
  } else {
    result = '@@observable';
  }

  return result;
}

/* global window */
var root;

if (typeof self !== 'undefined') {
  root = self;
} else if (typeof window !== 'undefined') {
  root = window;
} else if (typeof global !== 'undefined') {
  root = global;
} else if (typeof module !== 'undefined') {
  root = module;
} else {
  root = Function('return this')();
}

var result = symbolObservablePonyfill(root);

/**
 * callbag-from-obs
 * --------------
 *
 * Convert an observable (or subscribable) to a callbag listenable source.
 *
 * `npm install callbag-from-obs`
 *
 * Example:
 *
 * Convert an RxJS Observable:
 *
 *     const Rx = require('rxjs');
 *     const fromObs = require('callbag-from-obs');
 *     const observe = require('callbag-observe');
 *
 *     const source = fromObs(Rx.Observable.interval(1000).take(4));
 *
 *     observe(x => console.log(x)(source); // 0
 *                                          // 1
 *                                          // 2
 *                                          // 3
 *
 * Convert anything that has the `.subscribe` method:
 *
 *     const fromObs = require('callbag-from-obs');
 *     const observe = require('callbag-observe');
 *
 *     const subscribable = {
 *       subscribe: (observer) => {
 *         let i = 0;
 *         setInterval(() => observer.next(i++), 1000);
 *       }
 *     };
 *
 *     const source = fromObs(subscribable);
 *
 *     observe(x => console.log(x))(source); // 0
 *                                           // 1
 *                                           // 2
 *                                           // 3
 *                                           // ...
 */
const fromObs = observable => (start, sink) => {
  if (start !== 0) return;
  let dispose;
  sink(0, t => {
    if (t === 2 && dispose) {
      if (dispose.unsubscribe) dispose.unsubscribe();else dispose();
    }
  });
  observable = observable[result] ? observable[result]() : observable;
  dispose = observable.subscribe({
    next: x => sink(1, x),
    error: e => sink(2, e),
    complete: () => sink(2)
  });
};

const fromIter = iter => (start, sink) => {
  if (start !== 0) return;
  const iterator = typeof Symbol !== 'undefined' && iter[Symbol.iterator] ? iter[Symbol.iterator]() : iter;
  let inloop = false;
  let got1 = false;
  let completed = false;
  let res;

  function loop() {
    inloop = true;

    while (got1 && !completed) {
      got1 = false;
      res = iterator.next();

      if (res.done) {
        sink(2);
        break;
      } else sink(1, res.value);
    }

    inloop = false;
  }

  sink(0, t => {
    if (completed) return;

    if (t === 1) {
      got1 = true;
      if (!inloop && !(res && res.done)) loop();
    } else if (t === 2) {
      completed = true;
    }
  });
};

const fromEvent = (node, name) => (start, sink) => {
  if (start !== 0) return;

  const handler = ev => sink(1, ev);

  sink(0, t => {
    if (t === 2) node.removeEventListener(name, handler);
  });
  node.addEventListener(name, handler);
};

const fromPromise = promise => (start, sink) => {
  if (start !== 0) return;
  let ended = false;

  const onfulfilled = val => {
    if (ended) return;
    sink(1, val);
    sink(2);
  };

  const onrejected = err => {
    if (ended) return;
    sink(2, err);
  };

  promise.then(onfulfilled, onrejected);
  sink(0, t => {
    if (t === 2) ended = true;
  });
};

const interval = period => (start, sink) => {
  if (start !== 0) return;
  let i = 0;
  const id = setInterval(() => {
    sink(1, i++);
  }, period);
  sink(0, t => {
    if (t === 2) clearInterval(id);
  });
};

/**
 * callbag-map
 * -----------
 *
 * Callbag operator that applies a transformation on data passing through it.
 * Works on either pullable or listenable sources.
 *
 * `npm install callbag-map`
 *
 * Example:
 *
 *     const fromIter = require('callbag-from-iter');
 *     const iterate = require('callbag-iterate');
 *     const map = require('callbag-map');
 *
 *     const source = map(x => x * 0.1)(fromIter([10,20,30,40]));
 *
 *     iterate(x => console.log(x))(source); // 1
 *                                           // 2
 *                                           // 3
 *                                           // 4
 */
const map = f => source => (start, sink) => {
  if (start !== 0) return;
  source(0, (t, d) => {
    sink(t, t === 1 ? f(d) : d);
  });
};

/**
 * callbag-scan
 * ------------
 *
 * Callbag operator that combines consecutive values from the same source.
 * It's essentially like array `.reduce`, but delivers a new accumulated value
 * for each value from the callbag source. Works on either pullable or
 * listenable sources.
 *
 * `npm install callbag-scan`
 *
 * Example:
 *
 *     const fromIter = require('callbag-from-iter');
 *     const iterate = require('callbag-iterate');
 *     const scan = require('callbag-scan');
 *
 *     const iterSource = fromIter([1,2,3,4,5]);
 *     const scanned = scan((prev, x) => prev + x, 0)(iterSource);
 *
 *     scanned(0, iterate(x => console.log(x))); // 1
 *                                               // 3
 *                                               // 6
 *                                               // 10
 *                                               // 15
 */
function scan(reducer, seed) {
  let hasAcc = arguments.length === 2;
  return source => (start, sink) => {
    if (start !== 0) return;
    let acc = seed;
    source(0, (t, d) => {
      if (t === 1) {
        acc = hasAcc ? reducer(acc, d) : (hasAcc = true, d);
        sink(1, acc);
      } else sink(t, d);
    });
  };
}

const flatten = source => (start, sink) => {
  if (start !== 0) return;

  const exists = x => typeof x !== 'undefined';

  const absent = x => typeof x === 'undefined';

  const noop = () => {};

  let outerEnded = false;
  let outerTalkback;
  let innerTalkback;

  function talkback(t, d) {
    if (t === 1) (innerTalkback || outerTalkback || noop)(1, d);

    if (t === 2) {
      innerTalkback && innerTalkback(2);
      outerTalkback && outerTalkback(2);
    }
  }

  source(0, (T, D) => {
    if (T === 0) {
      outerTalkback = D;
      sink(0, talkback);
    } else if (T === 1) {
      const innerSource = D;
      if (innerTalkback) innerTalkback(2);
      innerSource(0, (t, d) => {
        if (t === 0) {
          innerTalkback = d;
          innerTalkback(1);
        } else if (t === 1) sink(1, d);else if (t === 2 && absent(d)) {
          if (outerEnded) sink(2);else {
            innerTalkback = void 0;
            outerTalkback(1);
          }
        } else if (t === 2 && exists(d)) sink(2, d);
      });
    } else if (T === 2 && absent(D)) {
      if (!innerTalkback) sink(2);else outerEnded = true;
    } else if (T === 2 && exists(D)) sink(2, D);
  });
};

const take = max => source => (start, sink) => {
  if (start !== 0) return;
  let taken = 0;
  let sourceTalkback;

  function talkback(t, d) {
    if (taken < max) sourceTalkback(t, d);
  }

  source(0, (t, d) => {
    if (t === 0) {
      sourceTalkback = d;
      sink(0, talkback);
    } else if (t === 1) {
      if (taken < max) {
        taken++;
        sink(t, d);

        if (taken === max) {
          sink(2);
          sourceTalkback(2);
        }
      }
    } else {
      sink(t, d);
    }
  });
};

const skip = max => source => (start, sink) => {
  if (start !== 0) return;
  let skipped = 0;
  let talkback;
  source(0, (t, d) => {
    if (t === 0) {
      talkback = d;
      sink(t, d);
    } else if (t === 1) {
      if (skipped < max) {
        skipped++;
        talkback(1);
      } else sink(t, d);
    } else {
      sink(t, d);
    }
  });
};

/**
 * callbag-filter
 * --------------
 *
 * Callbag operator that conditionally lets data pass through. Works on either
 * pullable or listenable sources.
 *
 * `npm install callbag-filter`
 *
 * Example:
 *
 *     const fromIter = require('callbag-from-iter');
 *     const iterate = require('callbag-iterate');
 *     const filter = require('callbag-filter');
 *
 *     const source = filter(x => x % 2)(fromIter([1,2,3,4,5]));
 *
 *     iterate(x => console.log(x))(source); // 1
 *                                           // 3
 *                                           // 5
 */
const filter = condition => source => (start, sink) => {
  if (start !== 0) return;
  let talkback;
  source(0, (t, d) => {
    if (t === 0) {
      talkback = d;
      sink(t, d);
    } else if (t === 1) {
      if (condition(d)) sink(t, d);else talkback(1);
    } else sink(t, d);
  });
};

/**
 * callbag-merge
 * -------------
 *
 * Callbag factory that merges data from multiple callbag sources. Works well
 * with listenable sources, and while it may work for some pullable sources,
 * it is only designed for listenable sources.
 *
 * `npm install callbag-merge`
 *
 * Example:
 *
 *     const interval = require('callbag-interval');
 *     const forEach = require('callbag-for-each');
 *     const merge = require('callbag-merge');
 *
 *     const source = merge(interval(100), interval(350));
 *
 *     forEach(x => console.log(x))(source); // 0
 *                                           // 1
 *                                           // 2
 *                                           // 0
 *                                           // 3
 *                                           // 4
 *                                           // 5
 *                                           // ...
 */
function merge(...sources) {
  return (start, sink) => {
    if (start !== 0) return;
    const n = sources.length;
    const sourceTalkbacks = new Array(n);
    let startCount = 0;
    let endCount = 0;

    const talkback = t => {
      if (t === 0) return;

      for (let i = 0; i < n; i++) sourceTalkbacks[i] && sourceTalkbacks[i](t);
    };

    for (let i = 0; i < n; i++) {
      sources[i](0, (t, d) => {
        if (t === 0) {
          sourceTalkbacks[i] = d;
          if (++startCount === 1) sink(0, talkback);
        } else if (t === 2) {
          sourceTalkbacks[i] = void 0;
          if (++endCount === n) sink(2);
        } else sink(t, d);
      });
    }
  };
}

/**
 * callbag-concat
 * --------------
 *
 * Callbag factory that concatenates the data from multiple (2 or more)
 * callbag sources. It starts each source at a time: waits for the previous
 * source to end before starting the next source. Works with both pullable
 * and listenable sources.
 *
 * `npm install callbag-concat`
 *
 * Example:
 *
 *     const fromIter = require('callbag-from-iter');
 *     const iterate = require('callbag-iterate');
 *     const concat = require('callbag-concat');
 *
 *     const source = concat(fromIter([10,20,30]), fromIter(['a','b']));
 *
 *     iterate(x => console.log(x))(source); // 10
 *                                           // 20
 *                                           // 30
 *                                           // a
 *                                           // b
 */
const concat = (...sources) => (start, sink) => {
  if (start !== 0) return;
  const n = sources.length;

  if (n === 0) {
    sink(0, () => {});
    sink(2);
    return;
  }

  let i = 0;
  let sourceTalkback;

  const talkback = (t, d) => {
    if (t === 1 || t === 2) {
      sourceTalkback(t, d);
    }
  };

  (function next() {
    if (i === n) {
      sink(2);
      return;
    }

    sources[i](0, (t, d) => {
      if (t === 0) {
        sourceTalkback = d;
        if (i === 0) sink(0, talkback);else sourceTalkback(1);
      } else if (t === 1) {
        sink(1, d);
      } else if (t === 2) {
        i++;
        next();
      }
    });
  })();
};

/**
 * callbag-combine
 * ---------------
 *
 * Callbag factory that combines the latest data points from multiple (2 or
 * more) callbag sources. It delivers those latest values as an array. Works
 * with both pullable and listenable sources.
 *
 * `npm install callbag-combine`
 *
 * Example:
 *
 *     const interval = require('callbag-interval');
 *     const observe = require('callbag-observe');
 *     const combine = require('callbag-combine');
 *
 *     const source = combine(interval(100), interval(350));
 *
 *     observe(x => console.log(x))(source); // [2,0]
 *                                           // [3,0]
 *                                           // [4,0]
 *                                           // [5,0]
 *                                           // [6,0]
 *                                           // [6,1]
 *                                           // [7,1]
 *                                           // [8,1]
 *                                           // ...
 */
const EMPTY = {};

const combine = (...sources) => (start, sink) => {
  if (start !== 0) return;
  const n = sources.length;

  if (n === 0) {
    sink(0, () => {});
    sink(1, []);
    sink(2);
    return;
  }

  let Ns = n; // start counter

  let Nd = n; // data counter

  let Ne = n; // end counter

  const vals = new Array(n);
  const sourceTalkbacks = new Array(n);

  const talkback = (t, d) => {
    if (t === 0) return;

    for (let i = 0; i < n; i++) sourceTalkbacks[i](t, d);
  };

  sources.forEach((source, i) => {
    vals[i] = EMPTY;
    source(0, (t, d) => {
      if (t === 0) {
        sourceTalkbacks[i] = d;
        if (--Ns === 0) sink(0, talkback);
      } else if (t === 1) {
        const _Nd = !Nd ? 0 : vals[i] === EMPTY ? --Nd : Nd;

        vals[i] = d;

        if (_Nd === 0) {
          const arr = new Array(n);

          for (let j = 0; j < n; ++j) arr[j] = vals[j];

          sink(1, arr);
        }
      } else if (t === 2) {
        if (--Ne === 0) sink(2);
      } else {
        sink(t, d);
      }
    });
  });
};

const share = source => {
  let sinks = [];
  let sourceTalkback;
  return function shared(start, sink) {
    if (start !== 0) return;
    sinks.push(sink);

    const talkback = (t, d) => {
      if (t === 0) return;

      if (t === 2) {
        const i = sinks.indexOf(sink);
        if (i > -1) sinks.splice(i, 1);
        if (!sinks.length) sourceTalkback(2);
      } else {
        sourceTalkback(t, d);
      }
    };

    if (sinks.length === 1) {
      source(0, (t, d) => {
        if (t === 0) {
          sourceTalkback = d;
          sink(0, talkback);
        } else for (let s of sinks.slice(0)) s(t, d);

        if (t === 2) sinks = [];
      });
      return;
    }

    sink(0, talkback);
  };
};

/**
 * callbag-pipe
 * ------------
 *
 * Utility function for plugging callbags together in chain. This utility
 * actually doesn't rely on Callbag specifics, and is basically the same as
 * Ramda's `pipe` or lodash's `flow`. Anyway, this exists just to play nicely
 * with the ecosystem, and to facilitate the import of the function.
 *
 * `npm install callbag-pipe`
 *
 * Example:
 *
 * Create a source with `pipe`, then pass it to a `forEach`:
 *
 *     const interval = require('callbag-interval');
 *     const forEach = require('callbag-for-each');
 *     const combine = require('callbag-combine');
 *     const pipe = require('callbag-pipe');
 *     const take = require('callbag-take');
 *     const map = require('callbag-map');
 *
 *     const source = pipe(
 *       combine(interval(100), interval(350)),
 *       map(([x, y]) => `X${x},Y${y}`),
 *       take(10)
 *     );
 *
 *     forEach(x => console.log(x))(source); // X2,Y0
 *                                           // X3,Y0
 *                                           // X4,Y0
 *                                           // X5,Y0
 *                                           // X6,Y0
 *                                           // X6,Y1
 *                                           // X7,Y1
 *                                           // X8,Y1
 *                                           // X9,Y1
 *                                           // X9,Y2
 *
 *
 * Or use `pipe` to go all the way from source to sink:
 *
 *     const interval = require('callbag-interval');
 *     const forEach = require('callbag-for-each');
 *     const combine = require('callbag-combine');
 *     const pipe = require('callbag-pipe');
 *     const take = require('callbag-take');
 *     const map = require('callbag-map');
 *
 *     pipe(
 *       combine(interval(100), interval(350)),
 *       map(([x, y]) => `X${x},Y${y}`),
 *       take(10),
 *       forEach(x => console.log(x))
 *     );
 *     // X2,Y0
 *     // X3,Y0
 *     // X4,Y0
 *     // X5,Y0
 *     // X6,Y0
 *     // X6,Y1
 *     // X7,Y1
 *     // X8,Y1
 *     // X9,Y1
 *     // X9,Y2
 *
 *
 * Nesting
 * -------
 *
 * To use pipe inside another pipe, you need to give the inner pipe an
 * argument, e.g. `s => pipe(s, ...`:
 *
 *     const interval = require('callbag-interval');
 *     const forEach = require('callbag-for-each');
 *     const combine = require('callbag-combine');
 *     const pipe = require('callbag-pipe');
 *     const take = require('callbag-take');
 *     const map = require('callbag-map');
 *
 *     pipe(
 *       combine(interval(100), interval(350)),
 *       s => pipe(s,
 *         map(([x, y]) => `X${x},Y${y}`),
 *         take(10)
 *       ),
 *       forEach(x => console.log(x))
 *     );
 *
 *
 * This means you can use pipe to create a new operator:
 *
 *     const mapThenTake = (f, amount) =>
 *       s => pipe(s, map(f), take(amount));
 *
 *     pipe(
 *       combine(interval(100), interval(350)),
 *       mapThenTake(([x, y]) => `X${x},Y${y}`, 10),
 *       forEach(x => console.log(x))
 *     );
 *
 */
function pipe(...cbs) {
  let res = cbs[0];

  for (let i = 1, n = cbs.length; i < n; i++) res = cbs[i](res);

  return res;
}

const observe = operation => source => {
  source(0, (t, d) => {
    if (t === 1) operation(d);
  });
};

function of() {
  for (var _len = arguments.length, values = new Array(_len), _key = 0; _key < _len; _key++) {
    values[_key] = arguments[_key];
  }

  return function (start, sink) {
    if (start !== 0) return;
    var disposed = false;
    sink(0, function (type, data) {
      if (type !== 2) return;
      disposed = true;
    });

    for (var _i = 0; _i < values.length; _i++) {
      var value = values[_i];
      if (disposed) break;
      sink(1, value);
    }

    if (!disposed) {
      sink(2);
    }
  };
}

const sample = pullable => listenable => (start, sink) => {
  if (start !== 0) return;
  let ltalkback;
  let ptalkback;
  listenable(0, (lt, ld) => {
    if (lt === 0) {
      ltalkback = ld;
      pullable(0, (pt, pd) => {
        if (pt === 0) ptalkback = pd;
        if (pt === 1) sink(1, pd);

        if (pt === 2) {
          ltalkback(2);
          sink(2);
        }
      });
      sink(0, t => {
        if (t === 2) {
          ltalkback(2);
          ptalkback(2);
        }
      });
    }

    if (lt === 1) ptalkback(1);

    if (lt === 2) {
      ptalkback(2);
      sink(2);
    }
  });
};

function sampleWhen(sampler) {
  return function (listenable) {
    return function (start, sink) {
      if (start !== 0) return;
      var inited = false;
      var value;
      var listenableTalkback;
      var samplerTalkback;
      listenable(0, function (type, data) {
        if (type === 0) {
          listenableTalkback = data;
          sampler(0, function (type, data) {
            if (type === 0) {
              samplerTalkback = data;
              return;
            }

            if (type === 1 && inited) {
              sink(1, value);
              return;
            }

            if (type === 2) {
              listenableTalkback(2);
              sink(2);
              return;
            }
          });
          sink(0, function (end) {
            if (end !== 2) return;
            listenableTalkback(2);
            samplerTalkback(2);
          });
          return;
        }

        if (type === 1) {
          inited = true;
          value = data;
          return;
        }

        if (type === 2) {
          samplerTalkback(2);
          sink(2);
          return;
        }
      });
    };
  };
}

function makeSubject() {
  let sinks = [];
  return (type, data) => {
    if (type === 0) {
      const sink = data;
      sinks.push(sink);
      sink(0, t => {
        if (t === 2) {
          const i = sinks.indexOf(sink);
          if (i > -1) sinks.splice(i, 1);
        }
      });
    } else {
      const zinkz = sinks.slice(0);

      for (let i = 0, n = zinkz.length, sink; i < n; i++) {
        sink = zinkz[i];
        if (sinks.indexOf(sink) > -1) sink(type, data);
      }
    }
  };
}

exports.forEach = forEach;
exports.fromObs = fromObs;
exports.fromIter = fromIter;
exports.fromEvent = fromEvent;
exports.fromPromise = fromPromise;
exports.interval = interval;
exports.map = map;
exports.scan = scan;
exports.flatten = flatten;
exports.take = take;
exports.skip = skip;
exports.filter = filter;
exports.merge = merge;
exports.concat = concat;
exports.combine = combine;
exports.share = share;
exports.pipe = pipe;
exports.observe = observe;
exports.of = of;
exports.sample = sample;
exports.sampleWhen = sampleWhen;
exports.makeSubject = makeSubject;
