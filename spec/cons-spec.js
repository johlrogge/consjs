(function(){
  var defmod = function(cons, fn){
    console.log("hello", cons, fn);
  };

  if(typeof defined !== 'undefined'){
      return define(['cons', 'cons/fn'], defmod);
  }
  else if (typeof module !== 'undefined' && module.exports !== 'undefined') {
      module.exports = defmod(require('cons', 'cons/fn'));
  }
  else {
      return defmod(cons, cons.fn);
  }
})();
