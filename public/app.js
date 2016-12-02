(function () {
    var concurrentUpdate = angular.module('concurrentUpdate', ['ngSanitize', 'firebase', 'ui.bootstrap', 'ngAnimate']);

    concurrentUpdate.run(function ($rootScope) {
        $rootScope.users = {
            "2772": {
                "userName": "Maria Preethi",
                "userRole": "Physician"
            },
            "3453": {
                "userName": "Sucheta Shukla",
                "userRole": "Nurse"
            },
            "7777": {
                "userName": "Subhash Walunj",
                "userRole": "Physician"
            }
        };

        $rootScope.fromTemplates = {
            "editPatient-53467": {
                "firstName": {},
                "lastName": {},
                "cellNo": {},
                "gender": {}
            }
        }
    });

    concurrentUpdate.controller('EditPatientController', function EditPatientController($rootScope, $scope, $firebase, $sanitize, $sce, $timeout, $firebaseObject, concurrentUpdateFactory) {
        const formId = "editPatient-53467";
        var focusedElementId = "";

        $scope.workingUser = "2772";
        $scope.alertMsg = "Loading form status...";
        $scope.concurrentUpdateFieldsMsg = {};
        $scope.isConcuDataFetched = false;

        $scope.patient = {
            "firstName": "",
            "lastName": "",
            "cellNo": "",
            "gender": ""
        }

        function setConcurrentEditMsg() {
            var workingUsers = concurrentUpdateFactory.getWorkingUsers(formId, $scope.workingUser);
            $scope.alertMsg = "";
            for (var i = 0; i < workingUsers.length; i++) {
                $scope.alertMsg += "<strong>" + $rootScope.users[workingUsers[i]].userName + "</strong>";
                if (i != workingUsers.length - 1) {
                    $scope.alertMsg += ",";
                }
            }

            if ($scope.alertMsg.length) {
                $scope.alertMsg += " editing same patient.";
            }
        }

        function syncConcurrentData() {
            var concFieldObj = {};
            var formTemplateCopy = {};

            //if (!concurrentUpdateFactory.isCurrentUserLogged(formId, $scope.concurrentData, $scope.workingUser)) {
            if (formId in $rootScope.fromTemplates) {
                formTemplateCopy = angular.copy($rootScope.fromTemplates[formId]);
                angular.forEach(formTemplateCopy, function (field, fieldKey) {
                    concFieldObj = {};
                    concFieldObj[$scope.workingUser] = angular.copy($rootScope.users[$scope.workingUser]);
                    concFieldObj[$scope.workingUser]["fieldValue"] = $scope.patient[fieldKey];
                    formTemplateCopy[fieldKey] = concFieldObj;
                });
            }
            //}

            if (formId in $scope.concurrentData) {
                var concurrentDataCopy = angular.copy($scope.concurrentData);
                angular.forEach(concurrentDataCopy[formId], function (formField, fieldKey) {
                    if (fieldKey in formTemplateCopy) {
                        concurrentDataCopy[formId][fieldKey][$scope.workingUser] = formTemplateCopy[fieldKey][$scope.workingUser];
                    }
                });
                $scope.concurrentData = angular.copy(concurrentDataCopy);
            } else {
                $scope.concurrentData[formId] = angular.copy(formTemplateCopy);
            }
        }

        $scope.triggerUserChange = function () {
            $scope.patient = {
                "firstName": "",
                "lastName": "",
                "cellNo": "",
                "gender": ""
            }
            setConcurrentEditMsg();
            syncConcurrentData();
        }

        $scope.checkConcurrentUpdate = function (fieldId, fromView) {
            var workingUsers = concurrentUpdateFactory.getConcurrentUpdateField(formId, fieldId, $scope.workingUser);
            $scope.concurrentUpdateFieldsMsg[fieldId] = {
                "msg": "",
                "show": false
            };

            angular.forEach(workingUsers, function (value, key) {
                $scope.concurrentUpdateFieldsMsg[fieldId].msg += "<strong>" + value.userName + "</strong> saying it - <i>" + value.fieldValue + "</i><br>";
            });

            $timeout(function () {
                $scope.$apply();
            });

            if (fromView) {
                focusedElementId = fieldId;
                $scope.concurrentUpdateFieldsMsg[fieldId]['show'] = true;
            } else {
                if (focusedElementId && focusedElementId == fieldId) {
                    $scope.concurrentUpdateFieldsMsg[fieldId]['show'] = true;
                }
            }
        }

        $scope.updateConcurrentModel = function (fieldId, fieldValue) {
            if (formId in $scope.concurrentData) {
                if (fieldId in $scope.concurrentData[formId]) {
                    if ($scope.workingUser in $scope.concurrentData[formId][fieldId]) {
                        $scope.concurrentData[formId][fieldId][$scope.workingUser].fieldValue = fieldValue;
                    }
                }
            }
            //$scope.checkConcurrentUpdate(fieldId);
        }

        var firebaseRef = concurrentUpdateFactory.getFirebaseRef();
        $firebaseObject(firebaseRef).$loaded().then(function (concurrencyData) {
            concurrentUpdateFactory.setConcurrentUpdateObj(concurrencyData);
            $scope.isConcuDataFetched = true;
            setConcurrentEditMsg();
        }).catch(function (error) {
            console.log(error);
        });

        $firebaseObject(firebaseRef).$bindTo($scope, "concurrentData").then(function () {
            syncConcurrentData();
        });

        $firebaseObject(firebaseRef).$watch(function () {
            //console.log("data changed!");
            formTemplateCopy = angular.copy($rootScope.fromTemplates[formId]);
            angular.forEach(formTemplateCopy, function (field, fieldKey) {
                $scope.checkConcurrentUpdate(fieldKey, false);
            });
        });
    });

    concurrentUpdate.factory('concurrentUpdateFactory', function () {
        var factory = {};

        factory.concurrentUpdateObj = {};

        factory.getFirebaseRef = function () {
            return firebase.database().ref().child("concurrentUpdateData");
        }

        factory.setConcurrentUpdateObj = function (data) {
            factory.concurrentUpdateObj = data;
        }

        factory.isCurrentUserLogged = function (formId, data, currentUserId) {
            var flag = false;
            if (formId in data) {
                angular.forEach(data[formId], function (formField, fieldKey) {
                    angular.forEach(formField, function (user, userKey) {
                        if (userKey == currentUserId) {
                            flag = true;
                            return;
                        }
                    });
                    if (flag == true) return;
                });
            }
            return flag;
        }

        factory.getWorkingUsers = function (formId, currentUserId) {
            var workingUsers = [];
            var user = {};
            if (formId in factory.concurrentUpdateObj) {
                angular.forEach(factory.concurrentUpdateObj[formId], function (formField, fieldKey) {
                    angular.forEach(formField, function (user, userKey) {
                        //angular.forEach(users, function (user, userKey) {
                        if (workingUsers.indexOf(userKey) == -1 && userKey != currentUserId) {
                            workingUsers.push(userKey);
                        }
                        //});
                    });
                });
            }
            return workingUsers;
        }

        factory.getConcurrentUpdateField = function (formId, fieldId, currentUserId) {
            var fieldDetail = {};
            if (formId in factory.concurrentUpdateObj) {
                if (fieldId in factory.concurrentUpdateObj[formId]) {
                    fieldDetail = angular.copy(factory.concurrentUpdateObj[formId][fieldId]);
                    if (currentUserId in fieldDetail) {
                        delete fieldDetail[currentUserId];
                    }
                }
            }
            return fieldDetail;
        }

        return factory;
    });

    var config = {
        apiKey: "AIzaSyCIbIGthu8jK97yn1K0_DCxhG2MTs4bQvA",
        authDomain: "concurrentupdate-poc.firebaseapp.com",
        databaseURL: "https://concurrentupdate-poc.firebaseio.com",
        storageBucket: "concurrentupdate-poc.appspot.com",
        messagingSenderId: "895235900514"
    };
    firebase.initializeApp(config);
})();