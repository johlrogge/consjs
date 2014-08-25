(function(){
    var streamsFn = function(consjs, when, _) {
        var hasMore = function(xs) {
            return xs !== consjs.EOF;
        }

        var take = function(xs, count) {
            function takeNext(maybeXS, icnt) {
                return icnt !== 0 ? when(maybeXS).then(
                        function(elem){
                            if(isHead(elem)){
                                return takeNext(consjs.next(elem), icnt);
                            }
                            return {
                                value: consjs.value(elem),
                                next:function(){return takeNext(consjs.next(elem), icnt -1);}
                            }
                        }
                    ) : consjs.EOF;
            };
            
            return {next: function(){return takeNext(xs, count);}};
        }

        var drop = function(xs, count) {
            function dropNext(maybeXS, icnt) {
                return icnt === 0 ? maybeXS : 
                    when(maybeXS).then(function(elem){
                        return dropNext(consjs.next(elem), icnt-1);
                    });
            }
            return {next: function(){return dropNext(seekToValue(xs), count)}};
        }

        var iterate = function(iterator, initial) {
            var iteration = function(current) {
                return when(current).then(
                    function(resolved){
                        return consjs.cons(
                            resolved,
                            function(){
                                return iteration(iterator(resolved))}
                        );
                    },
                function(error){
                    console.log("error ", error);
                });
            }
            return {next: function(){return iteration(initial)}};
        }

        function seekToValue(cons){
            return when(cons).then(
                function(resolved){
                    if(consjs.isEOF(resolved)) {
                        return consjs.EOF;
                    }

                    if(isHead(resolved)) {
                        return seekToValue(consjs.next(resolved));
                    }
                    
                    return resolved;
                });
        }

        function each(cons, callback, eofCallback) {
            return when(seekToValue(cons)).done(
                function(resolved){
                    if (consjs.isEOF(resolved)) {
                        if(eofCallback){
                            return eofCallback();
                        }
                        return consjs.EOF;
                    }

                    
                    callback(consjs.value(resolved));
                    each(consjs.next(resolved), callback, eofCallback);
                });
        }


        function isHead(stream){
            return typeof(stream.value) === 'undefined';
        }

        var flatten = function(stream) {
            function iter(outerStream){
                return when(outerStream).then(function(outervalue) {
                    if(outervalue === consjs.EOF) {
                        return consjs.EOF;
                    }
                    if(isHead(outervalue)){
                        return iter(consjs.next(outervalue));
                    }

                    function iterateInner(value) {
                        return when(value).then(function(element){
                            if(element === consjs.EOF) {
                                return iter(consjs.next(outervalue));
                            }
                            if(isHead(element)){
                                return iterateInner(consjs.next(element));
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
                    return iterateInner(seekToValue( consjs.value(outervalue)));
                });
            }
            return iter(seekToValue(stream));
        }

        function forArray(array){
            if(!_.isArray(array)){
                throw ("Argument is not an array (was "+array+")");
            }
            function iter(arr) {
                if(_.isEmpty(arr)) {
                    return consjs.EOF;
                }
                return when(_.first(arr)).
                    then(function(resolved){
                        return consjs.cons(resolved, 
                                           function(){
                                               return iter(_.rest(arr));
                                           });
                    });
            }
            return {next: function(){return when.resolve(iter(array))}}
        }

        var concat = function()  {
            var args = _(arguments).toArray().value();
            return flatten(forArray(args));
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
            return { next: function(){return iteration(seekToValue(streamin))}};
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
            filter: filter,
            forArray: forArray,
            seekToValue: seekToValue
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
