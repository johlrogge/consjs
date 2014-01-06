(function(){
  
  var defmod = function(q, cons, fn, _){
      var run = function(tests){
          var results = _(tests).pairs().map(function(pair){
              return q(q.timeout(pair[1](), 1000)).then(
                  function(passed) {
                      return Q.resolve({name: pair[0], result: passed});
                  },
                  function(error){
                      return Q.reject({name: pair[0], result: error});
                  });

          }).valueOf();
          q.all(results).then(
              function(rs){
                  _.each(rs, function(result){
                      console.log(result.name, " ", result.result);
                  });
              },
              function(error){
                  console.log("Error: ", error);
              }
          ).done();
      };

      function assertStreamIs(stream, expected){
          var deferred = q.defer();
          var elements = [];
          fn.each(stream, 
                  function(elem){
                      elements = elements.concat([elem]);
                  },
                  function(){
                      if(!(elements < expected  || elements > expected)) {
                          deferred.resolve(elements);
                      }
                      else {
                          deferred.reject(elements + " is not equal to "+expected);
                      }
                  }
                 );
          return deferred.promise;
      };

      run({
          'cons is cons' : function(){
              var val = cons.cons('head', 'tail');
              return cons.isCons(val) ? q.resolve(val) : q.reject(val + " is not a cons") },
          'next on stream returns first element' : function() {
              var stream = cons.stream();
              var next = stream.read.next();
              stream.push("first");
              return q.all([
                  next.then(function(val){return cons.isCons(val) ? q.resolve(val) : q.reject(val)}),
                  next.then(function(val){return cons.value(val) === "first" ? q.resolve(cons.value(val)) : q.reject(cons.value(val))})
              ]);
          }
      });

      run({
          'each sends closed event on EOF' : function(){
              var stream = cons.stream();
              var deferred = q.defer();
              fn.each(stream.read, function(elem){
              }, function(){
                  deferred.resolve("closed")})
              stream.close();
              return deferred.promise;
          },
          'each iterates through all elements' : function() {
              var stream = cons.stream();
              var result = assertStreamIs(stream.read, [1,2,3]);
              stream.push(1);
              stream.push(2);
              stream.push(3);
              stream.close();
              return result;
          }
      });

      run({
          'drop drops n elements' : function(){
              var stream = cons.stream();
              var result = assertStreamIs(                  
                  fn.drop(stream.read,2)
                  , [3,4,5]);
              stream.push(1);
              stream.push(2);
              stream.push(3);
              stream.push(4);
              stream.push(5);
              stream.close();
              return result;
          }
      });


      run({
          'filter filters matching elements' : function(){
              var stream = cons.stream();
              var result = assertStreamIs(                  
                  fn.filter(stream.read,
                            function(elem){
                                return elem % 2 === 0;
                            })
                  , [2,4]);
              stream.push(1);
              stream.push(2);
              stream.push(3);
              stream.push(4);
              stream.push(5);
              stream.close();
              return result;
          }
      })
  };

  if(typeof defined !== 'undefined'){
      return define(['q', 'cons', 'cons/fn', 'lodash'], defmod);
  }
  else if (typeof module !== 'undefined' && module.exports !== 'undefined') {
      module.exports = defmod(require('q'), require('cons'), require('cons/fn'), require('lodash'));
  }
  else {
      return defmod(Q, cons, cons.fn, _);
  }
})();
