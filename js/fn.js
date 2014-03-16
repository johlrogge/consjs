(function(){
    var streamsFn = function(phloem, when, _) {
        var hasMore = function(xs) {
            return xs !== phloem.EOF;
        }

        var take = function(xs, count) {
            function takeNext(maybeXS, icnt) {
                return icnt !== 0 ? when(maybeXS).then(
                        function(elem){
                            return {
                                value: phloem.value(elem),
                                next:function(){return takeNext(phloem.next(elem), icnt -1);}
                            }
                        }
                    ) : phloem.EOF;
            };
            return {next: function(){return takeNext(phloem.next(xs), count);}};
        }

        var drop = function(xs, count) {
            function dropNext(maybeXS, icnt) {
                return icnt === 0 ? maybeXS : 
                    when(maybeXS).then(function(elem){
                        return dropNext(phloem.next(elem), icnt-1);
                    });
            }
            return {next: function(){return dropNext(phloem.next(xs), count)}};
        }

        var iterate = function(iterator, initial) {
            var iteration = function(current) {
                return phloem.cons(current, 
                                   function() {
                                       return when(iteration(iterator(current)));
                                   });
            }
            return {next :function(){return iteration(initial);}};
        }

        var each = function(cons, callback, eofCallback) {
            return when(phloem.next(cons)).done(
                function(val) {
                    if(val !== phloem.EOF) {
                        callback(phloem.value(val));
                        each(val, callback, eofCallback);
                    }
                    else {
                        if(eofCallback){
                            eofCallback();
                        };
                    }
                }
            )
        }

        var flatten = function(stream) {
            function iter(outerStream){
                return when(outerStream).then(function(outervalue) {
                    if(outervalue === phloem.EOF) {
                        return phloem.EOF;
                    }
                    function iterateInner(value) {
                        return when(value).then(function(element){
                            if(element === phloem.EOF) {
                                return iter(phloem.next(value));
                            }
                            return phloem.cons(
                                phloem.value(element), 
                                function(){
                                    if(phloem.next(element) === phloem.EOF) {
                                        return iter(phloem.next(outervalue));
                                    }
                                    return when(iterateInner(phloem.next(element)));
                                });
                        });
                    }
                    return iterateInner(phloem.next( phloem.value(outervalue)));
                });
            }
            return {
                next: function(){
                    return iter(stream.next());
                }
            }

        }

        var concat = function(stream)  {
            var result = phloem.stream();
            var resRO = result.read.next();
            var args = Array.prototype.valueOf.apply(arguments);
            _.each(args, function(element){
                result.push(element);
            });
            result.close();
            return flatten({next:function(){return resRO}});
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
            return { next: function(){return iteration(phloem.next(streamin))}};
        }

        var flatMap = function(stream, fn) {
            var flat = map(stream, fn);
            return flatten(flat);
        }

        var filter = function(next, condition) {
            var passed = phloem.stream();
            var doMatch = condition;
            if((typeof condition) != "function") {
                doMatch = function(val) {
                    var match = condition.exec(val)
                    return match && (match.length > 1 ? match.slice(1) : match[0])
                }
            }

            each(next, 
                 function(val) {
                     var match = doMatch(val)
                     if(match) {
                         passed.push(val) 
                     }
                 },
                 passed.close
                );
            return passed.read;
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
        return define(['cons', 'q', 'lodash'], streamsFn);
    }
    else if (typeof module !== 'undefined' && module.exports) {
        module.exports = streamsFn(require('./cons'), require('q'), require('lodash'));
    }
    else {
        window.cons.fn = streamsFn(window.cons, Q, _);
    }
})();
