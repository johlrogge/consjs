(function(){
    var streams = function(when, _) {
        var EOF = {
            type:"EOF"
        }

        EOF.next = function(){return when.reject("EOF")};
        function isEOF(cons){
            return cons && cons.type === "EOF";
        };

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

        var next = function(val){
            return when(val).then(function(resolved){
                if(!resolved.next) {
                    console.log(resolved, " does not have a next");
                }
                return resolved.next();
            })
        };

        var value = function(val) {return val.value};
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
            return maybeCons && maybeCons.next ? maybeCons : false;
        }

        return {
            isCons:isCons,
            stream: stream,
            isEOF:isEOF,
            EOF: EOF,
            cons: cons,
            next: next,
            value: value,
            log: function(val) {console.log(val); return val}
        }
    }
    if(typeof define !== 'undefined'){
        return define(['q', 'lodash'], streams);
    }
    else if(typeof module !== 'undefined' && module.exports) {
        module.exports = streams(require('q'), require('lodash'));
    }
    else {
        window.cons = streams(Q, _);
    }
})();
