(function(){
    var fn = function(when, _) {
        var EOF = {
            type:"EOF"
        }

        EOF.next = function(){return when(EOF)};

        var cons = function(head, tail) {
            var tail = tail;
            if (typeof tail === 'function') {
                return {
                    value: head, 
                    next: function(){
                        return when(tail());
                    }
                }
            }

            return {
                value:head, 
                next: function() {
                    return when(tail || EOF);
                }
            }
        };

        var next = function(val){return val.next()};
        var value =  function(val) {return val.value};
        var stream = function() {
            var deferredNext = when.defer();
            var nextValue = deferredNext.promise;
            var push = function(value){
                var old = deferredNext;
                deferredNext = when.defer();
                nextValue = old.promise;
                var result = cons(value, deferredNext.promise);
                return old.resolve(result);
            }

            return {
                push: push,
                close: function() {
                    nextValue = EOF;
                    deferredNext.resolve(EOF);
                },
                read: {
                    next: function(){
                        return nextValue
                    }
                }
            }
        }

        var isCons = function(maybeCons) {
            return maybeCons.value && maybeCons.next ? maybeCons : false;
        }

        return {
            isCons:isCons,
            stream: stream,
            EOF: EOF,
            cons: cons,
            next: next,
            value: value,
            log: function(val) {console.log(val); return val}
        }
    }
    if(typeof define !== 'undefined'){
        return define(['q', 'lodash'], fn);
    }
    else if(typeof module !== 'undefined' && module.exports) {
        module.exports = fn(require('q'), require('lodash'));
    }
    else {
        window.cons = window.cons || {};
        window.cons.fn = fn(Q, _);
    }
})();
