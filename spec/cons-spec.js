(function(){
  
  var defmod = function(q, cons, fn, _){

      function tbd() {
          return q.reject("To be defined");
      };

      function nrun(tests){
          console.log("ignore: ", tests);
      };

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

      function assertEqual(actual, expected){
          var deferred = q.defer();
          return q.when(actual).then(
          function(v){
              if(expected === v) {
                  return q.resolve(v);
              }
              else {
                  return q.reject(v);
              }
          });
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

      var incStream = function() {
          return fn.iterate(
              function(last){
                  return last + 1;
              },
              0);
      };

      run({
          'iterate builds stream' : function(){
              var stream = incStream();
              return assertStreamIs(
                  fn.take(stream, 5),
                  [0,1,2,3,4]
              );
              
          }
      });

      run({
          'drop drops n elements' : function(){
              var stream = fn.take(incStream(), 5);
              return assertStreamIs(                  
                  fn.drop(stream, 2)
                  , [2,3,4]);
          }
      });

      run({
          'filter filters matching elements' : function(){
              var stream = fn.take(incStream(), 5);
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
              var stream = fn.take(incStream(), 5);
              function double(value){return value *2; };
              return assertStreamIs(                  
                  fn.map(stream, double)
                  , [0,2,4,6,8]);
          }
      });

      run({
       'EOF stream flattens to EOF': function() {
              return assertStreamIs(
                  fn.flatten(cons.EOF),
                  []
              )
          },
       'stream with one stream flattens to one stream' : function() {
              var stream = fn.take(
                  fn.iterate(
                      function(){
                          var res = fn.take(incStream(), 5);
                          return res;
                      },
                      fn.take(incStream(), 5)), 1);

              return assertStreamIs(
                  fn.flatten(stream),
                  [0,1,2,3,4]
              )
          },
          'stream with two streams flattens to one stream' : function() {
              var stream = fn.take(
                  fn.iterate(
                      function(){
                          var res = fn.take(incStream(), 5);
                          return res;
                      },
                      fn.take(incStream(), 5)), 2);

              return assertStreamIs(
                  fn.flatten(stream),
                  [0,1,2,3,4,0,1,2,3,4]
              )
          }


      });
      run({
          'concat one stream is identical stream' : function() {
              var stream = fn.take(incStream(), 5);
              return assertStreamIs(
                  fn.concat(stream),
                  [0,1,2,3,4]
              )
          },
          'concat two streams makes one stream with elements from both' : function() {
              var stream1, stream2;
              stream1 = fn.take(incStream(), 5);
              stream2 = fn.take(incStream(), 6);
              return assertStreamIs(
                  fn.concat(stream1, stream2),
                  [0,1,2,3,4,0,1,2,3,4,5]
              )
          }
      })

      run({
          'flatmap can remove elements' : function() {
              var stream = fn.take(incStream(), 5);
              var res = fn.flatMap(stream, function(elem){
                      return elem % 2 === 0 ? cons.EOF : {next: function(){return cons.cons(elem, cons.EOF)}};
                  });
              return assertStreamIs(
                  res,
                  [1,3]
              )
          },
          'flatmap can add elements' : function() {
              var stream = fn.take(incStream(), 5);
              var res = fn.flatMap(stream, function(elem){
                      return {next: function(){return cons.cons(elem, cons.cons(elem, cons.EOF))}};
                  });
              return assertStreamIs(
                  res,
                  [0,0,1,1,2,2,3,3,4,4]
              )
          }
      });
      run({
          'fold can aggregate a stream of numbers' : function() {
              var stream = fn.take(fn.drop(incStream(), 1),5);
              var res = fn.fold(stream, function(acc, elem){
                      return acc + elem;
                  }, 0);
              return assertEqual(
                  res,
                  1+2+3+4+5
              )
          }
      });
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
