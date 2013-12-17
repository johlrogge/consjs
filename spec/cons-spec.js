(function(){
  
  var defmod = function(q, cons, fn, _){
      var run = function(tests){
          var results = _(tests).pairs().map(function(pair){
              return q(pair[1]()).then(
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
              });
      };
      run({
          'cons is cons' : function(){
              var val = cons.cons('head', 'tail');
              return fn.isCons(val) ? q.resolve(val) : q.reject(val + " is not a cons") },
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
