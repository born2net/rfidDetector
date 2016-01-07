#!/usr/bin/node

// ssh -L 8585:192.168.65.131:8585 root@192.168.65.131
// alias bl='balance -df 8585 127.0.0.1:5858 > /tmp/balance.out 2>&1 &'

var exec = require('child_process').exec;
var Rx = require('rxjs');

var child = exec('java -jar rfid-movement-detection-0.1-SNAPSHOT.jar');

var database = {};
var minDistanceMoved = 14;
var inputLiveTags;

var tags = [
    '000000000000001362006243',
    '000000000000000013781212'
];

// build db
for (var i in tags) {
    var tag = tags[i];
    database[tag] = {
        id: tag,
        totalSeen: 0,
        newDistance: 0,
        oldDistance: 0
    }
}

var source1 = Rx.Observable.create(function (observer) {
    child.stdout.on('data', function (stdout) {
        var re = 'rssi\ (.*)(, epc)(.*), count\ ([0-9A-Za-z]+)';
        var match = stdout.match(new RegExp(re));
        if (match == null)
            return;
        var data = {
            distance: match[1] * -1,
            tag: match[3],
            count: match[4]
        };
        observer.next(data);
    });
    child.stderr.on('data', function (data) {
        console.log('stdout: ' + data);
    });
    child.on('close', function (code) {
        console.log('closing code: ' + code);
    });

}).throttleTime(5000).map(data=> {
    // ignore unknown tags
    var tag = data.tag.trim();
    if (!database[tag]) {
        console.log('ignoring unknown tag ' + tag);
        return null;
    }

    database[tag].oldDistance = database[tag].newDistance;
    database[tag].newDistance = data.distance;
    database[tag].totalSeen = database[tag].totalSeen + 1;

    return database[tag];
});

var source22 = Rx.Observable.interval(100).map(e=> {
    return Rx.Observable.create(function (observer) {
        for (var tag in database) {
            observer.next(database[tag]);
        }
    });
});

var source2 = source22.flatMap(e=> {
    return e
})


var source3 = Rx.Observable.merge(source1, source2);

var subscription = source3.subscribe(
    function (x) {
        console.log(x);
    },
    function (err) {
        console.log('Error: ' + err);
    },
    function () {
        console.log('Completed');
    });


/*
 outputLiveTags.throttleTime(5).map(data=> {
 console.log('AAAAAAAAAAAAAAAAAAAAAAAAAAA')
 // ignore unknown tags
 var tag = data.tag.trim();
 //if (!database[tag]) {
 //    //console.log('ignoring unknown tag ' + tag);
 //    return null;
 //}

 database[tag].oldDistance = database[tag].newDistance;
 database[tag].newDistance = data.distance;
 database[tag].totalSeen = database[tag].totalSeen + 1;

 return database[tag];

 })

 var final = Rx.Observable.merge(outputAllTags, outputLiveTags);

 final.subscribe(e=> {
 console.log(`Final ${JSON.stringify(e)}`);

 //var newDistance = Math.abs(data.distance)
 //var oldDistance = Math.abs(database[tag].distance)
 //var differenceInDistance = Math.abs(newDistance - oldDistance);
 //if (oldDistance != 0 &&
 //    differenceInDistance > minDistanceMoved) {
 //    console.log(`Sample id moved ' ${tag} old: ${oldDistance} new: ${newDistance}`);
 //}

 });

 child.stdout.on('data', function (data) {
 var re = 'rssi\ (.*)(, epc)(.*), count\ ([0-9A-Za-z]+)';
 var match = data.match(new RegExp(re));
 if (match == null)
 return;
 var data = {
 distance: match[1] * -1,
 tag: match[3],
 count: match[4]
 };
 if (!inputLiveTags)
 return;
 inputLiveTags.next(data);

 //console.log('stdout: ' + data);
 });
 child.stderr.on('data', function (data) {
 console.log('stdout: ' + data);
 });
 child.on('close', function (code) {
 console.log('closing code: ' + code);
 });
 */