(function(){
    var streamsFn = function(phloem, when) {
        var hasMore = function(xs) {
            return xs !== phloem.EOF;
        }

        var take = function(xs, count) {
            return when(xs).then(
                function(val) {
                    return (hasMore(val) && count > 0) ? 
                        phloem.cons(phloem.value(val), take(phloem.next(val), count-1)) : 
                        phloem.EOF;
                });
        }

        var drop = function(xs, count) {
            return when(xs).then(
                function(val) {
                    if (hasMore(val)) {
                        return count > 0 ? 
                            drop(phloem.next(val), count -1) : val;
                    }
                    return phloem.EOF;
                });
        }

        var iterate = function(iterator, initial) {
            var iteration = function(current) {
                return phloem.cons(current, 
                                   function() {
                                       return when(iteration(iterator(current)));
                                   });
            }
            return iteration(iterator(initial));
        }

        var each = function(cons, callback, eofCallback) {
            return when(phloem.next(cons)).done(
                function(val) {
                    if(val !== phloem.EOF) {
                        callback(phloem.value(val));
                        each(val, callback);
                    }
                    else {
                        callback(phloem.EOF);
                        if(eofCallback){
                            eofCallback();
                        };
                    }
                }
            )
        }

        var flatten = function(stream) {
            var result = phloem.stream();
            var res = result.read.next();
            function iter(outer) {
                return when(outer).done(
                    function(val) {
                        if(val !== phloem.EOF) {
                            each(phloem.value(val), function(elem){
                                if(elem !== phloem.EOF) {
                                    result.push(elem);
                                }
                                else {
                                    iter(phloem.next(val));
                                }
                            });
                        }
                        else {
                            result.close();
                        }
                    }
                )
            }
            iter(stream);
            return res;
        }


        var concat = function(stream1, stream2)  {
            var result = phloem.stream();
            var res = result.read.next();
            result.push(stream1);
            result.push(stream2);
            result.close();
            return flatten(res);
        }

        var map = function(streamin, fn) {
            var iteration = function(stream) {
                return when(stream).then(function(resolved) {
                    if(resolved === phloem.EOF) return resolved;
                    return phloem.cons(
                        fn(phloem.value(resolved)), 
                        function() {
                            return iteration(phloem.next(resolved));
                        });
                });
            }
            return iteration(streamin);
        }

        var flatMap = function(stream, fn) {
            var flat = map(stream, fn);
            return flatten(flat);
        }

        var filter = function(next, condition) {
            var passed = stream();
            var rejected = stream();
            var doMatch = condition;
            if((typeof condition) != "function") {
                doMatch = function(val) {
                    var match = condition.exec(val)
                    return match && (match.length > 1 ? match.slice(1) : match[0])
                }
            }

            each(next, function(val) {
                var match = doMatch(val)
                if(match) {
                    passed.push(match) 
                }
                else {
                    rejected.push(val);
                }
            });
            return {
                read: {
                    next: passed.read.next,
                    unmatched: rejected.read.next
                }
            };
        }

        var fold = function(str, fn, initial) {
            var deferred = when.defer();
            var acc = initial;
            each(str, function(value){
                if(value !== phloem.EOF) {
                    acc = fn(acc, value);
                }
                else  {
                    deferred.resolve(acc);
                }
            });
            return deferred.promise;
        }

        return {
            drop: drop,
            take: take,
            iterate: iterate,
            map: map,
            flatMap:flatMap,
            flatten:flatten,
            each: each,
            fold: fold,
            concat:concat,
            filter: filter
        }
     }
    if (typeof define !== 'undefined') {
        return define(['cons', 'q'], streamsFn);
    }
    else if (typeof module !== 'undefined' && module.exports) {
        module.exports = streamsFn(require('./cons'), require('q'));
    }
    else {
        window.cons.fn = streamsFn(window.cons, Q);
    }
})();
