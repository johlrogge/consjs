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
          'take takes n elements' : function(){
              var stream = cons.stream();
              var result = assertStreamIs(                  
                  fn.take(stream.read,3)
                  , [1,2,3]);
              stream.push(1);
              stream.push(2);
              stream.push(3);
              stream.push(4);
              stream.push(5);
              stream.close();
              return result;
          }
      });

      var incStream = fn.iterate(
                  function(last){
                      return last + 1;
                  },
                  0);

      run({
          'iterate builds stream' : function(){
              var stream = incStream;
              return assertStreamIs(
                  fn.take(stream, 5),
                  [0,1,2,3,4]
              );
              
          }
      });

      run({
          'drop drops n elements' : function(){
              var stream = fn.take(incStream, 5);
              return assertStreamIs(                  
                  fn.drop(stream, 2)
                  , [3,4,5]);
          }
      });

      run({
          'filter filters matching elements' : function(){
              var stream = fn.take(incStream, 5);
              return assertStreamIs(                  
                  fn.filter(stream,
                            function(elem){
                                return elem % 2 === 0;
                            })
                  , [0,2,4]);
          }
      });

      run({
          'map creates new stream' : function(){
              var stream = fn.take(incStream, 5);
              function double(value){return value *2; };
              return assertStreamIs(                  
                  fn.map(stream, double)
                  , [0,2,4,6,8]);
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
