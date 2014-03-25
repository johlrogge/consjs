(function(){
    var streamsFn = function(consjs, when, _) {
        var hasMore = function(xs) {
            return xs !== consjs.EOF;
        }

        var take = function(xs, count) {
            function takeNext(maybeXS, icnt) {
                return icnt !== 0 ? when(maybeXS).then(
                        function(elem){
                            return {
                                value: consjs.value(elem),
                                next:function(){return takeNext(consjs.next(elem), icnt -1);}
                            }
                        }
                    ) : consjs.EOF;
            };
            return {next: function(){return takeNext(consjs.next(xs), count);}};
        }

        var drop = function(xs, count) {
            function dropNext(maybeXS, icnt) {
                return icnt === 0 ? maybeXS : 
                    when(maybeXS).then(function(elem){
                        return dropNext(consjs.next(elem), icnt-1);
                    });
            }
            return {next: function(){return dropNext(consjs.next(xs), count)}};
        }

        var iterate = function(iterator, initial) {
            var iteration = function(current) {
                return consjs.cons(current, 
                                   function() {
                                       return when(iteration(iterator(current)));
                                   });
            }
            return {next :function(){return iteration(initial);}};
        }

        var each = function(cons, callback, eofCallback) {
            return when(consjs.next(cons)).done(
                function(val) {
                    if(val !== consjs.EOF) {
                        callback(consjs.value(val));
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
                    if(outervalue === consjs.EOF) {
                        return consjs.EOF;
                    }
                    function iterateInner(value) {
                        return when(value).then(function(element){
                            if(element === consjs.EOF) {
                                return iter(consjs.next(outervalue));
                            }
                            return consjs.cons(
                                consjs.value(element), 
                                function(){
                                    if(consjs.next(element) === consjs.EOF) {
                                        return iter(consjs.next(outervalue));
                                    }
                                    return when(iterateInner(consjs.next(element)));
                                });
                        });
                    }
                    return iterateInner(consjs.next( consjs.value(outervalue)));
                });
            }
            return {
                next: function(){
                    return iter(stream.next());
                }
            }

        }

        var concat = function(stream)  {
            var result = consjs.stream();
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
                    if(resolved === consjs.EOF) return resolved;
                    return consjs.cons(
                        fn(consjs.value(resolved)), 
                        function() {
                            return iteration(consjs.next(resolved));
                        });
                });
            }
            return { next: function(){return iteration(consjs.next(streamin))}};
        }

        var flatMap = function(stream, fn) {
            return flatten(map(stream, fn));
        }

        var filter = function(next, condition) {
            var passed = consjs.stream();
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
            each(str, 
                 function(value){
                     acc = fn(acc, value);
                 },
                 function(){
                     deferred.resolve(acc);
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
