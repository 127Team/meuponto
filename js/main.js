
var myApp = angular.module('myApp',['ui.mask']);

  myApp.controller('CounterController', ['$scope', '$filter', '$interval', function($scope, $filter, $interval) {

		Date.prototype.today = function () {
	    return ((this.getDate() < 10)?"0":"") + this.getDate() +"/"+(((this.getMonth()+1) < 10)?"0":"") + (this.getMonth()+1) +"/"+ this.getFullYear();
		}

		Date.prototype.timeNow = function () {
	    return ((this.getHours() < 10)?"0":"") + this.getHours() +":"+ ((this.getMinutes() < 10)?"0":"") + this.getMinutes() +":"+ ((this.getSeconds() < 10)?"0":"") + this.getSeconds();
		}

    var dataStorage = JSON.parse(localStorage.getItem("pontoEletronico"));
    if (!dataStorage) {
        var pontoEletronico = {user: {}};
        pontoEletronico.user.name = prompt("Informe o seu nome:");
        pontoEletronico.user.email = prompt("Informe o seu email:");
        pontoEletronico.user.registros = [];
        localStorage.setItem("pontoEletronico", JSON.stringify(pontoEletronico));
    } else {
      var pontoEletronico = dataStorage;
    }

		var date = new Date();
    var today = date.toISOString().match(/\d{4}-\d{2}-\d{2}/).join('-');
    var current = $filter('filter')(pontoEletronico.user.registros, {date: today})[0];

    if (!current || current.length < 1) {
      var registro = {
        date: today,
        pontos: []
      };
      current = registro;
      pontoEletronico.user.registros.push(registro);
      localStorage.setItem("pontoEletronico", JSON.stringify(pontoEletronico));
    }

    $scope.ponto = '';
    $scope.pontos = current.pontos;
    $scope.dataAtual = date;
		$scope.horarioAtual = date.timeNow();
    $scope.pontoEletronico = pontoEletronico;
    
    $scope.addPonto = function () {
      if ($scope.ponto) {
        $scope.pontos.push(formatPonto(angular.copy($scope.ponto)));
        $scope.ponto = '';
        localStorage.setItem("pontoEletronico", JSON.stringify(pontoEletronico));
      }
    };

    $scope.horasTrabalhadas = function () {
      var diffs = [];
			var pontosAux = angular.copy($scope.pontos);

			if (pontosAux.length % 2 != 0) {
				pontosAux.push(angular.copy($scope.horarioAtual).match(/\d{2}:\d{2}/).join(':'));
			}

      for (i in pontosAux) {
        if (i % 2 != 0) {
          diffs.push(hmh.diff(toHMH(pontosAux[i-1]), toHMH(pontosAux[i])).toString().replace(/\s+/g, ''));
        }
      }

      return hmh.sum(diffs).toString() || 0;
    };

		$interval(function () {
			$scope.horarioAtual = new Date().timeNow();
		}, 1000);

    function formatPonto (p) {
      return p.charAt(0) + p.charAt(1) + ":" + p.charAt(2) + p.charAt(3);
    }

    function toHMH (p) {
      p = p.match(/\d+/g).join('');
      return p.charAt(0) + p.charAt(1) + "h" + p.charAt(2) + p.charAt(3) + "m";
    }

  }]);
