(function () {
  "use strict";

  var config = {
    apiKey: "AIzaSyAG7SiJpRPyCuNKOnC3MWh3bsxrjF3MkX8",
    authDomain: "meuponto-22c8a.firebaseapp.com",
    databaseURL: "https://meuponto-22c8a.firebaseio.com",
    storageBucket: "meuponto-22c8a.appspot.com",
    messagingSenderId: "453391659544"
  };

  firebase.initializeApp(config);

  function CounterController($scope, $filter, $interval) {
    Date.prototype.today = function () {
      return ((this.getDate() < 10) ? "0" : "") + this.getDate() + "/" + (((this.getMonth() + 1) < 10) ? "0" : "") + (this.getMonth() + 1) + "/" + this.getFullYear();
    }

    Date.prototype.timeNow = function () {
      return ((this.getHours() < 10) ? "0" : "") + this.getHours() + ":" + ((this.getMinutes() < 10) ? "0" : "") + this.getMinutes() + ":" + ((this.getSeconds() < 10) ? "0" : "") + this.getSeconds();
    }

    var vm = this;
    vm.user = null;
    vm.saldo = { total: '', sinal: '' };
    vm.loading = false;

    var dataStorage = JSON.parse(localStorage.getItem("pontoEletronico"));
    if (!dataStorage) {
      var pontoEletronico = { user: { name: '', email: '' } };
      pontoEletronico.user.registros = [];
      pontoEletronico.user.saldo = { total: '', sinal: '' };
      pontoEletronico.user.resumo = { saldo: {} }
      localStorage.setItem("pontoEletronico", JSON.stringify(pontoEletronico));
    } else {
      var pontoEletronico = dataStorage;
      initializeSaldo();
    }

    var date = new Date();
    var today = date.toISOString().match(/\d{4}-\d{2}-\d{2}/).join('-');
    var current = $filter('filter')(pontoEletronico.user.registros, { date: today })[0];

    if (!current || current.length < 1) {
      var registro = {
        date: today,
        pontos: [],
        feriado: false
      };
      current = registro;
      pontoEletronico.user.registros.push(registro);
      localStorage.setItem("pontoEletronico", JSON.stringify(pontoEletronico));
    }

    $scope.current = current;
    $scope.pontos = current.pontos;
    $scope.ponto = '';
    $scope.dataAtual = date;
    $scope.horarioAtual = date.timeNow();
    $scope.pontoEletronico = pontoEletronico;
    $scope.showInputPonto = false;
    $scope.horario_anterior = {};
    $scope.loginForm = { hasError: false, error: {} }

    firebase.auth().onAuthStateChanged(authDataCallback);

    vm.login = function () {
      vm.loading = true;

      firebase.auth().signInWithEmailAndPassword($scope.user.email, $scope.user.password)
        .catch(function (err) {
          if (err) {
            console.error('signInWithEmailAndPasswordERROR', err);

            if (err.code == 'auth/user-not-found') {
              firebase.auth().createUserWithEmailAndPassword($scope.user.email, $scope.user.password)
                .catch(function (err) {
                  if (err) {
                    console.error('createUserWithEmailAndPasswordERROR', err);
                  }
                }).then(function () {
                  vm.loading = false;
                })
            } else {
              $scope.loginForm.hasError = true;
              $scope.loginForm.error = err;
            }
          }
        }).then(function () {
          vm.loading = false;
        });
    };

    vm.logout = function () {
      save();

      firebase.auth().signOut().then(function () {
        // Sign-out successful.
        vm.user = {}
        localStorage.removeItem("pontoEletronico");
        var pontoEletronico = { user: { name: '', email: '' } };
        pontoEletronico.user.registros = [];
        pontoEletronico.user.saldo = { total: '', sinal: '' };
        localStorage.setItem("pontoEletronico", JSON.stringify(pontoEletronico));
      }, function (err) {
        // An error happened.
        console.error(err);
      });
    };

    vm.addPonto = function (arg) {
      if (arg) {
        if (!$scope.horario_anterior[arg.date]) {
          alert('Insira um valor!');
          return false;
        }

        var day = $filter('filter')(pontoEletronico.user.registros, { date: arg.date })[0];
        day.pontos.push(formatPonto(angular.copy($scope.horario_anterior[arg.date])));

        save();

        $scope.horario_anterior[arg.date] = '';
        vm.showInputPonto(arg.date);
      } else {
        if ($scope.ponto.horario) {
          $scope.pontos.push(formatPonto(angular.copy($scope.ponto.horario)));
          $scope.ponto = '';

          save();
        }
      }
    };

    vm.saidaSugerida = function () {
      var horarioAtual = toHMH($scope.horarioAtual);
      var horasTrabalhadas = vm.horasTrabalhadas();


      if (horasTrabalhadas === undefined || horasTrabalhadas == 0)
        return 0

      var jornada = "0h";

      if (!current.hasOwnProperty('feriado') || current.feriado == false) {
        if (date.getDay() != 0 && date.getDay() != 6) {
          jornada = (date.getDay() == 5) ? "8h" : "9h"
        }

        if ($scope.pontos.length == 1) {
          jornada = hmh.sum(jornada + " 1h").toString();
        }

        var horarioDiff = hmh.sub(jornada + " " + horasTrabalhadas);

        if (vm.verificaHoraExtra() > 0) {
          return horarioAtual
        }

        return hmh.sum(horarioAtual + " " + horarioDiff).toString() || 0;
      }

      return horarioAtual;
    };

    vm.horasTrabalhadas = function (p) {
      var pontos = (p) ? p : $scope.pontos;
      var pontosAux = angular.copy(pontos);

      if (pontosAux && pontosAux.length % 2 != 0) {
        pontosAux.push(angular.copy($scope.horarioAtual).match(/\d{2}:\d{2}/).join(':'));
      }

      return calcularHorasTrabalhadas(pontosAux);
    };

    vm.totalHorasTrabalhadas = function (p) {
      var pontos = (p) ? p : $scope.pontos;
      var pontosAux = angular.copy(pontos);
      return calcularHorasTrabalhadas(pontosAux);
    };

    vm.totalHoraExtra = function (r) {
      var registro = r || current;
      if (registro === undefined || !registro.hasOwnProperty('pontos') || registro.pontos.length == 0)
        return 0
      var horasTrabalhadas = vm.horasTrabalhadas(registro.pontos);
      var d = new Date(registro.date.split('-')[0], registro.date.split('-')[1] - 1, registro.date.split('-')[2]);
      var jornada = (d.getDay() == 6 || registro.feriado) ? "0h" : (d.getDay() == 5) ? "8h" : "9h";
      var extra = hmh.diff(jornada, horasTrabalhadas);
      registro.extra = extra.toString();
      return extra.toString() || 0;
    };

    vm.verificaHoraExtra = function (r) {
      var r = r || current;
      if (r === undefined || !r.hasOwnProperty('pontos') || r.pontos.length == 0)
        return 0
      var horasExtra = vm.totalHoraExtra(r);
      var regex = /\-/;
      if (regex.test(horasExtra)) {
        return -1;
      } else if (horasExtra == 0) {
        return 0;
      } else {
        return 1;
      }
    };

    vm.preparaSaldo = function () {
      if (pontoEletronico.user.hasOwnProperty('saldo')) {
        if (!pontoEletronico.user.saldo.total || !pontoEletronico.user.saldo.sinal) {
          return false;
        }

        var sinal = pontoEletronico.user.saldo.sinal == 'N' ? '-' : '';

        return {
          toString: function () { return sinal + toHMH(pontoEletronico.user.saldo.total) },
          isNegative: function () { return pontoEletronico.user.saldo.sinal == 'N' },
          total: pontoEletronico.user.saldo.total
        }
      }
      return false
    }

    vm.bancoDeHorasTotal = function () {
      var registrosCredito = [];
      var registroDebito = [];

      var subtotal = null;
      var total = null;
      var saldo = vm.preparaSaldo();

      var dataBase = today.split('-');
      var mesAtual = parseInt(dataBase[1]);

      angular.forEach(pontoEletronico.user.registros, function (item) {
        if (item.date != today) {
          if (/\-/.test(item.extra)) {
            registroDebito.push(item.extra);
          } else {
            registrosCredito.push(item.extra);
          }
        }
      });

      if (saldo) {
        if (saldo.isNegative()) {
          registroDebito.push(saldo.toString())
        } else {
          registrosCredito.push(saldo.toString())
        }
      }

      var credito = hmh.sum(registrosCredito, 'minutes').toString() || '0h';
      var debito = hmh.sum(registroDebito, 'minutes').toString() || '0h';

      total = hmh.sub(credito + " " + debito);
      let copyTotal = clone(total);

      if (!pontoEletronico.user.hasOwnProperty('resumo')) {
        pontoEletronico.user.resumo = {}
      }

      if (!pontoEletronico.user.resumo.hasOwnProperty('saldo')) {
        pontoEletronico.user.resumo = { saldo: {} }
      }

      delete copyTotal.toString;

      pontoEletronico.user.resumo.saldo = copyTotal;

      firesaveResumo();

      return total
    };

    vm.bancoDeHorasMes = function () {
      var registrosCredito = [];
      var registroDebito = [];

      var dataBase = today.split('-');
      var mesRef = dataBase[2] >= 21 ? parseInt(dataBase[1]) + 1 : parseInt(dataBase[1]);

      var mesMin = (mesRef == 1) ? 12 : (mesRef - 1);
      mesMin = (mesMin < 10) ? "0" + mesMin : mesMin;

      var mesMax = (mesRef < 12) ? (mesRef + 1) : 1;
      mesMax = (mesMax < 10) ? "0" + mesMax : mesMax;

      var dataMin = dataBase[0] + '-' + mesMin + '-21';
      var dataMax = dataBase[0] + '-' + mesRef + '-20';

      angular.forEach(pontoEletronico.user.registros, function (item) {
        if (item.date != today && item.date >= dataMin && item.date <= dataMax) {
          if (/\-/.test(item.extra)) {
            registroDebito.push(item.extra);
          } else {
            registrosCredito.push(item.extra);
          }
        }
      });

      var credito = hmh.sum(registrosCredito, 'minutes').toString() || '0h';
      var debito = hmh.sum(registroDebito, 'minutes').toString() || '0h';

      vm.periodo = {};
      vm.periodo.min = dataMin;
      vm.periodo.max = dataMax;

      return hmh.sub(credito + " " + debito);
    };

    vm.verificaBancoDeHoras = function () {
      return 0;
    };

    vm.showInputPonto = function (arg) {
      $('.input.input-ponto.' + arg)
        .transition('fade right')
        .find('input')
        .focus()
        ;
    };

    vm.showInputPonto = function (arg) {
      $('.input.input-ponto.' + arg)
        .transition('fade right')
        .find('input')
        .focus()
        ;
    };

    vm.marcarComoFeriado = function (r) {
      registro = r || current
      if (typeof registro === 'object') {
        registro.feriado = true;
        save()
      }
    };

    vm.desmarcarComoFeriado = function (r) {
      registro = r || current
      if (typeof registro === 'object') {
        registro.feriado = false;
        save()
      }
    };

    vm.isDescanso = function (r) {
      registro = r || current;
      var d = new Date(registro.date.split('-')[0], registro.date.split('-')[1] - 1, registro.date.split('-')[2]);
      return (d.getDay() == 6) || (d.getDay() == 0);
    };

    vm.modalAdicionarHoras = function () {
      $('[data-modal="adicionar-horas"]').modal({
        blurring: true
      }).modal('show');
    };

    vm.fechaModalAdicionarHoras = function (form) {
      if (form) {
        form.$setPristine();
        form.$setUntouched();
        initializeSaldo();
      }

      $('[data-modal="adicionar-horas"]').modal('hide');
    };

    vm.modalEditarPerfil = function () {
      $('[data-modal="perfil"]').modal({
        blurring: true
      }).modal('show');
    };

    vm.editarPerfil = function () {
      firesave({
        uid: pontoEletronico.user.uid,
        name: pontoEletronico.user.name,
        email: pontoEletronico.user.email
      });

      save();

      $('[data-modal="perfil"]').modal('hide');
    };

    vm.salvarSaldoAnterior = function () {
      if (!vm.saldo.total || !vm.saldo.sinal) {
        return false
      }

      if (!pontoEletronico.user.hasOwnProperty('saldo')) {
        pontoEletronico.user.saldo = { total: '', sinal: '' }
      }

      console.log(vm.saldo.total);

      pontoEletronico.user.saldo.total = formatPonto(angular.copy(vm.saldo.total.replace(/[^\d]/g, '')));
      pontoEletronico.user.saldo.sinal = angular.copy(vm.saldo.sinal);

      save();

      vm.fechaModalAdicionarHoras();
    };

    vm.resetSaldo = function (form) {
      if (pontoEletronico.user.hasOwnProperty('saldo')) {
        delete pontoEletronico.user.saldo
      }

      if (form) {
        form.$setPristine();
        form.$setUntouched();
        initializeSaldo();
      }

      save();

      vm.fechaModalAdicionarHoras();
    };

    $interval(atualizaHorario, 1000);

    function atualizaHorario() {
      return $scope.horarioAtual = new Date().timeNow();
    }

    function calcularHorasTrabalhadas(pontos) {
      var diffs = [];
      for (var i in pontos) {
        if (i % 2 != 0) {
          diffs.push(hmh.diff(toHMH(pontos[i - 1]), toHMH(pontos[i])).toString().replace(/\s+/g, ''));
        }
      }
      return hmh.sum(diffs).toString() || 0;
    }

    function formatPonto(p) {
      return p.charAt(0) + p.charAt(1) + ":" + p.charAt(2) + p.charAt(3);
    }

    function toHMH(p) {
      p = p.match(/\d+/g).join('');
      return p.charAt(0) + p.charAt(1) + "h" + p.charAt(2) + p.charAt(3) + "m";
    }

    function save() {
      localStorage.setItem("pontoEletronico", JSON.stringify(pontoEletronico));
      firesavePonto();
      firesaveSaldo();
      firesaveResumo();
    }

    function firesaveResumo() {
      if (pontoEletronico.user.uid) {
        return firesave('/resumo', pontoEletronico.user.resumo)
      }
    }

    function firesaveSaldo() {
      return firesave('/saldo', pontoEletronico.user.saldo)
    }

    function firesavePonto() {
      return firesave('/registros', pontoEletronico.user.registros)
    }

    function firesave(uri, data) {
      var fireuri = 'users/' + pontoEletronico.user.uid;

      if (typeof uri === "object") {
        data = uri
        uri = null
      }

      if (typeof uri === "string") {
        fireuri += uri
      }

      return firebase.database().ref(fireuri).set(data)
    }

    function initializeSaldo() {
      if (!pontoEletronico.user.hasOwnProperty('saldo')) {
        pontoEletronico.user.saldo = { total: '', sinal: '' };
      }
      vm.saldo.total = pontoEletronico.user.saldo.total;
      vm.saldo.sinal = pontoEletronico.user.saldo.sinal;
    }

    function initializeApp() { }

    function authDataCallback(authData) {
      if (authData) {
        pontoEletronico.user.uid = authData.uid;
        console.log("User " + authData.uid + " is logged in with " + authData.provider);

        if ($('[data-modal="login"]').hasClass('active')) {
          $('[data-modal="login"]').modal('hide');
        }

        firebase.database().ref('users/' + authData.uid).once('value').then(function (snapshot) {
          var snapshoptUser = snapshot.val();
          if (!snapshoptUser) {
            firesave({
              uid: authData.uid,
              name: pontoEletronico.user.name,
              email: authData.email
            })
            firesavePonto();
            firesaveSaldo();
            firesaveResumo();
          } else {
            if (!pontoEletronico.user.name || !pontoEletronico.user.email) {
              pontoEletronico.user.name = snapshoptUser.name;
              pontoEletronico.user.email = snapshoptUser.email;
              pontoEletronico.user.uid = snapshoptUser.uid;
              save()
            }

            if (snapshoptUser.registros && pontoEletronico.user.registros.length < snapshoptUser.registros.length) {
              pontoEletronico.user.registros = snapshoptUser.registros;
              current = $filter('filter')(pontoEletronico.user.registros, { date: today })[0];
              if (!current.hasOwnProperty('pontos')) {
                console.log(current)
                current.pontos = [];
              }

              $scope.current = current;
              $scope.pontos = current.pontos;
              save()
            }

            if (pontoEletronico.user.saldo.total != snapshoptUser.saldo.total) {
              pontoEletronico.user.saldo = snapshoptUser.saldo;
              vm.saldo = pontoEletronico.user.saldo;
              save()
            }
          }
        });

      } else {
        console.log("User is logged out");
        $scope.$apply(function () {
          $('[data-modal="login"]').modal({
            blurring: true,
            keyboardShortcuts: false,
            closable: false
          }).modal('show');
        });
      }
    };

    function clone(obj) {
      if (null == obj || "object" != typeof obj) return obj;
      var copy = obj.constructor();
      for (var attr in obj) {
        if (obj.hasOwnProperty(attr)) copy[attr] = obj[attr];
      }
      return copy;
    }

  };

  CounterController.$inject = ['$scope', '$filter', '$interval'];

  angular.module('myApp', ['ui.mask', 'firebase']).controller('CounterController', CounterController);

})();
